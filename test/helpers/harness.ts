import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  Client,
  type ClientCapabilities,
  type ElicitRequest,
  type ElicitResult,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import { createMcpHandler, InMemoryTransport, type McpServer } from '@modelcontextprotocol/server';
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
  /** Whether deletion is enabled (default false; also needs writes). */
  deleteEnabled?: boolean;
  /** Client capabilities, e.g. `{ elicitation: { form: {} } }`. */
  capabilities?: ClientCapabilities;
  /** Answers the server's elicitations; the client declares form elicitation when given. */
  onElicit?: (request: ElicitRequest['params']) => ElicitResult | Promise<ElicitResult>;
  /** Protocol era to negotiate (default the newest, 2026-07-28). */
  era?: 'modern' | 'legacy';
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
 * Serves `factory` through `createMcpHandler` (no port, no socket, same
 * handler as production HTTP) and connects `client` to it, negotiating the
 * newest revision (2026-07-28). Returns the server teardown.
 */
async function connectModern(
  client: Client,
  factory: () => McpServer,
): Promise<() => Promise<void>> {
  const handler = createMcpHandler(factory);
  await client.connect(
    new StreamableHTTPClientTransport(new URL('http://test.local/mcp'), {
      fetch: (url, init) => handler.fetch(new Request(url, init)),
    }),
  );
  return () => handler.close();
}

/**
 * Connects `client` to one server over an in-memory session, like
 * `serveStdio` does per connection, so 2025-11-25 server→client requests
 * (the SDK's legacy shim for elicitation) work. Returns the server teardown.
 */
async function connectLegacy(
  client: Client,
  factory: () => McpServer,
): Promise<() => Promise<void>> {
  const server = factory();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return () => server.close();
}

/**
 * Connects a real `Client` to `createServer` in-process, on the newest
 * protocol revision by default (`era: 'legacy'` for 2025-11-25). Writes go
 * to a temporary working store, never to the fixture.
 */
export async function startHarness(options: HarnessOptions = {}): Promise<Harness> {
  const dir = await tempDir();
  const storePath = join(dir, 'tickets.local.json');
  const { writeEnabled = false, deleteEnabled = false, clock, onElicit, era = 'modern' } = options;
  const repository = options.incidents
    ? new IncidentRepository(options.incidents, { storePath, writeEnabled, deleteEnabled, clock })
    : await IncidentRepository.open({
        fixturePath: FIXTURE_PATH,
        storePath,
        writeEnabled,
        deleteEnabled,
        clock,
      });
  const docsDirectory = options.docsDirectory ?? configFromEnvironment({}).docsDirectory;
  const factory = () => createServer({ repository, docsDirectory });
  const client = new Client(
    { name: 'test-harness', version: '1.0.0' },
    {
      capabilities: options.capabilities ?? (onElicit ? { elicitation: { form: {} } } : {}),
      versionNegotiation: { mode: era === 'modern' ? 'auto' : 'legacy' },
    },
  );
  if (onElicit) {
    client.setRequestHandler('elicitation/create', (request) => onElicit(request.params));
  }
  const closeServer =
    era === 'modern' ? await connectModern(client, factory) : await connectLegacy(client, factory);
  return {
    client,
    repository,
    docsDirectory,
    storePath,
    close: async () => {
      await client.close();
      await closeServer();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
