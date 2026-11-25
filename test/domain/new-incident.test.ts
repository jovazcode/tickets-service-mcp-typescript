import { describe, expect, it } from 'vitest';
import {
  MAX_DETAIL_LENGTH,
  MAX_TITLE_LENGTH,
  validateNewIncident,
} from '../../src/domain/new-incident.js';

const draft = { title: 'Título', detail: 'Detalle', impact: 'bajo' } as const;

describe('validateNewIncident', () => {
  it('trims text and defaults workaround to false', () => {
    expect(validateNewIncident({ ...draft, title: '  Título  ', detail: '\nDetalle ' })).toEqual({
      title: 'Título',
      detail: 'Detalle',
      impact: 'bajo',
      workaround: false,
    });
  });

  it('keeps an explicit workaround', () => {
    expect(validateNewIncident({ ...draft, workaround: true }).workaround).toBe(true);
  });

  it.each([
    ['a blank title', { title: '   ' }, 'title'],
    ['a blank detail', { detail: '' }, 'detail'],
    ['a title that is too long', { title: 'x'.repeat(MAX_TITLE_LENGTH + 1) }, 'title'],
    ['a detail that is too long', { detail: 'x'.repeat(MAX_DETAIL_LENGTH + 1) }, 'detail'],
  ])('rejects %s with VALIDATION_ERROR', (_, overrides, field) => {
    expect(() => validateNewIncident({ ...draft, ...overrides })).toThrow(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining(field),
      }),
    );
  });

  it('accepts limits after trimming', () => {
    const title = ` ${'x'.repeat(MAX_TITLE_LENGTH)} `;
    expect(validateNewIncident({ ...draft, title }).title).toHaveLength(MAX_TITLE_LENGTH);
  });
});
