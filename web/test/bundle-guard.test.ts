import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * La página pública se abre en celulares modestos con datos limitados. El paquete compartido trae zod en su
 * índice, así que el código de la landing pública NO debe importar su raíz (solo subrutas ligeras o tipos).
 */
const root = path.resolve(__dirname, '../src');
const publicDirs = ['render', 'public'];

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return files(full);
    return /\.(ts|tsx)$/.test(e.name) ? [full] : [];
  });
}

// `import ... from '@veta-roja/shared'` que no sea `import type` (los tipos se borran al compilar).
const RUNTIME_ROOT_IMPORT = /import\s+(?!type\b)[^;]*?from\s+['"]@veta-roja\/shared['"]/gs;

describe('código de la landing pública (web/src/render y web/src/public)', () => {
  it('no importa la raíz de @veta-roja/shared en tiempo de ejecución (arrastraría zod al celular)', () => {
    const offenders = publicDirs
      .flatMap((d) => files(path.join(root, d)))
      .filter((f) => RUNTIME_ROOT_IMPORT.test(fs.readFileSync(f, 'utf8')) || ((RUNTIME_ROOT_IMPORT.lastIndex = 0), false))
      .map((f) => path.relative(root, f));
    expect(offenders).toEqual([]);
  });
});
