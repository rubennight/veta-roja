import { MAX_SLIDES, normalizeSlug, type Slide, type SlideType } from '@veta-roja/shared';
import type { Landing } from './api';

export interface EditorState {
  title: string;
  description: string;
  slug: string;
  /** Si el slug ya se editó a mano, deja de sugerirse desde el título. */
  slugTouched: boolean;
  themeId: string;
  status: 'draft' | 'published';
  /** Texto del formulario; vacío significa "usar el enlace por defecto". */
  ctaUrl: string;
  /** Id del grupo; vacío significa "sin grupo". */
  groupId: string;
  slides: Slide[];
}

export const SLIDE_TYPES: Array<{ type: SlideType; label: string; hint: string }> = [
  { type: 'cover', label: 'Portada', hint: 'Título, subtítulo e imagen de fondo' },
  { type: 'emphasis_text', label: 'Texto con énfasis', hint: 'Párrafo con palabras resaltadas' },
  { type: 'quote', label: 'Cita destacada', hint: 'Frase, autor y fecha' },
  { type: 'concept', label: 'Recuadro de concepto', hint: 'Término y definición' },
  { type: 'big_figure', label: 'Dato o cifra grande', hint: 'Un número enorme con su explicación' },
  { type: 'timeline', label: 'Línea de tiempo', hint: 'Hechos con fecha, en orden' },
  { type: 'comparison', label: 'Comparación', hint: 'Dos columnas con título y puntos' },
  { type: 'gallery', label: 'Imagen o galería', hint: 'Imágenes con pie de foto' },
  { type: 'cta', label: 'Llamado a la acción', hint: 'Invitación y botón al canal de WhatsApp' },
  { type: 'buttons', label: 'Botones', hint: 'Varios botones hacia otras diapositivas, otras landings o enlaces' },
  { type: 'expandables', label: 'Recuadros desplegables', hint: 'Recuadros que se abren y cierran con una explicación breve' },
];

export const slideTypeLabel = (type: SlideType): string => SLIDE_TYPES.find((t) => t.type === type)?.label ?? type;

export const ANIMATION_LABELS: Record<string, string> = {
  none: 'Sin animación',
  fade: 'Aparecer',
  'slide-up': 'Deslizar hacia arriba',
  underline: 'Subrayar',
  zoom: 'Ampliar',
};

export function emptyState(): EditorState {
  return { title: '', description: '', slug: '', slugTouched: false, themeId: 'indice-blanco', status: 'draft', ctaUrl: '', groupId: '', slides: [] };
}

export function stateFromLanding(l: Landing): EditorState {
  return {
    title: l.title,
    description: l.description,
    slug: l.slug,
    slugTouched: true,
    themeId: l.themeId,
    status: l.status,
    ctaUrl: l.ctaUrl ?? '',
    groupId: l.groupId ?? '',
    slides: l.slides,
  };
}

/** Botón nuevo: lleva a otra diapositiva de la misma landing, que todavía hay que elegir. */
export function newButton() {
  return { label: 'Saber más', target: { kind: 'slide' as const, slideId: '' } };
}

/** Diapositiva nueva con contenido de ejemplo válido (la galería necesita al menos una imagen). */
export function newSlide(type: SlideType): Slide {
  const base = { id: crypto.randomUUID(), hidden: false, animation: 'fade' as const };
  switch (type) {
    case 'cover':
      return { ...base, type, title: 'Título de la landing', subtitle: 'Una frase que invite a seguir leyendo' };
    case 'emphasis_text':
      return { ...base, type, text: 'Escribe aquí. Usa **negritas** y ==resaltados== para dar énfasis.' };
    case 'quote':
      return { ...base, type, text: 'Una frase que se quede en la memoria', author: '', date: '' };
    case 'concept':
      return { ...base, type, term: 'Concepto', definition: 'Explica el concepto con claridad.' };
    case 'big_figure':
      return { ...base, type, figure: '100', caption: 'Qué significa este número' };
    case 'timeline':
      return { ...base, type, items: [{ date: '1900', text: 'Primer hecho' }] };
    case 'comparison':
      return {
        ...base,
        type,
        left: { title: 'Lado A', points: ['Primer punto'] },
        right: { title: 'Lado B', points: ['Primer punto'] },
      };
    case 'gallery':
      return { ...base, type, images: [] };
    case 'cta':
      return { ...base, type, text: 'La historia se hace organizándose. Súmate.', buttonLabel: 'Entrar al canal' };
    case 'buttons':
      return { ...base, type, text: '', items: [newButton()] };
    case 'expandables':
      return { ...base, type, heading: '', items: [{ title: 'Concepto', body: 'Explicación breve.' }] };
  }
}

export type EditorAction =
  | { type: 'load'; state: EditorState }
  | { type: 'setTitle'; value: string }
  | { type: 'setSlug'; value: string }
  | { type: 'setField'; field: 'description' | 'themeId' | 'status' | 'ctaUrl' | 'groupId'; value: string }
  | { type: 'addSlide'; slideType: SlideType }
  | { type: 'updateSlide'; id: string; patch: Partial<Slide> }
  | { type: 'moveSlide'; id: string; direction: -1 | 1 }
  | { type: 'toggleHidden'; id: string }
  | { type: 'duplicateSlide'; id: string }
  | { type: 'removeSlide'; id: string };

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'load':
      return action.state;
    case 'setTitle':
      return { ...state, title: action.value, slug: state.slugTouched ? state.slug : normalizeSlug(action.value) };
    case 'setSlug':
      return { ...state, slug: action.value, slugTouched: true };
    case 'setField':
      return { ...state, [action.field]: action.value } as EditorState;
    case 'addSlide':
      if (state.slides.length >= MAX_SLIDES) return state;
      return { ...state, slides: [...state.slides, newSlide(action.slideType)] };
    case 'updateSlide':
      return { ...state, slides: state.slides.map((s) => (s.id === action.id ? ({ ...s, ...action.patch } as Slide) : s)) };
    case 'moveSlide': {
      const from = state.slides.findIndex((s) => s.id === action.id);
      const to = from + action.direction;
      if (from < 0 || to < 0 || to >= state.slides.length) return state;
      const slides = [...state.slides];
      [slides[from], slides[to]] = [slides[to], slides[from]];
      return { ...state, slides };
    }
    case 'toggleHidden':
      return { ...state, slides: state.slides.map((s) => (s.id === action.id ? { ...s, hidden: !s.hidden } : s)) };
    case 'duplicateSlide': {
      if (state.slides.length >= MAX_SLIDES) return state;
      const i = state.slides.findIndex((s) => s.id === action.id);
      if (i < 0) return state;
      const copy = { ...structuredClone(state.slides[i]), id: crypto.randomUUID() } as Slide;
      return { ...state, slides: [...state.slides.slice(0, i + 1), copy, ...state.slides.slice(i + 1)] };
    }
    case 'removeSlide':
      return { ...state, slides: state.slides.filter((s) => s.id !== action.id) };
  }
}

/** Datos listos para validar con LandingInputSchema y enviar a la API. */
export function toInput(state: EditorState) {
  const cta = state.ctaUrl.trim();
  // Limpieza al guardar: sin líneas vacías en las columnas y sin imágenes todavía sin subir.
  const slides = state.slides.map((s): Slide => {
    if (s.type === 'comparison') {
      const clean = (c: typeof s.left) => ({ ...c, points: c.points.map((p) => p.trim()).filter(Boolean) });
      return { ...s, left: clean(s.left), right: clean(s.right) };
    }
    if (s.type === 'gallery') return { ...s, images: s.images.filter((i) => i.imageId !== '') };
    return s;
  });
  return {
    title: state.title,
    description: state.description,
    slug: state.slug,
    themeId: state.themeId,
    status: state.status,
    slides,
    ctaUrl: cta === '' ? null : cta,
    groupId: state.groupId === '' ? null : state.groupId,
  };
}
