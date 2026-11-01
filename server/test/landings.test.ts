import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { LandingInput } from '@veta-roja/shared';
import { findPublicLanding, resolveCtaUrl } from '../src/landings/repo';
import { loginAsAdmin, makeTestApp, type TestApp } from './helpers';

let t: TestApp;
let cookies: { vr_session: string };

beforeAll(async () => {
  t = await makeTestApp();
});
afterAll(async () => {
  await t.close();
});
beforeEach(async () => {
  await t.reset();
  cookies = await loginAsAdmin(t);
});

const slide = () => ({
  id: crypto.randomUUID(),
  type: 'cover' as const,
  title: 'Portada',
  hidden: false,
  animation: 'fade' as const,
});

const input = (over: Partial<LandingInput> = {}): LandingInput => ({
  title: 'Vivienda',
  description: 'Sobre la vivienda',
  slug: 'vivienda',
  themeId: 'indice-blanco',
  status: 'published',
  slides: [slide()],
  ctaUrl: null,
  ...over,
});

const post = (payload: unknown) =>
  t.app.inject({ method: 'POST', url: '/api/admin/landings', cookies, payload: payload as object });
const put = (id: string, payload: unknown) =>
  t.app.inject({ method: 'PUT', url: `/api/admin/landings/${id}`, cookies, payload: payload as object });

describe('CRUD de landings', () => {
  it('crea, lista, edita y borra una landing', async () => {
    const created = await post(input());
    expect(created.statusCode).toBe(201);
    const { id } = created.json();

    const list = await t.app.inject({ method: 'GET', url: '/api/admin/landings', cookies });
    expect(list.json().map((l: { slug: string }) => l.slug)).toEqual(['vivienda']);

    const edited = await put(id, input({ title: 'Vivienda digna' }));
    expect(edited.statusCode).toBe(200);
    const got = await t.app.inject({ method: 'GET', url: `/api/admin/landings/${id}`, cookies });
    expect(got.json().title).toBe('Vivienda digna');

    const del = await t.app.inject({ method: 'DELETE', url: `/api/admin/landings/${id}`, cookies });
    expect(del.statusCode).toBe(204);
    const gone = await t.app.inject({ method: 'GET', url: `/api/admin/landings/${id}`, cookies });
    expect(gone.statusCode).toBe(404);
  });

  it('rechaza 31 diapositivas con 400', async () => {
    const res = await post(input({ slides: Array.from({ length: 31 }, slide) }));
    expect(res.statusCode).toBe(400);
  });

  it('rechaza el slug reservado "admin" con 400', async () => {
    expect((await post(input({ slug: 'admin' }))).statusCode).toBe(400);
  });

  it('rechaza ctaUrl con javascript: con 400', async () => {
    expect((await post(input({ ctaUrl: 'javascript:alert(1)' }))).statusCode).toBe(400);
  });

  it('un slug repetido da 409 al crear', async () => {
    await post(input());
    expect((await post(input())).statusCode).toBe(409);
  });

  it('un id que no es uuid da 404', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/admin/landings/no-es-uuid', cookies });
    expect(res.statusCode).toBe(404);
  });
});

describe('redirecciones de slug', () => {
  it('renombrar deja una redirección: el slug viejo apunta al nuevo', async () => {
    const { id } = (await post(input())).json();
    await put(id, input({ slug: 'vivienda-digna' }));
    expect(await findPublicLanding(t.db, 'vivienda')).toEqual({ kind: 'redirect', slug: 'vivienda-digna' });
    expect((await findPublicLanding(t.db, 'vivienda-digna')).kind).toBe('found');
  });

  it('dos renombres seguidos mantienen ambos slugs viejos apuntando al actual', async () => {
    const { id } = (await post(input())).json();
    await put(id, input({ slug: 'segundo' }));
    await put(id, input({ slug: 'tercero' }));
    expect(await findPublicLanding(t.db, 'vivienda')).toEqual({ kind: 'redirect', slug: 'tercero' });
    expect(await findPublicLanding(t.db, 'segundo')).toEqual({ kind: 'redirect', slug: 'tercero' });
  });

  it('un slug que es redirección de otra landing da 409 al usarlo', async () => {
    const { id } = (await post(input())).json();
    await put(id, input({ slug: 'vivienda-digna' }));
    expect((await post(input({ slug: 'vivienda' }))).statusCode).toBe(409);
  });

  it('volver al propio slug anterior borra esa redirección', async () => {
    const { id } = (await post(input())).json();
    await put(id, input({ slug: 'vivienda-digna' }));
    expect((await put(id, input({ slug: 'vivienda' }))).statusCode).toBe(200);
    expect((await findPublicLanding(t.db, 'vivienda')).kind).toBe('found');
    expect(await findPublicLanding(t.db, 'vivienda-digna')).toEqual({ kind: 'redirect', slug: 'vivienda' });
  });
});

describe('findPublicLanding', () => {
  it('da unavailable para borrador, para landing borrada y para slug inexistente', async () => {
    const draft = (await post(input({ status: 'draft' }))).json();
    expect(await findPublicLanding(t.db, 'vivienda')).toEqual({ kind: 'unavailable' });

    const pub = (await post(input({ slug: 'otra' }))).json();
    await put(pub.id, input({ slug: 'otra-renombrada' }));
    await t.app.inject({ method: 'DELETE', url: `/api/admin/landings/${pub.id}`, cookies });
    expect(await findPublicLanding(t.db, 'otra-renombrada')).toEqual({ kind: 'unavailable' });
    expect(await findPublicLanding(t.db, 'otra')).toEqual({ kind: 'unavailable' });

    expect(await findPublicLanding(t.db, 'nunca-existio')).toEqual({ kind: 'unavailable' });
    expect(draft.id).toBeTruthy();
  });

  it('un slug viejo cuya landing volvió a borrador da unavailable y no filtra el slug nuevo', async () => {
    const { id } = (await post(input())).json();
    await put(id, input({ slug: 'vivienda-digna', status: 'draft' }));
    expect(await findPublicLanding(t.db, 'vivienda')).toEqual({ kind: 'unavailable' });
  });
});

describe('enlace del canal', () => {
  it('resolveCtaUrl usa el de la landing y, si es null, el por defecto; si ninguno, null', () => {
    const wa = 'https://whatsapp.com/channel/propio';
    const def = 'https://whatsapp.com/channel/defecto';
    const landing = { ctaUrl: wa } as Parameters<typeof resolveCtaUrl>[0];
    expect(resolveCtaUrl(landing, def)).toBe(wa);
    expect(resolveCtaUrl({ ctaUrl: null } as typeof landing, def)).toBe(def);
    expect(resolveCtaUrl({ ctaUrl: null } as typeof landing, null)).toBeNull();
  });

  it('PUT default-cta-url rechaza una URL fuera de WhatsApp con 400 y acepta una válida', async () => {
    const url = '/api/admin/settings/default-cta-url';
    expect((await t.app.inject({ method: 'PUT', url, cookies, payload: { url: 'https://evil.com/x' } })).statusCode).toBe(400);
    const ok = await t.app.inject({ method: 'PUT', url, cookies, payload: { url: 'https://whatsapp.com/channel/abc' } });
    expect(ok.statusCode).toBe(200);
    const got = await t.app.inject({ method: 'GET', url, cookies });
    expect(got.json()).toEqual({ url: 'https://whatsapp.com/channel/abc' });
    await t.app.inject({ method: 'PUT', url, cookies, payload: { url: null } });
    expect((await t.app.inject({ method: 'GET', url, cookies })).json()).toEqual({ url: null });
  });
});

describe('protección', () => {
  it('todas las rutas /api/admin/* dan 401 sin sesión', async () => {
    const id = crypto.randomUUID();
    const calls: Array<[string, string]> = [
      ['GET', '/api/admin/landings'],
      ['POST', '/api/admin/landings'],
      ['GET', `/api/admin/landings/${id}`],
      ['PUT', `/api/admin/landings/${id}`],
      ['DELETE', `/api/admin/landings/${id}`],
      ['GET', '/api/admin/settings/default-cta-url'],
      ['PUT', '/api/admin/settings/default-cta-url'],
    ];
    for (const [method, url] of calls) {
      const res = await t.app.inject({ method: method as 'GET', url, payload: method === 'GET' ? undefined : {} });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });
});
