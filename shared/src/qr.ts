import { z } from 'zod';

/** Formas de los módulos (los cuadritos del código). */
export const QR_BODY_SHAPES = ['square', 'rounded', 'dots', 'vertical', 'horizontal'] as const;
/** Formas del marco de los tres ojos (los cuadros grandes de las esquinas). */
export const QR_EYE_FRAMES = ['square', 'rounded', 'circle', 'leaf'] as const;
/** Formas de la bolita central de cada ojo. */
export const QR_EYE_BALLS = ['square', 'rounded', 'circle', 'diamond'] as const;
export const QR_GRADIENTS = ['none', 'linear', 'radial'] as const;
export const QR_ECC_LEVELS = ['L', 'M', 'Q', 'H'] as const;

export const QR_LABELS = {
  body: { square: 'Cuadrado', rounded: 'Redondeado', dots: 'Puntos', vertical: 'Barras verticales', horizontal: 'Barras horizontales' },
  eyeFrame: { square: 'Cuadrado', rounded: 'Redondeado', circle: 'Círculo', leaf: 'Hoja' },
  eyeBall: { square: 'Cuadrado', rounded: 'Redondeado', circle: 'Círculo', diamond: 'Rombo' },
  gradient: { none: 'Color liso', linear: 'Degradado lineal', radial: 'Degradado radial' },
} as const;

const hex = z
  .string()
  .regex(/^#?[0-9a-fA-F]{6}$/, 'color inválido')
  .transform((v) => `#${v.replace('#', '').toLowerCase()}`);

/** Color opcional: vacío o ausente = "el mismo que el del código". */
const optionalHex = z
  .union([hex, z.literal(''), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

const bool = z.union([z.boolean(), z.enum(['0', '1']).transform((v) => v === '1')]);

/** Todo lo que se puede personalizar de un QR. Llega como parámetros de dirección (texto), por eso se coacciona. */
export const QrStyleSchema = z.object({
  body: z.enum(QR_BODY_SHAPES).default('square'),
  eyeFrame: z.enum(QR_EYE_FRAMES).default('square'),
  eyeBall: z.enum(QR_EYE_BALLS).default('square'),
  fg: hex.default('#000000'),
  gradient: z.enum(QR_GRADIENTS).default('none'),
  fg2: hex.default('#7a0000'),
  angle: z.coerce.number().int().min(0).max(360).default(45),
  /** Color del fondo, o "none" para fondo transparente. */
  bg: z.union([hex, z.literal('none')]).default('#ffffff'),
  eyeFrameColor: optionalHex.default(null),
  eyeBallColor: optionalHex.default(null),
  /** Martillo y hoz al centro. */
  logo: bool.default(true),
  /** Lado del emblema, en % del lado del código. */
  logoSize: z.coerce.number().int().min(10).max(28).default(22),
  /** Corrección de errores (con emblema siempre se usa H). */
  ecc: z.enum(QR_ECC_LEVELS).default('M'),
  /** Margen blanco alrededor, en módulos. */
  margin: z.coerce.number().int().min(0).max(10).default(4),
  /** Lado de la imagen PNG, en píxeles. */
  size: z.coerce.number().int().min(256).max(4096).default(1024),
});

export type QrStyle = z.output<typeof QrStyleSchema>;

export const DEFAULT_QR_STYLE: QrStyle = QrStyleSchema.parse({});

/** Parámetros de dirección con solo lo que difiere del estilo por omisión (cadena vacía si nada difiere). */
export function qrStyleToQuery(style: QrStyle): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(DEFAULT_QR_STYLE) as (keyof QrStyle)[]) {
    if (style[key] === DEFAULT_QR_STYLE[key]) continue;
    const value = style[key];
    params.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : value === null ? '' : String(value));
  }
  return params.toString();
}

function luminance(color: string): number {
  const channel = (i: number) => {
    const c = parseInt(color.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** Relación de contraste WCAG entre dos colores `#rrggbb` (1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
