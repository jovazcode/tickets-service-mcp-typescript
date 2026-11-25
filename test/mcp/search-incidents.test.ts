import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SEARCH_INCIDENTS } from '../../src/mcp/tools/search-incidents.js';
import { type Harness, startHarness } from '../helpers/harness.js';

describe(SEARCH_INCIDENTS, () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await startHarness();
  });

  afterEach(async () => {
    await harness.close();
  });

  const call = (args: Record<string, unknown>) =>
    harness.client.callTool({ name: SEARCH_INCIDENTS, arguments: args });

  it('is listed as a read-only tool with input and output schemas', async () => {
    const { tools } = await harness.client.listTools();
    const tool = tools.find(({ name }) => name === SEARCH_INCIDENTS);
    expect(tool).toMatchObject({
      title: 'Buscar incidencias',
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: { properties: { q: { maxLength: 200 }, limit: { maximum: 100 } } },
      outputSchema: { required: ['items', 'total'] },
    });
  });

  it('finds incidents by free text, ignoring accents', async () => {
    const result = await call({ q: 'exportacion' });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ total: 1, items: [{ id: 'INC-104' }] });
    expect(result.content).toEqual([
      { type: 'text', text: JSON.stringify(result.structuredContent) },
    ]);
  });

  it('combines filters and paging', async () => {
    const result = await call({ status: 'abierta', impact: 'bajo', limit: 1, offset: 1 });
    expect(result.structuredContent).toMatchObject({ total: 2, items: [{ id: 'INC-102' }] });
  });

  it('returns every incident without arguments', async () => {
    const result = await call({});
    expect(result.structuredContent).toMatchObject({ total: 4 });
  });

  it('rejects invalid arguments as a tool error', async () => {
    const result = await call({ limit: 0 });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('limit');
  });
});
