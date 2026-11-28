import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { IncidentIdSchema, IncidentSchema, IncidentStatusSchema } from '../../domain/incident.js';
import { ReasonSchema } from '../../domain/status-transition.js';
import type { IncidentRepository } from '../../store/incident-repository.js';

/** Tool name, as clients invoke it. */
export const CHANGE_STATUS = 'cambiar_estado';

const inputSchema = z.object({
  id: IncidentIdSchema,
  expectedRevision: z
    .int()
    .positive()
    .describe('Revisión actual de la incidencia, tal como se leyó con obtener_incidencia'),
  status: IncidentStatusSchema.describe('Estado de destino'),
  reason: ReasonSchema.optional().describe('Motivo del cambio; obligatorio para reabrir'),
});

const outputSchema = z.object({
  incident: IncidentSchema,
  previousStatus: IncidentStatusSchema.describe('Estado que tenía antes del cambio'),
});

/** Registers `cambiar_estado`: moves an incident through its lifecycle. */
export function registerChangeStatus(server: McpServer, repository: IncidentRepository): void {
  server.registerTool(
    CHANGE_STATUS,
    {
      title: 'Cambiar estado',
      description:
        'Cambia el estado de una incidencia respetando las transiciones permitidas: ' +
        'abierta → en_progreso o resuelta; en_progreso → resuelta o abierta; resuelta → ' +
        'abierta (reabrir, exige reason; si no lo tienes, pregúntaselo al usuario). Otras ' +
        'responden INVALID_TRANSITION. Exige expectedRevision, la revisión leída con ' +
        'obtener_incidencia (REVISION_CONFLICT si ha cambiado). Requiere que el servidor ' +
        'tenga la escritura habilitada; si no, responde WRITE_DISABLED.',
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    // DomainErrors become isError results with their code.
    async ({ id, expectedRevision, status, reason }) => {
      const result = await repository.changeStatus(id, expectedRevision, status, reason);
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );
}
