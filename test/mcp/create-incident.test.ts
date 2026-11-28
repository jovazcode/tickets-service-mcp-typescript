import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { CREATE_INCIDENT } from '../../src/mcp/tools/create-incident.js';
import { SEARCH_INCIDENTS } from '../../src/mcp/tools/search-incidents.js';
import { type Harness, type HarnessOptions, startHarness } from '../helpers/harness.js';

const args = { title: 'El informe tarda', detail: 'Desde ayer, a todo el equipo', impact: 'bajo' };

describe(CREATE_INCIDENT, () => {
  let harness: Harness;

  const start = async (options: HarnessOptions = {}) => {
    harness = await startHarness({ clock: () => new Date(2026, 10, 25), ...options });
  };

  afterEach(async () => {
    await harness.close();
  });

  const call = (a: Record<string, unknown>, name = CREATE_INCIDENT) =>
    harness.client.callTool({ name, arguments: a });

  it('is listed as a non-destructive write tool', async () => {
    await start();
    const { tools } = await harness.client.listTools();
    expect(tools.find(({ name }) => name === CREATE_INCIDENT)).toMatchObject({
      title: 'Crear incidencia',
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      inputSchema: {
        required: ['title', 'detail', 'impact'],
        properties: { title: { minLength: 1, maxLength: 200 }, impact: { enum: ['alto', 'bajo'] } },
      },
      outputSchema: { required: ['incident'] },
    });
  });

  it('creates the incident with the next ID and makes it searchable', async () => {
    await start({ writeEnabled: true });
    const result = await call(args);
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      incident: {
        id: 'INC-105',
        title: 'El informe tarda',
        status: 'abierta',
        impact: 'bajo',
        workaround: false,
        created: '2026-11-25',
        detail: 'Desde ayer, a todo el equipo',
        revision: 1,
      },
    });
    const search = await call({ q: 'informe tarda' }, SEARCH_INCIDENTS);
    expect(search.structuredContent).toMatchObject({ total: 1, items: [{ id: 'INC-105' }] });
    expect(JSON.parse(await readFile(harness.storePath, 'utf8'))).toMatchObject({ nextId: 106 });
  });

  it('answers WRITE_DISABLED in read-only mode', async () => {
    await start();
    const result = await call(args);
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain(
      'WRITE_DISABLED: El servidor está en modo solo lectura',
    );
  });

  it('rejects blank fields before writing', async () => {
    await start({ writeEnabled: true });
    const result = await call({ ...args, title: '   ' });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('title');
    expect(harness.repository.all()).toHaveLength(4);
  });
});
