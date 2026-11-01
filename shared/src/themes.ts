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
];

export function getTheme(id: string): ThemeInfo | undefined {
  return THEMES.find((t) => t.id === id);
}
