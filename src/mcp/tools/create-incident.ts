import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { IncidentSchema } from '../../domain/incident.js';
import { NewIncidentSchema } from '../../domain/new-incident.js';
import type { IncidentRepository } from '../../store/incident-repository.js';

/** Tool name, as clients invoke it. */
export const CREATE_INCIDENT = 'crear_incidencia';

const outputSchema = z.object({ incident: IncidentSchema });

/** Registers `crear_incidencia`: opens a new incident in the working store. */
export function registerCreateIncident(server: McpServer, repository: IncidentRepository): void {
  server.registerTool(
    CREATE_INCIDENT,
    {
      title: 'Crear incidencia',
      description:
        'Abre una incidencia nueva en estado "abierta" con la fecha de hoy; el servidor ' +
        'asigna el ID. Antes, sigue docs://proceso_apertura: busca con buscar_incidencias ' +
        'si ya existe una parecida y pide los datos que falten en lugar de inventarlos. ' +
        'Requiere que el servidor tenga la escritura habilitada; si no, responde WRITE_DISABLED.',
      inputSchema: NewIncidentSchema,
      outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    // DomainErrors (WRITE_DISABLED, VALIDATION_ERROR, PERSISTENCE_ERROR) become isError results.
    async (draft) => {
      const result = { incident: await repository.create(draft) };
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );
}
