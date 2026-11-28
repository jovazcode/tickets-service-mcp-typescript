import * as z from 'zod/v4';
import { DomainError } from './domain-error.js';
import type { Incident, IncidentStatus } from './incident.js';

/** Longest reason allowed for a status change, after trimming. */
export const MAX_REASON_LENGTH = 500;

/** Reason for a status change: trimmed, not blank. */
export const ReasonSchema = z.string().trim().min(1).max(MAX_REASON_LENGTH);

/**
 * States each state can move to:
 * - `abierta` → `en_progreso` or `resuelta`;
 * - `en_progreso` → `resuelta`, or back to `abierta`;
 * - `resuelta` → `abierta` (reopening; needs a reason).
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<IncidentStatus, readonly IncidentStatus[]>> = {
  abierta: ['en_progreso', 'resuelta'],
  en_progreso: ['abierta', 'resuelta'],
  resuelta: ['abierta'],
};

/** Whether the incident is still pending (`abierta` or `en_progreso`). */
export const isActive = (status: IncidentStatus): boolean => status !== 'resuelta';

/**
 * Validates and normalizes an optional `reason`.
 *
 * @throws {DomainError} `VALIDATION_ERROR` if it is blank or too long.
 */
export function validateReason(reason: string | undefined): string | undefined {
  if (reason === undefined) return undefined;
  const parsed = ReasonSchema.safeParse(reason);
  if (!parsed.success) {
    throw new DomainError('VALIDATION_ERROR', `reason: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

/**
 * Moves `incident` to `status`, with the next revision.
 *
 * @throws {DomainError} `INVALID_TRANSITION` if it is already there or the
 * move is not in {@link ALLOWED_TRANSITIONS}, `REASON_REQUIRED` when
 * reopening without a reason.
 */
export function transition(
  incident: Incident,
  status: IncidentStatus,
  reason: string | undefined,
): Incident {
  const { id, status: current } = incident;
  if (current === status) {
    throw new DomainError('INVALID_TRANSITION', `${id} ya está en estado ${status}.`);
  }
  const allowed = ALLOWED_TRANSITIONS[current];
  if (!allowed.includes(status)) {
    throw new DomainError(
      'INVALID_TRANSITION',
      `No se puede pasar de ${current} a ${status}. Desde ${current} se permite: ` +
        `${allowed.join(', ')}.`,
    );
  }
  if (!isActive(current) && reason === undefined) {
    throw new DomainError(
      'REASON_REQUIRED',
      `Para reabrir ${id} indica el motivo (reason); pregúntaselo al usuario si no lo sabes.`,
    );
  }
  return { ...incident, status, revision: incident.revision + 1 };
}
