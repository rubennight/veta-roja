import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AdminApp } from '../src/admin/App';

type Handler = (body: unknown) => { status?: number; json?: unknown };
let handlers: Record<string, Handler>;
let calls: Array<{ key: string; body: unknown }>;

function jsonResponse(status: number, json?: unknown) {
  return new Response(status === 204 ? null : JSON.stringify(json ?? {}), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  handlers = {};
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const key = `${method} ${String(input)}`;
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ key, body });
      const handler = handlers[key];
      if (!handler) return jsonResponse(404, { error: `sin mock para ${key}` });
      const r = handler(body);
      return jsonResponse(r.status ?? 200, r.json);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const landing = (over: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  slug: 'vivienda',
  title: 'Vivienda digna',
  themeId: 'indice-blanco',
  status: 'published',
  updatedAt: '2026-11-01T12:00:00.000Z',
  ...over,
});

const loggedIn = () => {
  handlers['GET /api/auth/me'] = () => ({ json: { username: 'admin' } });
};
const mount = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AdminApp />
    </MemoryRouter>,
  );

describe('acceso', () => {
  it('sin sesión (/me da 401) redirige a /login', async () => {
    handlers['GET /api/auth/me'] = () => ({ status: 401, json: { error: 'Sesión requerida' } });
    mount('/');
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeTruthy();
  });

  it('login correcto lleva a la lista', async () => {
    let logged = false;
    handlers['GET /api/auth/me'] = () => (logged ? { json: { username: 'admin' } } : { status: 401 });
    handlers['POST /api/auth/login'] = () => {
      logged = true;
      return { json: { username: 'admin' } };
    };
    handlers['GET /api/admin/landings'] = () => ({ json: [landing()] });
    const user = userEvent.setup();
    mount('/login');
    await user.type(await screen.findByLabelText('Usuario'), 'admin');
    await user.type(screen.getByLabelText('Contraseña'), 'contraseña-larga-123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Vivienda digna')).toBeTruthy();
    expect(calls.find((c) => c.key === 'POST /api/auth/login')?.body).toEqual({
      username: 'admin',
      password: 'contraseña-larga-123',
    });
  });

  it('login fallido muestra "Usuario o contraseña incorrectos" sin decir cuál falló', async () => {
    handlers['GET /api/auth/me'] = () => ({ status: 401 });
    handlers['POST /api/auth/login'] = () => ({ status: 401, json: { error: 'Usuario o contraseña incorrectos' } });
    const user = userEvent.setup();
    mount('/login');
    await user.type(await screen.findByLabelText('Usuario'), 'admin');
    await user.type(screen.getByLabelText('Contraseña'), 'mala');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Usuario o contraseña incorrectos');
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeTruthy();
  });

  it('un login limitado (429) muestra un aviso de espera', async () => {
    handlers['GET /api/auth/me'] = () => ({ status: 401 });
    handlers['POST /api/auth/login'] = () => ({ status: 429, json: { error: 'Rate limit exceeded' } });
    const user = userEvent.setup();
    mount('/login');
    await user.type(await screen.findByLabelText('Usuario'), 'admin');
    await user.type(screen.getByLabelText('Contraseña'), 'x');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/demasiados intentos/i);
  });

  it('cerrar sesión llama a logout y vuelve a /login', async () => {
    loggedIn();
    handlers['GET /api/admin/landings'] = () => ({ json: [] });
    handlers['POST /api/auth/logout'] = () => ({ status: 204 });
    const user = userEvent.setup();
    mount('/');
    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(calls.some((c) => c.key === 'POST /api/auth/logout')).toBe(true));
    handlers['GET /api/auth/me'] = () => ({ status: 401 });
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeTruthy();
  });
});

describe('lista de landings', () => {
  it('muestra cada landing con su estado, theme y su enlace /l/<slug>', async () => {
    loggedIn();
    handlers['GET /api/admin/landings'] = () => ({
      json: [landing(), landing({ id: crypto.randomUUID(), slug: 'salud', title: 'Salud', status: 'draft', themeId: 'socavon' })],
    });
    mount('/');
    const row1 = (await screen.findByText('Vivienda digna')).closest('tr')!;
    expect(within(row1).getByText('Publicada')).toBeTruthy();
    expect(within(row1).getByText('Índice Blanco')).toBeTruthy();
    expect(within(row1).getByRole('link', { name: '/l/vivienda' }).getAttribute('href')).toBe('/l/vivienda');
    const row2 = screen.getByText('Salud').closest('tr')!;
    expect(within(row2).getByText('Borrador')).toBeTruthy();
    expect(within(row2).getByText('Socavón')).toBeTruthy();
  });

  it('sin landings muestra un estado vacío con acceso a crear la primera', async () => {
    loggedIn();
    handlers['GET /api/admin/landings'] = () => ({ json: [] });
    mount('/');
    expect(await screen.findByText(/todavía no hay landings/i)).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /nueva landing/i }).length).toBeGreaterThan(0);
  });

  it('eliminar pide confirmación y solo entonces llama a DELETE', async () => {
    loggedIn();
    const l = landing();
    let list = [l];
    handlers['GET /api/admin/landings'] = () => ({ json: list });
    handlers[`DELETE /api/admin/landings/${l.id}`] = () => {
      list = [];
      return { status: 204 };
    };
    const confirm = vi.spyOn(window, 'confirm');
    const user = userEvent.setup();
    mount('/');
    const row = (await screen.findByText('Vivienda digna')).closest('tr')!;

    confirm.mockReturnValueOnce(false);
    await user.click(within(row).getByRole('button', { name: 'Eliminar' }));
    expect(calls.some((c) => c.key.startsWith('DELETE'))).toBe(false);

    confirm.mockReturnValueOnce(true);
    await user.click(within(row).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(calls.some((c) => c.key === `DELETE /api/admin/landings/${l.id}`)).toBe(true));
    expect(confirm.mock.calls[0][0]).toContain('Vivienda digna');
    await waitFor(() => expect(screen.queryByText('Vivienda digna')).toBeNull());
  });
});

describe('ajustes', () => {
  it('guarda el enlace por defecto', async () => {
    loggedIn();
    handlers['GET /api/admin/settings/default-cta-url'] = () => ({ json: { url: null } });
    handlers['PUT /api/admin/settings/default-cta-url'] = (b) => ({ json: b });
    const user = userEvent.setup();
    mount('/settings');
    const input = await screen.findByLabelText(/enlace del canal/i);
    await user.type(input, 'https://whatsapp.com/channel/abc');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Guardado')).toBeTruthy();
    expect(calls.find((c) => c.key.startsWith('PUT'))?.body).toEqual({ url: 'https://whatsapp.com/channel/abc' });
  });

  it('muestra el error del servidor cuando el enlace no es de WhatsApp', async () => {
    loggedIn();
    handlers['GET /api/admin/settings/default-cta-url'] = () => ({ json: { url: null } });
    handlers['PUT /api/admin/settings/default-cta-url'] = () => ({ status: 400, json: { error: 'Datos no válidos' } });
    const user = userEvent.setup();
    mount('/settings');
    await user.type(await screen.findByLabelText(/enlace del canal/i), 'https://evil.com/x');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/whatsapp/i);
    expect(screen.queryByText('Guardado')).toBeNull();
  });

  it('un campo vacío guarda null (sin canal por defecto)', async () => {
    loggedIn();
    handlers['GET /api/admin/settings/default-cta-url'] = () => ({ json: { url: 'https://whatsapp.com/channel/abc' } });
    handlers['PUT /api/admin/settings/default-cta-url'] = (b) => ({ json: b });
    const user = userEvent.setup();
    mount('/settings');
    const input = await screen.findByLabelText(/enlace del canal/i);
    await waitFor(() => expect((input as HTMLInputElement).value).toBe('https://whatsapp.com/channel/abc'));
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByText('Guardado');
    expect(calls.find((c) => c.key.startsWith('PUT'))?.body).toEqual({ url: null });
  });
});
