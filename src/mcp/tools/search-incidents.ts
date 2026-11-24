import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { ImpactSchema, IncidentSchema, IncidentStatusSchema } from '../../domain/incident.js';
import { DEFAULT_LIMIT, MAX_LIMIT, searchIncidents } from '../../services/incident-search.js';
import type { IncidentRepository } from '../../store/incident-repository.js';
import { READ_ONLY_ANNOTATIONS } from '../annotations.js';

/** Tool name, as clients invoke it. */
export const SEARCH_INCIDENTS = 'buscar_incidencias';

const inputSchema = z.object({
  q: z.string().max(200).optional().describe('Texto a buscar, por ejemplo "exportación"'),
  status: IncidentStatusSchema.optional().describe('Filtra por estado'),
  impact: ImpactSchema.optional().describe('Filtra por impacto'),
  workaround: z
    .boolean()
    .optional()
    .describe('true: solo con alternativa temporal; false: solo sin'),
  limit: z
    .int()
    .min(1)
    .max(MAX_LIMIT)
    .optional()
    .describe(`Resultados por página (por defecto ${DEFAULT_LIMIT})`),
  offset: z.int().min(0).optional().describe('Resultados que se saltan (por defecto 0)'),
});

const outputSchema = z.object({
  items: z.array(IncidentSchema),
  total: z.int().min(0).describe('Total de coincidencias antes de paginar'),
});

/** Registers `buscar_incidencias`: free-text search with combined filters. */
export function registerSearchIncidents(server: McpServer, repository: IncidentRepository): void {
  server.registerTool(
    SEARCH_INCIDENTS,
    {
      title: 'Buscar incidencias',
      description:
        'Busca incidencias por texto libre (en ID, título y detalle, sin distinguir ' +
        'mayúsculas ni tildes) y por estado, impacto o existencia de alternativa ' +
        'temporal. Sin argumentos devuelve todas, paginadas.',
      inputSchema,
      outputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ q, ...filters }) => {
      const result = searchIncidents(repository.all(), { text: q, ...filters });
      // SDK 2.4 types still require `content`; mirror the structured result
      // for clients that ignore `structuredContent`.
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );
}
