import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Project root: the parent of `src/` (tsx, tests) and of `dist/` (build). */
export const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Server configuration, resolved at startup from the environment. */
export interface ServerConfig {
  /** Absolute path of the incidents JSON file. */
  dataPath: string;
}

/**
 * Builds the configuration from `env`, resolving relative paths against
 * `baseDirectory` (not the working directory: hosts may launch stdio servers
 * from anywhere). Variables:
 * - `MESA_INCIDENCIAS_DATA`: incidents JSON file (default `data/tickets.json`).
 */
export function configFromEnvironment(
  env: NodeJS.ProcessEnv,
  baseDirectory: string = PROJECT_ROOT,
): ServerConfig {
  const path = (variable: string, fallback: string): string =>
    resolve(baseDirectory, env[variable]?.trim() || fallback);

  return { dataPath: path('MESA_INCIDENCIAS_DATA', 'data/tickets.json') };
}
