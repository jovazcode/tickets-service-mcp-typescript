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

  it('registers every tool with a title, marking the write tools', async () => {
    const { tools } = await harness.client.listTools();
    expect(tools.map(({ name }) => name).sort()).toEqual([
      'actualizar_incidencia',
      'buscar_incidencias',
      'cambiar_estado',
      'crear_incidencia',
      'obtener_incidencia',
    ]);
    for (const tool of tools) {
      expect(tool.title).toBeTruthy();
      expect(tool.annotations?.readOnlyHint).toBe(
        !['crear_incidencia', 'actualizar_incidencia', 'cambiar_estado'].includes(tool.name),
      );
    }
  });

  it('tells the model whether writes are enabled', async () => {
    expect(harness.client.getInstructions()).toContain('modo solo lectura');
    const writable = await startHarness({ writeEnabled: true });
    try {
      expect(writable.client.getInstructions()).toContain('La escritura está habilitada');
    } finally {
      await writable.close();
    }
  });
});
