import { describe, expect, it } from 'vitest';
import { LandingInputSchema, SlideSchema, type Slide, type SlideType } from '@veta-roja/shared';
import { editorReducer, emptyState, newSlide, toInput, SLIDE_TYPES, type EditorState } from '../src/admin/editorState';

const IMAGE = '11111111-1111-4111-8111-111111111111';

function withSlides(n: number): EditorState {
  let s = emptyState();
  for (let i = 0; i < n; i++) s = editorReducer(s, { type: 'addSlide', slideType: 'emphasis_text' });
  return s;
}
const ids = (s: EditorState) => s.slides.map((x) => x.id);

describe('newSlide', () => {
  it('cada uno de los 9 tipos nace con datos que pasan SlideSchema (la galería, al añadir una imagen)', () => {
    expect(SLIDE_TYPES.map((t) => t.type).sort()).toEqual(
      ['big_figure', 'comparison', 'concept', 'cover', 'cta', 'emphasis_text', 'gallery', 'quote', 'timeline'].sort(),
    );
    for (const { type } of SLIDE_TYPES) {
      let slide = newSlide(type as SlideType);
      if (slide.type === 'gallery') slide = { ...slide, images: [{ imageId: IMAGE }] };
      expect(SlideSchema.safeParse(slide).success, type).toBe(true);
    }
  });

  it('la galería vacía todavía no es válida (falta la imagen)', () => {
    expect(SlideSchema.safeParse(newSlide('gallery')).success).toBe(false);
  });

  it('cada diapositiva nueva trae un id distinto, visible y con animación "fade"', () => {
    const a = newSlide('quote');
    const b = newSlide('quote');
    expect(a.id).not.toBe(b.id);
    expect(a.hidden).toBe(false);
    expect(a.animation).toBe('fade');
  });
});

describe('editorReducer: diapositivas', () => {
  it('addSlide agrega al final', () => {
    const s = editorReducer(withSlides(2), { type: 'addSlide', slideType: 'quote' });
    expect(s.slides.map((x) => x.type)).toEqual(['emphasis_text', 'emphasis_text', 'quote']);
  });

  it('addSlide no pasa de 30', () => {
    const s = editorReducer(withSlides(30), { type: 'addSlide', slideType: 'quote' });
    expect(s.slides.length).toBe(30);
  });

  it('moveSlide sube y baja, y no se sale de los extremos', () => {
    const s = withSlides(3);
    const [a, b, c] = ids(s);
    expect(ids(editorReducer(s, { type: 'moveSlide', id: b, direction: -1 }))).toEqual([b, a, c]);
    expect(ids(editorReducer(s, { type: 'moveSlide', id: b, direction: 1 }))).toEqual([a, c, b]);
    expect(ids(editorReducer(s, { type: 'moveSlide', id: a, direction: -1 }))).toEqual([a, b, c]);
    expect(ids(editorReducer(s, { type: 'moveSlide', id: c, direction: 1 }))).toEqual([a, b, c]);
  });

  it('toggleHidden oculta y vuelve a mostrar', () => {
    const s = withSlides(1);
    const hidden = editorReducer(s, { type: 'toggleHidden', id: s.slides[0].id });
    expect(hidden.slides[0].hidden).toBe(true);
    expect(editorReducer(hidden, { type: 'toggleHidden', id: s.slides[0].id }).slides[0].hidden).toBe(false);
  });

  it('duplicateSlide inserta una copia con id distinto justo después y sin compartir objetos', () => {
    let s = withSlides(2);
    const [first] = ids(s);
    s = editorReducer(s, { type: 'updateSlide', id: first, patch: { text: 'Original' } as Partial<Slide> });
    const dup = editorReducer(s, { type: 'duplicateSlide', id: first });
    expect(dup.slides.length).toBe(3);
    expect(dup.slides[1].id).not.toBe(first);
    expect((dup.slides[1] as { text: string }).text).toBe('Original');
    const changed = editorReducer(dup, { type: 'updateSlide', id: dup.slides[1].id, patch: { text: 'Copia' } as Partial<Slide> });
    expect((changed.slides[0] as { text: string }).text).toBe('Original');
  });

  it('duplicar en el límite de 30 no agrega nada', () => {
    const s = withSlides(30);
    expect(editorReducer(s, { type: 'duplicateSlide', id: s.slides[0].id }).slides.length).toBe(30);
  });

  it('removeSlide elimina solo esa diapositiva', () => {
    const s = withSlides(3);
    const [a, b, c] = ids(s);
    expect(ids(editorReducer(s, { type: 'removeSlide', id: b }))).toEqual([a, c]);
  });
});

describe('editorReducer: slug', () => {
  it('el slug se sugiere desde el título hasta que se edita a mano; después ya no cambia', () => {
    let s = emptyState();
    s = editorReducer(s, { type: 'setTitle', value: 'Vivienda Digna' });
    expect(s.slug).toBe('vivienda-digna');
    s = editorReducer(s, { type: 'setTitle', value: 'Vivienda Digna en Zacatecas' });
    expect(s.slug).toBe('vivienda-digna-en-zacatecas');
    s = editorReducer(s, { type: 'setSlug', value: 'mi-slug' });
    s = editorReducer(s, { type: 'setTitle', value: 'Otro título' });
    expect(s.slug).toBe('mi-slug');
  });
});

describe('toInput', () => {
  it('un estado completo pasa LandingInputSchema y el enlace vacío es null', () => {
    let s = emptyState();
    s = editorReducer(s, { type: 'setTitle', value: 'Vivienda' });
    s = editorReducer(s, { type: 'addSlide', slideType: 'cover' });
    s = { ...s, ctaUrl: '   ' };
    const parsed = LandingInputSchema.safeParse(toInput(s));
    expect(parsed.success).toBe(true);
    expect(toInput(s).ctaUrl).toBeNull();
    expect(toInput({ ...s, ctaUrl: ' https://whatsapp.com/channel/abc ' }).ctaUrl).toBe('https://whatsapp.com/channel/abc');
  });
});
