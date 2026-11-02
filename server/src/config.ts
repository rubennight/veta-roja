import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Config {
  databaseUrl: string;
  publicBaseUrl: string;
  uploadsDir: string;
  /** Carpeta del paquete web (themes, fuentes y build del cliente). */
  webDir: string;
  isProd: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Falta la variable DATABASE_URL');
  const publicBaseUrl = env.PUBLIC_BASE_URL;
  if (!publicBaseUrl) throw new Error('Falta la variable PUBLIC_BASE_URL');
  return {
    databaseUrl,
    publicBaseUrl: publicBaseUrl.replace(/\/+$/, ''),
    uploadsDir: path.resolve(env.UPLOADS_DIR ?? 'uploads'),
    webDir: path.resolve(env.WEB_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '../../web')),
    isProd: env.NODE_ENV === 'production',
  };
}
