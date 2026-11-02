import { describe, expect, it } from 'vitest';
import { LandingInputSchema, SlideSchema, isAllowedLinkUrl } from '../src/index';

const id = () => crypto.randomUUID();
const base = { hidden: false, animation: 'fade' as const };

const landing = (slides: unknown[]) => ({
  title: 'Vivienda',
  description: '',
  slug: 'vivienda',
  themeId: 'indice-blanco',
  status: 'draft',
  slides,
  ctaUrl: null,
});

describe('isAllowedLinkUrl', () => {
  it('acepta https de cualquier sitio y rechaza el resto', () => {
    expect(isAllowedLinkUrl('https://es.wikipedia.org/wiki/Marx')).toBe(true);
    expect(isAllowedLinkUrl('http://ejemplo.mx')).toBe(false);
    expect(isAllowedLinkUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedLinkUrl('data:text/html,hola')).toBe(false);
    expect(isAllowedLinkUrl('https://user:pass@ejemplo.mx')).toBe(false);
    expect(isAllowedLinkUrl('no es url')).toBe(false);
  });
});

describe('diapositiva de botones', () => {
  const target = id();
  const buttons = (items: unknown[]) => ({ ...base, id: id(), type: 'buttons', items });

  it('acepta destinos: otra diapositiva, otra landing y enlace externo', () => {
    const s = buttons([
      { label: 'Más sobre la plusvalía', target: { kind: 'slide', slideId: target } },
      { label: 'Otra landing', target: { kind: 'landing', slug: 'vivienda-digna' } },
      { label: 'Leer el texto', target: { kind: 'url', url: 'https://www.marxists.org/espanol/' } },
    ]);
    expect(SlideSchema.safeParse(s).success).toBe(true);
  });

  it('rechaza sin botones, con más de 12, destino mal formado o enlace no https', () => {
    expect(SlideSchema.safeParse(buttons([])).success).toBe(false);
    const one = { label: 'x', target: { kind: 'landing', slug: 'a' } };
    expect(SlideSchema.safeParse(buttons(Array(13).fill(one))).success).toBe(false);
    expect(SlideSchema.safeParse(buttons([{ label: 'x', target: { kind: 'landing', slug: 'No Valido!' } }])).success).toBe(false);
    expect(SlideSchema.safeParse(buttons([{ label: 'x', target: { kind: 'url', url: 'javascript:alert(1)' } }])).success).toBe(false);
    expect(SlideSchema.safeParse(buttons([{ label: '', target: { kind: 'landing', slug: 'a' } }])).success).toBe(false);
  });

  it('una landing exige que el destino "otra diapositiva" exista y no esté oculto', () => {
    const detail = { ...base, id: target, type: 'concept', term: 'Plusvalía', definition: 'x' };
    const btn = (slideId: string) => buttons([{ label: 'Detalle', target: { kind: 'slide', slideId } }]);
    expect(LandingInputSchema.safeParse(landing([btn(target), detail])).success).toBe(true);
    // Que el destino esté antes o después no importa.
    expect(LandingInputSchema.safeParse(landing([detail, btn(target)])).success).toBe(true);
    // No existe.
    const missing = LandingInputSchema.safeParse(landing([btn(id()), detail]));
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.error.issues[0].path.slice(0, 2)).toEqual(['slides', 0]);
    // Existe pero está oculta: no se publica, el botón quedaría roto.
    expect(LandingInputSchema.safeParse(landing([btn(target), { ...detail, hidden: true }])).success).toBe(false);
  });
});

describe('diapositiva de recuadros desplegables', () => {
  const boxes = (items: unknown[], heading?: string) => ({ ...base, id: id(), type: 'expandables', heading, items });

  it('acepta recuadros con título y texto breve', () => {
    expect(SlideSchema.safeParse(boxes([{ title: '¿Qué es la plusvalía?', body: 'El **trabajo** no pagado.' }], 'Para profundizar')).success).toBe(true);
  });
  it('rechaza sin recuadros, más de 20, o con título/texto vacío', () => {
    expect(SlideSchema.safeParse(boxes([])).success).toBe(false);
    expect(SlideSchema.safeParse(boxes(Array(21).fill({ title: 'a', body: 'b' }))).success).toBe(false);
    expect(SlideSchema.safeParse(boxes([{ title: '', body: 'b' }])).success).toBe(false);
    expect(SlideSchema.safeParse(boxes([{ title: 'a', body: '' }])).success).toBe(false);
  });
});
