import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { loggerConfig } from '../src/logging';

describe('registro de peticiones', () => {
  it('no guarda la IP del visitante ni su puerto, solo método y dirección', async () => {
    const lines: string[] = [];
    const app = Fastify({ logger: { ...loggerConfig, stream: { write: (s: string) => void lines.push(s) } } });
    app.get('/l/demo', async () => 'ok');
    await app.inject({ method: 'GET', url: '/l/demo', remoteAddress: '203.0.113.77', headers: { 'user-agent': 'Prueba/1.0', 'x-forwarded-for': '198.51.100.9' } });
    const log = lines.join('');
    expect(log).toContain('/l/demo');
    expect(log).not.toContain('203.0.113.77');
    expect(log).not.toContain('198.51.100.9');
    expect(log).not.toContain('remotePort');
    expect(log).not.toContain('Prueba/1.0');
    await app.close();
  });

  it('los errores del servidor sí se siguen registrando', async () => {
    const lines: string[] = [];
    const app = Fastify({ logger: { ...loggerConfig, stream: { write: (s: string) => void lines.push(s) } } });
    app.get('/falla', async () => {
      throw new Error('explotó a propósito');
    });
    await app.inject({ method: 'GET', url: '/falla' });
    expect(lines.join('')).toContain('explotó a propósito');
    await app.close();
  });
});
