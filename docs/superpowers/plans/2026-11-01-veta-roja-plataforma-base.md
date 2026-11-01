# Veta Roja — Plataforma base (plan de implementación)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir Veta Roja: panel admin para crear landings en forma de presentación, con themes, QR descargable y botón a un canal de WhatsApp, más la primera tanda de 6 themes.

**Architecture:** Monorepo npm con tres paquetes: `shared` (esquemas y reglas compartidas), `server` (Fastify + Drizzle + Postgres, entrega HTML de landings con render en servidor) y `web` (React + Vite: panel admin como SPA y landings públicas renderizadas en servidor e hidratadas). Cada landing guarda sus diapositivas como JSON validado en Postgres; el theme es una hoja CSS estática con alcance `[data-theme="<id>"]`.

**Tech Stack:** Node 22, TypeScript, Fastify, Drizzle ORM + drizzle-kit, Postgres 16, argon2, sharp, qrcode, zod, React, Vite, react-router, Vitest + Testing Library, @fontsource (solo como origen local de las fuentes).

**Spec:** `docs/superpowers/specs/2026-11-01-veta-roja-design.md`. Los mockups de dirección visual están en `docs/superpowers/mockups/` (son bocetos, no el diseño final).

**Fuera de este plan:** los 16 themes restantes (segundo plan, mismo contrato de theme que la Task 7).

## Global Constraints

- Sin servicios externos en ejecución: nada de Google Fonts, CDN de terceros, analítica, CAPTCHA ni correo de terceros. Fuentes y todo recurso se sirven desde nuestro servidor.
- El sitio **no recoge datos personales**. El llamado a la acción es solo un botón con enlace a un canal de WhatsApp.
- Interfaz y contenido en español. Identificadores de código en inglés.
- Dominio `vetaroja.mx`, configurado con la variable `PUBLIC_BASE_URL`. Las direcciones públicas son `/l/<slug>`.
- Solo existe el usuario admin. El modelo permite agregar usuarios después, pero no se construye.
- Máximo 30 diapositivas por landing. Imágenes de hasta 5 MB, reducidas al subirse.
- Un slug renombrado conserva una redirección 301 desde el slug anterior.
- Una landing en borrador, borrada o inexistente muestra "Este tema ya no está disponible" con enlace a `/`, con estado HTTP 404.
- Prohibidas las tipografías tipo Comic Sans o cursivas informales en cualquier theme.
- Primero celular: contraste suficiente y animaciones desactivadas con `prefers-reduced-motion`.
- Los commits terminan con la línea de coautoría que indique el sistema.

## Review Focus

Entradas que el diseño implica y que pueden dañar a quien use el software. Cada una tiene su prueba en la tarea indicada.

1. Texto con HTML o `<script>` dentro de cualquier campo de diapositiva: debe verse como texto, nunca ejecutarse (Task 7).
2. Slugs con acentos, mayúsculas, espacios o palabras reservadas (`admin`, `api`, `l`, `uploads`): se normalizan o se rechazan (Tasks 2 y 4).
3. Enlace del botón con esquema peligroso (`javascript:`) o fuera de WhatsApp: se rechaza (Task 2).
4. Archivo subido que no es imagen real (SVG con script, GIF, 20 MB, tipo declarado falso): se rechaza (Task 5).
5. Acceso público a una landing en borrador o a un slug antiguo: nunca filtra contenido del borrador (Task 8).

---

## File Structure

```
veta-roja/
  package.json, tsconfig.base.json, .gitignore, .env.example, docker-compose.dev.yml
  shared/src/{slides.ts,inline.ts,slug.ts,cta.ts,themes.ts,index.ts}
  server/src/{config.ts,app.ts,index.ts}
  server/src/db/{client.ts,schema.ts}           (+ migraciones en server/drizzle/)
  server/src/auth/{password.ts,sessions.ts,routes.ts}
  server/src/landings/{repo.ts,routes.ts,settings.ts}
  server/src/images/{process.ts,routes.ts}
  server/src/qr/{render.ts,routes.ts}
  server/src/ssr/{assets.ts,template.ts,routes.ts}
  server/scripts/{admin-create.ts,admin-reset.ts,seed-demo.ts}
  web/{admin.html,public.html,vite.config.ts,scripts/copy-fonts.mjs}
  web/public/{themes/*.css,fonts/*.woff2}
  web/src/render/{SlideDeck.tsx,InlineText.tsx,useReveal.ts,render.css,slides/*.tsx}
  web/src/public/{entry-client.tsx,entry-server.tsx}
  web/src/admin/{main.tsx,App.tsx,api.ts,pages/*.tsx,components/*.tsx}
  deploy/{Dockerfile,docker-compose.yml,Caddyfile,backup.sh,README-DEPLOY.md,smoke.mjs}
```

---

### Task 1: Esqueleto, base de datos y salud del servidor

**Files:**
- Create: `package.json` (workspaces `shared`, `server`, `web`), `tsconfig.base.json`, `.gitignore` (incluye `node_modules`, `.env`, `uploads`, `dist`, `.superpowers`), `.env.example`, `docker-compose.dev.yml` (solo Postgres 16)
- Create: `server/package.json`, `server/drizzle.config.ts`, `server/src/{config.ts,app.ts,index.ts}`, `server/src/db/client.ts`, `server/test/helpers.ts`, `server/test/health.test.ts`
- Create: `shared/package.json`, `web/package.json` (vacíos de lógica por ahora)

**Interfaces:**
- Produces: `loadConfig(env: NodeJS.ProcessEnv): Config` con `{ databaseUrl, publicBaseUrl, uploadsDir, isProd }` (falla con mensaje claro si falta `DATABASE_URL` o `PUBLIC_BASE_URL`).
- Produces: `createDb(url: string): { db: Db; close(): Promise<void> }` y `runMigrations(db: Db): Promise<void>`.
- Produces: `buildApp(deps: { db: Db; config: Config }): Promise<FastifyInstance>`.
- Produces (tests): `makeTestApp(): Promise<{ app: FastifyInstance; db: Db; reset(): Promise<void> }>`, que usa `TEST_DATABASE_URL`, corre migraciones y vacía las tablas en `reset()`.

- [ ] **Step 1:** `git init` en `veta-roja/`; verificar que Postgres está disponible (`docker compose -f docker-compose.dev.yml up -d` o uno local). Crear la base `veta_roja_test`.
- [ ] **Step 2: Test** `health.test.ts::GET /api/health responde 200 con { ok: true }` usando `app.inject`.
- [ ] **Step 3:** Ejecutar `npm test -w server`. Esperado: FALLA (ruta inexistente).
- [ ] **Step 4:** Implementar esqueleto, `loadConfig`, `createDb`, `runMigrations`, `buildApp` con la ruta de salud que además hace `select 1`. Test adicional: `loadConfig` lanza si falta `PUBLIC_BASE_URL`.
- [ ] **Step 5:** `npm test -w server`. Esperado: PASS.
- [ ] **Step 6:** Commit `chore: esqueleto del monorepo y servidor con salud`.

---

### Task 2: Reglas compartidas (diapositivas, slug, enlace, texto en línea, themes)

**Files:**
- Create: `shared/src/{slides.ts,inline.ts,slug.ts,cta.ts,themes.ts,index.ts}`, `shared/test/*.test.ts`

**Interfaces:**
- Produces (`slides.ts`): `ANIMATIONS = ['none','fade','slide-up','underline','zoom'] as const`; `SlideSchema` (zod, unión discriminada por `type`) con base `{ id: string(uuid), hidden: boolean (default false), animation: Animation (default 'fade') }` y los tipos:
  `cover {title, subtitle?, imageId?}`, `emphasis_text {text}`, `quote {text, author?, date?}`, `concept {term, definition}`, `big_figure {figure, caption}`, `timeline {items: {date, text}[] (min 1)}`, `comparison {left: Column, right: Column}` con `Column = {title, points: string[]}`, `gallery {images: {imageId, caption?}[] (min 1)}`, `cta {text, buttonLabel}`.
  `LandingInputSchema` con `{ title, description, slug, themeId, status: 'draft'|'published', slides: Slide[] (máx 30), ctaUrl: string|null }`. Tipos exportados `Slide`, `LandingInput`.
- Produces (`inline.ts`): `parseInline(text: string): InlineToken[]` con `InlineToken = { kind: 'text'|'bold'|'mark'; value: string }`. Sintaxis `**negrita**` y `==resaltado==`; marcadores sin cerrar quedan como texto literal.
- Produces (`slug.ts`): `RESERVED_SLUGS = ['admin','api','l','uploads','themes','fonts','assets']`; `normalizeSlug(input: string): string` (minúsculas, sin acentos, guiones, sin extremos con guion); `isValidSlug(slug: string): boolean` (2–60 caracteres, no reservado).
- Produces (`cta.ts`): `isAllowedCtaUrl(url: string): boolean`. Solo `https:` y hosts `whatsapp.com`, `www.whatsapp.com`, `chat.whatsapp.com`, `wa.me`.
- Produces (`themes.ts`): `THEMES: ThemeInfo[]` con `ThemeInfo = { id: string; name: string }`; `getTheme(id): ThemeInfo | undefined`. Por ahora registra los 6 ids de la primera tanda (ver Task 9: `indice-blanco`, `indice-negro`, `indice-papel`, `indice-azul-palido`, `cantera-y-tinta`, `socavon`).

- [ ] **Step 1: Tests** (nombres y aserciones):
  - `slides::acepta los 9 tipos con datos mínimos válidos`.
  - `slides::rechaza más de 30 diapositivas` y `acepta exactamente 30`.
  - `slides::rechaza timeline sin items y gallery sin imágenes`.
  - `inline::"a **b** ==c==" produce [text "a ", bold "b", text " ", mark "c"]`; `"**sin cerrar"` produce un solo token `text` con el literal.
  - `slug::normalizeSlug("Vivienda Digna Zacatecas!")` = `"vivienda-digna-zacatecas"`; `normalizeSlug("Niñez y Educación")` = `"ninez-y-educacion"`.
  - `slug::isValidSlug` es falso para `admin`, `api`, `l`, para `a` (muy corto) y para cadenas de 61 caracteres.
  - `cta::acepta https://whatsapp.com/channel/abc, https://chat.whatsapp.com/xyz y https://wa.me/123`; `rechaza javascript:alert(1), http://whatsapp.com/x, https://evil.com/whatsapp.com y data:text/html,x`.
  - `themes::LandingInputSchema rechaza themeId desconocido`.
- [ ] **Step 2:** `npm test -w shared`. Esperado: FALLA.
- [ ] **Step 3:** Implementar los módulos con las firmas de arriba. `LandingInputSchema` refina `ctaUrl` con `isAllowedCtaUrl`, `slug` con `isValidSlug` y `themeId` con `getTheme`.
- [ ] **Step 4:** `npm test -w shared`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(shared): esquemas de diapositivas, slug, enlace y texto en línea`.

---

### Task 3: Autenticación del admin

**Files:**
- Create: `server/src/auth/{password.ts,sessions.ts,routes.ts}`, `server/scripts/{admin-create.ts,admin-reset.ts}`, `server/test/auth.test.ts`
- Modify: `server/src/db/schema.ts` (tablas `users`, `sessions`), `server/src/app.ts` (registrar cookies, rate-limit, rutas de auth)

**Interfaces:**
- Consumes: `buildApp`, `makeTestApp` (Task 1).
- Produces (schema): `users(id uuid pk, username text unique, passwordHash text, createdAt timestamptz)`, `sessions(tokenHash text pk, userId uuid fk, expiresAt timestamptz)`.
- Produces: `createAdmin(db, username: string, password: string): Promise<void>` (hash `argon2id`, mínimo 12 caracteres), `setAdminPassword(db, username, password): Promise<void>`.
- Produces: decorador `app.requireAdmin` (preHandler que responde 401 sin sesión válida) que usarán las Tasks 4–6 y el resto de rutas `/api/admin/*`.
- Produces (rutas): `POST /api/auth/login {username,password}` → 200 y cookie `vr_session` (`httpOnly`, `sameSite=lax`, `secure` en producción, 7 días); `GET /api/auth/me` → `{ username }` o 401; `POST /api/auth/logout` → 204 e invalida la sesión.
- Scripts: `npm run admin:create -w server -- <usuario>` y `admin:reset -w server -- <usuario>`; leen la contraseña de `ADMIN_PASSWORD` o la piden sin eco.

- [ ] **Step 1: Tests** (`auth.test.ts`):
  - `createAdmin guarda un hash que empieza con "$argon2id$"`.
  - `login correcto fija cookie httpOnly y /me devuelve el usuario`.
  - `login con contraseña errónea y con usuario inexistente dan el mismo 401 con el mismo cuerpo`.
  - `el sexto intento de login en un minuto desde la misma IP da 429`.
  - `una ruta con requireAdmin sin cookie da 401`.
  - `logout invalida la cookie: /me da 401 después`.
  - `una sesión vencida es rechazada`.
  - `setAdminPassword cambia la contraseña y las sesiones anteriores quedan cerradas`.
- [ ] **Step 2:** `npm test -w server -- auth`. Esperado: FALLA.
- [ ] **Step 3:** Implementar. Guardar solo el hash SHA-256 del token de sesión; el token es de 32 bytes aleatorios. Generar migración con drizzle-kit.
- [ ] **Step 4:** `npm test -w server -- auth`. Esperado: PASS.
- [ ] **Step 5:** Probar los scripts a mano: crear admin, iniciar sesión con `curl`. Esperado: 200 con cookie.
- [ ] **Step 6:** Commit `feat(server): autenticación del admin con sesiones y limitación de intentos`.

---

### Task 4: Landings, redirecciones de slug y enlace por defecto

**Files:**
- Create: `server/src/landings/{repo.ts,routes.ts,settings.ts}`, `server/test/landings.test.ts`
- Modify: `server/src/db/schema.ts` (`landings`, `slug_redirects`, `settings`), `server/src/app.ts`

**Interfaces:**
- Consumes: `LandingInputSchema`, `normalizeSlug`, `isValidSlug`, `isAllowedCtaUrl` (Task 2); `app.requireAdmin` (Task 3).
- Produces (schema): `landings(id uuid pk, slug text unique, title, description, themeId text, status text, slides jsonb, ctaUrl text null, createdAt, updatedAt)`, `slug_redirects(oldSlug text pk, landingId uuid fk on delete cascade)`, `settings(key text pk, value text)`.
- Produces (repo): `createLanding(db, input: LandingInput): Promise<Landing>`, `updateLanding(db, id: string, input: LandingInput): Promise<Landing>`, `deleteLanding(db, id): Promise<void>`, `listLandings(db): Promise<LandingSummary[]>`, `getLanding(db, id): Promise<Landing | null>`, `findPublicLanding(db, slug): Promise<{ kind: 'found'; landing: Landing } | { kind: 'redirect'; slug: string } | { kind: 'unavailable' }>`, `getDefaultCtaUrl(db): Promise<string | null>`, `setDefaultCtaUrl(db, url: string | null): Promise<void>`, `resolveCtaUrl(landing, defaultUrl): string | null`.
- Produces (rutas, todas con `requireAdmin`): `POST/GET /api/admin/landings`, `GET/PUT/DELETE /api/admin/landings/:id`, `GET/PUT /api/admin/settings/default-cta-url`. Slug en uso por otra landing o por una redirección ajena: 409.

- [ ] **Step 1: Tests** (`landings.test.ts`):
  - `crea, lista, edita y borra una landing`.
  - `rechaza 31 diapositivas con 400`, `rechaza slug reservado "admin" con 400`, `rechaza ctaUrl con javascript: con 400`.
  - `renombrar el slug deja una redirección: findPublicLanding con el slug viejo da { kind: 'redirect', slug: nuevo }`.
  - `un slug que es redirección de otra landing da 409 al usarlo`; `volver al propio slug anterior borra esa redirección`.
  - `findPublicLanding da unavailable para borrador, para landing borrada y para slug inexistente`.
  - `resolveCtaUrl usa el de la landing y, si es null, el por defecto; si ninguno, null`.
  - `PUT default-cta-url rechaza una URL fuera de WhatsApp con 400`.
  - `todas las rutas /api/admin/* dan 401 sin sesión`.
- [ ] **Step 2:** `npm test -w server -- landings`. Esperado: FALLA.
- [ ] **Step 3:** Implementar repo y rutas (validar con `LandingInputSchema`; las transacciones de renombrado y redirección van en una sola operación).
- [ ] **Step 4:** `npm test -w server -- landings`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(server): landings, redirecciones de slug y enlace por defecto`.

---

### Task 5: Subida y procesamiento de imágenes

**Files:**
- Create: `server/src/images/{process.ts,routes.ts}`, `server/test/images.test.ts`
- Modify: `server/src/db/schema.ts` (`images`), `server/src/app.ts` (multipart y estáticos de `/uploads`)

**Interfaces:**
- Consumes: `app.requireAdmin`, `Config.uploadsDir`.
- Produces: `processImage(buffer: Buffer): Promise<{ data: Buffer; width: number; height: number }>`; detecta el formato real con `sharp`, acepta solo JPEG, PNG y WebP, escala a máximo 1600 px de ancho y exporta WebP. Lanza `UnsupportedImageError` en cualquier otro caso.
- Produces (ruta): `POST /api/admin/images` (campo `file`) → 201 `{ id: string; url: string; width: number; height: number }` con `url = /uploads/<id>.webp`. Más de 5 MB → 413. Formato no admitido → 415.
- Produces (schema): `images(id uuid pk, file text, width int, height int, bytes int, createdAt)`.
- `GET /uploads/<archivo>` sirve estáticos con `Cache-Control: public, max-age=31536000, immutable`.

- [ ] **Step 1: Tests** (generar imágenes con `sharp` dentro de la prueba):
  - `convierte un PNG de 3000 px a WebP de 1600 px de ancho`.
  - `no agranda una imagen de 800 px`.
  - `rechaza un SVG con <script> (415)` y `rechaza un GIF (415)`.
  - `rechaza un archivo .jpg cuyo contenido es texto (415)`, aunque el tipo declarado sea image/jpeg.
  - `rechaza un archivo de más de 5 MB (413)`.
  - `el archivo queda en uploadsDir y GET /uploads/<id>.webp lo sirve con cabecera immutable`.
  - `sin sesión da 401`.
- [ ] **Step 2:** `npm test -w server -- images`. Esperado: FALLA.
- [ ] **Step 3:** Implementar con `@fastify/multipart` (límite de 5 MB) y `@fastify/static`. El nombre del archivo lo genera el servidor; nunca se usa el nombre enviado.
- [ ] **Step 4:** `npm test -w server -- images`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(server): subida de imágenes validadas y optimizadas`.

---

### Task 6: Códigos QR descargables

**Files:**
- Create: `server/src/qr/{render.ts,routes.ts}`, `server/test/qr.test.ts`
- Dev deps: `jsqr`, `pngjs` (solo para decodificar en pruebas)

**Interfaces:**
- Consumes: `getLanding` (Task 4), `Config.publicBaseUrl`, `app.requireAdmin`.
- Produces: `renderQr(text: string, format: 'svg'): Promise<string>` y `renderQr(text: string, format: 'png'): Promise<Buffer>`. PNG de 1024 px, corrección de errores M, margen de 4 módulos.
- Produces (rutas, con `requireAdmin`): `GET /api/admin/landings/:id/qr.svg` y `.../qr.png`. Codifican `${publicBaseUrl}/l/${slug}`. Con `?download=1` añaden `Content-Disposition: attachment; filename="qr-<slug>.<ext>"`.

- [ ] **Step 1: Tests:**
  - `el PNG decodificado con jsqr es exactamente "https://vetaroja.mx/l/<slug>"` (con `PUBLIC_BASE_URL` de prueba).
  - `el SVG empieza con "<svg" y tiene tipo image/svg+xml`.
  - `?download=1 agrega Content-Disposition con qr-<slug>.png`.
  - `id inexistente da 404`; `sin sesión da 401`.
  - `si el slug cambia, el QR nuevo codifica el slug nuevo`.
- [ ] **Step 2:** `npm test -w server -- qr`. Esperado: FALLA.
- [ ] **Step 3:** Implementar con el paquete `qrcode`.
- [ ] **Step 4:** `npm test -w server -- qr`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(server): QR de cada landing en SVG y PNG`.

---

### Task 7: Render de diapositivas y contrato de theme (con Índice Blanco)

> **REQUIRED SUB-SKILL:** invocar la habilidad `frontend-slides` antes de escribir esta tarea. El dueño pidió ese enfoque para las landings. Si sus convenciones chocan con el contrato de abajo, gana el contrato y se documenta la diferencia.

**Files:**
- Create: `web/vite.config.ts`, `web/scripts/copy-fonts.mjs`, `web/src/render/{SlideDeck.tsx,InlineText.tsx,useReveal.ts,render.css}`, `web/src/render/slides/{Cover,EmphasisText,Quote,Concept,BigFigure,Timeline,Comparison,Gallery,Cta}.tsx`, `web/public/themes/indice-blanco.css`, `web/public/fonts/*.woff2`, `web/test/render.test.tsx`

**Interfaces:**
- Consumes: `Slide`, `parseInline` (Task 2).
- Produces: `SlideDeck(props: { slides: Slide[]; ctaUrl: string | null; imageUrl: (imageId: string) => string; themeId: string })`. Raíz `<main data-theme={themeId} class="deck">`. Cada diapositiva es `<section data-slide-type={type} data-animation={animation}>`. Las ocultas no se renderizan.
- Produces: `InlineText(props: { text: string })` que emite `<strong>` y `<mark>`, nunca HTML crudo.
- Produces: `useReveal(): void` que añade `.is-visible` a cada sección al entrar en pantalla (IntersectionObserver) y no hace nada con `prefers-reduced-motion`.
- Navegación (decisión mía): desplazamiento vertical con `scroll-snap`, una diapositiva por pantalla, teclas ↑ ↓ / AvPág / RePág, e indicador "n/total".
- **Contrato de theme** (documentado en el encabezado de `render.css`): cada theme es `web/public/themes/<id>.css`, todo bajo `[data-theme="<id>"]`; define las variables `--bg --fg --accent --accent-2 --muted --border --font-display --font-body`; estiliza `.deck`, `[data-slide-type="…"]` y las clases `.btn-cta`, `.progress`; carga sus fuentes con `@font-face` apuntando a `/fonts/*.woff2`; sin `url()` externos.
- `copy-fonts.mjs` copia los `.woff2` necesarios desde `@fontsource/*` hacia `web/public/fonts/` (los archivos copiados se versionan).
- Índice Blanco (referencia: `docs/superpowers/mockups/seis-themes.html`, tarjeta D): blanco `#FFFFFF`, texto `#0A0A0A`, rojo `#D4140B`, azul `#1A3DFF`, bordes de 3 px, títulos Archivo 700/900 en mayúsculas, texto en IBM Plex Mono, subrayado punteado rojo, botones que se vuelven azules al pasar el cursor.

- [ ] **Step 1: Tests** (`render.test.tsx`, Testing Library y `renderToString`):
  - `renderiza cada uno de los 9 tipos con su data-slide-type`.
  - `una diapositiva hidden no aparece`.
  - **Seguridad:** `una cita con "<script>alert(1)</script>" aparece escapada como texto y el HTML no contiene un <script> real`; lo mismo en `emphasis_text`, `concept` y los pies de galería.
  - `**x** produce <strong>x</strong> y ==x== produce <mark>x</mark>; marcadores sin cerrar quedan literales`.
  - `cta con ctaUrl muestra un <a> con rel "noopener noreferrer" y target _blank; sin ctaUrl no hay enlace`.
  - `la galería usa imageUrl(imageId) en cada <img> con alt igual al pie`.
  - `renderToString del deck no falla (compatible con servidor)`.
- [ ] **Step 2:** `npm test -w web`. Esperado: FALLA.
- [ ] **Step 3:** Implementar componentes, `render.css` estructural, `copy-fonts.mjs` (familias de Índice: Archivo, IBM Plex Mono, IBM Plex Serif, IBM Plex Sans Condensed) y `indice-blanco.css`.
- [ ] **Step 4:** `npm test -w web`. Esperado: PASS.
- [ ] **Step 5:** Verificación visual: abrir una página de prueba con las 9 diapositivas y el theme Índice Blanco en el navegador y confirmar contra el mockup D (celular y escritorio).
- [ ] **Step 6:** Commit `feat(web): render de diapositivas, contrato de theme y theme Índice Blanco`.

---

### Task 8: Páginas públicas con render en servidor

**Files:**
- Create: `web/public.html`, `web/src/public/{entry-client.tsx,entry-server.tsx}`, `server/src/ssr/{assets.ts,template.ts,routes.ts}`, `server/scripts/seed-demo.ts`, `server/test/public.test.ts`
- Modify: `web/vite.config.ts` (entradas `public` y `admin`, build SSR, manifest), `server/src/app.ts`

**Interfaces:**
- Consumes: `SlideDeck` (Task 7), `findPublicLanding`, `resolveCtaUrl`, `getDefaultCtaUrl` (Task 4).
- Produces: `entry-server.tsx` exporta `renderDeck(props: DeckProps): string`. `assets.ts` exporta `loadAssets(distDir: string): { publicJs: string; publicCss: string; adminJs: string; adminCss: string }` leyendo el manifest de Vite.
- Produces: `renderLandingPage(args: { landing: Landing; ctaUrl: string | null; baseUrl: string }): string`, que devuelve el HTML completo con: `<title>`, `meta description`, `og:title`, `og:description`, `og:url`, `og:image` (la imagen de la portada con URL absoluta, si existe), `<link rel="stylesheet" href="/themes/<themeId>.css">`, el contenido ya renderizado y un `<script type="application/json" id="__DECK__">` para hidratar.
- Produces (rutas): `GET /l/:slug` → 200 HTML si está publicada; 301 al slug nuevo si es redirección; 404 con la página "Este tema ya no está disponible" (con enlace a `/`) en cualquier otro caso. `GET /` → portada de Veta Roja con presentación y botón al canal por defecto (si no hay, sin botón). `GET /admin` y `/admin/*` → `admin.html`. Cabecera `Cache-Control: public, max-age=60` en páginas públicas.
- Script: `npm run seed:demo -w server` crea una landing "Demo" con las 9 diapositivas y el contenido de Lyon 1831.

- [ ] **Step 1: Tests** (`public.test.ts`, con `app.inject`):
  - `una landing publicada responde 200 y el HTML trae su título, og:title, la hoja del theme y el texto de sus diapositivas`.
  - **Seguridad:** `un título con <script> sale escapado en <title> y en og:title`.
  - `og:image usa la URL absoluta con publicBaseUrl cuando la portada tiene imagen; no aparece si no la tiene`.
  - `una landing en borrador da 404 con "Este tema ya no está disponible" y su contenido no aparece en el HTML`.
  - `un slug antiguo da 301 a /l/<nuevo>`.
  - `un slug inexistente da 404 con enlace a /`.
  - `GET / incluye el botón del canal por defecto; sin canal no hay botón`.
  - `GET /admin/login devuelve admin.html`.
- [ ] **Step 2:** `npm test -w server -- public`. Esperado: FALLA.
- [ ] **Step 3:** Implementar la configuración de Vite (dos entradas cliente + un bundle SSR), `entry-client.tsx` que hidrata con los datos de `#__DECK__`, la plantilla y las rutas.
- [ ] **Step 4:** `npm run build -w web && npm test -w server -- public`. Esperado: PASS.
- [ ] **Step 5:** `npm run seed:demo -w server`, arrancar el servidor y abrir `/l/demo` en el navegador. Confirmar que hidrata sin errores en consola y que el código QR (Task 6) lleva a esa página.
- [ ] **Step 6:** Commit `feat: páginas públicas con render en servidor y vista previa de enlaces`.

---

### Task 9: Primera tanda de themes (los otros 5)

**Files:**
- Create: `web/public/themes/{indice-negro,indice-papel,indice-azul-palido,cantera-y-tinta,socavon}.css`, `web/test/themes.test.ts`
- Modify: `shared/src/themes.ts` (nombres visibles), `web/scripts/copy-fonts.mjs` (agregar Source Serif 4 e Inter)

**Interfaces:**
- Consumes: contrato de theme (Task 7), `THEMES` (Task 2).
- Produces: los 6 themes de la primera tanda con estos ids y nombres visibles: `indice-blanco` "Índice Blanco", `indice-negro` "Índice Negro", `indice-papel` "Índice Papel", `indice-azul-palido` "Índice Azul Pálido", `cantera-y-tinta` "Cantera y tinta", `socavon` "Socavón".
- Referencias visuales: tarjetas D, E de `seis-themes.html`, F2 y F3 de `theme-f-alternativas.html`, A y C de `seis-themes.html`. Valores: Índice Negro `#0A0A0A / #F2F2EE / #FF5A4E / #8FA2FF`; Índice Papel fondo `#F4E9C8`; Índice Azul Pálido fondo `#DFE5FF`; Cantera `#F3E3DC` con rojo `#A8322D` y serif editorial (Source Serif 4); Socavón `#14110F` con rojo `#C8362F` y plata (Inter). Elección de fuentes y tonos exactos: del constructor, dentro de esa dirección.

- [ ] **Step 1: Tests** (`themes.test.ts`):
  - `cada id de THEMES tiene su archivo web/public/themes/<id>.css`.
  - `cada hoja de theme tiene todas sus reglas bajo [data-theme="<id>"] y define las 8 variables del contrato`.
  - `ninguna hoja de theme contiene http://, https:// ni @import externo`.
  - `todo url() de una hoja de theme apunta a /fonts/ y ese .woff2 existe en web/public/fonts`.
  - `ninguna hoja de theme usa la familia Comic Sans, Comic Neue ni Segoe Print`.
- [ ] **Step 2:** `npm test -w web -- themes`. Esperado: FALLA.
- [ ] **Step 3:** Escribir los 5 themes y registrar sus nombres.
- [ ] **Step 4:** `npm test -w web -- themes`. Esperado: PASS.
- [ ] **Step 5:** Verificación visual: cambiar el theme de la landing demo a cada uno de los 6 y revisar celular y escritorio contra los mockups.
- [ ] **Step 6:** Commit `feat(web): primera tanda de 6 themes`.

---

### Task 10: Panel admin — acceso, lista y ajustes

**Files:**
- Create: `web/admin.html`, `web/src/admin/{main.tsx,App.tsx,api.ts}`, `web/src/admin/pages/{Login,LandingList,Settings}.tsx`, `web/test/admin-shell.test.tsx`

**Interfaces:**
- Consumes: rutas de auth (Task 3), de landings y ajustes (Task 4).
- Produces (`api.ts`): `api.login(username, password)`, `api.me()`, `api.logout()`, `api.listLandings()`, `api.getLanding(id)`, `api.createLanding(input)`, `api.updateLanding(id, input)`, `api.deleteLanding(id)`, `api.getDefaultCtaUrl()`, `api.setDefaultCtaUrl(url)`, `api.uploadImage(file)`. Cada una usa `fetch` con `credentials: 'same-origin'` y lanza `ApiError { status: number; message: string }`.
- Rutas del SPA (`react-router`, base `/admin`): `/login`, `/` (lista), `/landings/new`, `/landings/:id` (Task 11), `/settings`.
- La lista muestra título, estado (borrador/publicada), theme, enlace público y botones Editar y Eliminar (con confirmación).

- [ ] **Step 1: Tests** (`fetch` simulado):
  - `sin sesión (/me da 401) redirige a /login`.
  - `login correcto lleva a la lista; login fallido muestra "Usuario o contraseña incorrectos" sin decir cuál`.
  - `la lista muestra cada landing con su estado y su enlace /l/<slug>`.
  - `eliminar pide confirmación y solo entonces llama a deleteLanding`.
  - `Ajustes guarda el enlace por defecto y muestra el error del servidor cuando no es de WhatsApp`.
  - `cerrar sesión llama a logout y vuelve a /login`.
- [ ] **Step 2:** `npm test -w web -- admin-shell`. Esperado: FALLA.
- [ ] **Step 3:** Implementar el SPA, con textos en español y estilo sobrio basado en el theme Índice Blanco.
- [ ] **Step 4:** `npm test -w web -- admin-shell`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(web): panel admin con acceso, lista y ajustes`.

---

### Task 11: Panel admin — editor de landings con vista previa y QR

**Files:**
- Create: `web/src/admin/pages/LandingEditor.tsx`, `web/src/admin/components/{SlideList,SlideForm,ThemePicker,ImageField,LivePreview,QrPanel}.tsx`, `web/src/admin/components/slideForms/{Cover,EmphasisText,Quote,Concept,BigFigure,Timeline,Comparison,Gallery,Cta}Form.tsx`, `web/test/editor.test.tsx`

**Interfaces:**
- Consumes: `api` (Task 10), `SlideDeck` (Task 7), `LandingInputSchema`, `normalizeSlug`, `ANIMATIONS`, `THEMES` (Task 2).
- Produces: `LandingEditor` en `/landings/new` y `/landings/:id`. Campos: título, descripción, slug (se sugiere con `normalizeSlug(título)` mientras no se edite a mano), theme (`ThemePicker`), estado, enlace del botón (opcional; si está vacío usa el por defecto), lista de diapositivas.
- `SlideList`: agregar por tipo, **reordenar** (subir/bajar), **ocultar**, **duplicar** (nuevo `id`) y eliminar; selector de animación con `ANIMATIONS`. Un formulario por tipo de diapositiva con los campos de la tabla del diseño; las imágenes se suben con `ImageField` (usa `api.uploadImage` y guarda el `imageId`).
- `LivePreview`: renderiza `SlideDeck` con el estado actual del formulario y el theme elegido (enlazando `/themes/<id>.css`; el alcance por `data-theme` evita choques).
- `QrPanel`: **donde se genera la landing se genera su QR.** Tras guardar (y siempre al editar una landing guardada) muestra la imagen de `/api/admin/landings/:id/qr.png`, la dirección pública con botón de copiar, y los enlaces "Descargar PNG" y "Descargar SVG" (`?download=1`, atributo `download`). Si la landing está en borrador, avisa que el QR no funcionará hasta publicarla.

- [ ] **Step 1: Tests:**
  - `agregar una diapositiva de cada uno de los 9 tipos genera datos que pasan SlideSchema`.
  - `subir, bajar, ocultar y duplicar cambian el orden y el estado esperados; el duplicado tiene un id distinto`.
  - `el slug se sugiere desde el título hasta que se edita a mano; después ya no cambia`.
  - `no deja guardar con 31 diapositivas y muestra el aviso`.
  - `guardar una landing nueva llama a createLanding y, al responder, aparece el QrPanel con la imagen y los dos enlaces de descarga con la URL correcta`.
  - `el QrPanel muestra el aviso de borrador cuando status es draft`.
  - `cambiar el theme actualiza el data-theme y la hoja enlazada en LivePreview`.
  - `ImageField llama a uploadImage y guarda el imageId devuelto; muestra el error si el servidor responde 415`.
- [ ] **Step 2:** `npm test -w web -- editor`. Esperado: FALLA.
- [ ] **Step 3:** Implementar el editor. Estado local con un `useReducer` y validación con `LandingInputSchema` antes de enviar.
- [ ] **Step 4:** `npm test -w web -- editor`. Esperado: PASS.
- [ ] **Step 5:** Recorrido manual: entrar, crear una landing con una diapositiva de cada tipo y una imagen, publicar, descargar el QR, escanearlo con un celular (red local) y confirmar que abre la landing.
- [ ] **Step 6:** Commit `feat(web): editor de landings con vista previa en vivo y QR descargable`.

---

### Task 12: Despliegue en servidor propio y prueba de humo

**Files:**
- Create: `deploy/{Dockerfile,docker-compose.yml,Caddyfile,backup.sh,README-DEPLOY.md,smoke.mjs}`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: `docker-compose.yml` con tres servicios (`app`, `postgres` con volumen, `caddy` con HTTPS automático para `vetaroja.mx`) y volumen persistente para `uploads`. Variables en `.env` (nunca versionado): `DATABASE_URL`, `PUBLIC_BASE_URL`, `UPLOADS_DIR`.
- Produces: `backup.sh` que hace `pg_dump` y comprime `uploads` con fecha.
- Produces: `smoke.mjs <baseUrl>`: inicia sesión con `ADMIN_USER` y `ADMIN_PASSWORD`, crea una landing publicada, comprueba `GET /l/<slug>` (200 con el título) y `GET /api/admin/landings/<id>/qr.png` (los primeros bytes son la firma PNG), y borra la landing. Termina con código 0 si todo pasa.
- `README-DEPLOY.md` (en español): requisitos, primer arranque, crear el admin (`admin:create`), restablecer contraseña (`admin:reset`), respaldo y restauración, y cómo actualizar. **Nota:** Caddy obtiene los certificados HTTPS de Let's Encrypt; es lo único externo, solo al emitir o renovar. Dejar documentado cómo usar un certificado propio si se prefiere.

- [ ] **Step 1:** Escribir Dockerfile multi-etapa (build del monorepo y ejecución con solo lo necesario) y el compose.
- [ ] **Step 2:** `docker compose -f deploy/docker-compose.yml up --build` con `PUBLIC_BASE_URL=http://localhost`. Esperado: los tres servicios sanos; `GET /api/health` responde 200.
- [ ] **Step 3:** `node deploy/smoke.mjs http://localhost`. Esperado: sale con código 0 e imprime una línea por comprobación.
- [ ] **Step 4:** Probar `backup.sh` y restaurar en una base nueva. Esperado: la landing de la prueba existe tras restaurar.
- [ ] **Step 5:** Commit `chore: despliegue con Docker Compose, respaldo y prueba de humo`.

---

## Autorevisión

- **Cobertura del diseño:** n landings desde un panel (Tasks 4, 10, 11); formulario campo por campo con los 9 tipos, animaciones, reordenar/ocultar/duplicar e imágenes (Tasks 2, 5, 11); QR generado donde se crea la landing y descargable (Tasks 6, 11); botón al canal de WhatsApp con enlace por defecto y por landing (Tasks 2, 4, 7, 11); sin datos personales (Global Constraints); render con título e imagen para vista previa en WhatsApp (Task 8); slug estable con redirección (Tasks 4, 8); página "tema no disponible" y portada `/` (Task 8); admin con comandos de creación y restablecimiento (Task 3); límites de 30 diapositivas y 5 MB (Tasks 2, 5); vista previa en vivo (Task 11); servidor propio y dominio por configuración (Task 12). **Pendiente a propósito:** 16 de los 22 themes (segundo plan).
- **Consistencia de tipos:** `Slide`, `LandingInput`, `Landing`, `findPublicLanding`, `resolveCtaUrl`, `SlideDeck` y `api.*` tienen una sola definición y los mismos nombres en todas las tareas que los usan.
- **Proporción:** el plan fija firmas, valores del diseño y pruebas; los cuerpos de las funciones los escribe quien implemente.
