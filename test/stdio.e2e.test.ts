import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterEach, describe, expect, it } from 'vitest';
import { SERVER_NAME } from '../src/server.js';
import { tempDir } from './helpers/harness.js';

// Requires `npm run build` (run automatically by `pretest`).
const entry = fileURLToPath(new URL('../dist/index.js', import.meta.url));

describe('stdio entry point', () => {
  let client: Client | undefined;
  let dir: string | undefined;

  afterEach(async () => {
    await client?.close();
    if (dir) await rm(dir, { recursive: true, force: true });
    client = dir = undefined;
  });

  it('completes the handshake over stdio with a clean stdout', async () => {
    client = new Client({ name: 'e2e', version: '1.0.0' });
    await client.connect(
      new StdioClientTransport({ command: process.execPath, args: [entry], stderr: 'ignore' }),
    );
    expect(client.getServerVersion()?.name).toBe(SERVER_NAME);
  });

  it.each(['auto', 'legacy'] as const)(
    'asks the user to confirm a deletion through elicitation (%s negotiation)',
    async (mode) => {
      dir = await tempDir();
      client = new Client(
        { name: 'e2e', version: '1.0.0' },
        { capabilities: { elicitation: { form: {} } }, versionNegotiation: { mode } },
      );
      const messages: string[] = [];
      client.setRequestHandler('elicitation/create', (request) => {
        messages.push(request.params.message);
        return { action: 'accept', content: { confirmar: true } };
      });
      await client.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: [entry],
          stderr: 'ignore',
          env: {
            MESA_INCIDENCIAS_STORE: join(dir, 'tickets.local.json'),
            MESA_INCIDENCIAS_WRITE_ENABLED: '1',
            MESA_INCIDENCIAS_DELETE_ENABLED: '1',
          },
        }),
      );
      const result = await client.callTool({
        name: 'eliminar_incidencia',
        arguments: { id: 'INC-103', confirm: true, reason: 'Prueba e2e' },
      });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({ deleted: { id: 'INC-103' } });
      expect(messages).toEqual([expect.stringContaining('Vas a borrar definitivamente INC-103')]);
    },
  );
});
