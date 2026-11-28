import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { configFromEnvironment } from '../../src/config.js';
import type { Incident } from '../../src/domain/incident.js';
import { createServer } from '../../src/server.js';
import { IncidentRepository } from '../../src/store/incident-repository.js';

/** An in-process client connected to the server, plus its teardown. */
export interface Harness {
  client: Client;
  repository: IncidentRepository;
  docsDirectory: string;
  /** Temporary working store; removed on close. */
  storePath: string;
  close: () => Promise<void>;
}

/** Options for {@link startHarness}. */
export interface HarnessOptions {
  /** Incidents to serve; defaults to the fixture `data/tickets.json`. */
  incidents?: Incident[];
  /** Process documents folder; defaults to the project's `docs/`. */
  docsDirectory?: string;
  /** Whether writes are enabled (default false). */
  writeEnabled?: boolean;
  /** Fixed clock for creation dates. */
  clock?: () => Date;
}

/** Read-only fixture `data/tickets.json`. */
export const FIXTURE_PATH = configFromEnvironment({}).dataPath;

/** Loads the read-only fixture `data/tickets.json`. */
export function loadFixture(): Promise<IncidentRepository> {
  return IncidentRepository.load(FIXTURE_PATH);
}

/** Creates a temporary directory; remove it with `rm(dir, { recursive: true })`. */
export function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'mesa-'));
}

/**
 * Connects a real `Client` to `createServer` in-process through
 * `createMcpHandler`: no port, no socket, same handler as production HTTP,
 * negotiating the newest protocol revision (2026-07-28). Writes go to a
 * temporary working store, never to the fixture.
 */
export async function startHarness(options: HarnessOptions = {}): Promise<Harness> {
  const dir = await tempDir();
  const storePath = join(dir, 'tickets.local.json');
  const { writeEnabled = false, clock } = options;
  const repository = options.incidents
    ? new IncidentRepository(options.incidents, { storePath, writeEnabled, clock })
    : await IncidentRepository.open({ fixturePath: FIXTURE_PATH, storePath, writeEnabled, clock });
  const docsDirectory = options.docsDirectory ?? configFromEnvironment({}).docsDirectory;
  const handler = createMcpHandler(() => createServer({ repository, docsDirectory }));
  const transport = new StreamableHTTPClientTransport(new URL('http://test.local/mcp'), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });
  const client = new Client(
    { name: 'test-harness', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  await client.connect(transport);
  return {
    client,
    repository,
    docsDirectory,
    storePath,
    close: async () => {
      await client.close();
      await handler.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
