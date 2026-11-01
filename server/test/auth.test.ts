import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createAdmin, setAdminPassword } from '../src/auth/password';
import { sessions, users } from '../src/db/schema';
import { makeTestApp, type TestApp } from './helpers';

const PASSWORD = 'contraseña-muy-larga-123';

let t: TestApp;

// Una app nueva por prueba: el límite de intentos vive en memoria de cada app.
beforeEach(async () => {
  t = await makeTestApp();
  t.app.get('/api/admin/_probe', { preHandler: t.app.requireAdmin }, async () => ({ ok: true }));
  await createAdmin(t.db, 'admin', PASSWORD);
});
afterEach(async () => {
  await t.close();
});

const login = (username: string, password: string) =>
  t.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password } });

const sessionCookie = (res: Awaited<ReturnType<typeof login>>) =>
  res.cookies.find((c) => c.name === 'vr_session');

describe('createAdmin / setAdminPassword', () => {
  it('guarda un hash que empieza con "$argon2id$"', async () => {
    const [u] = await t.db.select().from(users).where(eq(users.username, 'admin'));
    expect(u.passwordHash.startsWith('$argon2id$')).toBe(true);
  });
  it('rechaza contraseñas de menos de 12 caracteres', async () => {
    await expect(createAdmin(t.db, 'otro', 'corta')).rejects.toThrow(/12/);
  });
});

describe('login', () => {
  it('correcto fija cookie httpOnly y /me devuelve el usuario', async () => {
    const res = await login('admin', PASSWORD);
    expect(res.statusCode).toBe(200);
    const cookie = sessionCookie(res)!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Lax');
    const me = await t.app.inject({ method: 'GET', url: '/api/auth/me', cookies: { vr_session: cookie.value } });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toEqual({ username: 'admin' });
  });

  it('contraseña errónea y usuario inexistente dan el mismo 401 con el mismo cuerpo', async () => {
    const a = await login('admin', 'contraseña-equivocada-1');
    const b = await login('fantasma', 'contraseña-equivocada-1');
    expect(a.statusCode).toBe(401);
    expect(b.statusCode).toBe(401);
    expect(a.body).toBe(b.body);
    expect(sessionCookie(a)).toBeUndefined();
  });

  it('el sexto intento en un minuto desde la misma IP da 429', async () => {
    for (let i = 0; i < 5; i++) expect((await login('admin', 'mala-contraseña-123')).statusCode).toBe(401);
    expect((await login('admin', PASSWORD)).statusCode).toBe(429);
  });
});

describe('sesiones', () => {
  it('una ruta con requireAdmin sin cookie da 401', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/admin/_probe' });
    expect(res.statusCode).toBe(401);
  });

  it('con cookie válida la ruta protegida responde 200', async () => {
    const cookie = sessionCookie(await login('admin', PASSWORD))!;
    const res = await t.app.inject({ method: 'GET', url: '/api/admin/_probe', cookies: { vr_session: cookie.value } });
    expect(res.statusCode).toBe(200);
  });

  it('logout invalida la cookie: /me da 401 después', async () => {
    const cookie = sessionCookie(await login('admin', PASSWORD))!;
    const out = await t.app.inject({ method: 'POST', url: '/api/auth/logout', cookies: { vr_session: cookie.value } });
    expect(out.statusCode).toBe(204);
    const me = await t.app.inject({ method: 'GET', url: '/api/auth/me', cookies: { vr_session: cookie.value } });
    expect(me.statusCode).toBe(401);
  });

  it('una sesión vencida es rechazada', async () => {
    const cookie = sessionCookie(await login('admin', PASSWORD))!;
    await t.db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) });
    const me = await t.app.inject({ method: 'GET', url: '/api/auth/me', cookies: { vr_session: cookie.value } });
    expect(me.statusCode).toBe(401);
  });

  it('setAdminPassword cambia la contraseña y cierra las sesiones anteriores', async () => {
    const cookie = sessionCookie(await login('admin', PASSWORD))!;
    await setAdminPassword(t.db, 'admin', 'otra-contraseña-larga-9');
    const me = await t.app.inject({ method: 'GET', url: '/api/auth/me', cookies: { vr_session: cookie.value } });
    expect(me.statusCode).toBe(401);
    expect((await login('admin', PASSWORD)).statusCode).toBe(401);
    expect((await login('admin', 'otra-contraseña-larga-9')).statusCode).toBe(200);
  });
});
