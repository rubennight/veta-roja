import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { LandingInput } from '@veta-roja/shared';
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

const input = (over: Partial<LandingInput> = {}): LandingInput => ({
  title: 'Vivienda',
  description: '',
  slug: 'vivienda',
  themeId: 'indice-blanco',
  status: 'draft',
  slides: [],
  ctaUrl: null,
  ...over,
});

const call = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) =>
  t.app.inject({ method, url, cookies, payload });
const mkGroup = async (name: string) => (await call('POST', '/api/admin/groups', { name })).json() as { id: string; name: string };

describe('grupos de landings', () => {
  it('crea, lista, renombra y borra grupos', async () => {
    const created = await call('POST', '/api/admin/groups', { name: '  Taller de febrero ' });
    expect(created.statusCode).toBe(201);
    const group = created.json();
    expect(group.name).toBe('Taller de febrero');

    const list = await call('GET', '/api/admin/groups');
    expect(list.json().map((g: { name: string }) => g.name)).toEqual(['Taller de febrero']);

    const renamed = await call('PUT', `/api/admin/groups/${group.id}`, { name: 'Taller de marzo' });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().name).toBe('Taller de marzo');

    expect((await call('DELETE', `/api/admin/groups/${group.id}`)).statusCode).toBe(204);
    expect((await call('GET', '/api/admin/groups')).json()).toEqual([]);
  });

  it('rechaza nombre vacío o demasiado largo con 400 y nombre repetido con 409', async () => {
    expect((await call('POST', '/api/admin/groups', { name: '   ' })).statusCode).toBe(400);
    expect((await call('POST', '/api/admin/groups', { name: 'x'.repeat(61) })).statusCode).toBe(400);
    await mkGroup('Ejido');
    expect((await call('POST', '/api/admin/groups', { name: 'Ejido' })).statusCode).toBe(409);
    expect((await call('POST', '/api/admin/groups', { name: 'ejido' })).statusCode).toBe(409);
  });

  it('renombrar a un nombre ya usado da 409; un id inexistente o inválido da 404', async () => {
    await mkGroup('Uno');
    const dos = await mkGroup('Dos');
    expect((await call('PUT', `/api/admin/groups/${dos.id}`, { name: 'Uno' })).statusCode).toBe(409);
    expect((await call('PUT', `/api/admin/groups/${crypto.randomUUID()}`, { name: 'Tres' })).statusCode).toBe(404);
    expect((await call('DELETE', '/api/admin/groups/no-es-uuid')).statusCode).toBe(404);
  });

  it('exige sesión de administrador', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/admin/groups' });
    expect(res.statusCode).toBe(401);
  });

  it('la lista de grupos trae cuántas landings tiene cada uno', async () => {
    const g = await mkGroup('Ejido');
    await call('POST', '/api/admin/landings', input({ groupId: g.id }));
    await call('POST', '/api/admin/landings', input({ slug: 'otra', groupId: g.id }));
    await call('POST', '/api/admin/landings', input({ slug: 'suelta' }));
    const list = (await call('GET', '/api/admin/groups')).json();
    expect(list).toEqual([expect.objectContaining({ id: g.id, landingCount: 2 })]);
  });
});

describe('landings dentro de un grupo', () => {
  it('guarda groupId, lo devuelve en el detalle y en la lista', async () => {
    const g = await mkGroup('Ejido');
    const created = (await call('POST', '/api/admin/landings', input({ groupId: g.id }))).json();
    expect(created.groupId).toBe(g.id);
    expect((await call('GET', `/api/admin/landings/${created.id}`)).json().groupId).toBe(g.id);
    expect((await call('GET', '/api/admin/landings')).json()[0].groupId).toBe(g.id);
  });

  it('sin groupId queda sin grupo; con null saca del grupo; omitirlo al editar lo conserva', async () => {
    const g = await mkGroup('Ejido');
    const { id, groupId } = (await call('POST', '/api/admin/landings', input())).json();
    expect(groupId).toBeNull();

    await call('PUT', `/api/admin/landings/${id}`, input({ groupId: g.id }));
    expect((await call('PUT', `/api/admin/landings/${id}`, input({ title: 'Nuevo título' }))).json().groupId).toBe(g.id);
    expect((await call('PUT', `/api/admin/landings/${id}`, input({ groupId: null }))).json().groupId).toBeNull();
  });

  it('rechaza un groupId que no es uuid (400) o que no existe (400)', async () => {
    expect((await call('POST', '/api/admin/landings', input({ groupId: 'hola' }))).statusCode).toBe(400);
    const res = await call('POST', '/api/admin/landings', input({ groupId: crypto.randomUUID() }));
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/grupo/i);
  });

  it('borrar un grupo no borra sus landings: quedan sin grupo', async () => {
    const g = await mkGroup('Ejido');
    const { id } = (await call('POST', '/api/admin/landings', input({ groupId: g.id }))).json();
    await call('DELETE', `/api/admin/groups/${g.id}`);
    const after = await call('GET', `/api/admin/landings/${id}`);
    expect(after.statusCode).toBe(200);
    expect(after.json().groupId).toBeNull();
  });
});
