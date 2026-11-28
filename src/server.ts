import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/server';
import { registerOpenIncident } from './mcp/prompts/open-incident.js';
import { registerProcessDocuments } from './mcp/resources/process-documents.js';
import { registerCreateIncident } from './mcp/tools/create-incident.js';
import { registerGetIncident } from './mcp/tools/get-incident.js';
import { registerSearchIncidents } from './mcp/tools/search-incidents.js';
import type { IncidentRepository } from './store/incident-repository.js';

interface PackageInfo {
  name: string;
  version: string;
}

// package.json sits one level above both src/ (tsx, tests) and dist/ (build).
const pkg = createRequire(import.meta.url)('../package.json') as PackageInfo;

/** Name the server reports to clients in `serverInfo`. */
export const SERVER_NAME = pkg.name;

/** Version the server reports to clients in `serverInfo`, taken from package.json. */
export const SERVER_VERSION = pkg.version;

/** Shared services the server's capabilities work on. */
export interface ServerDependencies {
  repository: IncidentRepository;
  /** Absolute path of the folder with the process documents. */
  docsDirectory: string;
}

/** Instructions for the model, which tell it whether writes are enabled. */
export function serverInstructions(writeEnabled: boolean): string {
  return (
    'Mesa de incidencias local con datos ficticios. Usa buscar_incidencias para localizar ' +
    'incidencias y obtener_incidencia para ver una ficha. Los procesos de la mesa están en ' +
    'los recursos docs://proceso_apertura y docs://proceso_triaje; síguelos antes de crear ' +
    'incidencias; el prompt abrir_incidencia guía ese proceso paso a paso. ' +
    (writeEnabled
      ? 'La escritura está habilitada: crear_incidencia guarda cambios reales en el almacén ' +
        'local, así que confirma con el usuario antes de usarla.'
      : 'El servidor está en modo solo lectura: crear_incidencia responderá WRITE_DISABLED.')
  );
}

/**
 * Builds a new MCP server for the incident desk.
 *
 * Transports call this factory once per connection (`serveStdio`) or per
 * request (`createMcpHandler`), so it holds no shared mutable state: shared
 * services come in through `deps`.
 *
 * Each tool, resource or prompt lives in its own module under `src/mcp/` and
 * is registered here.
 */
export function createServer(deps: ServerDependencies): McpServer {
  const { repository, docsDirectory } = deps;
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: serverInstructions(repository.writeEnabled) },
  );
  registerSearchIncidents(server, repository);
  registerGetIncident(server, repository);
  registerCreateIncident(server, repository);
  registerProcessDocuments(server, docsDirectory);
  registerOpenIncident(server, docsDirectory, repository.writeEnabled);
  return server;
}
