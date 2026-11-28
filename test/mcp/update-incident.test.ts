import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { GET_INCIDENT } from '../../src/mcp/tools/get-incident.js';
import { UPDATE_INCIDENT } from '../../src/mcp/tools/update-incident.js';
import { type Harness, type HarnessOptions, startHarness } from '../helpers/harness.js';

describe(UPDATE_INCIDENT, () => {
  let harness: Harness;

  const start = async (options: HarnessOptions = {}) => {
    harness = await startHarness(options);
  };

  afterEach(async () => {
    await harness.close();
  });

  const call = (a: Record<string, unknown>, name = UPDATE_INCIDENT) =>
    harness.client.callTool({ name, arguments: a });

  it('is listed as a destructive, non-idempotent write tool', async () => {
    await start();
    const { tools } = await harness.client.listTools();
    expect(tools.find(({ name }) => name === UPDATE_INCIDENT)).toMatchObject({
      title: 'Actualizar incidencia',
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      inputSchema: {
        required: ['id', 'expectedRevision'],
        properties: {
          expectedRevision: { type: 'integer' },
          title: { minLength: 1, maxLength: 200 },
          impact: { enum: ['alto', 'bajo'] },
          workaround: { type: 'boolean' },
        },
      },
      outputSchema: { required: ['incident'] },
    });
  });

  it('updates the incident read with obtener_incidencia and saves it', async () => {
    await start({ writeEnabled: true });
    const read = await call({ id: 'INC-104' }, GET_INCIDENT);
    const { incident } = read.structuredContent as { incident: Record<string, unknown> };
    expect(incident).toMatchObject({ revision: 1 });

    const result = await call({ id: 'INC-104', expectedRevision: 1, impact: 'bajo' });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      incident: { ...incident, impact: 'bajo', revision: 2 },
    });
    const store = JSON.parse(await readFile(harness.storePath, 'utf8'));
    expect(store.incidents).toContainEqual({ ...incident, impact: 'bajo', revision: 2 });
  });

  it('answers REVISION_CONFLICT with a recovery hint for a stale revision', async () => {
    await start({ writeEnabled: true });
    await call({ id: 'INC-104', expectedRevision: 1, workaround: true });
    const result = await call({ id: 'INC-104', expectedRevision: 1, workaround: false });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toMatch(
      /REVISION_CONFLICT: INC-104 ha cambiado.*obtener_incidencia/,
    );
  });

  it('answers WRITE_DISABLED in read-only mode', async () => {
    await start();
    const result = await call({ id: 'INC-104', expectedRevision: 1, impact: 'bajo' });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('WRITE_DISABLED');
  });

  it('answers VALIDATION_ERROR when no field changes', async () => {
    await start({ writeEnabled: true });
    const result = await call({ id: 'INC-104', expectedRevision: 1 });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('VALIDATION_ERROR: Indica al menos un campo');
  });

  it('answers NOT_FOUND for an unknown ID', async () => {
    await start({ writeEnabled: true });
    const result = await call({ id: 'INC-999', expectedRevision: 1, impact: 'bajo' });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('NOT_FOUND');
  });
});
