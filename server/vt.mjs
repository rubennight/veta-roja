import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
const run = promisify(execFile);
const BASE = 'http://localhost:3000';
const SCR = 'C:/Users/rubis/AppData/Local/Temp/claude/C--Users-rubis-OneDrive-Documentos-GitHub/b0901537-1be1-43df-8893-84eaef365738/scratchpad/shots';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
mkdirSync(SCR, { recursive: true });
const themes = process.argv.slice(2);

const l = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'prueba-local-12345' }) });
const cookie = l.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
const h = { 'content-type': 'application/json', cookie };
const u = (n) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;
const base = (n, type) => ({ id: u(n), type, hidden: false, animation: 'fade' });
const slides = [
  { ...base(1, 'cover'), title: 'La vivienda no es mercancía', subtitle: 'Un análisis materialista desde Zacatecas' },
  { ...base(2, 'emphasis_text'), text: 'El **salario** alcanza cada vez menos, mientras la renta sube. No es mala suerte: es la lógica del capital.' },
  { ...base(3, 'quote'), text: 'La historia de toda sociedad hasta nuestros días es la historia de la lucha de clases.', author: 'Marx y Engels', date: '1848' },
  { ...base(4, 'concept'), term: 'Plusvalía', definition: 'El trabajo no pagado que el capitalista se apropia de quien produce la riqueza.' },
  { ...base(5, 'big_figure'), figure: '8 de 10', caption: 'familias trabajadoras gastan más de un tercio de su ingreso en vivienda' },
  { ...base(6, 'timeline'), items: [{ date: '1910', text: 'Estalla la Revolución Mexicana.' }, { date: '1914', text: 'La División del Norte toma Zacatecas.' }] },
  { ...base(7, 'comparison'), left: { title: 'Hoy', points: ['Renta impagable', 'Trabajo precario'] }, right: { title: 'Organizados', points: ['Vivienda digna', 'Salario justo'] } },
  { ...base(8, 'buttons'), text: '¿Profundizar?', items: [{ label: 'Ver la plusvalía', target: { kind: 'slide', slideId: u(4) } }, { label: 'Leer a Marx', target: { kind: 'url', url: 'https://www.marxists.org' } }] },
  { ...base(9, 'expandables'), heading: 'Conceptos', items: [{ title: 'Clase obrera', body: 'Quienes **viven de vender** su fuerza de trabajo.' }, { title: 'Capital', body: 'Valor que se valoriza explotando trabajo ajeno.' }] },
  { ...base(10, 'cta'), text: 'La historia se hace organizándose. Súmate.', buttonLabel: 'Entrar al canal' },
];
const input = { title: 'Vista de themes', description: 'Prueba', slug: 'vista-themes', themeId: 'indice-blanco', status: 'published', slides, ctaUrl: 'https://whatsapp.com/channel/prueba' };
let list = await (await fetch(BASE + '/api/admin/landings', { headers: h })).json();
let item = list.find((x) => x.slug === 'vista-themes');
let id;
if (!item) {
  const r = await fetch(BASE + '/api/admin/landings', { method: 'POST', headers: h, body: JSON.stringify(input) });
  if (!r.ok) throw new Error('crear ' + r.status + ' ' + (await r.text()));
  id = (await r.json()).id;
} else id = item.id;

const shot = (theme, n) =>
  run(EDGE, ['--headless=new', '--disable-gpu', `--user-data-dir=${SCR}/prof-${theme}-${n}`, `--screenshot=${SCR}/${theme}-${n}.png`, '--window-size=500,900', '--hide-scrollbars', '--virtual-time-budget=3000', `${BASE}/l/vista-themes#s-${u(n)}`], { timeout: 120000 });

for (const theme of themes) {
  const r = await fetch(`${BASE}/api/admin/landings/${id}`, { method: 'PUT', headers: h, body: JSON.stringify({ ...input, themeId: theme }) });
  if (!r.ok) { console.log(theme, 'PUT', r.status, await r.text()); continue; }
  const order = [1, 2, 3, 4, 5, 7, 9, 10];
  for (let i = 0; i < order.length; i += 2) await Promise.all(order.slice(i, i + 2).map((n) => shot(theme, n)));
  const bufs = await Promise.all(order.map((n) => sharp(`${SCR}/${theme}-${n}.png`).resize({ width: 300 }).toBuffer()));
  const hgt = Math.round((900 * 300) / 500);
  await sharp({ create: { width: 4 * 305, height: 2 * (hgt + 5), channels: 3, background: '#777' } })
    .composite(bufs.map((b, i) => ({ input: b, left: (i % 4) * 305, top: Math.floor(i / 4) * (hgt + 5) })))
    .png().toFile(`${SCR}/sheet-${theme}.png`);
  console.log('ok', theme);
}
