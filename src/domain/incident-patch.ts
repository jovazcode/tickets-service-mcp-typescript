import * as z from 'zod/v4';
import { DomainError } from './domain-error.js';
import { type Impact, ImpactSchema, type Incident } from './incident.js';
import { DetailSchema, TitleSchema } from './new-incident.js';

/**
 * Fields to change in an incident; omitted fields stay as they are. The
 * status is not part of it: it changes through explicit transitions.
 */
export const IncidentPatchSchema = z.object({
  title: TitleSchema.optional().describe('Nuevo título'),
  detail: DetailSchema.optional().describe('Nuevo detalle'),
  impact: ImpactSchema.optional().describe('Nuevo impacto, según docs://proceso_triaje'),
  workaround: z.boolean().optional().describe('Si ahora existe una alternativa temporal'),
});

/** Fields to change in an incident. */
export type IncidentPatch = z.input<typeof IncidentPatchSchema>;

/** A validated {@link IncidentPatch}: trimmed text, only the fields that change. */
export type IncidentChanges = Partial<{
  title: string;
  detail: string;
  impact: Impact;
  workaround: boolean;
}>;

/**
 * Validates and normalizes `patch`.
 *
 * @throws {DomainError} `VALIDATION_ERROR` if a field is invalid or none is given.
 */
export function validatePatch(patch: IncidentPatch): IncidentChanges {
  const parsed = IncidentPatchSchema.safeParse(patch);
  if (!parsed.success) {
    throw new DomainError('VALIDATION_ERROR', z.prettifyError(parsed.error));
  }
  const changes: IncidentChanges = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined),
  );
  if (Object.keys(changes).length === 0) {
    throw new DomainError(
      'VALIDATION_ERROR',
      'Indica al menos un campo a cambiar: title, detail, impact o workaround.',
    );
  }
  return changes;
}

/** Applies `changes` to `incident`, with the next revision. */
export function applyChanges(incident: Incident, changes: IncidentChanges): Incident {
  return { ...incident, ...changes, revision: incident.revision + 1 };
}
