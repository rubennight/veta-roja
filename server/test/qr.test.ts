import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import sharp from 'sharp';
import type { LandingInput } from '@veta-roja/shared';
import { createLanding, updateLanding } from '../src/landings/repo';
import { loginAsAdmin, makeTestApp, type TestApp } from './helpers';

let t: TestApp;
let cookies: { vr_session: string };

beforeAll(async () => {
  t = await makeTestApp({ publicBaseUrl: 'https://vetaroja.mx' });
});
afterAll(async () => {
  await t.close();
});
beforeEach(async () => {
  await t.reset();
  cookies = await loginAsAdmin(t);
});

const input = (over: Partial<LandingInput> = {}): LandingInput => ({
  title: 'Vivienda',
  description: '',
  slug: 'vivienda',
  themeId: 'indice-blanco',
  status: 'published',
  slides: [],
  ctaUrl: null,
  ...over,
});

const get = (id: string, ext: 'svg' | 'png', query = '', withSession = true) =>
  t.app.inject({
    method: 'GET',
    url: `/api/admin/landings/${id}/qr.${ext}${query}`,
    cookies: withSession ? cookies : undefined,
  });

function decodePng(buf: Buffer): string | undefined {
  const png = PNG.sync.read(buf);
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data;
}

describe('QR de cada landing', () => {
  it('el PNG decodificado es exactamente la dirección pública de la landing', async () => {
    const l = await createLanding(t.db, input());
    const res = await get(l.id, 'png');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    const png = PNG.sync.read(res.rawPayload);
    expect(png.width).toBe(1024);
    expect(decodePng(res.rawPayload)).toBe('https://vetaroja.mx/l/vivienda');
  });

  it('por omisión lleva el martillo y la hoz al centro y sigue leyéndose', async () => {
    const l = await createLanding(t.db, input());
    const withLogo = await get(l.id, 'png');
    const plain = await get(l.id, 'png', '?logo=0');
    expect(decodePng(withLogo.rawPayload)).toBe('https://vetaroja.mx/l/vivienda');
    expect(decodePng(plain.rawPayload)).toBe('https://vetaroja.mx/l/vivienda');
    // Mismo tamaño, pero el centro es distinto: ahí está el emblema.
    const centre = (buf: Buffer) => {
      const png = PNG.sync.read(buf);
      let dark = 0;
      for (let y = 462; y < 562; y++) for (let x = 462; x < 562; x++) if (png.data[(y * png.width + x) * 4] < 100) dark++;
      return dark;
    };
    expect(centre(withLogo.rawPayload)).not.toBe(centre(plain.rawPayload));
    expect(withLogo.rawPayload.equals(plain.rawPayload)).toBe(false);
  });

  it('?logo=0 quita el emblema también del SVG, y con emblema el SVG se lee igual', async () => {
    const l = await createLanding(t.db, input());
    const withLogo = (await get(l.id, 'svg')).body;
    expect(withLogo).toContain('id="martillo-y-hoz"');
    expect((await get(l.id, 'svg', '?logo=0')).body).not.toContain('martillo-y-hoz');
    const raster = await sharp(Buffer.from(withLogo)).resize(1024, 1024).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const decoded = jsQR(new Uint8ClampedArray(raster.data), raster.info.width, raster.info.height);
    expect(decoded?.data).toBe('https://vetaroja.mx/l/vivienda');
  });

  it('el emblema no rompe la lectura con un slug largo', async () => {
    const slug = 'por-que-la-vivienda-digna-es-una-lucha-de-clase-en-zacatecas';
    const l = await createLanding(t.db, input({ slug }));
    expect(decodePng((await get(l.id, 'png')).rawPayload)).toBe(`https://vetaroja.mx/l/${slug}`);
  });

  it('el SVG empieza con "<svg" y tiene tipo image/svg+xml', async () => {
    const l = await createLanding(t.db, input());
    const res = await get(l.id, 'svg');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('image/svg+xml');
    expect(res.body.trimStart().startsWith('<svg')).toBe(true);
  });

  it('?download=1 agrega Content-Disposition con el nombre del archivo', async () => {
    const l = await createLanding(t.db, input());
    expect((await get(l.id, 'png', '?download=1')).headers['content-disposition']).toBe('attachment; filename="qr-vivienda.png"');
    expect((await get(l.id, 'svg', '?download=1')).headers['content-disposition']).toBe('attachment; filename="qr-vivienda.svg"');
    expect((await get(l.id, 'png')).headers['content-disposition']).toBeUndefined();
  });

  it('si el slug cambia, el QR nuevo codifica el slug nuevo', async () => {
    const l = await createLanding(t.db, input());
    await updateLanding(t.db, l.id, input({ slug: 'vivienda-digna' }));
    expect(decodePng((await get(l.id, 'png')).rawPayload)).toBe('https://vetaroja.mx/l/vivienda-digna');
  });

  it('usa PUBLIC_BASE_URL de la configuración', async () => {
    const other = await makeTestApp({ publicBaseUrl: 'https://otro.example' });
    const c = await loginAsAdmin(other);
    const l = await createLanding(other.db, input());
    const res = await other.app.inject({ method: 'GET', url: `/api/admin/landings/${l.id}/qr.png`, cookies: c });
    expect(decodePng(res.rawPayload)).toBe('https://otro.example/l/vivienda');
    await other.close();
  });

  it('id inexistente o que no es uuid da 404', async () => {
    expect((await get(crypto.randomUUID(), 'png')).statusCode).toBe(404);
    expect((await get('no-es-uuid', 'svg')).statusCode).toBe(404);
  });

  it('sin sesión da 401', async () => {
    const l = await createLanding(t.db, input());
    expect((await get(l.id, 'png', '', false)).statusCode).toBe(401);
    expect((await get(l.id, 'svg', '', false)).statusCode).toBe(401);
  });
});

describe('personalización del QR', () => {
  const URL_ = 'https://vetaroja.mx/l/vivienda';
  // jsQR es inestable con módulos sueltos (puntos, rombos, barras): según la escala a veces no encuentra los ojos aunque el dibujo
  // sea correcto. Se exige que alguna de varias resoluciones se lea; un dato mal colocado no se leería en ninguna.
  const decode = async (id: string, query: string) => {
    for (const size of [1024, 512, 600, 768, 448, 540, 640, 720, 896, 480, 560, 680]) {
      const res = await get(id, 'png', `${query}${query ? '&' : '?'}size=${size}`);
      const text = decodePng(res.rawPayload);
      if (text) return text;
    }
    return undefined;
  };

  it('el emblema por omisión es el martillo y la hoz rojos del archivo del usuario', async () => {
    const l = await createLanding(t.db, input());
    const svg = (await get(l.id, 'svg')).body;
    expect(svg).toContain('id="martillo-y-hoz"');
    expect(svg).toContain('#cc0000');
  });

  it.each(['square', 'rounded', 'dots', 'vertical', 'horizontal'])('forma de módulo "%s" se sigue leyendo', async (body) => {
    const l = await createLanding(t.db, input());
    expect(await decode(l.id, `?body=${body}&logo=0`)).toBe(URL_);
    expect(await decode(l.id, `?body=${body}`)).toBe(URL_);
  });

  it.each([
    ['square', 'square'],
    ['rounded', 'rounded'],
    ['circle', 'circle'],
    ['leaf', 'diamond'],
  ])('ojos "%s" + "%s" se leen', async (eyeFrame, eyeBall) => {
    const l = await createLanding(t.db, input());
    expect(await decode(l.id, `?eyeFrame=${eyeFrame}&eyeBall=${eyeBall}&logo=0`)).toBe(URL_);
  });

  it('colores, degradado y color propio de ojos conservan la lectura', async () => {
    const l = await createLanding(t.db, input());
    const q = `?fg=${encodeURIComponent('#7a0000')}&gradient=linear&fg2=${encodeURIComponent('#003366')}&bg=${encodeURIComponent('#fffbe6')}&eyeFrameColor=${encodeURIComponent('#000000')}`;
    expect(await decode(l.id, q)).toBe(URL_);
    const radial = await decode(l.id, `?gradient=radial&fg=${encodeURIComponent('#220000')}&fg2=${encodeURIComponent('#000044')}`);
    expect(radial).toBe(URL_);
    const svg = (await get(l.id, 'svg', q)).body;
    expect(svg).toContain('linearGradient');
    expect(svg).toContain('#fffbe6');
  });

  it('fondo transparente: el SVG no pinta fondo y el PNG tiene alfa 0 en la esquina', async () => {
    const l = await createLanding(t.db, input());
    const svg = (await get(l.id, 'svg', '?bg=none')).body;
    expect(svg).not.toContain('id="fondo"');
    const png = PNG.sync.read((await get(l.id, 'png', '?bg=none')).rawPayload);
    expect(png.data[3]).toBe(0);
  });

  it('size, margin y logoSize cambian el resultado', async () => {
    const l = await createLanding(t.db, input());
    expect(PNG.sync.read((await get(l.id, 'png', '?size=512')).rawPayload).width).toBe(512);
    const a = (await get(l.id, 'svg', '?margin=2')).body;
    const b = (await get(l.id, 'svg', '?margin=8')).body;
    expect(a).not.toBe(b);
    expect((await get(l.id, 'svg', '?logoSize=12')).body).not.toBe((await get(l.id, 'svg', '?logoSize=26')).body);
    expect(await decode(l.id, '?logoSize=28&margin=0')).toBe(URL_);
  });

  it('parámetros inválidos dan 400 con mensaje, no un QR roto ni un 500', async () => {
    const l = await createLanding(t.db, input());
    for (const q of ['?body=estrella', '?fg=rojo', '?size=10', '?logoSize=90', '?bg=%23zzzzzz']) {
      const res = await get(l.id, 'png', q);
      expect(res.statusCode, q).toBe(400);
      expect(res.json().error).toBeTruthy();
    }
  });

  it('un valor malicioso en un color no llega al SVG', async () => {
    const l = await createLanding(t.db, input());
    const res = await get(l.id, 'svg', `?fg=${encodeURIComponent('"/><script>alert(1)</script>')}`);
    expect(res.statusCode).toBe(400);
    expect(res.body).not.toContain('<script>');
  });
});
