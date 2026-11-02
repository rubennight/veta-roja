import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import { THEMES } from '@veta-roja/shared';

const publicDir = path.resolve(__dirname, '../public');
const REQUIRED_VARS = ['--bg', '--fg', '--accent', '--accent-2', '--muted', '--border', '--font-display', '--font-body'];
const FORBIDDEN_FONTS = /comic\s*sans|comic\s*neue|segoe\s*print|chalkboard|marker\s*felt|papyrus/i;

const css = (id: string) => fs.readFileSync(path.join(publicDir, 'themes', `${id}.css`), 'utf8');

function hexOf(value: string | undefined): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec((value ?? '').trim());
  if (!m) throw new Error(`Se esperaba un color hexadecimal de 6 dígitos y llegó "${value}"`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminance([r, g, b]: [number, number, number]) {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a: string | undefined, b: string | undefined) {
  const [la, lb] = [luminance(hexOf(a)), luminance(hexOf(b))];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe.each(THEMES.map((t) => [t.id, t.name]))('theme %s (%s)', (id) => {
  const prefix = `[data-theme="${id}"]`;
  const source = () => css(id);

  it('tiene su archivo web/public/themes/<id>.css', () => {
    expect(fs.existsSync(path.join(publicDir, 'themes', `${id}.css`))).toBe(true);
  });

  it('todas sus reglas están bajo [data-theme="<id>"]', () => {
    const root = postcss.parse(source());
    const offenders: string[] = [];
    root.walkRules((rule) => {
      const parent = rule.parent;
      if (parent && parent.type === 'atrule' && /keyframes$/i.test((parent as postcss.AtRule).name)) return;
      for (const sel of rule.selectors) if (!sel.trim().startsWith(prefix)) offenders.push(sel.trim());
    });
    expect(offenders).toEqual([]);
  });

  it('define las 8 variables del contrato', () => {
    const root = postcss.parse(source());
    const declared = new Set<string>();
    root.walkRules((rule) => {
      if (rule.selectors.length === 1 && rule.selector.trim() === prefix) {
        rule.walkDecls(/^--/, (d) => declared.add(d.prop));
      }
    });
    for (const v of REQUIRED_VARS) expect(declared.has(v), v).toBe(true);
  });

  it('no usa @import ni URLs externas; todo url() es /fonts/ o data:', () => {
    const root = postcss.parse(source());
    let imports = 0;
    root.walkAtRules('import', () => imports++);
    expect(imports).toBe(0);
    const urls: string[] = [];
    root.walkDecls((d) => {
      for (const m of d.value.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) urls.push(m[1]);
    });
    for (const u of urls) expect(u.startsWith('/fonts/') || u.startsWith('data:'), u).toBe(true);
  });

  it('cada url(/fonts/...) apunta a un .woff2 que existe', () => {
    const root = postcss.parse(source());
    const files: string[] = [];
    root.walkDecls((d) => {
      for (const m of d.value.matchAll(/url\(\s*['"]?(\/fonts\/[^'")]+)['"]?\s*\)/g)) files.push(m[1]);
    });
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(f.endsWith('.woff2'), f).toBe(true);
      expect(fs.existsSync(path.join(publicDir, f)), f).toBe(true);
    }
  });

  it('la primera familia de --font-display y --font-body se carga con @font-face propio', () => {
    const root = postcss.parse(source());
    const faces = new Set<string>();
    root.walkAtRules('font-face', (r) =>
      r.walkDecls('font-family', (d) => faces.add(d.value.replace(/['"]/g, '').trim())),
    );
    const vars: Record<string, string> = {};
    root.walkRules((rule) => {
      if (rule.selector.trim() === prefix) rule.walkDecls(/^--font-(display|body)$/, (d) => (vars[d.prop] = d.value));
    });
    for (const prop of ['--font-display', '--font-body']) {
      const first = vars[prop].split(',')[0].replace(/['"]/g, '').trim();
      expect(faces.has(first), `${prop}: ${first}`).toBe(true);
    }
  });

  it('no usa tipografías tipo Comic Sans ni cursivas informales', () => {
    expect(source()).not.toMatch(FORBIDDEN_FONTS);
  });

  it('el contraste del texto sobre el fondo es de al menos 4.5:1 (y los acentos 3:1)', () => {
    const root = postcss.parse(source());
    const vars: Record<string, string> = {};
    root.walkRules((rule) => {
      if (rule.selector.trim() === prefix) rule.walkDecls(/^--/, (d) => (vars[d.prop] = d.value));
    });
    expect(contrast(vars['--fg'], vars['--bg'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(vars['--muted'], vars['--bg'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(vars['--accent'], vars['--bg'])).toBeGreaterThanOrEqual(3);
    expect(contrast(vars['--accent-2'], vars['--bg'])).toBeGreaterThanOrEqual(3);
  });
});

describe('registro de themes', () => {
  it('no hay hojas de theme sin registrar en THEMES', () => {
    const files = fs.readdirSync(path.join(publicDir, 'themes')).map((f) => f.replace(/\.css$/, '')).sort();
    expect(files).toEqual(THEMES.map((t) => t.id).sort());
  });
});
