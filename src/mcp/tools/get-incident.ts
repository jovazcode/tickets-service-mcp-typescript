import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { IncidentIdSchema, IncidentSchema } from '../../domain/incident.js';
import type { IncidentRepository } from '../../store/incident-repository.js';
import { READ_ONLY_ANNOTATIONS } from '../annotations.js';

/** Tool name, as clients invoke it. */
export const GET_INCIDENT = 'obtener_incidencia';

const outputSchema = z.object({ incident: IncidentSchema });

/** Registers `obtener_incidencia`: the full record of one incident by ID. */
export function registerGetIncident(server: McpServer, repository: IncidentRepository): void {
  server.registerTool(
    GET_INCIDENT,
    {
      title: 'Obtener incidencia',
      description:
        'Devuelve la ficha completa de una incidencia por su ID, incluida su revisión ' +
        '(necesaria para actualizar_incidencia). Si no existe, responde con el error NOT_FOUND.',
      inputSchema: z.object({ id: IncidentIdSchema }),
      outputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    // A DomainError (NOT_FOUND) thrown here becomes an isError result.
    async ({ id }) => {
      const result = { incident: repository.getById(id) };
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );
}
