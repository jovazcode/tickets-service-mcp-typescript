import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET_INCIDENT } from '../../src/mcp/tools/get-incident.js';
import { type Harness, startHarness } from '../helpers/harness.js';

describe(GET_INCIDENT, () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await startHarness();
  });

  afterEach(async () => {
    await harness.close();
  });

  const call = (args: Record<string, unknown>) =>
    harness.client.callTool({ name: GET_INCIDENT, arguments: args });

  it('is listed as a read-only tool that requires an ID', async () => {
    const { tools } = await harness.client.listTools();
    expect(tools.find(({ name }) => name === GET_INCIDENT)).toMatchObject({
      title: 'Obtener incidencia',
      annotations: { readOnlyHint: true },
      inputSchema: { required: ['id'], properties: { id: { pattern: '^INC-\\d{3,}$' } } },
      outputSchema: { required: ['incident'] },
    });
  });

  it('returns the full record', async () => {
    const result = await call({ id: 'INC-101' });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      incident: harness.repository.getById('INC-101'),
    });
  });

  it('reports an unknown ID as a NOT_FOUND tool error', async () => {
    const result = await call({ id: 'INC-999' });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'NOT_FOUND: No existe la incidencia INC-999. Usa buscar_incidencias para localizar su ID.',
      },
    ]);
  });

  it('rejects a malformed ID before reaching the repository', async () => {
    const result = await call({ id: '104' });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('Input validation error');
  });
});
