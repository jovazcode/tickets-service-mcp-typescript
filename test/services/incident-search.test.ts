import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIMIT,
  normalizeText,
  searchIncidents,
} from '../../src/services/incident-search.js';
import { incident } from '../fixtures.js';

const incidents = [
  incident({ id: 'INC-101', title: 'Acceso', status: 'abierta', impact: 'bajo', workaround: true }),
  incident({ id: 'INC-102', title: 'Botón', detail: 'Color incorrecto', impact: 'bajo' }),
  incident({ id: 'INC-103', title: 'Guardar', status: 'resuelta', impact: 'alto' }),
  incident({ id: 'INC-104', title: 'La exportación se interrumpe', impact: 'alto' }),
];

const ids = (criteria: Parameters<typeof searchIncidents>[1]) =>
  searchIncidents(incidents, criteria).items.map(({ id }) => id);

describe('normalizeText', () => {
  it('lowercases and strips accents', () => {
    expect(normalizeText('ExPORTACIÓN Año Pingüino')).toBe('exportacion ano pinguino');
  });
});

describe('searchIncidents', () => {
  it('returns everything without criteria', () => {
    expect(searchIncidents(incidents)).toEqual({ items: incidents, total: 4 });
  });

  it('matches text in the title ignoring case and accents', () => {
    expect(ids({ text: 'EXPORTACION' })).toEqual(['INC-104']);
    expect(ids({ text: 'botón' })).toEqual(['INC-102']);
  });

  it('matches text in the ID and the detail', () => {
    expect(ids({ text: 'inc-103' })).toEqual(['INC-103']);
    expect(ids({ text: 'incorrecto' })).toEqual(['INC-102']);
  });

  it('ignores blank text', () => {
    expect(ids({ text: '   ' })).toHaveLength(4);
  });

  it('filters by status, impact and workaround', () => {
    expect(ids({ status: 'resuelta' })).toEqual(['INC-103']);
    expect(ids({ impact: 'alto' })).toEqual(['INC-103', 'INC-104']);
    expect(ids({ workaround: true })).toEqual(['INC-101']);
    expect(ids({ workaround: false })).toEqual(['INC-102', 'INC-103', 'INC-104']);
  });

  it('combines filters with AND', () => {
    expect(ids({ status: 'abierta', impact: 'alto' })).toEqual(['INC-104']);
    expect(ids({ text: 'acceso', impact: 'alto' })).toEqual([]);
  });

  it('pages with limit and offset, reporting the unpaged total', () => {
    expect(searchIncidents(incidents, { limit: 2, offset: 1 })).toEqual({
      items: incidents.slice(1, 3),
      total: 4,
    });
    expect(searchIncidents(incidents, { offset: 10 })).toEqual({ items: [], total: 4 });
  });

  it('uses the default page size', () => {
    const many = Array.from({ length: DEFAULT_LIMIT + 5 }, (_, i) =>
      incident({ id: `INC-${String(i).padStart(3, '0')}` }),
    );
    expect(searchIncidents(many)).toMatchObject({ total: DEFAULT_LIMIT + 5 });
    expect(searchIncidents(many).items).toHaveLength(DEFAULT_LIMIT);
  });
});
