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

/**
 * Registers each of {@link PROCESS_DOCUMENTS} as a static resource. The file
 * `<docsDirectory>/<name>.md` is read on every request, so edits show up
 * without a restart.
 */
export function registerProcessDocuments(server: McpServer, docsDirectory: string): void {
  for (const { name, title, description } of PROCESS_DOCUMENTS) {
    const uri = documentUri(name);
    server.registerResource(
      name,
      uri,
      { title, description, mimeType: MIME_TYPE },
      async (requested) => {
        let text: string;
        try {
          text = await readFile(join(docsDirectory, `${name}.md`), 'utf8');
        } catch (error) {
          // Server misconfiguration: log the details, don't leak local paths.
          console.error(`No se pudo leer el documento ${uri}:`, error);
          throw new ProtocolError(
            ProtocolErrorCode.InternalError,
            `No se pudo leer el documento ${uri}`,
          );
        }
        return { contents: [{ uri: requested.href, mimeType: MIME_TYPE, text }] };
      },
    );
  }
}
