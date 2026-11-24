#!/usr/bin/env node
/**
 * Entry point: serves the MCP server over stdio.
 *
 * stdout carries JSON-RPC, so diagnostics go to stderr. Keep logic out of
 * this file: it only wires the transport and is not covered by unit tests.
 */
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer, SERVER_NAME, SERVER_VERSION } from './server.js';

void serveStdio(createServer);
console.error(`${SERVER_NAME} ${SERVER_VERSION} running on stdio`);
