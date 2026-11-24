import type { Incident } from '../src/domain/incident.js';

/** Builds a valid incident, overriding the given fields. */
export function incident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: 'INC-001',
    title: 'Título',
    status: 'abierta',
    impact: 'bajo',
    workaround: false,
    created: '2026-09-01',
    detail: 'Detalle',
    ...overrides,
  };
}
