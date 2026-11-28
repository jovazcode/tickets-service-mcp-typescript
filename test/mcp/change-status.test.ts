import { afterEach, describe, expect, it } from 'vitest';
import { CHANGE_STATUS } from '../../src/mcp/tools/change-status.js';
import { type Harness, type HarnessOptions, startHarness } from '../helpers/harness.js';

describe(CHANGE_STATUS, () => {
  let harness: Harness;

  const start = async (options: HarnessOptions = {}) => {
    harness = await startHarness(options);
  };

  afterEach(async () => {
    await harness.close();
  });

  const call = (a: Record<string, unknown>) =>
    harness.client.callTool({ name: CHANGE_STATUS, arguments: a });

  const errorText = async (a: Record<string, unknown>) => {
    const result = await call(a);
    expect(result.isError).toBe(true);
    return JSON.stringify(result.content);
  };

  it('is listed as a non-destructive write tool', async () => {
    await start();
    const { tools } = await harness.client.listTools();
    expect(tools.find(({ name }) => name === CHANGE_STATUS)).toMatchObject({
      title: 'Cambiar estado',
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      inputSchema: {
        required: ['id', 'expectedRevision', 'status'],
        properties: {
          status: { enum: ['abierta', 'en_progreso', 'resuelta'] },
          reason: { minLength: 1, maxLength: 500 },
        },
      },
      outputSchema: { required: ['incident', 'previousStatus'] },
    });
  });

  it('moves an incident and reports its previous status', async () => {
    await start({ writeEnabled: true });
    const result = await call({ id: 'INC-104', expectedRevision: 1, status: 'en_progreso' });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      incident: { id: 'INC-104', status: 'en_progreso', revision: 2 },
      previousStatus: 'abierta',
    });
  });

  it('asks for a reason to reopen, then reopens', async () => {
    await start({ writeEnabled: true });
    expect(await errorText({ id: 'INC-103', expectedRevision: 1, status: 'abierta' })).toContain(
      'REASON_REQUIRED',
    );
    const result = await call({
      id: 'INC-103',
      expectedRevision: 1,
      status: 'abierta',
      reason: 'El problema ha vuelto',
    });
    expect(result.structuredContent).toMatchObject({
      incident: { status: 'abierta' },
      previousStatus: 'resuelta',
    });
  });

  it('answers INVALID_TRANSITION listing the allowed targets', async () => {
    await start({ writeEnabled: true });
    expect(
      await errorText({ id: 'INC-103', expectedRevision: 1, status: 'en_progreso', reason: 'x' }),
    ).toContain('INVALID_TRANSITION: No se puede pasar de resuelta a en_progreso');
  });

  it('answers REVISION_CONFLICT for a stale revision', async () => {
    await start({ writeEnabled: true });
    await call({ id: 'INC-104', expectedRevision: 1, status: 'en_progreso' });
    expect(await errorText({ id: 'INC-104', expectedRevision: 1, status: 'resuelta' })).toContain(
      'REVISION_CONFLICT',
    );
  });

  it('answers WRITE_DISABLED in read-only mode', async () => {
    await start();
    expect(await errorText({ id: 'INC-104', expectedRevision: 1, status: 'resuelta' })).toContain(
      'WRITE_DISABLED',
    );
  });
});
