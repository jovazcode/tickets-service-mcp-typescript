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
  close: () => Promise<void>;
}

/** Options for {@link startHarness}. */
export interface HarnessOptions {
  /** Incidents to serve; defaults to the fixture `data/tickets.json`. */
  incidents?: Incident[];
  /** Process documents folder; defaults to the project's `docs/`. */
  docsDirectory?: string;
}

/** Loads the read-only fixture `data/tickets.json`. */
export function loadFixture(): Promise<IncidentRepository> {
  return IncidentRepository.load(configFromEnvironment({}).dataPath);
}

/**
 * Connects a real `Client` to `createServer` in-process through
 * `createMcpHandler`: no port, no socket, same handler as production HTTP,
 * negotiating the newest protocol revision (2026-07-28).
 */
export async function startHarness(options: HarnessOptions = {}): Promise<Harness> {
  const repository = options.incidents
    ? new IncidentRepository(options.incidents)
    : await loadFixture();
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
    close: async () => {
      await client.close();
      await handler.close();
    },
  };
}
