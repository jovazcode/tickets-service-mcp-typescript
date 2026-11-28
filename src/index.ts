#!/usr/bin/env node
/**
 * Entry point: loads the configuration and data, then serves the MCP server
 * over stdio.
 *
 * stdout carries JSON-RPC, so diagnostics go to stderr. Keep logic out of
 * this file: it only wires things together and is not covered by unit tests.
 */
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { configFromEnvironment } from './config.js';
import { createServer, SERVER_NAME, SERVER_VERSION } from './server.js';
import { IncidentRepository } from './store/incident-repository.js';

const config = configFromEnvironment(process.env);

let repository: IncidentRepository;
try {
  repository = await IncidentRepository.open({
    fixturePath: config.dataPath,
    storePath: config.storePath,
    writeEnabled: config.writeEnabled,
    deleteEnabled: config.deleteEnabled,
  });
} catch (error) {
  console.error(`${SERVER_NAME}: no se pudieron cargar las incidencias:`, error);
  process.exit(1);
}

void serveStdio(() => createServer({ repository, docsDirectory: config.docsDirectory }));
console.error(
  `${SERVER_NAME} ${SERVER_VERSION} running on stdio with ${repository.all().length} incidents ` +
    `(${repository.deleteEnabled ? 'escritura y borrado habilitados' : repository.writeEnabled ? 'escritura habilitada' : 'solo lectura'})`,
);
