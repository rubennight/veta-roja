// Copia los .woff2 necesarios desde los paquetes @fontsource hacia web/public/fonts/.
// Los archivos copiados se versionan: en producción las fuentes se sirven desde nuestro servidor.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'public', 'fonts');
const require = createRequire(import.meta.url);

/** [paquete, archivo dentro de files/] */
export const FONT_FILES = [
  // Familia Índice
  ['archivo', 'archivo-latin-700-normal.woff2'],
  ['archivo', 'archivo-latin-900-normal.woff2'],
  ['ibm-plex-mono', 'ibm-plex-mono-latin-400-normal.woff2'],
  ['ibm-plex-mono', 'ibm-plex-mono-latin-600-normal.woff2'],
  ['ibm-plex-serif', 'ibm-plex-serif-latin-400-italic.woff2'],
  ['ibm-plex-sans-condensed', 'ibm-plex-sans-condensed-latin-700-normal.woff2'],
  // Cantera y tinta
  ['source-serif-4', 'source-serif-4-latin-400-normal.woff2'],
  ['source-serif-4', 'source-serif-4-latin-400-italic.woff2'],
  ['source-serif-4', 'source-serif-4-latin-700-normal.woff2'],
  // Socavón
  ['barlow-condensed', 'barlow-condensed-latin-700-normal.woff2'],
  ['barlow-condensed', 'barlow-condensed-latin-800-normal.woff2'],
  ['barlow', 'barlow-latin-400-normal.woff2'],
  ['barlow', 'barlow-latin-600-normal.woff2'],
  // Themes de la segunda tanda
  ['abril-fatface', 'abril-fatface-latin-400-normal.woff2'],
  ['alfa-slab-one', 'alfa-slab-one-latin-400-normal.woff2'],
  ['allerta-stencil', 'allerta-stencil-latin-400-normal.woff2'],
  ['anton', 'anton-latin-400-normal.woff2'],
  ['bebas-neue', 'bebas-neue-latin-400-normal.woff2'],
  ['big-shoulders-display', 'big-shoulders-display-latin-800-normal.woff2'],
  ['big-shoulders-display', 'big-shoulders-display-latin-900-normal.woff2'],
  ['bowlby-one', 'bowlby-one-latin-400-normal.woff2'],
  ['cinzel', 'cinzel-latin-700-normal.woff2'],
  ['cinzel', 'cinzel-latin-900-normal.woff2'],
  ['fraunces', 'fraunces-latin-700-normal.woff2'],
  ['fraunces', 'fraunces-latin-900-normal.woff2'],
  ['instrument-serif', 'instrument-serif-latin-400-italic.woff2'],
  ['instrument-serif', 'instrument-serif-latin-400-normal.woff2'],
  ['old-standard-tt', 'old-standard-tt-latin-400-italic.woff2'],
  ['old-standard-tt', 'old-standard-tt-latin-400-normal.woff2'],
  ['old-standard-tt', 'old-standard-tt-latin-700-normal.woff2'],
  ['orbitron', 'orbitron-latin-700-normal.woff2'],
  ['orbitron', 'orbitron-latin-800-normal.woff2'],
  ['playfair-display', 'playfair-display-latin-700-normal.woff2'],
  ['playfair-display', 'playfair-display-latin-900-normal.woff2'],
  ['special-elite', 'special-elite-latin-400-normal.woff2'],
];

mkdirSync(out, { recursive: true });
for (const [pkg, file] of FONT_FILES) {
  const pkgDir = dirname(require.resolve(`@fontsource/${pkg}/package.json`));
  const from = join(pkgDir, 'files', file);
  if (!existsSync(from)) throw new Error(`No existe ${from}`);
  copyFileSync(from, join(out, file));
  console.log(`fuente: ${file}`);
}
