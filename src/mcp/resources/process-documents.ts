import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type McpServer, ProtocolError, ProtocolErrorCode } from '@modelcontextprotocol/server';

/** A desk process document, served as the Markdown resource `docs://<name>`. */
export interface ProcessDocument {
  /** Resource name; also the file name `<name>.md`. */
  name: string;
  title: string;
  /** What the document is for. */
  description: string;
}

/** Process documents the server publishes. */
export const PROCESS_DOCUMENTS: readonly ProcessDocument[] = [
  {
    name: 'proceso_apertura',
    title: 'Proceso de apertura',
    description:
      'Cómo abrir una incidencia: datos obligatorios, redacción y comprobaciones previas.',
  },
  {
    name: 'proceso_triaje',
    title: 'Proceso de triaje',
    description: 'Cómo clasificar el impacto de una incidencia y en qué orden atender las activas.',
  },
];

const MIME_TYPE = 'text/markdown';

/** URI of a process document. */
export const documentUri = (name: string): string => `docs://${name}`;

/** Contents of a process document, as resource contents. */
export type ProcessDocumentContents = { uri: string; mimeType: string; text: string };

/**
 * Reads `<docsDirectory>/<name>.md`. An unreadable file is a server
 * misconfiguration: the details go to stderr and the client gets a generic
 * internal error that doesn't leak local paths.
 */
export async function readProcessDocument(
  docsDirectory: string,
  name: string,
): Promise<ProcessDocumentContents> {
  const uri = documentUri(name);
  try {
    const text = await readFile(join(docsDirectory, `${name}.md`), 'utf8');
    return { uri, mimeType: MIME_TYPE, text };
  } catch (error) {
    console.error(`No se pudo leer el documento ${uri}:`, error);
    throw new ProtocolError(ProtocolErrorCode.InternalError, `No se pudo leer el documento ${uri}`);
  }
}

/**
 * Registers each of {@link PROCESS_DOCUMENTS} as a static resource. The file
 * is read on every request, so edits show up without a restart.
 */
export function registerProcessDocuments(server: McpServer, docsDirectory: string): void {
  for (const { name, title, description } of PROCESS_DOCUMENTS) {
    server.registerResource(
      name,
      documentUri(name),
      { title, description, mimeType: MIME_TYPE },
      async (requested) => {
        const document = await readProcessDocument(docsDirectory, name);
        return { contents: [{ ...document, uri: requested.href }] };
      },
    );
  }
}
