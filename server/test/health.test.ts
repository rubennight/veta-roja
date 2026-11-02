import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { makeTestApp, type TestApp } from './helpers';

describe('salud del servidor', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await makeTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  it('GET /api/health responde 200 con { ok: true }', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});

describe('loadConfig', () => {
  it('lanza si falta PUBLIC_BASE_URL', () => {
    expect(() => loadConfig({ DATABASE_URL: 'postgres://x/y' } as NodeJS.ProcessEnv)).toThrow(/PUBLIC_BASE_URL/);
  });
  it('lanza si falta DATABASE_URL', () => {
    expect(() => loadConfig({ PUBLIC_BASE_URL: 'https://vetaroja.mx' } as NodeJS.ProcessEnv)).toThrow(/DATABASE_URL/);
  });
  it('quita la barra final de PUBLIC_BASE_URL', () => {
    const c = loadConfig({ DATABASE_URL: 'postgres://x/y', PUBLIC_BASE_URL: 'https://vetaroja.mx/' } as NodeJS.ProcessEnv);
    expect(c.publicBaseUrl).toBe('https://vetaroja.mx');
  });
});
