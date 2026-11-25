import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, SERVER_NAME, SERVER_VERSION } from '../src/server.js';
import { type Harness, startHarness } from './helpers/harness.js';

describe('createServer', () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await startHarness();
  });

  afterEach(async () => {
    await harness.close();
  });

  it('builds a new instance on every call', () => {
    const deps = { repository: harness.repository, docsDirectory: harness.docsDirectory };
    expect(createServer(deps)).not.toBe(createServer(deps));
  });

  it('reports its name and version from package.json', () => {
    expect(SERVER_NAME).toBe('tickets-service-mcp-typescript');
    expect(harness.client.getServerVersion()).toMatchObject({
      name: SERVER_NAME,
      version: SERVER_VERSION,
    });
  });

  it('registers every tool as read-only with a title', async () => {
    const { tools } = await harness.client.listTools();
    expect(tools.map(({ name }) => name).sort()).toEqual([
      'buscar_incidencias',
      'obtener_incidencia',
    ]);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.title).toBeTruthy();
    }
  });
});
