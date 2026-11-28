import { describe, expect, it } from 'vitest';
import { applyChanges, validatePatch } from '../../src/domain/incident-patch.js';
import { incident } from '../fixtures.js';

describe('validatePatch', () => {
  it('trims text and keeps only the given fields', () => {
    expect(validatePatch({ title: ' Nuevo ', detail: undefined, workaround: false })).toEqual({
      title: 'Nuevo',
      workaround: false,
    });
  });

  it('requires at least one field', () => {
    expect(() => validatePatch({})).toThrow(/^VALIDATION_ERROR: Indica al menos un campo/);
  });

  it.each([
    { title: '   ' },
    { title: 'x'.repeat(201) },
    { detail: 'x'.repeat(5001) },
    { impact: 'medio' as 'alto' },
  ])('rejects %o', (patch) => {
    expect(() => validatePatch(patch)).toThrow(/^VALIDATION_ERROR:/);
  });
});

describe('applyChanges', () => {
  it('applies the changes and bumps the revision without touching the original', () => {
    const original = incident({ revision: 3 });
    expect(applyChanges(original, { impact: 'alto' })).toEqual(
      incident({ impact: 'alto', revision: 4 }),
    );
    expect(original).toEqual(incident({ revision: 3 }));
  });
});
