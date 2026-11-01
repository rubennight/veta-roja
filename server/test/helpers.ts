import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { buildApp } from '../src/app';
import { createDb, runMigrations, type Db } from '../src/db/client';
import type { Config } from '../src/config';

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
