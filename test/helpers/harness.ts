import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createServer } from '../../src/server.js';

/** An in-process client connected to the server, plus its teardown. */
export interface Harness {
  client: Client;
  close: () => Promise<void>;
}

/**
 * Connects a real `Client` to `createServer` in-process through
 * `createMcpHandler`: no port, no socket, same handler as production HTTP,
 * negotiating the newest protocol revision (2026-07-28).
 */
export async function startHarness(): Promise<Harness> {
  const handler = createMcpHandler(createServer);
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
    close: async () => {
      await client.close();
      await handler.close();
    },
  };
}
