import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { findPublicLanding, resolveCtaUrl } from '../landings/repo';
import { getDefaultCtaUrl } from '../landings/settings';
import { loadAssets } from './assets';
import { renderAdminShell, renderHomePage, renderLandingPage, renderUnavailablePage } from './template';

export async function registerPublicRoutes(app: FastifyInstance): Promise<void> {
  const { webDir } = app.config;
  const assets = loadAssets(webDir);

  const staticDirs: Array<{ prefix: string; root: string; maxAge: string; immutable: boolean }> = [
    { prefix: '/themes/', root: path.join(webDir, 'public/themes'), maxAge: '1h', immutable: false },
    { prefix: '/fonts/', root: path.join(webDir, 'public/fonts'), maxAge: '1y', immutable: true },
    { prefix: '/assets/', root: path.join(webDir, 'dist/client/assets'), maxAge: '1y', immutable: true },
  ];
  for (const dir of staticDirs) {
    if (!fs.existsSync(dir.root)) continue;
    await app.register(fastifyStatic, {
      root: dir.root,
      prefix: dir.prefix,
      decorateReply: false,
      index: false,
      dotfiles: 'deny',
      maxAge: dir.maxAge,
      immutable: dir.immutable,
    });
  }

  app.get('/', async (_req, reply) => {
    const ctaUrl = await getDefaultCtaUrl(app.db);
    return reply.type('text/html; charset=utf-8').header('Cache-Control', 'public, max-age=60').send(renderHomePage({ ctaUrl, assets }));
  });

  app.get<{ Params: { slug: string } }>('/l/:slug', async (req, reply) => {
    const found = await findPublicLanding(app.db, req.params.slug);
    if (found.kind === 'redirect') return reply.code(301).redirect(`/l/${found.slug}`);
    if (found.kind === 'unavailable') {
      return reply
        .code(404)
        .type('text/html; charset=utf-8')
        .header('Cache-Control', 'no-store')
        .send(renderUnavailablePage(assets));
    }
    const ctaUrl = resolveCtaUrl(found.landing, await getDefaultCtaUrl(app.db));
    const html = renderLandingPage({ landing: found.landing, ctaUrl, baseUrl: app.config.publicBaseUrl, assets });
    return reply.type('text/html; charset=utf-8').header('Cache-Control', 'public, max-age=60').send(html);
  });

  const adminShell = async (_req: unknown, reply: import('fastify').FastifyReply) =>
    reply.type('text/html; charset=utf-8').header('Cache-Control', 'no-store').send(renderAdminShell(assets));
  app.get('/admin', adminShell);
  app.get('/admin/*', adminShell);
}
