import type { Slide } from '@veta-roja/shared';
import { renderDeck, type PublicDeckData } from '../../../web/src/public/entry-server';
import type { Landing } from '../landings/repo';
import type { Assets } from './assets';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value: string): string => value.replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** JSON seguro para incrustar dentro de <script>: ningún texto puede cerrar la etiqueta. */
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

export function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .split(LINE_SEPARATOR).join('\\u2028')
    .split(PARAGRAPH_SEPARATOR).join('\\u2029');
}

// Icono incrustado: evita una petición extra (y un 404) por /favicon.ico.
const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23D4140B'/%3E%3Ctext x='16' y='24' font-size='22' font-weight='900' text-anchor='middle' fill='white' font-family='sans-serif'%3EV%3C/text%3E%3C/svg%3E";

interface ShellOptions {
  title: string;
  description?: string;
  extraHead?: string;
  themeId?: string;
  body: string;
  cssLinks: string[];
  script?: string;
  dataIsland?: string;
}

function shell(o: ShellOptions): string {
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<link rel="icon" href="${FAVICON}">`,
    `<title>${esc(o.title)}</title>`,
    o.description ? `<meta name="description" content="${esc(o.description)}">` : '',
    o.themeId ? `<link rel="stylesheet" href="/themes/${esc(o.themeId)}.css">` : '',
    ...o.cssLinks.map((href) => `<link rel="stylesheet" href="${esc(href)}">`),
    o.extraHead ?? '',
  ]
    .filter(Boolean)
    .join('\n');
  return `<!doctype html>
<html lang="es">
<head>
${head}
</head>
<body>
<div id="root">${o.body}</div>
${o.dataIsland ?? ''}${o.script ? `<script type="module" src="${esc(o.script)}"></script>\n` : ''}</body>
</html>
`;
}

const ctaButton = (ctaUrl: string | null, label: string) =>
  ctaUrl ? `<a class="btn-cta" href="${esc(ctaUrl)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : '';

/** Página de una landing, con título, descripción e imagen para la vista previa de enlaces. */
export function renderLandingPage(args: {
  landing: Landing;
  ctaUrl: string | null;
  baseUrl: string;
  assets: Assets;
}): string {
  const { landing, ctaUrl, baseUrl, assets } = args;
  // Las diapositivas ocultas no se publican: ni en el HTML, ni en los datos de hidratación, ni en la vista previa.
  const slides = (landing.slides as Slide[]).filter((s) => !s.hidden);
  const data: PublicDeckData = { slides, ctaUrl, themeId: landing.themeId };
  const cover = slides.find((s) => s.type === 'cover' && s.imageId);
  // Para compartir se usa la copia JPEG (WhatsApp y otras apps aceptan JPEG de forma fiable; WebP no siempre).
  const image = cover && cover.type === 'cover' && cover.imageId ? `${baseUrl}/uploads/${cover.imageId}.jpg` : null;
  const pageUrl = `${baseUrl}/l/${landing.slug}`;

  const meta = [
    `<link rel="canonical" href="${esc(pageUrl)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Veta Roja">',
    `<meta property="og:title" content="${esc(landing.title)}">`,
    landing.description ? `<meta property="og:description" content="${esc(landing.description)}">` : '',
    `<meta property="og:url" content="${esc(pageUrl)}">`,
    image ? `<meta property="og:image" content="${esc(image)}">` : '',
    '<meta property="og:locale" content="es_MX">',
  ]
    .filter(Boolean)
    .join('\n');

  return shell({
    title: landing.title,
    description: landing.description,
    themeId: landing.themeId,
    extraHead: meta,
    body: renderDeck(data),
    cssLinks: assets.publicCss,
    dataIsland: `<script type="application/json" id="__DECK__">${safeJson(data)}</script>\n`,
    script: assets.publicJs,
  });
}

const simplePage = (inner: string) =>
  `<main class="deck" data-theme="indice-blanco"><section class="slide"><div class="slide-inner">${inner}</div></section></main>`;

export function renderUnavailablePage(assets: Assets): string {
  return shell({
    title: 'Tema no disponible · Veta Roja',
    themeId: 'indice-blanco',
    cssLinks: assets.publicCss,
    body: simplePage(
      `<h1 class="slide-title">Este tema ya no está disponible</h1>
<p class="slide-subtitle">Puede que haya cambiado de dirección o que se haya retirado.</p>
<p><a class="btn-cta" href="/">Ir a la portada</a></p>`,
    ),
  });
}

export function renderHomePage(args: { ctaUrl: string | null; assets: Assets }): string {
  return shell({
    title: 'Veta Roja',
    description: 'Educación marxista-leninista desde Zacatecas.',
    themeId: 'indice-blanco',
    cssLinks: args.assets.publicCss,
    body: simplePage(
      `<h1 class="slide-title">Veta Roja</h1>
<p class="slide-subtitle">Educación marxista-leninista desde Zacatecas.</p>
<p>${ctaButton(args.ctaUrl, 'Entrar al canal')}</p>`,
    ),
  });
}

export function renderAdminShell(assets: Assets): string {
  return shell({
    title: 'Panel · Veta Roja',
    extraHead: '<meta name="robots" content="noindex, nofollow">',
    cssLinks: assets.adminCss,
    body: '',
    script: assets.adminJs,
  });
}
