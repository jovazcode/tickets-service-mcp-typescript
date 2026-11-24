import { describe, expect, it } from 'vitest';
import { IncidentSchema } from '../../src/domain/incident.js';
import { incident } from '../fixtures.js';

describe('IncidentSchema', () => {
  it('accepts a valid incident', () => {
    expect(IncidentSchema.parse(incident())).toEqual(incident());
  });

  it.each([
    ['an ID with a bad format', { id: 'INC-1' }],
    ['an unknown status', { status: 'cerrada' }],
    ['an unknown impact', { impact: 'medio' }],
    ['a non-ISO date', { created: '01/09/2026' }],
    ['a non-boolean workaround', { workaround: 'sí' }],
  ])('rejects %s', (_, overrides) => {
    expect(IncidentSchema.safeParse({ ...incident(), ...overrides }).success).toBe(false);
  });

  it('rejects a missing field', () => {
    const { detail: _, ...withoutDetail } = incident();
    expect(IncidentSchema.safeParse(withoutDetail).success).toBe(false);
  });
});
