#!/usr/bin/env node
// Prueba de humo contra un servidor REAL de Veta Roja (no usa mocks ni inyección en memoria).
//
// Uso:  ADMIN_USER=admin ADMIN_PASSWORD=... node deploy/smoke.mjs https://vetaroja.mx
//
// Crea una landing temporal, comprueba que se sirve ya renderizada, que su QR es un PNG y que renombrar
// el slug deja una redirección; al final la borra. Sale con código 0 si todo pasa y 1 si algo falla.

const base = (process.argv[2] ?? '').replace(/\/+$/, '');
const user = process.env.ADMIN_USER;
const password = process.env.ADMIN_PASSWORD;
if (!base || !user || !password) {
  console.error('Uso: ADMIN_USER=... ADMIN_PASSWORD=... node deploy/smoke.mjs <urlBase>');
  process.exit(2);
}

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

let cookie = '';
const call = (path, init = {}) =>
  fetch(base + path, { redirect: 'manual', ...init, headers: { ...(init.headers ?? {}), ...(cookie ? { cookie } : {}) } });
const json = (method, path, body) =>
  call(path, {
    method,
    // Sin cuerpo no se declara content-type (Fastify rechaza un JSON vacío con 400).
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const slug = `smoke-${Date.now().toString(36)}`;
const title = `Prueba de humo ${slug}`;
let landingId = null;

try {
  const health = await call('/api/health');
  check('GET /api/health responde 200 { ok: true }', health.status === 200 && (await health.json()).ok === true);

  const login = await json('POST', '/api/auth/login', { username: user, password });
  const setCookie = login.headers.getSetCookie?.() ?? [];
  cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
  check('login del admin', login.status === 200 && cookie.includes('vr_session='), `estado ${login.status}`);
  if (!cookie) throw new Error('Sin sesión no se puede continuar');

  const slides = [
    { id: crypto.randomUUID(), type: 'cover', hidden: false, animation: 'fade', title, subtitle: 'Humo' },
    { id: crypto.randomUUID(), type: 'cta', hidden: false, animation: 'zoom', text: 'Súmate', buttonLabel: 'Entrar al canal' },
  ];
  const created = await json('POST', '/api/admin/landings', {
    title,
    description: 'Landing temporal de la prueba de humo',
    slug,
    themeId: 'indice-blanco',
    status: 'published',
    slides,
    ctaUrl: 'https://whatsapp.com/channel/humo',
  });
  const landing = created.status === 201 ? await created.json() : null;
  check('crear una landing publicada', created.status === 201, `estado ${created.status}`);
  landingId = landing?.id ?? null;
  if (!landingId) throw new Error('No se pudo crear la landing');

  const page = await call(`/l/${slug}`);
  const html = await page.text();
  check('GET /l/<slug> responde 200 HTML', page.status === 200 && (page.headers.get('content-type') ?? '').includes('text/html'));
  check('la landing llega YA renderizada en el servidor', html.includes('<main class="deck"') && html.includes('data-slide-type="cover"'));
  check('trae título, vista previa y hoja del theme', html.includes(`<title>${title}</title>`) && html.includes('og:title') && html.includes('/themes/indice-blanco.css'));
  check('el botón lleva al canal de WhatsApp', html.includes('class="btn-cta" href="https://whatsapp.com/channel/humo"'));

  const css = await call('/themes/indice-blanco.css');
  check('el theme se sirve como CSS', css.status === 200 && (css.headers.get('content-type') ?? '').includes('text/css'));
  const font = await call('/fonts/archivo-latin-900-normal.woff2');
  check('las fuentes se sirven desde nuestro servidor', font.status === 200);

  const qr = await call(`/api/admin/landings/${landingId}/qr.png`);
  const bytes = Buffer.from(await qr.arrayBuffer());
  check('el QR es un PNG', qr.status === 200 && bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])));
  const svg = await call(`/api/admin/landings/${landingId}/qr.svg`);
  check('el QR también se descarga en SVG', svg.status === 200 && (await svg.text()).trimStart().startsWith('<svg'));

  const admin = await call('/admin/login');
  check('el panel (/admin/login) responde HTML', admin.status === 200 && (await admin.text()).includes('<div id="root">'));

  const renamed = `${slug}-b`;
  const renamedRes = await json('PUT', `/api/admin/landings/${landingId}`, { ...landing, slug: renamed });
  check('renombrar el slug', renamedRes.status === 200, `estado ${renamedRes.status}`);
  const old = await call(`/l/${slug}`);
  check('el slug viejo (QR ya impreso) redirige 301 al nuevo', old.status === 301 && old.headers.get('location') === `/l/${renamed}`, `estado ${old.status}`);
  check('el slug nuevo responde 200', (await call(`/l/${renamed}`)).status === 200);

  const draft = await json('PUT', `/api/admin/landings/${landingId}`, { ...landing, slug: renamed, status: 'draft' });
  check('pasar a borrador', draft.status === 200);
  const hidden = await call(`/l/${renamed}`);
  const hiddenHtml = await hidden.text();
  check('un borrador no se filtra: 404 "ya no está disponible"', hidden.status === 404 && hiddenHtml.includes('Este tema ya no está disponible') && !hiddenHtml.includes(title));
} catch (err) {
  check('la prueba terminó sin excepciones', false, err instanceof Error ? err.message : String(err));
} finally {
  if (landingId) {
    const del = await json('DELETE', `/api/admin/landings/${landingId}`);
    check('limpieza: borrar la landing temporal', del.status === 204, `estado ${del.status}`);
  }
}

console.log(failures === 0 ? '\nTodo en orden.' : `\n${failures} comprobación(es) fallaron.`);
// exitCode (y no process.exit) deja cerrar las conexiones abiertas; en Windows process.exit puede abortar Node.
process.exitCode = failures === 0 ? 0 : 1;
