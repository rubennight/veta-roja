import { buildApp } from './app';
import { loadConfig } from './config';
import { createDb, runMigrations } from './db/client';

const config = loadConfig();
const { db } = createDb(config.databaseUrl);
await runMigrations(db);
const app = await buildApp({ db, config });
const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: process.env.HOST ?? '0.0.0.0' });
console.log(`Veta Roja escuchando en ${config.publicBaseUrl} (puerto ${port})`);
