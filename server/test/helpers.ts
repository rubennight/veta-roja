import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../src/app';
import { createDb, runMigrations, type Db } from '../src/db/client';
import type { Config } from '../src/config';
import { createAdmin } from '../src/auth/password';
import { createSession } from '../src/auth/sessions';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';

export interface TestApp {
  app: FastifyInstance;
  db: Db;
  config: Config;
  reset(): Promise<void>;
  close(): Promise<void>;
}

export async function makeTestApp(overrides: Partial<Config> = {}): Promise<TestApp> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('Falta TEST_DATABASE_URL');
  const { db, close } = createDb(url);
  await runMigrations(db);
  const config: Config = {
    databaseUrl: url,
    publicBaseUrl: 'https://vetaroja.mx',
    uploadsDir: fs.mkdtempSync(path.join(os.tmpdir(), 'vr-uploads-')),
    webDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web'),
    isProd: false,
    ...overrides,
  };
  const app = await buildApp({ db, config });

  async function reset() {
    const res = await db.execute(sql`select tablename from pg_tables where schemaname = 'public'`);
    const names = res.rows.map((r) => `"${(r as { tablename: string }).tablename}"`);
    if (names.length) await db.execute(sql.raw(`truncate ${names.join(', ')} restart identity cascade`));
  }
  await reset();

  return {
    app,
    db,
    config,
    reset,
    async close() {
      await app.close();
      await close();
    },
  };
}

/** Crea un admin y una sesión directamente (sin pasar por el login limitado) y devuelve las cookies. */
export async function loginAsAdmin(t: TestApp): Promise<{ vr_session: string }> {
  await createAdmin(t.db, 'admin', 'contraseña-muy-larga-123');
  const [user] = await t.db.select().from(users).where(eq(users.username, 'admin'));
  return { vr_session: await createSession(t.db, user.id) };
}
