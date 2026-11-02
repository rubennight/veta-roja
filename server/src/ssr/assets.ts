import fs from 'node:fs';
import path from 'node:path';

export interface Assets {
  publicJs: string | undefined;
  publicCss: string[];
  adminJs: string | undefined;
  adminCss: string[];
}

interface ManifestEntry {
  file: string;
  css?: string[];
  imports?: string[];
}

const PUBLIC_ENTRY = 'src/public/entry-client.tsx';
const ADMIN_ENTRY = 'src/admin/main.tsx';
const url = (file: string) => `/${file}`;

/** Lee el manifest de Vite (web/dist/client/.vite/manifest.json). Sin build devuelve todo vacío. */
export function loadAssets(webDir: string): Assets {
  const manifestPath = path.join(webDir, 'dist/client/.vite/manifest.json');
  if (!fs.existsSync(manifestPath)) return { publicJs: undefined, publicCss: [], adminJs: undefined, adminCss: [] };
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, ManifestEntry>;

  /** Hojas de la entrada y de los chunks que importa, sin repetir. */
  function cssOf(key: string, seen = new Set<string>()): string[] {
    const entry = manifest[key];
    if (!entry || seen.has(key)) return [];
    seen.add(key);
    const own = (entry.css ?? []).map(url);
    const imported = (entry.imports ?? []).flatMap((i) => cssOf(i, seen));
    return [...own, ...imported];
  }

  return {
    publicJs: manifest[PUBLIC_ENTRY] ? url(manifest[PUBLIC_ENTRY].file) : undefined,
    publicCss: cssOf(PUBLIC_ENTRY),
    adminJs: manifest[ADMIN_ENTRY] ? url(manifest[ADMIN_ENTRY].file) : undefined,
    adminCss: cssOf(ADMIN_ENTRY),
  };
}
