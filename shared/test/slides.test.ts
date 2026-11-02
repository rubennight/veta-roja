import { describe, expect, it } from 'vitest';
import { LandingInputSchema, SlideSchema, type Slide } from '../src/slides';

const id = () => crypto.randomUUID();
const base = { hidden: false, animation: 'fade' as const };

const samples: Slide[] = [
  { ...base, id: id(), type: 'cover', title: 'T' },
  { ...base, id: id(), type: 'emphasis_text', text: 'a **b**' },
  { ...base, id: id(), type: 'quote', text: '¡Vivir trabajando o morir luchando!' },
  { ...base, id: id(), type: 'concept', term: 'Contradicción', definition: 'x' },
  { ...base, id: id(), type: 'big_figure', figure: '10 000', caption: 'encarcelados o deportados' },
  { ...base, id: id(), type: 'timeline', items: [{ date: '1831', text: 'Lyon' }] },
  {
    ...base,
    id: id(),
    type: 'comparison',
    left: { title: 'Capital', points: ['a'] },
    right: { title: 'Trabajo', points: ['b'] },
  },
  { ...base, id: id(), type: 'gallery', images: [{ imageId: id() }] },
  { ...base, id: id(), type: 'cta', text: 'Únete', buttonLabel: 'Entrar al canal' },
  { ...base, id: id(), type: 'buttons', items: [{ label: 'Más', target: { kind: 'landing', slug: 'otra' } }] },
  { ...base, id: id(), type: 'expandables', items: [{ title: 'Qué es', body: 'Esto' }] },
];

const landing = (slides: unknown[]) => ({
  title: 'Vivienda',
  description: 'd',
  slug: 'vivienda',
  themeId: 'indice-blanco',
  status: 'draft',
  slides,
  ctaUrl: null,
});

describe('SlideSchema', () => {
  it('acepta los 11 tipos con datos mínimos válidos', () => {
    for (const s of samples) expect(SlideSchema.safeParse(s).success, s.type).toBe(true);
    expect(new Set(samples.map((s) => s.type)).size).toBe(11);
  });
  it('rechaza timeline sin items y gallery sin imágenes', () => {
    expect(SlideSchema.safeParse({ ...samples[5], items: [] }).success).toBe(false);
    expect(SlideSchema.safeParse({ ...samples[7], images: [] }).success).toBe(false);
  });
  it('aplica hidden=false y animation=fade por defecto', () => {
    const r = SlideSchema.parse({ id: id(), type: 'cover', title: 'T' });
    expect(r.hidden).toBe(false);
    expect(r.animation).toBe('fade');
  });
});

describe('LandingInputSchema', () => {
  it('acepta exactamente 30 diapositivas y rechaza 31', () => {
    const mk = (n: number) => Array.from({ length: n }, () => ({ ...samples[0], id: id() }));
    expect(LandingInputSchema.safeParse(landing(mk(30))).success).toBe(true);
    expect(LandingInputSchema.safeParse(landing(mk(31))).success).toBe(false);
  });
  it('rechaza themeId desconocido', () => {
    expect(LandingInputSchema.safeParse({ ...landing([]), themeId: 'no-existe' }).success).toBe(false);
  });
  it('rechaza slug reservado y ctaUrl fuera de WhatsApp', () => {
    expect(LandingInputSchema.safeParse({ ...landing([]), slug: 'admin' }).success).toBe(false);
    expect(LandingInputSchema.safeParse({ ...landing([]), ctaUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(LandingInputSchema.safeParse({ ...landing([]), ctaUrl: 'https://whatsapp.com/channel/abc' }).success).toBe(true);
  });
});
