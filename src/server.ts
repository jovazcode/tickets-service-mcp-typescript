import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/server';
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
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerSearchIncidents(server, deps.repository);
  registerGetIncident(server, deps.repository);
  return server;
}
