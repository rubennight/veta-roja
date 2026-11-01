import sharp from 'sharp';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_WIDTH = 1600;
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);

export class UnsupportedImageError extends Error {
  constructor() {
    super('Formato de imagen no admitido: usa JPEG, PNG o WebP');
  }
}

/**
 * Detecta el formato real por el contenido (no por el nombre ni el tipo declarado),
 * acepta solo JPEG, PNG y WebP, escala a 1600 px de ancho como máximo y exporta WebP sin metadatos.
 */
export async function processImage(buffer: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  try {
    const meta = await sharp(buffer).metadata();
    if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) throw new UnsupportedImageError();
    const { data, info } = await sharp(buffer)
      .rotate()
      .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch (err) {
    if (err instanceof UnsupportedImageError) throw err;
    throw new UnsupportedImageError();
  }
}
