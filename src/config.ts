import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Project root: the parent of `src/` (tsx, tests) and of `dist/` (build). */
export const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

/** Server configuration, resolved at startup from the environment. */
export interface ServerConfig {
  /** Absolute path of the read-only incidents fixture. */
  dataPath: string;
  /** Absolute path of the working store that writes go to. */
  storePath: string;
  /** Absolute path of the folder with the process documents. */
  docsDirectory: string;
  /** Whether write tools may change the working store. */
  writeEnabled: boolean;
}

/**
 * Builds the configuration from `env`, resolving relative paths against
 * `baseDirectory` (not the working directory: hosts may launch stdio servers
 * from anywhere). Variables:
 * - `MESA_INCIDENCIAS_DATA`: incidents fixture (default `data/tickets.json`).
 * - `MESA_INCIDENCIAS_STORE`: working store (default `data/tickets.local.json`).
 * - `MESA_INCIDENCIAS_DOCS`: process documents folder (default `docs`).
 * - `MESA_INCIDENCIAS_WRITE_ENABLED`: `1`, `true`, `yes` or `on` enable writes.
 */
export function configFromEnvironment(
  env: NodeJS.ProcessEnv,
  baseDirectory: string = PROJECT_ROOT,
): ServerConfig {
  const read = (variable: string): string | undefined => env[variable]?.trim() || undefined;
  const path = (variable: string, fallback: string): string =>
    resolve(baseDirectory, read(variable) ?? fallback);

  return {
    dataPath: path('MESA_INCIDENCIAS_DATA', 'data/tickets.json'),
    storePath: path('MESA_INCIDENCIAS_STORE', 'data/tickets.local.json'),
    docsDirectory: path('MESA_INCIDENCIAS_DOCS', 'docs'),
    writeEnabled: TRUTHY.has(read('MESA_INCIDENCIAS_WRITE_ENABLED')?.toLowerCase() ?? ''),
  };
}
