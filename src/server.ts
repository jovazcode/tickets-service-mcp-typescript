import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/server';
import { registerOpenIncident } from './mcp/prompts/open-incident.js';
import { registerProcessDocuments } from './mcp/resources/process-documents.js';
import { registerChangeStatus } from './mcp/tools/change-status.js';
import { registerCreateIncident } from './mcp/tools/create-incident.js';
import { registerDeleteIncident } from './mcp/tools/delete-incident.js';
import { registerGetIncident } from './mcp/tools/get-incident.js';
import { registerSearchIncidents } from './mcp/tools/search-incidents.js';
import { registerUpdateIncident } from './mcp/tools/update-incident.js';
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

/** Instructions for the model, which tell it which writes are enabled. */
export function serverInstructions(writeEnabled: boolean, deleteEnabled: boolean): string {
  const base =
    'Mesa de incidencias local con datos ficticios. Usa buscar_incidencias para localizar ' +
    'incidencias y obtener_incidencia para ver una ficha. Los procesos de la mesa están en ' +
    'los recursos docs://proceso_apertura y docs://proceso_triaje; síguelos antes de crear ' +
    'incidencias; el prompt abrir_incidencia guía ese proceso paso a paso. ';
  if (!writeEnabled) {
    return (
      base +
      'El servidor está en modo solo lectura: crear_incidencia, actualizar_incidencia, ' +
      'cambiar_estado y eliminar_incidencia responderán WRITE_DISABLED.'
    );
  }
  return (
    base +
    'La escritura está habilitada: crear_incidencia, actualizar_incidencia y cambiar_estado ' +
    'guardan cambios reales en el almacén local, así que confirma con el usuario antes de ' +
    'usarlas. ' +
    (deleteEnabled
      ? 'El borrado también está habilitado: usa eliminar_incidencia solo si el usuario lo ' +
        'pide expresamente para esa incidencia.'
      : 'El borrado está desactivado: eliminar_incidencia responderá DELETE_DISABLED.')
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
    { instructions: serverInstructions(repository.writeEnabled, repository.deleteEnabled) },
  );
  registerSearchIncidents(server, repository);
  registerGetIncident(server, repository);
  registerCreateIncident(server, repository);
  registerUpdateIncident(server, repository);
  registerChangeStatus(server, repository);
  registerDeleteIncident(server, repository);
  registerProcessDocuments(server, docsDirectory);
  registerOpenIncident(server, docsDirectory, repository.writeEnabled);
  return server;
}
