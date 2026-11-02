import { z } from 'zod';
import { isAllowedCtaUrl } from './cta';
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
});
export type LandingInput = z.infer<typeof LandingInputSchema>;
