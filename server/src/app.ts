import Fastify, { type FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import type { Config } from './config';
import type { Db } from './db/client';
import { registerAuth } from './auth/routes';
import { registerLandingRoutes } from './landings/routes';
import { registerImageRoutes } from './images/routes';
import { registerQrRoutes } from './qr/routes';
import { registerPublicRoutes } from './ssr/routes';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    config: Config;
  }
}

export async function buildApp(deps: { db: Db; config: Config }): Promise<FastifyInstance> {
  // En las pruebas (vitest) no se registra nada; en ejecución real se registran peticiones y errores.
  const app = Fastify({ logger: process.env.VITEST ? false : true, trustProxy: deps.config.isProd });
  app.decorate('db', deps.db);
  app.decorate('config', deps.config);

  app.get('/api/health', async () => {
    await deps.db.execute(sql`select 1`);
    return { ok: true };
  });

  await registerAuth(app);
  await registerLandingRoutes(app);
  await registerImageRoutes(app);
  await registerQrRoutes(app);
  await registerPublicRoutes(app);

  return app;
}
