import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterEach, describe, expect, it } from 'vitest';
import { SERVER_NAME } from '../src/server.js';

// Requires `npm run build` (run automatically by `pretest`).
const entry = fileURLToPath(new URL('../dist/index.js', import.meta.url));

describe('stdio entry point', () => {
  let client: Client | undefined;

  afterEach(async () => {
    await client?.close();
  });

  it('completes the handshake over stdio with a clean stdout', async () => {
    client = new Client({ name: 'e2e', version: '1.0.0' });
    await client.connect(
      new StdioClientTransport({ command: process.execPath, args: [entry], stderr: 'ignore' }),
    );
    expect(client.getServerVersion()?.name).toBe(SERVER_NAME);
  });
});
