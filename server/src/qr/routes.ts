import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getLanding } from '../landings/repo';
import { QrStyleSchema } from '@veta-roja/shared';
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
      const query = req.query as Record<string, unknown>;
      // Estilo del QR: forma, colores, emblema… Todo se valida; un valor inválido es un 400, nunca un SVG con texto ajeno.
      const parsed = QrStyleSchema.safeParse(query);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return reply.code(400).send({ error: `Estilo de QR inválido (${issue.path.join('.') || 'parámetros'}): ${issue.message}` });
      }
      const body = format === 'svg' ? await renderQr(url, 'svg', parsed.data) : await renderQr(url, 'png', parsed.data);
      const download = query.download === '1';
      if (download) reply.header('Content-Disposition', `attachment; filename="qr-${landing.slug}.${format}"`);
      return reply
        .type(format === 'svg' ? 'image/svg+xml; charset=utf-8' : 'image/png')
        .header('Cache-Control', 'no-store')
        .send(body);
    };

  app.get('/api/admin/landings/:id/qr.svg', { preHandler: app.requireAdmin }, serve('svg'));
  app.get('/api/admin/landings/:id/qr.png', { preHandler: app.requireAdmin }, serve('png'));
}
