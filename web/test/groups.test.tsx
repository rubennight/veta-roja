import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AdminApp } from '../src/admin/App';

type Handler = (body: unknown) => { status?: number; json?: unknown };
let handlers: Record<string, Handler>;
let calls: Array<{ key: string; body: unknown }>;

const jsonResponse = (status: number, json?: unknown) =>
  new Response(status === 204 ? null : JSON.stringify(json ?? {}), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  handlers = { 'GET /api/auth/me': () => ({ json: { username: 'admin' } }), 'GET /api/admin/settings/default-cta-url': () => ({ json: { url: null } }) };
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${String(input)}`;
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
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

const G1 = '11111111-1111-4111-8111-111111111111';
const G2 = '22222222-2222-4222-8222-222222222222';
const L1 = 'a1111111-1111-4111-8111-111111111111';
const L2 = 'a2222222-2222-4222-8222-222222222222';
const L3 = 'a3333333-3333-4333-8333-333333333333';

const summary = (over: Record<string, unknown>) => ({
  status: 'published',
  themeId: 'indice-blanco',
  groupId: null,
  updatedAt: '2026-11-01T12:00:00.000Z',
  ...over,
});
const group = (id: string, name: string, landingCount: number) => ({ id, name, landingCount, createdAt: '2026-11-01T12:00:00.000Z' });

const seed = () => {
  handlers['GET /api/admin/groups'] = () => ({ json: [group(G1, 'Ejido', 2), group(G2, 'Vacío', 0)] });
  handlers['GET /api/admin/landings'] = () => ({
    json: [
      summary({ id: L1, slug: 'tierra', title: 'La tierra', groupId: G1 }),
      summary({ id: L2, slug: 'agua-limpia', title: 'El agua', groupId: G1, themeId: 'socavon' }),
      summary({ id: L3, slug: 'suelta', title: 'Landing suelta' }),
    ],
  });
};

const mount = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <AdminApp />
    </MemoryRouter>,
  );
const sectionOf = (name: RegExp) => screen.getByRole('heading', { level: 2, name }).closest('section') as HTMLElement;

describe('lista agrupada', () => {
  it('muestra una sección por grupo con su conteo y aparte las landings sin grupo', async () => {
    seed();
    mount();
    const ejido = within(await waitFor(() => sectionOf(/Ejido/)));
    expect(ejido.getByText('La tierra')).toBeTruthy();
    expect(ejido.getByText('El agua')).toBeTruthy();
    expect(ejido.queryByText('Landing suelta')).toBeNull();
    expect(within(sectionOf(/Sin grupo/)).getByText('Landing suelta')).toBeTruthy();
    expect(within(sectionOf(/Vacío/)).getByText(/sin landings/i)).toBeTruthy();
  });

  it('si no hay grupos (o fallan al cargar) la lista sigue siendo una sola tabla', async () => {
    handlers['GET /api/admin/landings'] = () => ({ json: [summary({ id: L1, slug: 'tierra', title: 'La tierra' })] });
    mount();
    expect(await screen.findByText('La tierra')).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });
});

describe('búsqueda y filtros', () => {
  it('buscar filtra por título o por dirección y oculta las secciones sin coincidencias', async () => {
    seed();
    const user = userEvent.setup();
    mount();
    await screen.findByText('La tierra');
    await user.type(screen.getByLabelText('Buscar'), 'AGUA-lim');
    expect(screen.queryByText('La tierra')).toBeNull();
    expect(screen.getByText('El agua')).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2, name: /Sin grupo/ })).toBeNull();
    await user.clear(screen.getByLabelText('Buscar'));
    await user.type(screen.getByLabelText('Buscar'), 'tierra');
    expect(screen.getByText('La tierra')).toBeTruthy();
    expect(screen.queryByText('El agua')).toBeNull();
  });

  it('sin coincidencias avisa y permite limpiar los filtros', async () => {
    seed();
    const user = userEvent.setup();
    mount();
    await screen.findByText('La tierra');
    await user.type(screen.getByLabelText('Buscar'), 'zzzz');
    expect(screen.getByText(/ninguna landing coincide/i)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByText('La tierra')).toBeTruthy();
  });

  it('filtra por grupo (incluido "Sin grupo") y por theme', async () => {
    seed();
    const user = userEvent.setup();
    mount();
    await screen.findByText('La tierra');
    await user.selectOptions(screen.getByLabelText('Grupo'), 'Sin grupo');
    expect(screen.queryByText('La tierra')).toBeNull();
    expect(screen.getByText('Landing suelta')).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Grupo'), 'Ejido');
    expect(screen.getByText('La tierra')).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Theme'), 'Socavón');
    expect(screen.queryByText('La tierra')).toBeNull();
    expect(screen.getByText('El agua')).toBeTruthy();
  });
});

describe('gestionar grupos', () => {
  it('crea un grupo con su nombre y vuelve a cargar', async () => {
    seed();
    handlers['POST /api/admin/groups'] = (b) => ({ status: 201, json: { ...group(crypto.randomUUID(), (b as { name: string }).name, 0) } });
    const user = userEvent.setup();
    mount();
    await screen.findByText('La tierra');
    await user.type(screen.getByLabelText('Nombre del grupo nuevo'), 'Taller');
    await user.click(screen.getByRole('button', { name: 'Crear grupo' }));
    await waitFor(() => expect(calls.find((c) => c.key === 'POST /api/admin/groups')?.body).toEqual({ name: 'Taller' }));
  });

  it('un nombre repetido muestra el aviso del servidor', async () => {
    seed();
    handlers['POST /api/admin/groups'] = () => ({ status: 409, json: { error: 'Ya existe un grupo llamado "Ejido"' } });
    const user = userEvent.setup();
    mount();
    await screen.findByText('La tierra');
    await user.type(screen.getByLabelText('Nombre del grupo nuevo'), 'Ejido');
    await user.click(screen.getByRole('button', { name: 'Crear grupo' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/ya existe/i);
  });

  it('renombra un grupo pidiendo el nombre nuevo', async () => {
    seed();
    handlers[`PUT /api/admin/groups/${G1}`] = (b) => ({ json: group(G1, (b as { name: string }).name, 2) });
    vi.spyOn(window, 'prompt').mockReturnValue('Ejido Norte');
    const user = userEvent.setup();
    mount();
    await screen.findByText('La tierra');
    await user.click(within(sectionOf(/Ejido/)).getByRole('button', { name: 'Renombrar grupo' }));
    await waitFor(() => expect(calls.find((c) => c.key === `PUT /api/admin/groups/${G1}`)?.body).toEqual({ name: 'Ejido Norte' }));
  });

  it('eliminar un grupo pide confirmación y avisa que las landings no se borran', async () => {
    seed();
    handlers[`DELETE /api/admin/groups/${G1}`] = () => ({ status: 204 });
    const confirm = vi.spyOn(window, 'confirm');
    const user = userEvent.setup();
    mount();
    await screen.findByText('La tierra');
    const button = () => within(sectionOf(/Ejido/)).getByRole('button', { name: 'Eliminar grupo' });

    confirm.mockReturnValueOnce(false);
    await user.click(button());
    expect(calls.some((c) => c.key.startsWith('DELETE'))).toBe(false);

    confirm.mockReturnValueOnce(true);
    await user.click(button());
    await waitFor(() => expect(calls.some((c) => c.key === `DELETE /api/admin/groups/${G1}`)).toBe(true));
    expect(confirm.mock.calls[0][0]).toMatch(/no se borran/i);
  });

  it('mover una landing de grupo desde la fila guarda su groupId', async () => {
    seed();
    handlers[`GET /api/admin/landings/${L3}`] = () => ({
      json: { ...summary({ id: L3, slug: 'suelta', title: 'Landing suelta' }), description: '', ctaUrl: null, slides: [], createdAt: '2026-11-01T12:00:00.000Z' },
    });
    handlers[`PUT /api/admin/landings/${L3}`] = (b) => ({ json: b });
    const user = userEvent.setup();
    mount();
    await screen.findByText('Landing suelta');
    await user.selectOptions(screen.getByLabelText('Grupo de Landing suelta'), 'Ejido');
    await waitFor(() => expect(calls.some((c) => c.key === `PUT /api/admin/landings/${L3}`)).toBe(true));
    const body = calls.find((c) => c.key === `PUT /api/admin/landings/${L3}`)!.body as Record<string, unknown>;
    expect(body).toMatchObject({ groupId: G1, slug: 'suelta', title: 'Landing suelta', slides: [] });
    expect(body).not.toHaveProperty('id');
    expect(body).not.toHaveProperty('updatedAt');
  });
});

describe('grupo en el editor', () => {
  const full = (over: Record<string, unknown> = {}) => ({
    ...summary({ id: L1, slug: 'tierra', title: 'La tierra', groupId: G1 }),
    description: '',
    ctaUrl: null,
    slides: [],
    ...over,
  });

  it('muestra el grupo actual y permite cambiarlo o quitarlo al guardar', async () => {
    handlers['GET /api/admin/groups'] = () => ({ json: [group(G1, 'Ejido', 1), group(G2, 'Taller', 0)] });
    handlers[`GET /api/admin/landings/${L1}`] = () => ({ json: full() });
    handlers[`PUT /api/admin/landings/${L1}`] = (b) => ({ json: { ...(b as object), id: L1, updatedAt: '2026-11-01T12:00:00.000Z' } });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[`/landings/${L1}`]}>
        <AdminApp />
      </MemoryRouter>,
    );
    const select = (await screen.findByLabelText('Grupo')) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe(G1));
    await user.selectOptions(select, 'Taller');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(calls.some((c) => c.key === `PUT /api/admin/landings/${L1}`)).toBe(true));
    expect(calls.find((c) => c.key === `PUT /api/admin/landings/${L1}`)!.body).toMatchObject({ groupId: G2 });

    await user.selectOptions(select, 'Sin grupo');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(calls.filter((c) => c.key === `PUT /api/admin/landings/${L1}`).length).toBe(2));
    expect(calls.filter((c) => c.key === `PUT /api/admin/landings/${L1}`)[1].body).toMatchObject({ groupId: null });
  });
});
