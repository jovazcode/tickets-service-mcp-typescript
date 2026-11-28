import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { configFromEnvironment, PROJECT_ROOT } from '../src/config.js';

describe('configFromEnvironment', () => {
  it('resolves the project root from the module location', () => {
    expect(existsSync(join(PROJECT_ROOT, 'package.json'))).toBe(true);
  });

  it('defaults to the fixture under the project root', () => {
    expect(configFromEnvironment({})).toEqual({
      dataPath: join(PROJECT_ROOT, 'data', 'tickets.json'),
      storePath: join(PROJECT_ROOT, 'data', 'tickets.local.json'),
      docsDirectory: join(PROJECT_ROOT, 'docs'),
      writeEnabled: false,
      deleteEnabled: false,
    });
  });

  it('resolves a relative override against the base directory', () => {
    const env = { MESA_INCIDENCIAS_DATA: 'otros/datos.json' };
    expect(configFromEnvironment(env, '/srv/mesa').dataPath).toBe('/srv/mesa/otros/datos.json');
  });

  it('overrides the documents folder', () => {
    const env = { MESA_INCIDENCIAS_DOCS: 'manuales' };
    expect(configFromEnvironment(env, '/srv/mesa').docsDirectory).toBe('/srv/mesa/manuales');
  });

  it('overrides the working store', () => {
    const env = { MESA_INCIDENCIAS_STORE: 'tmp/store.json' };
    expect(configFromEnvironment(env, '/srv/mesa').storePath).toBe('/srv/mesa/tmp/store.json');
  });

  it.each(['1', 'true', 'YES', ' on '])('enables writes with %j', (value) => {
    expect(configFromEnvironment({ MESA_INCIDENCIAS_WRITE_ENABLED: value }).writeEnabled).toBe(
      true,
    );
  });

  it.each(['0', 'false', 'no', ''])('keeps writes disabled with %j', (value) => {
    expect(configFromEnvironment({ MESA_INCIDENCIAS_WRITE_ENABLED: value }).writeEnabled).toBe(
      false,
    );
  });

  it('enables deletion with its own flag', () => {
    const config = configFromEnvironment({ MESA_INCIDENCIAS_DELETE_ENABLED: ' Yes ' });
    expect(config).toMatchObject({ writeEnabled: false, deleteEnabled: true });
  });

  it('keeps an absolute override', () => {
    const env = { MESA_INCIDENCIAS_DATA: '/tmp/datos.json' };
    expect(configFromEnvironment(env, '/srv/mesa').dataPath).toBe('/tmp/datos.json');
  });

  it('ignores a blank override', () => {
    const env = { MESA_INCIDENCIAS_DATA: '  ' };
    expect(configFromEnvironment(env, '/srv/mesa').dataPath).toBe('/srv/mesa/data/tickets.json');
  });
});
