import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getLanding } from '../landings/repo';
import { renderQr } from './render';

const IdParam = z.object({ id: z.string().uuid() });

export async function registerQrRoutes(app: FastifyInstance): Promise<void> {
  const serve = (format: 'svg' | 'png') =>
    async (
      req: { params: unknown; query: unknown },
      reply: import('fastify').FastifyReply,
    ) => {
      const params = IdParam.safeParse(req.params);
      const landing = params.success ? await getLanding(app.db, params.data.id) : null;
      if (!landing) return reply.code(404).send({ error: 'No encontrada' });

      const url = `${app.config.publicBaseUrl}/l/${landing.slug}`;
      const body = format === 'svg' ? await renderQr(url, 'svg') : await renderQr(url, 'png');
      const download = (req.query as { download?: string }).download === '1';
      if (download) reply.header('Content-Disposition', `attachment; filename="qr-${landing.slug}.${format}"`);
      return reply
        .type(format === 'svg' ? 'image/svg+xml; charset=utf-8' : 'image/png')
        .header('Cache-Control', 'no-store')
        .send(body);
    };

  app.get('/api/admin/landings/:id/qr.svg', { preHandler: app.requireAdmin }, serve('svg'));
  app.get('/api/admin/landings/:id/qr.png', { preHandler: app.requireAdmin }, serve('png'));
}
