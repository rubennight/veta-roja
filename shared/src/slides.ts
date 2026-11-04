import { z } from 'zod';
import { isAllowedCtaUrl, isAllowedLinkUrl } from './cta';
import { isValidSlug } from './slug';
import { getTheme } from './themes';

export const ANIMATIONS = ['none', 'fade', 'slide-up', 'underline', 'zoom'] as const;
export type Animation = (typeof ANIMATIONS)[number];

export const MAX_SLIDES = 30;

const short = z.string().trim().min(1).max(300);
const long = z.string().trim().min(1).max(5000);
const optionalShort = z.string().trim().max(300).optional();

const base = {
  id: z.string().uuid(),
  hidden: z.boolean().default(false),
  animation: z.enum(ANIMATIONS).default('fade'),
};

/** A dónde lleva un botón: otra diapositiva de esta landing, otra landing del sitio o un enlace externo. */
export const ButtonTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('slide'), slideId: z.string().uuid() }),
  z.object({ kind: z.literal('landing'), slug: z.string().refine(isValidSlug, 'Slug no válido') }),
  z.object({ kind: z.literal('url'), url: z.string().max(2000).refine(isAllowedLinkUrl, 'El enlace debe ser https') }),
]);
export type ButtonTarget = z.infer<typeof ButtonTargetSchema>;

export const MAX_BUTTONS = 12;
export const MAX_EXPANDABLES = 20;

const Column = z.object({ title: short, points: z.array(short).max(20) });

export const SlideSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('cover'), title: short, subtitle: optionalShort, imageId: z.string().uuid().optional() }),
  z.object({ ...base, type: z.literal('emphasis_text'), text: long }),
  z.object({ ...base, type: z.literal('quote'), text: long, author: optionalShort, date: optionalShort }),
  z.object({ ...base, type: z.literal('concept'), term: short, definition: long }),
  z.object({ ...base, type: z.literal('big_figure'), figure: short, caption: short }),
  z.object({
    ...base,
    type: z.literal('timeline'),
    items: z.array(z.object({ date: short, text: long })).min(1).max(30),
  }),
  z.object({ ...base, type: z.literal('comparison'), left: Column, right: Column }),
  z.object({
    ...base,
    type: z.literal('gallery'),
    images: z.array(z.object({ imageId: z.string().uuid(), caption: optionalShort })).min(1).max(30),
  }),
  z.object({ ...base, type: z.literal('cta'), text: long, buttonLabel: short }),
  z.object({
    ...base,
    type: z.literal('buttons'),
    text: optionalShort,
    items: z.array(z.object({ label: short, target: ButtonTargetSchema })).min(1).max(MAX_BUTTONS),
  }),
  z.object({
    ...base,
    type: z.literal('expandables'),
    heading: optionalShort,
    items: z.array(z.object({ title: short, body: long })).min(1).max(MAX_EXPANDABLES),
  }),
]);
export type Slide = z.infer<typeof SlideSchema>;
export type SlideType = Slide['type'];

export const LandingInputSchema = z.object({
  title: short,
  description: z.string().trim().max(500),
  slug: z.string().refine(isValidSlug, 'Slug no válido'),
  themeId: z.string().refine((id) => getTheme(id) !== undefined, 'Theme desconocido'),
  status: z.enum(['draft', 'published']),
  slides: z.array(SlideSchema).max(MAX_SLIDES),
  ctaUrl: z.string().refine(isAllowedCtaUrl, 'El enlace debe ser https de WhatsApp').nullable(),
  /** Grupo del panel. Omitido = no cambiar (al crear: sin grupo); null = sin grupo. */
  groupId: z.uuid().nullable().optional(),
}).superRefine((landing, ctx) => {
  // Un botón hacia otra diapositiva solo sirve si esa diapositiva existe y se publica (no está oculta).
  const published = new Set(landing.slides.filter((s) => !s.hidden).map((s) => s.id));
  landing.slides.forEach((slide, i) => {
    if (slide.type !== 'buttons') return;
    slide.items.forEach((item, j) => {
      if (item.target.kind === 'slide' && !published.has(item.target.slideId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['slides', i, 'items', j, 'target'],
          message: 'apunta a una diapositiva que no existe o está oculta',
        });
      }
    });
  });
});
export type LandingInput = z.infer<typeof LandingInputSchema>;

export const MAX_GROUP_NAME = 60;
export const GroupInputSchema = z.object({ name: z.string().trim().min(1).max(MAX_GROUP_NAME) });
export type GroupInput = z.infer<typeof GroupInputSchema>;
