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
];

mkdirSync(out, { recursive: true });
for (const [pkg, file] of FONT_FILES) {
  const pkgDir = dirname(require.resolve(`@fontsource/${pkg}/package.json`));
  const from = join(pkgDir, 'files', file);
  if (!existsSync(from)) throw new Error(`No existe ${from}`);
  copyFileSync(from, join(out, file));
  console.log(`fuente: ${file}`);
}
