import path from 'node:path';

export interface Config {
  databaseUrl: string;
  publicBaseUrl: string;
  uploadsDir: string;
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
    isProd: env.NODE_ENV === 'production',
  };
}
