import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Slide } from '@veta-roja/shared';
import { AdminApp } from '../src/admin/App';

type Handler = (body: unknown) => { status?: number; json?: unknown };
let handlers: Record<string, Handler>;
let calls: Array<{ key: string; body: unknown }>;

const jsonResponse = (status: number, json?: unknown) =>
  new Response(status === 204 ? null : JSON.stringify(json ?? {}), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  handlers = {
    'GET /api/auth/me': () => ({ json: { username: 'admin' } }),
    'GET /api/admin/settings/default-cta-url': () => ({ json: { url: null } }),
  };
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${String(input)}`;
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
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

const ID = '22222222-2222-4222-8222-222222222222';
const IMAGE = '33333333-3333-4333-8333-333333333333';

const slide = (extra: Record<string, unknown>): Slide =>
  ({ id: crypto.randomUUID(), hidden: false, animation: 'fade', ...extra }) as Slide;

const landing = (over: Record<string, unknown> = {}) => ({
  id: ID,
  slug: 'vivienda',
  title: 'Vivienda digna',
  description: 'Descripción',
  themeId: 'indice-blanco',
  status: 'published',
  ctaUrl: null,
  updatedAt: '2026-11-01T12:00:00.000Z',
  slides: [slide({ type: 'cover', title: 'Portada' }), slide({ type: 'emphasis_text', text: 'Texto uno' })],
  ...over,
});

const mount = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AdminApp />
    </MemoryRouter>,
  );

const openExisting = async (over: Record<string, unknown> = {}) => {
  handlers[`GET /api/admin/landings/${ID}`] = () => ({ json: landing(over) });
  const view = mount(`/landings/${ID}`);
  await screen.findByDisplayValue('Vivienda digna');
  return view;
};

async function addSlide(user: ReturnType<typeof userEvent.setup>, type: string) {
  await user.selectOptions(screen.getByLabelText('Tipo de diapositiva'), type);
  await user.click(screen.getByRole('button', { name: 'Agregar diapositiva' }));
}

describe('crear una landing', () => {
  it('guardar llama a createLanding y, al responder, aparece el QR con sus dos descargas', async () => {
    handlers['POST /api/admin/landings'] = (b) => ({ status: 201, json: { ...(b as object), id: ID, updatedAt: '2026-11-01T12:00:00.000Z' } });
    handlers[`GET /api/admin/landings/${ID}`] = () => ({ json: landing({ status: 'draft', slides: [] }) });
    const user = userEvent.setup();
    mount('/landings/new');
    await user.type(await screen.findByLabelText('Título de la landing'), 'Vivienda digna');
    await addSlide(user, 'cover');
    expect(screen.queryByAltText(/código qr/i)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    const qr = await screen.findByAltText(/código qr/i);
    expect(qr.getAttribute('src')).toBe(`/api/admin/landings/${ID}/qr.png?v=vivienda-digna`);
    const png = screen.getByRole('link', { name: 'Descargar PNG' });
    expect(png.getAttribute('href')).toBe(`/api/admin/landings/${ID}/qr.png?download=1`);
    expect(png.hasAttribute('download')).toBe(true);
    const svg = screen.getByRole('link', { name: 'Descargar SVG' });
    expect(svg.getAttribute('href')).toBe(`/api/admin/landings/${ID}/qr.svg?download=1`);
    expect(svg.hasAttribute('download')).toBe(true);

    const post = calls.find((c) => c.key === 'POST /api/admin/landings')!.body as Record<string, unknown>;
    expect(post).toMatchObject({ title: 'Vivienda digna', slug: 'vivienda-digna', themeId: 'indice-blanco', status: 'draft', ctaUrl: null });
    expect((post.slides as unknown[]).length).toBe(1);
  });

  it('el QR de una landing en borrador avisa que no funcionará hasta publicarla', async () => {
    handlers['POST /api/admin/landings'] = (b) => ({ status: 201, json: { ...(b as object), id: ID } });
    handlers[`GET /api/admin/landings/${ID}`] = () => ({ json: landing({ status: 'draft', slides: [] }) });
    const user = userEvent.setup();
    mount('/landings/new');
    await user.type(await screen.findByLabelText('Título de la landing'), 'Vivienda');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/no funcionará hasta publicarla/i)).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Estado'), 'published');
    expect(screen.queryByText(/no funcionará hasta publicarla/i)).toBeNull();
  });

  it('no guarda si falta el título y muestra el motivo', async () => {
    const user = userEvent.setup();
    mount('/landings/new');
    await screen.findByLabelText('Título de la landing');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/título/i);
    expect(calls.some((c) => c.key.startsWith('POST /api/admin/landings'))).toBe(false);
  });

  it('un slug repetido (409) muestra "Esa dirección ya está en uso"', async () => {
    handlers['POST /api/admin/landings'] = () => ({ status: 409, json: { error: 'El slug "vivienda" ya está en uso' } });
    const user = userEvent.setup();
    mount('/landings/new');
    await user.type(await screen.findByLabelText('Título de la landing'), 'Vivienda');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/esa dirección ya está en uso/i);
  });

  it('el slug se sugiere desde el título hasta que se edita a mano', async () => {
    const user = userEvent.setup();
    mount('/landings/new');
    const title = await screen.findByLabelText('Título de la landing');
    const slug = screen.getByLabelText(/dirección/i) as HTMLInputElement;
    await user.type(title, 'Salud Pública');
    expect(slug.value).toBe('salud-publica');
    await user.clear(slug);
    await user.type(slug, 'mi-salud');
    await user.type(title, ' hoy');
    expect(slug.value).toBe('mi-salud');
  });
});

describe('editar una landing existente', () => {
  it('muestra el QR desde el principio y guardar usa PUT con el id', async () => {
    handlers[`PUT /api/admin/landings/${ID}`] = (b) => ({ json: { ...(b as object), id: ID } });
    const user = userEvent.setup();
    await openExisting();
    expect((await screen.findByAltText(/código qr/i)).getAttribute('src')).toBe(`/api/admin/landings/${ID}/qr.png?v=vivienda`);
    const title = screen.getByLabelText('Título de la landing');
    await user.clear(title);
    await user.type(title, 'Vivienda para todos');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(calls.some((c) => c.key === `PUT /api/admin/landings/${ID}`)).toBe(true));
    expect(calls.find((c) => c.key.startsWith('PUT'))!.body).toMatchObject({ title: 'Vivienda para todos', slug: 'vivienda' });
    expect(await screen.findByText('Guardado')).toBeTruthy();
  });

  it('cambiar el slug a mano no vuelve a derivarse del título', async () => {
    const user = userEvent.setup();
    await openExisting();
    const title = screen.getByLabelText('Título de la landing');
    await user.type(title, ' extra');
    expect((screen.getByLabelText(/dirección/i) as HTMLInputElement).value).toBe('vivienda');
  });
});

describe('lista de diapositivas', () => {
  const headings = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);

  it('reordenar, ocultar, duplicar y eliminar cambian la lista como se espera', async () => {
    const user = userEvent.setup();
    await openExisting();
    expect(headings()).toEqual(['Diapositiva 1 · Portada', 'Diapositiva 2 · Texto con énfasis']);

    await user.click(screen.getByRole('button', { name: 'Bajar diapositiva 1' }));
    expect(headings()).toEqual(['Diapositiva 1 · Texto con énfasis', 'Diapositiva 2 · Portada']);
    await user.click(screen.getByRole('button', { name: 'Subir diapositiva 2' }));
    expect(headings()).toEqual(['Diapositiva 1 · Portada', 'Diapositiva 2 · Texto con énfasis']);

    await user.click(screen.getByRole('button', { name: 'Duplicar diapositiva 1' }));
    expect(headings()).toEqual(['Diapositiva 1 · Portada', 'Diapositiva 2 · Portada', 'Diapositiva 3 · Texto con énfasis']);

    await user.click(screen.getByRole('button', { name: 'Ocultar diapositiva 2' }));
    expect(screen.getByRole('button', { name: 'Mostrar diapositiva 2' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Eliminar diapositiva 3' }));
    expect(headings()).toEqual(['Diapositiva 1 · Portada', 'Diapositiva 2 · Portada']);
  });

  it('con 30 diapositivas no deja agregar más y lo avisa', async () => {
    const thirty = Array.from({ length: 30 }, (_, i) => slide({ type: 'emphasis_text', text: `Texto ${i}` }));
    await openExisting({ slides: thirty });
    expect((screen.getByRole('button', { name: 'Agregar diapositiva' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/máximo 30 diapositivas/i)).toBeTruthy();
  });

  it('editar el texto de una diapositiva actualiza la vista previa', async () => {
    const user = userEvent.setup();
    await openExisting();
    await user.click(screen.getByRole('button', { name: 'Diapositiva 2 · Texto con énfasis' }));
    const text = screen.getByLabelText('Texto');
    await user.clear(text);
    await user.type(text, 'Nuevo **mensaje**');
    const preview = document.querySelector('.preview-frame')!;
    expect(within(preview as HTMLElement).getByText('mensaje').tagName).toBe('STRONG');
  });

  it('cada diapositiva permite elegir su animación', async () => {
    const user = userEvent.setup();
    await openExisting();
    await user.click(screen.getByRole('button', { name: 'Diapositiva 1 · Portada' }));
    await user.selectOptions(screen.getByLabelText('Animación de entrada'), 'zoom');
    const preview = document.querySelector('.preview-frame')!;
    expect(preview.querySelector('section')!.getAttribute('data-animation')).toBe('zoom');
  });
});

describe('theme y vista previa', () => {
  it('cambiar el theme actualiza data-theme y la hoja enlazada en la vista previa', async () => {
    const user = userEvent.setup();
    await openExisting();
    const frame = document.querySelector('.preview-frame')!;
    expect(frame.querySelector('main.deck')!.getAttribute('data-theme')).toBe('indice-blanco');
    await user.selectOptions(screen.getByLabelText('Theme'), 'socavon');
    expect(frame.querySelector('main.deck')!.getAttribute('data-theme')).toBe('socavon');
    expect(frame.querySelector('link[rel="stylesheet"]')!.getAttribute('href')).toBe('/themes/socavon.css');
  });

  it('el selector de theme lista todos los registrados con su nombre', async () => {
    await openExisting();
    const options = within(screen.getByLabelText('Theme')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toContain('Índice Papel');
    expect(options).toContain('Socavón');
    expect(options.length).toBe(6);
  });

  it('la vista previa usa el canal por defecto cuando la landing no tiene enlace propio', async () => {
    handlers['GET /api/admin/settings/default-cta-url'] = () => ({ json: { url: 'https://whatsapp.com/channel/defecto' } });
    const withCta = slide({ type: 'cta', text: 'Súmate', buttonLabel: 'Entrar al canal' });
    await openExisting({ slides: [withCta] });
    const preview = document.querySelector('.preview-frame') as HTMLElement;
    await waitFor(() => expect(within(preview).getByRole('link', { name: 'Entrar al canal' }).getAttribute('href')).toBe('https://whatsapp.com/channel/defecto'));
  });

  it('escribir en un campo con la barra espaciadora no desplaza la vista previa', async () => {
    const user = userEvent.setup();
    Element.prototype.scrollIntoView = vi.fn();
    await openExisting();
    await user.type(screen.getByLabelText('Descripción'), 'dos palabras');
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Descripción') as HTMLTextAreaElement).value).toBe('Descripcióndos palabras');
  });
});

describe('imágenes', () => {
  const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'foto.png', { type: 'image/png' });

  it('sube la imagen, guarda el imageId y muestra la miniatura', async () => {
    handlers['POST /api/admin/images'] = () => ({ status: 201, json: { id: IMAGE, url: `/uploads/${IMAGE}.webp`, width: 800, height: 400 } });
    const user = userEvent.setup();
    await openExisting();
    await user.click(screen.getByRole('button', { name: 'Diapositiva 1 · Portada' }));
    await user.upload(screen.getByLabelText('Imagen de fondo'), png());
    const thumb = (await screen.findAllByRole('img')).find((i) => i.getAttribute('src') === `/uploads/${IMAGE}.webp`);
    expect(thumb).toBeTruthy();
    expect(calls.some((c) => c.key === 'POST /api/admin/images')).toBe(true);
  });

  it('si el servidor responde 415 muestra el error', async () => {
    handlers['POST /api/admin/images'] = () => ({ status: 415, json: { error: 'Formato de imagen no admitido: usa JPEG, PNG o WebP' } });
    const user = userEvent.setup();
    await openExisting();
    await user.click(screen.getByRole('button', { name: 'Diapositiva 1 · Portada' }));
    await user.upload(screen.getByLabelText('Imagen de fondo'), png());
    expect((await screen.findByRole('alert')).textContent).toMatch(/formato de imagen no admitido/i);
  });

  it('la galería agrega imágenes con su pie de foto', async () => {
    handlers['POST /api/admin/images'] = () => ({ status: 201, json: { id: IMAGE, url: `/uploads/${IMAGE}.webp`, width: 10, height: 10 } });
    const user = userEvent.setup();
    mount('/landings/new');
    await screen.findByLabelText('Título de la landing');
    await addSlide(user, 'gallery');
    await user.click(screen.getByRole('button', { name: 'Agregar imagen' }));
    await user.upload(screen.getByLabelText('Imagen 1'), png());
    await user.type(screen.getByLabelText('Pie de foto 1'), 'Tejedores');
    const preview = document.querySelector('.preview-frame') as HTMLElement;
    await waitFor(() => expect(within(preview).getByAltText('Tejedores').getAttribute('src')).toBe(`/uploads/${IMAGE}.webp`));
  });
});
