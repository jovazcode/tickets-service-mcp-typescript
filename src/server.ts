import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/server';

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

/**
 * Builds a new MCP server for the incident desk.
 *
 * Transports call this factory once per connection (`serveStdio`) or per
 * request (`createMcpHandler`), so it must not hold shared mutable state:
 * inject shared services as parameters instead.
 *
 * Register tools, resources and prompts here, one module per capability
 * under `src/mcp/`.
 */
export function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  return server;
}
