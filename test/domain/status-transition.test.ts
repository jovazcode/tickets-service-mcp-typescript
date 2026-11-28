import { describe, expect, it } from 'vitest';
import { INCIDENT_STATUSES, type IncidentStatus } from '../../src/domain/incident.js';
import {
  ALLOWED_TRANSITIONS,
  isActive,
  transition,
  validateReason,
} from '../../src/domain/status-transition.js';
import { incident } from '../fixtures.js';

const pairs = INCIDENT_STATUSES.flatMap((from) =>
  INCIDENT_STATUSES.map((to) => [from, to] as [IncidentStatus, IncidentStatus]),
);

describe('transition', () => {
  it.each(pairs.filter(([from, to]) => ALLOWED_TRANSITIONS[from].includes(to)))(
    'allows %s → %s with a reason, bumping the revision',
    (from, to) => {
      expect(transition(incident({ status: from }), to, 'motivo')).toEqual(
        incident({ status: to, revision: 2 }),
      );
    },
  );

  it.each(pairs.filter(([from, to]) => from !== to && !ALLOWED_TRANSITIONS[from].includes(to)))(
    'rejects %s → %s, listing the allowed targets',
    (from, to) => {
      expect(() => transition(incident({ status: from }), to, 'motivo')).toThrow(
        `INVALID_TRANSITION: No se puede pasar de ${from} a ${to}. Desde ${from} se permite: ` +
          `${ALLOWED_TRANSITIONS[from].join(', ')}.`,
      );
    },
  );

  it.each(INCIDENT_STATUSES)('rejects staying in %s', (status) => {
    expect(() => transition(incident({ status }), status, undefined)).toThrow(
      `INVALID_TRANSITION: INC-001 ya está en estado ${status}.`,
    );
  });

  it('needs a reason only to reopen a resolved incident', () => {
    expect(() => transition(incident({ status: 'resuelta' }), 'abierta', undefined)).toThrow(
      /^REASON_REQUIRED: Para reabrir INC-001/,
    );
    expect(transition(incident(), 'resuelta', undefined).status).toBe('resuelta');
    expect(transition(incident({ status: 'en_progreso' }), 'abierta', undefined).status).toBe(
      'abierta',
    );
  });
});

describe('validateReason', () => {
  it('trims the reason and lets it be omitted', () => {
    expect(validateReason('  Vuelve a fallar ')).toBe('Vuelve a fallar');
    expect(validateReason(undefined)).toBeUndefined();
  });

  it.each(['   ', 'x'.repeat(501)])('rejects %j', (reason) => {
    expect(() => validateReason(reason)).toThrow(/^VALIDATION_ERROR: reason/);
  });
});

describe('isActive', () => {
  it('is true for every status except resuelta', () => {
    expect(INCIDENT_STATUSES.filter(isActive)).toEqual(['abierta', 'en_progreso']);
  });
});
