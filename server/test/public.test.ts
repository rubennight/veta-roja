import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { LandingInput } from '@veta-roja/shared';
import { createLanding, updateLanding } from '../src/landings/repo';
import { setDefaultCtaUrl } from '../src/landings/settings';
import { loadAssets } from '../src/ssr/assets';
import { makeTestApp, type TestApp } from './helpers';

let t: TestApp;

beforeAll(async () => {
  t = await makeTestApp();
});
afterAll(async () => {
  await t.close();
});
beforeEach(async () => {
  await t.reset();
});

const slide = (extra: Record<string, unknown>) => ({
  id: crypto.randomUUID(),
  hidden: false,
  animation: 'fade' as const,
  ...extra,
});

const input = (over: Partial<LandingInput> = {}): LandingInput => ({
  title: 'Vivienda digna',
  description: 'Análisis materialista de la vivienda',
  slug: 'vivienda',
  themeId: 'indice-blanco',
  status: 'published',
  slides: [
    slide({ type: 'cover', title: 'Vivienda' }),
    slide({ type: 'quote', text: '¡Vivir trabajando o morir luchando!' }),
    slide({ type: 'cta', text: 'Únete', buttonLabel: 'Entrar al canal' }),
  ] as LandingInput['slides'],
  ctaUrl: null,
  ...over,
});

const getPage = (url: string) => t.app.inject({ method: 'GET', url });

describe('GET /l/:slug', () => {
  it('una landing publicada responde 200 con título, og:title, hoja del theme y su contenido', async () => {
    await createLanding(t.db, input());
    const res = await getPage('/l/vivienda');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('<title>Vivienda digna</title>');
    expect(res.body).toContain('<meta property="og:title" content="Vivienda digna">');
    expect(res.body).toContain('<meta property="og:url" content="https://vetaroja.mx/l/vivienda">');
    expect(res.body).toContain('<link rel="stylesheet" href="/themes/indice-blanco.css">');
    expect(res.body).toContain('data-theme="indice-blanco"');
    expect(res.body).toContain('¡Vivir trabajando o morir luchando!');
    expect(res.headers['cache-control']).toBe('public, max-age=60');
  });

  it('un título con <script> sale escapado en <title> y en og:title', async () => {
    await createLanding(t.db, input({ title: '<script>alert(1)</script>' }));
    const res = await getPage('/l/vivienda');
    expect(res.body).toContain('<title>&lt;script&gt;alert(1)&lt;/script&gt;</title>');
    expect(res.body).toContain('content="&lt;script&gt;alert(1)&lt;/script&gt;"');
    expect(res.body).not.toContain('<title><script>');
  });

  it('un texto con </script> no rompe el bloque de datos de hidratación', async () => {
    const evil = '</script><script>alert(1)</script>';
    await createLanding(t.db, input({ slides: [slide({ type: 'emphasis_text', text: evil })] as LandingInput['slides'] }));
    const res = await getPage('/l/vivienda');
    expect(res.body).not.toContain(evil);
    // Cada <script> abierto tiene exactamente un cierre: el texto hostil no añadió etiquetas.
    const opens = (res.body.match(/<script/g) ?? []).length;
    const closes = (res.body.match(/<\/script>/g) ?? []).length;
    expect(opens).toBe(closes);
    expect(res.body.match(/<script type="application\/json"/g)?.length).toBe(1);
    expect(res.body).not.toContain('<script>alert');
    const json = /<script type="application\/json" id="__DECK__">([\s\S]*?)<\/script>/.exec(res.body)![1];
    expect(JSON.parse(json).slides[0].text).toBe(evil);
  });

  it('la isla de datos trae el enlace del canal ya resuelto (el por defecto si la landing no tiene)', async () => {
    await setDefaultCtaUrl(t.db, 'https://whatsapp.com/channel/defecto');
    await createLanding(t.db, input());
    const res = await getPage('/l/vivienda');
    const json = /<script type="application\/json" id="__DECK__">([\s\S]*?)<\/script>/.exec(res.body)![1];
    const data = JSON.parse(json);
    expect(data.ctaUrl).toBe('https://whatsapp.com/channel/defecto');
    expect(data.themeId).toBe('indice-blanco');
    expect(res.body).toContain('href="https://whatsapp.com/channel/defecto"');
  });

  it('og:image usa la URL absoluta de la portada con imagen y no aparece sin ella', async () => {
    const imageId = crypto.randomUUID();
    await createLanding(
      t.db,
      input({ slides: [slide({ type: 'cover', title: 'Portada', imageId })] as LandingInput['slides'] }),
    );
    expect((await getPage('/l/vivienda')).body).toContain(
      `<meta property="og:image" content="https://vetaroja.mx/uploads/${imageId}.webp">`,
    );
    await t.reset();
    await createLanding(t.db, input());
    expect((await getPage('/l/vivienda')).body).not.toContain('og:image');
  });

  it('una landing en borrador da 404 con "Este tema ya no está disponible" y no filtra su contenido', async () => {
    await createLanding(t.db, input({ status: 'draft', title: 'Secreto del borrador' }));
    const res = await getPage('/l/vivienda');
    expect(res.statusCode).toBe(404);
    expect(res.body).toContain('Este tema ya no está disponible');
    expect(res.body).toContain('href="/"');
    expect(res.body).not.toContain('Secreto del borrador');
    expect(res.body).not.toContain('Vivir trabajando');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('un slug antiguo da 301 a /l/<nuevo>', async () => {
    const l = await createLanding(t.db, input());
    await updateLanding(t.db, l.id, input({ slug: 'vivienda-digna' }));
    const res = await getPage('/l/vivienda');
    expect(res.statusCode).toBe(301);
    expect(res.headers.location).toBe('/l/vivienda-digna');
  });

  it('un slug antiguo cuya landing volvió a borrador no redirige ni filtra el slug nuevo', async () => {
    const l = await createLanding(t.db, input());
    await updateLanding(t.db, l.id, input({ slug: 'vivienda-digna', status: 'draft' }));
    const res = await getPage('/l/vivienda');
    expect(res.statusCode).toBe(404);
    expect(res.headers.location).toBeUndefined();
    expect(res.body).not.toContain('vivienda-digna');
  });

  it('un slug inexistente da 404 con enlace a /', async () => {
    const res = await getPage('/l/nunca-existio');
    expect(res.statusCode).toBe(404);
    expect(res.body).toContain('href="/"');
  });
});

describe('GET /', () => {
  it('incluye el botón del canal por defecto y, sin canal, no hay botón', async () => {
    const without = await getPage('/');
    expect(without.statusCode).toBe(200);
    expect(without.body).toContain('Veta Roja');
    expect(without.body).not.toContain('btn-cta');
    await setDefaultCtaUrl(t.db, 'https://whatsapp.com/channel/defecto');
    const withChannel = await getPage('/');
    expect(withChannel.body).toContain('class="btn-cta" href="https://whatsapp.com/channel/defecto"');
    expect(withChannel.body).toContain('rel="noopener noreferrer"');
  });

  it('no lista las landings publicadas', async () => {
    await createLanding(t.db, input());
    const res = await getPage('/');
    expect(res.body).not.toContain('/l/vivienda');
    expect(res.body).not.toContain('Vivienda digna');
  });
});

describe('GET /admin', () => {
  it('/admin/login devuelve el shell del panel', async () => {
    const res = await getPage('/admin/login');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('<div id="root"></div>');
  });
  it('/admin también devuelve el shell', async () => {
    expect((await getPage('/admin')).statusCode).toBe(200);
  });
});

describe('estáticos', () => {
  it('sirve las hojas de theme y las fuentes desde web/public', async () => {
    const css = await getPage('/themes/indice-blanco.css');
    expect(css.statusCode).toBe(200);
    expect(css.headers['content-type']).toContain('text/css');
    const font = await getPage('/fonts/archivo-latin-900-normal.woff2');
    expect(font.statusCode).toBe(200);
  });
});

describe('loadAssets (manifest de Vite)', () => {
  it('lee las entradas pública y admin con sus hojas, incluidas las de chunks importados', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-web-'));
    fs.mkdirSync(path.join(dir, 'dist/client/.vite'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'dist/client/.vite/manifest.json'),
      JSON.stringify({
        'src/public/entry-client.tsx': { file: 'assets/public-AAA.js', isEntry: true, css: ['assets/public-AAA.css'], imports: ['_shared.js'] },
        '_shared.js': { file: 'assets/shared-BBB.js', css: ['assets/shared-BBB.css'] },
        'src/admin/main.tsx': { file: 'assets/admin-CCC.js', isEntry: true },
      }),
    );
    const assets = loadAssets(dir);
    expect(assets.publicJs).toBe('/assets/public-AAA.js');
    expect(assets.publicCss).toEqual(['/assets/public-AAA.css', '/assets/shared-BBB.css']);
    expect(assets.adminJs).toBe('/assets/admin-CCC.js');
    expect(assets.adminCss).toEqual([]);
  });

  it('sin manifest devuelve entradas vacías sin fallar', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-web-'));
    expect(loadAssets(dir)).toEqual({ publicJs: undefined, publicCss: [], adminJs: undefined, adminCss: [] });
  });
});
