import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
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
