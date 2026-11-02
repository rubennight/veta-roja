import QRCode from 'qrcode';
import sharp from 'sharp';

/** Margen de silencio del QR, en módulos. */
const MARGIN = 4;
/** Fracción del lado del código (sin margen) que ocupa el emblema central. */
const LOGO_RATIO = 0.22;

export interface QrOptions {
  /** Martillo y hoz al centro. Por omisión sí. */
  logo?: boolean;
}

/**
 * Emblema minimalista (martillo y hoz) en un lienzo de 100×100: trazo negro sobre una placa blanca.
 * La placa deja una zona limpia para que el centro del QR no se confunda con módulos.
 */
const LOGO_BODY =
  '<rect width="100" height="100" rx="16" fill="#fff"/>' +
  // El dibujo se amplía un poco para llenar la placa.
  '<g transform="translate(50 50) scale(1.1) translate(-50 -52)">' +
  // Hoz: hoja en media luna y mango corto.
  '<path d="M57 83C13 80 7 33 50 19C26 37 32 67 57 83Z" fill="#111"/>' +
  '<path d="M57 83L71 93" stroke="#111" stroke-width="8" stroke-linecap="round" fill="none"/>' +
  // Martillo: mango en diagonal y cabeza cruzada.
  '<path d="M31 80L66 36" stroke="#111" stroke-width="8" stroke-linecap="round" fill="none"/>' +
  '<path d="M55 22L80 42" stroke="#111" stroke-width="15" fill="none"/>' +
  '</g>';

/** El emblema como imagen SVG independiente. */
export function logoSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${LOGO_BODY}</svg>`;
}

/** Lado del emblema y su esquina superior izquierda, en módulos del QR, para un código de `size` módulos (con margen). */
function logoBox(size: number): { side: number; offset: number } {
  const side = (size - 2 * MARGIN) * LOGO_RATIO;
  return { side, offset: (size - side) / 2 };
}

/** Con emblema se sube la corrección de errores a H (tolera hasta ~30 % tapado). */
function qrOptions(logo: boolean) {
  return { errorCorrectionLevel: logo ? 'H' : 'M', margin: MARGIN } as const;
}

export function renderQr(text: string, format: 'svg', options?: QrOptions): Promise<string>;
export function renderQr(text: string, format: 'png', options?: QrOptions): Promise<Buffer>;
export async function renderQr(text: string, format: 'svg' | 'png', { logo = true }: QrOptions = {}): Promise<string | Buffer> {
  const opts = qrOptions(logo);
  if (format === 'svg') {
    const svg = await QRCode.toString(text, { ...opts, type: 'svg' });
    if (!logo) return svg;
    const size = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)?.[1]);
    const { side, offset } = logoBox(size);
    const group = `<g id="martillo-y-hoz" transform="translate(${offset} ${offset}) scale(${side / 100})">${LOGO_BODY}</g>`;
    return svg.replace('</svg>', `${group}</svg>`);
  }

  const width = 1024;
  const png = await QRCode.toBuffer(text, { ...opts, type: 'png', width });
  if (!logo) return png;
  // Cantidad de módulos con margen: se obtiene del propio código para colocar el emblema en el centro exacto.
  const size = QRCode.create(text, { errorCorrectionLevel: opts.errorCorrectionLevel }).modules.size + 2 * MARGIN;
  const { side } = logoBox(size);
  const px = Math.round((side / size) * width);
  const emblem = await sharp(Buffer.from(logoSvg()), { density: 300 }).resize(px, px).png().toBuffer();
  return sharp(png)
    .composite([{ input: emblem, gravity: 'center' }])
    .png()
    .toBuffer();
}
