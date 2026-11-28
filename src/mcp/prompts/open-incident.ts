import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { MAX_DETAIL_LENGTH } from '../../domain/new-incident.js';
import { readProcessDocument } from '../resources/process-documents.js';

/** Name of the prompt that guides the model through opening an incident. */
export const OPEN_INCIDENT = 'abrir_incidencia';

const OpenIncidentArgsSchema = z.object({
  problema: z
    .string()
    .max(MAX_DETAIL_LENGTH)
    .optional()
    .describe('Descripción libre del problema a registrar'),
});

/** Instructions the prompt sends after the embedded process document. */
export function openIncidentInstructions(problem: string, writeEnabled: boolean): string {
  const request = problem
    ? `Problema: ${problem}`
    : 'Pregúntame primero qué problema quiero registrar.';
  const create = writeEnabled
    ? '4. Solo entonces llama a crear_incidencia y dime el ID asignado.'
    : '4. El servidor está en modo solo lectura: no llames a crear_incidencia. Dime que hay que ' +
      'arrancarlo con MESA_INCIDENCIAS_WRITE_ENABLED=1 y deja la propuesta lista para entonces.';
  return [
    'Quiero abrir una incidencia siguiendo el proceso de apertura adjunto.',
    request,
    '',
    'Pasos:',
    '1. Busca duplicados con buscar_incidencias, probando varias palabras clave del síntoma. ' +
      'Si hay una abierta o en_progreso equivalente, enséñamela y no crees otra. Si hay una ' +
      'resuelta y el problema ha vuelto, menciona su ID en el detalle.',
    '2. Completa title, detail, impact y workaround. Si falta información imprescindible, ' +
      'pregúntamela; no la inventes. Para el impacto aplica docs://proceso_triaje.',
    '3. Muéstrame la incidencia propuesta y espera mi confirmación.',
    create,
  ].join('\n');
}

/**
 * Registers the `abrir_incidencia` prompt. It embeds `docs://proceso_apertura`
 * so the model has the process even if the client doesn't read resources.
 */
export function registerOpenIncident(
  server: McpServer,
  docsDirectory: string,
  writeEnabled: boolean,
): void {
  server.registerPrompt(
    OPEN_INCIDENT,
    {
      title: 'Abrir incidencia',
      description:
        'Guía para registrar una incidencia nueva siguiendo el proceso de apertura: buscar ' +
        'duplicados, completar datos y confirmar antes de crear.',
      argsSchema: OpenIncidentArgsSchema,
    },
    async ({ problema }) => {
      const document = await readProcessDocument(docsDirectory, 'proceso_apertura');
      return {
        description: 'Apertura de incidencia según el proceso de la mesa',
        messages: [
          { role: 'user', content: { type: 'resource', resource: document } },
          {
            role: 'user',
            content: {
              type: 'text',
              text: openIncidentInstructions(problema?.trim() ?? '', writeEnabled),
            },
          },
        ],
      };
    },
  );
}
