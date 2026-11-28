import {
  CLIENT_CAPABILITIES_META_KEY,
  type ClientCapabilities,
  inputRequired,
  inputResponse,
  type McpServer,
} from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { DomainError } from '../../domain/domain-error.js';
import { type Incident, IncidentIdSchema, IncidentSchema } from '../../domain/incident.js';
import { ReasonSchema } from '../../domain/status-transition.js';
import type { IncidentRepository } from '../../store/incident-repository.js';

/** Tool name, as clients invoke it. */
export const DELETE_INCIDENT = 'eliminar_incidencia';

/** Key of the confirmation question in `inputRequests`/`inputResponses`. */
export const DELETE_CONFIRMATION_KEY = 'confirmar_borrado';

/** Form the user fills in to confirm the deletion. */
export const DeleteConfirmationSchema = z.object({
  confirmar: z
    .boolean()
    .default(false)
    .meta({ title: 'Borrar definitivamente' })
    .describe('Marca la casilla para confirmar el borrado'),
});

const inputSchema = z.object({
  id: IncidentIdSchema,
  confirm: z.boolean().describe('Debe ser true: confirma que el usuario lo ha pedido'),
  reason: ReasonSchema.describe('Por qué se borra'),
});

const outputSchema = z.object({
  deleted: IncidentSchema.describe('La incidencia tal como era antes de borrarla'),
  reason: z.string().describe('Motivo del borrado'),
});

/** Message of the confirmation form shown to the user. */
export function deleteConfirmationMessage(incident: Incident, reason: string): string {
  return (
    `Vas a borrar definitivamente ${incident.id} «${incident.title}» (estado ` +
    `${incident.status}, impacto ${incident.impact}). Motivo: ${reason}. No se puede ` +
    'deshacer. ¿Confirmas el borrado?'
  );
}

/**
 * Whether the client accepts form elicitations. An empty `elicitation`
 * capability means form mode (the rule before modes existed).
 */
export function supportsFormElicitation(capabilities: ClientCapabilities | undefined): boolean {
  const elicitation = capabilities?.elicitation;
  if (!elicitation) return false;
  return elicitation.form !== undefined || elicitation.url === undefined;
}

/**
 * Capabilities of the client making this request: on 2026-07-28 they travel
 * in every request's `_meta` envelope (the server instance may serve many
 * requests, e.g. over stdio); on 2025-11-25 they come from `initialize`.
 */
export function requestClientCapabilities(
  envelope: Record<string, unknown> | undefined,
  fromInitialize: ClientCapabilities | undefined,
): ClientCapabilities | undefined {
  return (
    (envelope?.[CLIENT_CAPABILITIES_META_KEY] as ClientCapabilities | undefined) ?? fromInitialize
  );
}

/**
 * Registers `eliminar_incidencia`: deletes an incident for good, after the
 * user confirms it through a form elicitation when the client supports it.
 */
export function registerDeleteIncident(server: McpServer, repository: IncidentRepository): void {
  server.registerTool(
    DELETE_INCIDENT,
    {
      title: 'Eliminar incidencia',
      description:
        'Borra físicamente una incidencia. No se puede deshacer y su ID no se reutiliza. ' +
        'Úsala solo si el usuario lo pide expresamente para esa incidencia: muéstrale antes ' +
        'la ficha y pide confirmación. Exige confirm: true y un motivo. Si el cliente admite ' +
        'elicitación, el servidor pide además confirmación directamente al usuario y responde ' +
        'DELETE_DECLINED o DELETE_CANCELLED si no la da. Requiere escritura y borrado ' +
        'habilitados (WRITE_DISABLED o DELETE_DISABLED si no).',
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    // DomainErrors become isError results with their code.
    async ({ id, confirm, reason: rawReason }, ctx) => {
      if (!confirm) {
        throw new DomainError(
          'CONFIRMATION_REQUIRED',
          'Para borrar hay que enviar confirm: true tras confirmarlo con el usuario.',
        );
      }
      const reason = rawReason.trim();
      const incident = repository.checkDeletable(id, reason);

      // On 2026-07-28 the client asks the user and retries with the answer in
      // inputResponses; on 2025-11-25 the SDK's legacy shim does the same
      // server-side. Without elicitation, confirm: true is the only confirmation.
      const capabilities = requestClientCapabilities(
        ctx.mcpReq.envelope,
        server.server.getClientCapabilities(),
      );
      if (supportsFormElicitation(capabilities)) {
        const answer = inputResponse(ctx.mcpReq.inputResponses, DELETE_CONFIRMATION_KEY);
        if (answer.kind !== 'elicit') {
          return inputRequired({
            inputRequests: {
              [DELETE_CONFIRMATION_KEY]: inputRequired.elicit({
                message: deleteConfirmationMessage(incident, reason),
                requestedSchema: DeleteConfirmationSchema,
              }),
            },
          });
        }
        if (answer.action === 'cancel') {
          throw new DomainError(
            'DELETE_CANCELLED',
            `El usuario cerró la confirmación sin responder; no se ha borrado ${id}. ` +
              'Pregúntale si quiere intentarlo de nuevo.',
          );
        }
        const form = DeleteConfirmationSchema.safeParse(answer.content ?? {});
        if (answer.action === 'decline' || !form.success || !form.data.confirmar) {
          throw new DomainError(
            'DELETE_DECLINED',
            `El usuario ha rechazado el borrado de ${id}; no se ha borrado nada.`,
          );
        }
      }

      const result = { deleted: await repository.delete(id, reason), reason };
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );
}
