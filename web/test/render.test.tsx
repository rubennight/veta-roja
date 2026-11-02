import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import type { Slide } from '@veta-roja/shared';
import { SlideDeck } from '../src/render/SlideDeck';

const id = () => crypto.randomUUID();
const base = { hidden: false, animation: 'fade' as const };
const imageUrl = (imageId: string) => `/uploads/${imageId}.webp`;

const one = (extra: Record<string, unknown>): Slide => ({ ...base, id: id(), ...extra }) as Slide;

const all: Slide[] = [
  one({ type: 'cover', title: 'Portada', subtitle: 'Sub' }),
  one({ type: 'emphasis_text', text: 'Hay **fuerza** y ==ojo==' }),
  one({ type: 'quote', text: '¡Vivir trabajando o morir luchando!', author: 'Lyon', date: '1831' }),
  one({ type: 'concept', term: 'Contradicción', definition: 'Dos opuestos que se necesitan' }),
  one({ type: 'big_figure', figure: '10 000', caption: 'encarcelados' }),
  one({ type: 'timeline', items: [{ date: '1831', text: 'Lyon' }, { date: '1844', text: 'Silesia' }] }),
  one({ type: 'comparison', left: { title: 'Capital', points: ['a'] }, right: { title: 'Trabajo', points: ['b'] } }),
  one({ type: 'gallery', images: [{ imageId: '11111111-1111-4111-8111-111111111111', caption: 'Tejedores' }] }),
  one({ type: 'cta', text: 'Únete a la organización', buttonLabel: 'Entrar al canal' }),
];

const WA = 'https://whatsapp.com/channel/abc';
const deck = (slides: Slide[], ctaUrl: string | null = WA) => (
  <SlideDeck slides={slides} ctaUrl={ctaUrl} imageUrl={imageUrl} themeId="indice-blanco" />
);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SlideDeck: contenido', () => {
  it('renderiza cada uno de los 9 tipos con su data-slide-type', () => {
    const { container } = render(deck(all));
    const types = [...container.querySelectorAll('section[data-slide-type]')].map((s) => s.getAttribute('data-slide-type'));
    expect(types).toEqual(all.map((s) => s.type));
  });

  it('pone data-theme en la raíz y data-animation en cada diapositiva', () => {
    const { container } = render(deck(all));
    expect(container.querySelector('main.deck')?.getAttribute('data-theme')).toBe('indice-blanco');
    expect(container.querySelector('section')?.getAttribute('data-animation')).toBe('fade');
  });

  it('una diapositiva hidden no aparece', () => {
    const hidden = one({ type: 'quote', text: 'Texto oculto', hidden: true });
    const { container } = render(deck([all[0], hidden]));
    expect(container.textContent).not.toContain('Texto oculto');
    expect(container.querySelectorAll('section').length).toBe(1);
  });

  it('**x** produce <strong> y ==x== produce <mark>; marcadores sin cerrar quedan literales', () => {
    const { container } = render(
      deck([one({ type: 'emphasis_text', text: 'Hay **fuerza** y ==ojo== y **abierto' })]),
    );
    expect(container.querySelector('strong')?.textContent).toBe('fuerza');
    expect(container.querySelector('mark')?.textContent).toBe('ojo');
    expect(container.textContent).toContain('**abierto');
  });

  it('la galería usa imageUrl(imageId) en cada <img> con alt igual al pie', () => {
    const { container } = render(deck([all[7]]));
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/uploads/11111111-1111-4111-8111-111111111111.webp');
    expect(img.getAttribute('alt')).toBe('Tejedores');
  });

  it('muestra "n/total" con el total de diapositivas visibles', () => {
    const { container } = render(deck(all));
    expect(container.querySelector('.progress')?.textContent).toBe(`1/${all.length}`);
  });
});

describe('SlideDeck: llamado a la acción', () => {
  it('con ctaUrl muestra un enlace con rel "noopener noreferrer" y target _blank', () => {
    const { container } = render(deck([all[8]]));
    const a = container.querySelector('a.btn-cta')!;
    expect(a.getAttribute('href')).toBe(WA);
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.textContent).toBe('Entrar al canal');
  });

  it('sin ctaUrl no hay enlace', () => {
    const { container } = render(deck([all[8]], null));
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('Únete a la organización');
  });
});

describe('SlideDeck: seguridad (texto con HTML)', () => {
  const evil = '<script>alert(1)</script><img src=x onerror=alert(1)>';
  const hostile: Slide[] = [
    one({ type: 'cover', title: evil, subtitle: evil }),
    one({ type: 'emphasis_text', text: evil }),
    one({ type: 'quote', text: evil, author: evil, date: evil }),
    one({ type: 'concept', term: evil, definition: evil }),
    one({ type: 'big_figure', figure: evil, caption: evil }),
    one({ type: 'timeline', items: [{ date: evil, text: evil }] }),
    one({ type: 'comparison', left: { title: evil, points: [evil] }, right: { title: evil, points: [evil] } }),
    one({ type: 'gallery', images: [{ imageId: '11111111-1111-4111-8111-111111111111', caption: evil }] }),
    one({ type: 'cta', text: evil, buttonLabel: evil }),
  ];

  it('en el cliente, el HTML queda escapado y no se crea ningún <script> ni onerror', () => {
    const { container } = render(deck(hostile));
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img[onerror]')).toBeNull();
    expect(container.innerHTML).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('en el servidor (renderToString), también queda escapado', () => {
    const html = renderToString(deck(hostile));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    // Estructura real: ningún <script> y ningún atributo de evento (on*) en ningún elemento.
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('script')).toBeNull();
    const withHandlers = [...doc.querySelectorAll('*')].filter((el) =>
      [...el.attributes].some((a) => a.name.toLowerCase().startsWith('on')),
    );
    expect(withHandlers).toEqual([]);
  });
});

describe('SlideDeck: compatible con servidor', () => {
  it('renderToString del deck no falla y trae el contenido', () => {
    const html = renderToString(deck(all));
    expect(html).toContain('data-slide-type="cover"');
    expect(html).toContain('Portada');
  });
});

describe('SlideDeck: botones y recuadros desplegables', () => {
  const detail = one({ type: 'concept', term: 'Plusvalía', definition: 'Trabajo no pagado' });
  const buttons = one({
    type: 'buttons',
    text: '¿Quieres profundizar?',
    items: [
      { label: 'Ver la plusvalía', target: { kind: 'slide', slideId: (detail as { id: string }).id } },
      { label: 'Otra landing', target: { kind: 'landing', slug: 'vivienda-digna' } },
      { label: 'Leer el texto', target: { kind: 'url', url: 'https://www.marxists.org/espanol/' } },
    ],
  });
  const boxes = one({
    type: 'expandables',
    heading: 'Para profundizar',
    items: [{ title: '¿Qué es la plusvalía?', body: 'El **trabajo** no pagado.' }],
  });

  it('cada diapositiva tiene un ancla s-<id> y cada botón lleva a donde dice', () => {
    const { container } = render(deck([buttons, detail]));
    const sections = container.querySelectorAll('section');
    expect(sections[1].id).toBe(`s-${(detail as { id: string }).id}`);
    const links = [...container.querySelectorAll<HTMLAnchorElement>('section[data-slide-type="buttons"] a')];
    expect(links.map((a) => a.textContent)).toEqual(['Ver la plusvalía', 'Otra landing', 'Leer el texto']);
    expect(links[0].getAttribute('href')).toBe(`#s-${(detail as { id: string }).id}`);
    expect(links[1].getAttribute('href')).toBe('/l/vivienda-digna');
    expect(links[1].getAttribute('target')).toBeNull();
    expect(links[2].getAttribute('href')).toBe('https://www.marxists.org/espanol/');
    expect(links[2].getAttribute('target')).toBe('_blank');
    expect(links[2].getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('el botón hacia otra diapositiva se desplaza suavemente hasta ella', () => {
    Element.prototype.scrollIntoView = vi.fn();
    const { container } = render(deck([buttons, detail]));
    const link = container.querySelector<HTMLAnchorElement>('section[data-slide-type="buttons"] a')!;
    const notPrevented = fireEvent.click(link);
    expect(notPrevented).toBe(false);
    const spy = Element.prototype.scrollIntoView as unknown as ReturnType<typeof vi.fn>;
    expect(spy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(spy.mock.contexts[0]).toBe(container.querySelectorAll('section')[1]);
  });

  it('los recuadros son <details> cerrados con su título, y el cuerpo admite negritas', () => {
    const { container } = render(deck([boxes]));
    const d = container.querySelector('details.expandable')!;
    expect(d.hasAttribute('open')).toBe(false);
    expect(d.querySelector('summary')?.textContent).toBe('¿Qué es la plusvalía?');
    expect(d.querySelector('.expandable-body strong')?.textContent).toBe('trabajo');
    expect(container.querySelector('.slide-title')?.textContent).toBe('Para profundizar');
  });
});

describe('SlideDeck: revelado y navegación', () => {
  let observed: Element[];
  let trigger: (entries: Array<{ target: Element; isIntersecting: boolean; intersectionRatio: number }>) => void;

  beforeEach(() => {
    observed = [];
    class FakeObserver {
      constructor(cb: IntersectionObserverCallback) {
        trigger = (entries) => cb(entries as unknown as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
      }
      observe(el: Element) {
        observed.push(el);
      }
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('marca .is-visible la diapositiva que entra en pantalla y actualiza n/total', () => {
    const { container } = render(deck(all));
    const sections = container.querySelectorAll('section');
    expect(observed.length).toBe(all.length);
    expect(sections[2].classList.contains('is-visible')).toBe(false);
    act(() => trigger([{ target: sections[2], isIntersecting: true, intersectionRatio: 0.9 }]));
    expect(sections[2].classList.contains('is-visible')).toBe(true);
    expect(container.querySelector('.progress')?.textContent).toBe(`3/${all.length}`);
  });

  it('la salida: al irse de pantalla pierde .is-visible y marca hacia dónde sale', () => {
    const { container } = render(deck(all));
    const sections = container.querySelectorAll('section');
    act(() => trigger([{ target: sections[1], isIntersecting: true, intersectionRatio: 0.9 }]));
    expect(sections[1].classList.contains('is-visible')).toBe(true);
    // Sale por arriba (su borde inferior queda por encima de la parte alta de la ventana).
    sections[1].getBoundingClientRect = () => ({ top: -500, bottom: 100 }) as DOMRect;
    act(() => trigger([{ target: sections[1], isIntersecting: true, intersectionRatio: 0.1 }]));
    expect(sections[1].classList.contains('is-visible')).toBe(false);
    expect(sections[1].getAttribute('data-exit')).toBe('up');
    // Sale por abajo.
    act(() => trigger([{ target: sections[1], isIntersecting: true, intersectionRatio: 0.9 }]));
    sections[1].getBoundingClientRect = () => ({ top: 700, bottom: 1300 }) as DOMRect;
    act(() => trigger([{ target: sections[1], isIntersecting: false, intersectionRatio: 0 }]));
    expect(sections[1].classList.contains('is-visible')).toBe(false);
    expect(sections[1].getAttribute('data-exit')).toBe('down');
  });

  it('con prefers-reduced-motion todo es visible desde el inicio', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} }));
    const { container } = render(deck(all));
    const sections = [...container.querySelectorAll('section')];
    expect(sections.every((s) => s.classList.contains('is-visible'))).toBe(true);
  });

  it('el teclado no se secuestra cuando se escribe en un campo (barra espaciadora y flechas)', () => {
    const { container } = render(deck(all));
    const input = document.createElement('input');
    document.body.appendChild(input);
    const spy = Element.prototype.scrollIntoView as unknown as ReturnType<typeof vi.fn>;
    for (const key of [' ', 'ArrowDown', 'PageDown']) {
      const notCancelled = fireEvent.keyDown(input, { key });
      expect(notCancelled, key).toBe(true); // nadie llamó a preventDefault
    }
    expect(spy).not.toHaveBeenCalled();
    expect(container.querySelectorAll('section').length).toBe(all.length);
    input.remove();
  });

  it('con keyboard={false} las teclas no mueven la presentación', () => {
    render(<SlideDeck slides={all} ctaUrl={null} imageUrl={imageUrl} themeId="indice-blanco" keyboard={false} />);
    const spy = Element.prototype.scrollIntoView as unknown as ReturnType<typeof vi.fn>;
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('las flechas ↓ y ↑ desplazan a la diapositiva siguiente y anterior', () => {
    const { container } = render(deck(all));
    const sections = container.querySelectorAll('section');
    const spy = Element.prototype.scrollIntoView as unknown as ReturnType<typeof vi.fn>;
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(spy.mock.instances[0]).toBe(sections[1]);
    act(() => trigger([{ target: sections[1], isIntersecting: true, intersectionRatio: 0.9 }]));
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(spy.mock.instances[1]).toBe(sections[0]);
  });
});
