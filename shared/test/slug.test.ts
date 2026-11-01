import { describe, expect, it } from 'vitest';
import { RESERVED_SLUGS, isValidSlug, normalizeSlug } from '../src/slug';

describe('slug', () => {
  it('normalizeSlug quita signos y pasa a minúsculas con guiones', () => {
    expect(normalizeSlug('Vivienda Digna Zacatecas!')).toBe('vivienda-digna-zacatecas');
  });
  it('normalizeSlug quita acentos y la ñ', () => {
    expect(normalizeSlug('Niñez y Educación')).toBe('ninez-y-educacion');
  });
  it('normalizeSlug colapsa guiones y recorta los extremos', () => {
    expect(normalizeSlug('  --Hola   mundo--  ')).toBe('hola-mundo');
  });
  it('isValidSlug es falso para reservados, muy cortos y de 61 caracteres', () => {
    for (const r of RESERVED_SLUGS) expect(isValidSlug(r), r).toBe(false);
    expect(isValidSlug('a')).toBe(false);
    expect(isValidSlug('a'.repeat(61))).toBe(false);
  });
  it('isValidSlug acepta slugs normales y rechaza mayúsculas, espacios y guion inicial', () => {
    expect(isValidSlug('vivienda-digna')).toBe(true);
    expect(isValidSlug('a'.repeat(60))).toBe(true);
    expect(isValidSlug('Vivienda')).toBe(false);
    expect(isValidSlug('con espacio')).toBe(false);
    expect(isValidSlug('-empieza')).toBe(false);
  });
});
