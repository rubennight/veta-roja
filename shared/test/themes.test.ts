import { describe, expect, it } from 'vitest';
import { THEMES, getTheme } from '../src/themes';

describe('themes', () => {
  it('registra los 22 themes acordados, sin ids repetidos y con la primera tanda al inicio', () => {
    const ids = THEMES.map((t) => t.id);
    expect(ids.slice(0, 6)).toEqual(['indice-blanco', 'indice-negro', 'indice-papel', 'indice-azul-palido', 'cantera-y-tinta', 'socavon']);
    expect(ids).toHaveLength(22);
    expect(new Set(ids).size).toBe(22);
    for (const id of ['cartel-constructivista', 'villista-sepia', 'rayos-rojos', 'periodico-obrero', 'cianotipo', 'xilografia', 'mural', 'industrial', 'manifiesto', 'neon', 'estarcido', 'oro-y-carmesi', 'concreto', 'loteria', 'pop-art', 'fanzine']) {
      expect(ids).toContain(id);
    }
  });
  it('getTheme encuentra por id y devuelve undefined si no existe', () => {
    expect(getTheme('socavon')?.name).toBe('Socavón');
    expect(getTheme('nada')).toBeUndefined();
  });
});
