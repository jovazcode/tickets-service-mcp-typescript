import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { IncidentIdSchema, IncidentSchema } from '../../domain/incident.js';
import { IncidentPatchSchema } from '../../domain/incident-patch.js';
import type { IncidentRepository } from '../../store/incident-repository.js';

/** Tool name, as clients invoke it. */
export const UPDATE_INCIDENT = 'actualizar_incidencia';

const inputSchema = z.object({
  id: IncidentIdSchema,
  expectedRevision: z
    .int()
    .positive()
    .describe('Revisión actual de la incidencia, tal como se leyó con obtener_incidencia'),
  ...IncidentPatchSchema.shape,
});

const outputSchema = z.object({ incident: IncidentSchema });

/** Registers `actualizar_incidencia`: changes fields of an incident, with revision control. */
export function registerUpdateIncident(server: McpServer, repository: IncidentRepository): void {
  server.registerTool(
    UPDATE_INCIDENT,
    {
      title: 'Actualizar incidencia',
      description:
        'Cambia uno o varios campos de una incidencia (title, detail, impact, workaround); ' +
        'los que no se indiquen no cambian. El estado se cambia con cambiar_estado. Exige ' +
        'expectedRevision, la revisión leída con obtener_incidencia: si la incidencia ha ' +
        'cambiado desde entonces responde REVISION_CONFLICT y no aplica nada; vuelve a ' +
        'consultarla y confirma con el usuario. Los valores anteriores no se conservan, así ' +
        'que confirma los cambios antes de aplicarlos. Requiere que el servidor tenga la ' +
        'escritura habilitada; si no, responde WRITE_DISABLED.',
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    // DomainErrors (WRITE_DISABLED, VALIDATION_ERROR, NOT_FOUND, REVISION_CONFLICT,
    // PERSISTENCE_ERROR) become isError results.
    async ({ id, expectedRevision, ...patch }) => {
      const result = { incident: await repository.update(id, expectedRevision, patch) };
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );
}
