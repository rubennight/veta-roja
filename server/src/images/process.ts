import sharp from 'sharp';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_WIDTH = 1600;
/** Ancho de la copia JPEG que se usa como imagen de vista previa al compartir el enlace. */
export const SHARE_IMAGE_WIDTH = 1200;
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);

export class UnsupportedImageError extends Error {
  constructor() {
    super('Formato de imagen no admitido: usa JPEG, PNG o WebP');
  }
}

export interface ProcessedImage {
  /** WebP de hasta 1600 px, el que muestran las landings. */
  data: Buffer;
  width: number;
  height: number;
  /** JPEG de hasta 1200 px, aplanado sobre blanco, para la vista previa al compartir (og:image). */
  share: Buffer;
}

/**
 * Detecta el formato real por el contenido (no por el nombre ni el tipo declarado),
 * acepta solo JPEG, PNG y WebP, escala a 1600 px de ancho como máximo y exporta WebP sin metadatos.
 * Además genera una copia JPEG para compartir.
 */
export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  try {
    const meta = await sharp(buffer).metadata();
    if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) throw new UnsupportedImageError();
    const { data, info } = await sharp(buffer)
      .rotate()
      .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    const share = await sharp(buffer)
      .rotate()
      .resize({ width: SHARE_IMAGE_WIDTH, withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    return { data, width: info.width, height: info.height, share };
  } catch (err) {
    if (err instanceof UnsupportedImageError) throw err;
    throw new UnsupportedImageError();
  }
}
