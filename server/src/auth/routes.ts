import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { users } from '../db/schema';
import { verifyPassword, hashPassword } from './password';
import { SESSION_COOKIE, SESSION_TTL_MS, createSession, deleteSession, findSessionUser } from './sessions';

declare module 'fastify' {
  interface FastifyInstance {
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    admin?: { id: string; username: string };
  }
}

const LoginBody = z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(500) });
const INVALID = { error: 'Usuario o contraseña incorrectos' };

// Hash de relleno para que un usuario inexistente tarde lo mismo que uno real.
const DUMMY_HASH_PROMISE = hashPassword('relleno-para-igualar-tiempos');

export async function registerAuth(app: FastifyInstance): Promise<void> {
  await app.register(cookie);
  await app.register(rateLimit, { global: false });

  app.decorate('requireAdmin', async (req: FastifyRequest, reply: FastifyReply) => {
    const token = req.cookies[SESSION_COOKIE];
    const user = token ? await findSessionUser(app.db, token) : null;
    if (!user) {
      await reply.code(401).send({ error: 'Sesión requerida' });
      return;
    }
    req.admin = user;
  });

  app.post(
    '/api/auth/login',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const parsed = LoginBody.safeParse(req.body);
      if (!parsed.success) return reply.code(401).send(INVALID);
      const { username, password } = parsed.data;

      const [user] = await app.db.select().from(users).where(eq(users.username, username));
      const ok = await verifyPassword(user ? user.passwordHash : await DUMMY_HASH_PROMISE, password);
      if (!user || !ok) return reply.code(401).send(INVALID);

      const token = await createSession(app.db, user.id);
      reply.setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: app.config.isProd,
        path: '/',
        maxAge: SESSION_TTL_MS / 1000,
      });
      return { username: user.username };
    },
  );

  app.get('/api/auth/me', { preHandler: app.requireAdmin }, async (req) => ({ username: req.admin!.username }));

  app.post('/api/auth/logout', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await deleteSession(app.db, token);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.code(204).send();
  });
}
