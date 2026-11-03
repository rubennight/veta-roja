export interface ThemeInfo {
  id: string;
  name: string;
}

/** Themes disponibles. Cada id tiene su hoja en web/public/themes/<id>.css. */
export const THEMES: ThemeInfo[] = [
  { id: 'indice-blanco', name: 'Índice Blanco' },
  { id: 'indice-negro', name: 'Índice Negro' },
  { id: 'indice-papel', name: 'Índice Papel' },
  { id: 'indice-azul-palido', name: 'Índice Azul Pálido' },
  { id: 'cantera-y-tinta', name: 'Cantera y tinta' },
  { id: 'socavon', name: 'Socavón' },
  { id: 'cartel-constructivista', name: 'Cartel constructivista' },
  { id: 'villista-sepia', name: 'Villista sepia' },
  { id: 'rayos-rojos', name: 'Rayos rojos' },
  { id: 'periodico-obrero', name: 'Periódico obrero' },
  { id: 'cianotipo', name: 'Cianotipo' },
  { id: 'xilografia', name: 'Xilografía' },
  { id: 'mural', name: 'Mural' },
  { id: 'industrial', name: 'Industrial' },
  { id: 'manifiesto', name: 'Manifiesto' },
  { id: 'neon', name: 'Neón' },
  { id: 'estarcido', name: 'Estarcido' },
  { id: 'oro-y-carmesi', name: 'Oro y carmesí' },
  { id: 'concreto', name: 'Concreto' },
  { id: 'loteria', name: 'Lotería' },
  { id: 'pop-art', name: 'Pop-art' },
  { id: 'fanzine', name: 'Fanzine' },
];

export function getTheme(id: string): ThemeInfo | undefined {
  return THEMES.find((t) => t.id === id);
}
