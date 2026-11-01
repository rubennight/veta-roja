import { describe, expect, it } from 'vitest';
import { THEMES, getTheme } from '../src/themes';

describe('themes', () => {
  it('registra los 6 de la primera tanda con id único', () => {
    expect(THEMES.map((t) => t.id)).toEqual([
      'indice-blanco',
      'indice-negro',
      'indice-papel',
      'indice-azul-palido',
      'cantera-y-tinta',
      'socavon',
    ]);
  });
  it('getTheme encuentra por id y devuelve undefined si no existe', () => {
    expect(getTheme('socavon')?.name).toBe('Socavón');
    expect(getTheme('nada')).toBeUndefined();
  });
});
