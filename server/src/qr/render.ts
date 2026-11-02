import QRCode from 'qrcode';
import sharp from 'sharp';
import { DEFAULT_QR_STYLE, type QrStyle } from '@veta-roja/shared';

/**
 * Martillo y hoz (rojo #cc0000) en un lienzo de 600×600: el archivo SVG que aportó el usuario, sin metadatos.
 * El dibujo llena todo el lienzo.
 */
const EMBLEM_BODY =
  '<g transform="matrix(3.9572752,0,0,3.9469524,-484.68108,-434.93624)" style="fill:#cc0000;fill-opacity:1">' +
  '<path d="m 137.43744,171.69421 18.86296,18.9937 17.78834,-17.66589 c 27.05847,29.021 55.43807,56.99501 82.28704,86.12782 4.03444,4.06233 10.59815,4.085 14.66056,0.0506 4.06232,-4.03445 4.08499,-10.59815 0.0506,-14.66056 -28.81871,-27.1901 -57.72545,-54.60143 -86.55328,-81.89095 l 23.96499,-23.80003 -33.34026,-4.61605 z"/>' +
  '<path d="m 198.2887,110.1955 c 15.51743,8.7394 27.29872,21.28122 34.2484,34.3924 7.04394,13.28902 10.13959,27.16218 10.20325,38.25433 0.13054,22.74374 -18.43771,41.18184 -41.18183,41.18184 -12.13597,0 -23.04607,-5.24868 -30.58302,-13.60085 l -4.16863,3.51033 c -0.70999,-0.27231 -1.46387,-0.41221 -2.22429,-0.41276 -1.82948,1.9e-4 -3.56621,0.80531 -4.74859,2.20136 -2.97368,0.38896 -5.46251,2.44529 -6.40534,5.29224 -3.13486,6.28843 -8.63524,11.21997 -15.29104,13.4776 -0.0637,0.0216 -0.11992,0.05 -0.1758,0.0783 -3.07749,1.12758 -6.16259,3.1643 -8.78919,5.80245 -5.19155,5.23656 -7.72858,11.93658 -6.30024,16.63822 -0.14098,0.40857 -0.21361,0.83759 -0.21498,1.26979 1.5e-4,2.17082 1.75991,3.93058 3.93073,3.93073 0.54341,-0.002 1.08053,-0.11639 1.57745,-0.33632 4.69369,1.05881 11.06885,-1.54582 16.05444,-6.55917 2.82624,-2.85072 4.94356,-6.22349 5.98303,-9.53062 2.31696,-6.62278 7.29699,-12.01856 13.62281,-15.05312 0.15105,-0.0725 0.27303,-0.14714 0.38218,-0.22358 2.12082,-1.01408 3.67251,-2.92895 4.225,-5.2139 9.70222,11.44481 24.25255,18.75299 40.51876,19.13577 29.83352,0.70205 52.13299,-21.25802 53.16414,-52.83642 0.51894,-15.89259 -5.62993,-36.3847 -19.6412,-53.19089 -10.70835,-12.84441 -26.40987,-23.50795 -44.18699,-28.20777 z"/>' +
  '</g>';
const EMBLEM_SIZE = 600;

/** El emblema como imagen SVG independiente. */
export function logoSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${EMBLEM_SIZE} ${EMBLEM_SIZE}" width="${EMBLEM_SIZE}" height="${EMBLEM_SIZE}">${EMBLEM_BODY}</svg>`;
}

type Radii = [number, number, number, number]; // arriba-izq, arriba-der, abajo-der, abajo-izq

const f = (n: number) => String(Math.round(n * 1000) / 1000);

/** Rectángulo con esquinas de radio propio, como trazo (sentido horario). */
function roundRect(x: number, y: number, w: number, h: number, [tl, tr, br, bl]: Radii): string {
  const arc = (r: number, dx: number, dy: number) => (r > 0 ? `a${f(r)} ${f(r)} 0 0 1 ${f(dx)} ${f(dy)}` : '');
  return (
    `M${f(x + tl)} ${f(y)}h${f(w - tl - tr)}${arc(tr, tr, tr)}v${f(h - tr - br)}${arc(br, -br, br)}` +
    `h${f(-(w - br - bl))}${arc(bl, -bl, -bl)}v${f(-(h - bl - tl))}${arc(tl, tl, -tl)}z`
  );
}

function circle(cx: number, cy: number, r: number): string {
  return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0z`;
}

function diamond(cx: number, cy: number, r: number): string {
  return `M${f(cx)} ${f(cy - r)}L${f(cx + r)} ${f(cy)}L${f(cx)} ${f(cy + r)}L${f(cx - r)} ${f(cy)}z`;
}

/** Posición (en módulos, ya con margen) de los tres ojos y la esquina que da al exterior del código. */
function eyePositions(count: number, margin: number): { x: number; y: number; outer: 0 | 1 | 3 }[] {
  const far = margin + count - 7;
  return [
    { x: margin, y: margin, outer: 0 },
    { x: far, y: margin, outer: 1 },
    { x: margin, y: far, outer: 3 },
  ];
}

function eyeFramePath(shape: QrStyle['eyeFrame'], x: number, y: number, outer: 0 | 1 | 3): string {
  const radii = (r: number, only?: boolean): Radii => {
    const out: Radii = only ? [r, r, r, r] : [r, r, r, r];
    if (only) out[outer] = 0;
    return out;
  };
  switch (shape) {
    case 'square':
      return roundRect(x, y, 7, 7, [0, 0, 0, 0]) + roundRect(x + 1, y + 1, 5, 5, [0, 0, 0, 0]);
    case 'rounded':
      return roundRect(x, y, 7, 7, radii(2)) + roundRect(x + 1, y + 1, 5, 5, radii(1));
    case 'circle':
      return circle(x + 3.5, y + 3.5, 3.5) + circle(x + 3.5, y + 3.5, 2.5);
    case 'leaf':
      return roundRect(x, y, 7, 7, radii(3.2, true)) + roundRect(x + 1, y + 1, 5, 5, radii(2.2, true));
  }
}

function eyeBallPath(shape: QrStyle['eyeBall'], x: number, y: number): string {
  const [bx, by] = [x + 2, y + 2];
  switch (shape) {
    case 'square':
      return roundRect(bx, by, 3, 3, [0, 0, 0, 0]);
    case 'rounded':
      return roundRect(bx, by, 3, 3, [0.9, 0.9, 0.9, 0.9]);
    case 'circle':
      return circle(bx + 1.5, by + 1.5, 1.5);
    case 'diamond':
      return diamond(bx + 1.5, by + 1.5, 2);
  }
}

/** Trazos de los módulos de datos. `has(c, r)` dice si hay módulo oscuro en esa celda (fuera del código, no). */
function bodyPath(shape: QrStyle['body'], count: number, margin: number, has: (c: number, r: number) => boolean): string {
  const out: string[] = [];
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!has(c, r)) continue;
      const x = margin + c;
      const y = margin + r;
      switch (shape) {
        case 'square':
          out.push(`M${x} ${y}h1v1h-1z`);
          break;
        case 'dots':
          out.push(circle(x + 0.5, y + 0.5, 0.54));
          break;
        case 'rounded': {
          // Se redondea una esquina solo si sus dos vecinos de ese lado están vacíos: así las zonas llenas quedan unidas.
          const n = has(c, r - 1);
          const e = has(c + 1, r);
          const s = has(c, r + 1);
          const w = has(c - 1, r);
          const R = 0.5;
          out.push(roundRect(x, y, 1, 1, [!n && !w ? R : 0, !n && !e ? R : 0, !s && !e ? R : 0, !s && !w ? R : 0]));
          break;
        }
        case 'vertical':
          // Una barra por tramo vertical continuo.
          if (!has(c, r - 1)) {
            let end = r;
            while (has(c, end + 1)) end++;
            out.push(roundRect(x + 0.05, y, 0.9, end - r + 1, [0.45, 0.45, 0.45, 0.45]));
          }
          break;
        case 'horizontal':
          if (!has(c - 1, r)) {
            let end = c;
            while (has(end + 1, r)) end++;
            out.push(roundRect(x, y + 0.05, end - c + 1, 0.9, [0.45, 0.45, 0.45, 0.45]));
          }
          break;
      }
    }
  }
  return out.join('');
}

export interface QrRender {
  svg: string;
  /** Lado del lienzo en módulos (código + margen). */
  modules: number;
}

/** El QR como SVG, dibujado módulo a módulo para poder personalizar cada parte. */
export function buildQrSvg(text: string, style: QrStyle): string {
  // Con emblema el centro queda tapado, así que se usa la corrección más alta.
  const qr = QRCode.create(text, { errorCorrectionLevel: style.logo ? 'H' : style.ecc });
  const count = qr.modules.size;
  const { margin } = style;
  const total = count + 2 * margin;

  const inEye = (c: number, r: number) => (c < 7 && r < 7) || (c >= count - 7 && r < 7) || (c < 7 && r >= count - 7);
  const dark = (c: number, r: number) => c >= 0 && r >= 0 && c < count && r < count && !inEye(c, r) && qr.modules.get(r, c) === 1;

  // Zona del emblema (en módulos con margen): se vacía de módulos y lleva una placa del color del fondo.
  const logoSide = style.logo ? ((count * style.logoSize) / 100) : 0;
  const logoX = (total - logoSide) / 2;
  const hasModule = (c: number, r: number) => {
    if (!dark(c, r)) return false;
    if (!style.logo) return true;
    const cx = margin + c + 0.5;
    const cy = margin + r + 0.5;
    return !(cx > logoX - 0.5 && cx < logoX + logoSide + 0.5 && cy > logoX - 0.5 && cy < logoX + logoSide + 0.5);
  };

  const fillFor = (override: string | null, fallback: string) => override ?? fallback;
  const bodyFill = style.gradient === 'none' ? style.fg : 'url(#vr-grad)';
  const frameFill = fillFor(style.eyeFrameColor, bodyFill);
  const ballFill = fillFor(style.eyeBallColor, style.eyeFrameColor ?? bodyFill);

  let defs = '';
  if (style.gradient === 'linear') {
    const a = (style.angle * Math.PI) / 180;
    const dx = Math.cos(a) / 2;
    const dy = Math.sin(a) / 2;
    defs = `<defs><linearGradient id="vr-grad" gradientUnits="userSpaceOnUse" x1="${f(total / 2 - dx * total)}" y1="${f(total / 2 - dy * total)}" x2="${f(total / 2 + dx * total)}" y2="${f(total / 2 + dy * total)}"><stop offset="0" stop-color="${style.fg}"/><stop offset="1" stop-color="${style.fg2}"/></linearGradient></defs>`;
  } else if (style.gradient === 'radial') {
    defs = `<defs><radialGradient id="vr-grad" gradientUnits="userSpaceOnUse" cx="${total / 2}" cy="${total / 2}" r="${f(total * 0.72)}"><stop offset="0" stop-color="${style.fg}"/><stop offset="1" stop-color="${style.fg2}"/></radialGradient></defs>`;
  }

  const parts: string[] = [];
  if (style.bg !== 'none') parts.push(`<rect id="fondo" width="${total}" height="${total}" fill="${style.bg}"/>`);
  parts.push(`<path id="modulos" fill="${bodyFill}" d="${bodyPath(style.body, count, margin, hasModule)}"/>`);
  const eyes = eyePositions(count, margin);
  parts.push(`<path id="marcos" fill="${frameFill}" fill-rule="evenodd" d="${eyes.map((e) => eyeFramePath(style.eyeFrame, e.x, e.y, e.outer)).join('')}"/>`);
  parts.push(`<path id="pupilas" fill="${ballFill}" d="${eyes.map((e) => eyeBallPath(style.eyeBall, e.x, e.y)).join('')}"/>`);

  if (style.logo) {
    // Placa del color del fondo (blanca si el fondo es transparente) con un poco de aire alrededor del emblema.
    const plate = style.bg === 'none' ? '#ffffff' : style.bg;
    const pad = logoSide * 0.1;
    const inner = logoSide - 2 * pad;
    parts.push(
      `<g id="martillo-y-hoz"><rect x="${f(logoX)}" y="${f(logoX)}" width="${f(logoSide)}" height="${f(logoSide)}" rx="${f(logoSide * 0.14)}" fill="${plate}"/>` +
        `<g transform="translate(${f(logoX + pad)} ${f(logoX + pad)}) scale(${f(inner / EMBLEM_SIZE)})">${EMBLEM_BODY}</g></g>`,
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${style.size}" height="${style.size}" shape-rendering="geometricPrecision">` +
    defs +
    parts.join('') +
    '</svg>'
  );
}

export function renderQr(text: string, format: 'svg', style?: Partial<QrStyle>): Promise<string>;
export function renderQr(text: string, format: 'png', style?: Partial<QrStyle>): Promise<Buffer>;
export async function renderQr(text: string, format: 'svg' | 'png', style: Partial<QrStyle> = {}): Promise<string | Buffer> {
  const full: QrStyle = { ...DEFAULT_QR_STYLE, ...style };
  const svg = buildQrSvg(text, full);
  if (format === 'svg') return svg;
  // Se rasteriza a mucha densidad para que los bordes queden nítidos y se fija el lado final.
  return sharp(Buffer.from(svg), { density: 300 }).resize(full.size, full.size).png().toBuffer();
}
