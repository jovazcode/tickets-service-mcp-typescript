import { readFile } from 'node:fs/promises';
import type { ElicitRequest, ElicitResult } from '@modelcontextprotocol/client';
import { CLIENT_CAPABILITIES_META_KEY } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DELETE_INCIDENT,
  requestClientCapabilities,
  supportsFormElicitation,
} from '../../src/mcp/tools/delete-incident.js';
import { type Harness, type HarnessOptions, startHarness } from '../helpers/harness.js';

const args = { id: 'INC-103', confirm: true, reason: '  Duplicada de INC-101 ' };

describe(DELETE_INCIDENT, () => {
  let harness: Harness;

  const start = async (options: HarnessOptions = {}) => {
    harness = await startHarness({ writeEnabled: true, deleteEnabled: true, ...options });
  };

  afterEach(async () => {
    await harness.close();
  });

  const call = (a: Record<string, unknown> = args) =>
    harness.client.callTool({ name: DELETE_INCIDENT, arguments: a });

  const errorText = async (a?: Record<string, unknown>) => {
    const result = await call(a);
    expect(result.isError).toBe(true);
    return JSON.stringify(result.content);
  };

  const expectDeleted = async (result: Awaited<ReturnType<typeof call>>) => {
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      deleted: { id: 'INC-103', status: 'resuelta' },
      reason: 'Duplicada de INC-101',
    });
    expect(() => harness.repository.getById('INC-103')).toThrow(/NOT_FOUND/);
    const store = JSON.parse(await readFile(harness.storePath, 'utf8'));
    expect(store.incidents.map(({ id }: { id: string }) => id)).toEqual([
      'INC-101',
      'INC-102',
      'INC-104',
    ]);
    expect(store.nextId).toBe(105);
  };

  it('is listed as a destructive, idempotent write tool', async () => {
    await start();
    const { tools } = await harness.client.listTools();
    expect(tools.find(({ name }) => name === DELETE_INCIDENT)).toMatchObject({
      title: 'Eliminar incidencia',
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      inputSchema: { required: ['id', 'confirm', 'reason'] },
      outputSchema: { required: ['deleted', 'reason'] },
    });
  });

  it('deletes with confirm: true when the client has no elicitation', async () => {
    await start();
    await expectDeleted(await call());
  });

  describe.each(['modern', 'legacy'] as const)('with form elicitation (%s era)', (era) => {
    const startAnswering = (answer: ElicitResult) => {
      const onElicit = vi.fn((_request: ElicitRequest['params']) => answer);
      return start({ era, onElicit }).then(() => onElicit);
    };

    it('asks the user and deletes when they confirm', async () => {
      const onElicit = await startAnswering({ action: 'accept', content: { confirmar: true } });
      await expectDeleted(await call());
      expect(onElicit).toHaveBeenCalledOnce();
      expect(onElicit.mock.calls[0]?.[0]).toMatchObject({
        message: expect.stringContaining(
          'Vas a borrar definitivamente INC-103 «No se pueden guardar incidencias»',
        ),
        requestedSchema: {
          type: 'object',
          properties: { confirmar: { type: 'boolean', title: 'Borrar definitivamente' } },
        },
      });
      expect(onElicit.mock.calls[0]?.[0]).toMatchObject({
        message: expect.stringContaining('Motivo: Duplicada de INC-101.'),
      });
    });

    it.each([
      { action: 'decline' },
      { action: 'accept', content: { confirmar: false } },
      { action: 'accept', content: {} },
      { action: 'accept', content: { confirmar: 'sí' } },
    ] as ElicitResult[])('answers DELETE_DECLINED for %o', async (answer) => {
      await startAnswering(answer);
      expect(await errorText()).toContain('DELETE_DECLINED: El usuario ha rechazado el borrado');
      expect(harness.repository.getById('INC-103')).toBeDefined();
    });

    it('answers DELETE_CANCELLED when the user closes the form', async () => {
      await startAnswering({ action: 'cancel' });
      expect(await errorText()).toContain('DELETE_CANCELLED');
      expect(harness.repository.getById('INC-103')).toBeDefined();
    });

    it('does not ask when the call is invalid', async () => {
      const onElicit = await startAnswering({ action: 'accept', content: { confirmar: true } });
      expect(await errorText({ ...args, id: 'INC-999' })).toContain('NOT_FOUND');
      expect(onElicit).not.toHaveBeenCalled();
    });
  });

  it('requires confirm: true', async () => {
    await start();
    expect(await errorText({ ...args, confirm: false })).toContain('CONFIRMATION_REQUIRED');
  });

  it('answers DELETE_DISABLED when only writes are enabled', async () => {
    await start({ deleteEnabled: false });
    expect(await errorText()).toContain(
      'DELETE_DISABLED: El borrado está desactivado. Arranca el servidor con ' +
        'MESA_INCIDENCIAS_DELETE_ENABLED=1',
    );
  });

  it('answers WRITE_DISABLED in read-only mode, even with deletion enabled', async () => {
    await start({ writeEnabled: false });
    expect(await errorText()).toContain('WRITE_DISABLED');
  });
});

describe('supportsFormElicitation', () => {
  it.each([
    [undefined, false],
    [{}, false],
    [{ elicitation: {} }, true],
    [{ elicitation: { form: {} } }, true],
    [{ elicitation: { url: {} } }, false],
    [{ elicitation: { form: {}, url: {} } }, true],
  ])('%o → %s', (capabilities, expected) => {
    expect(supportsFormElicitation(capabilities)).toBe(expected);
  });
});

describe('requestClientCapabilities', () => {
  const initialize = { elicitation: { form: {} } };

  it('prefers the capabilities of the request envelope', () => {
    expect(requestClientCapabilities({ [CLIENT_CAPABILITIES_META_KEY]: {} }, initialize)).toEqual(
      {},
    );
  });

  it('falls back to the capabilities from initialize', () => {
    expect(requestClientCapabilities(undefined, initialize)).toBe(initialize);
    expect(requestClientCapabilities({}, initialize)).toBe(initialize);
  });
});
