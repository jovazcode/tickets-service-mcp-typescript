import * as z from 'zod/v4';
import { DomainError } from './domain-error.js';
import { ImpactSchema } from './incident.js';

/** Longest title allowed, after trimming. */
export const MAX_TITLE_LENGTH = 200;

/** Longest detail allowed, after trimming. */
export const MAX_DETAIL_LENGTH = 5000;

/**
 * Data needed to open an incident. The server assigns ID, status (`abierta`)
 * and creation date. Text fields are trimmed and must not be blank.
 */
export const NewIncidentSchema = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE_LENGTH).describe('Síntoma en una frase corta'),
  detail: z
    .string()
    .trim()
    .min(1)
    .max(MAX_DETAIL_LENGTH)
    .describe('A quién afecta, desde cuándo, cómo reproducirlo y qué se ha intentado'),
  impact: ImpactSchema.describe('Impacto según docs://proceso_triaje'),
  workaround: z
    .boolean()
    .optional()
    .describe('Si existe una alternativa temporal (por defecto false); descríbela en el detalle'),
});

/** Data needed to open an incident. */
export type NewIncident = z.input<typeof NewIncidentSchema>;

/** A {@link NewIncident} after validation: trimmed text, explicit workaround. */
export interface ValidNewIncident {
  title: string;
  detail: string;
  impact: z.infer<typeof ImpactSchema>;
  workaround: boolean;
}

/**
 * Validates and normalizes `draft`.
 *
 * @throws {DomainError} `VALIDATION_ERROR` naming the offending fields.
 */
export function validateNewIncident(draft: NewIncident): ValidNewIncident {
  const parsed = NewIncidentSchema.safeParse(draft);
  if (!parsed.success) {
    throw new DomainError('VALIDATION_ERROR', z.prettifyError(parsed.error));
  }
  const { workaround = false, ...rest } = parsed.data;
  return { ...rest, workaround };
}
