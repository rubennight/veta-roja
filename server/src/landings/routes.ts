import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { LandingInputSchema, isAllowedCtaUrl } from '@veta-roja/shared';
import { SlugTakenError, createLanding, deleteLanding, getLanding, listLandings, updateLanding } from './repo';
import { getDefaultCtaUrl, setDefaultCtaUrl } from './settings';

const IdParam = z.object({ id: z.string().uuid() });
const CtaBody = z.object({
  url: z.string().refine(isAllowedCtaUrl, 'El enlace debe ser https de WhatsApp').nullable(),
});

export async function registerLandingRoutes(app: FastifyInstance): Promise<void> {
  const guard = { preHandler: app.requireAdmin };

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof SlugTakenError) return reply.code(409).send({ error: err.message });
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) return reply.code(status).send({ error: err.message });
    app.log.error(err);
    return reply.code(500).send({ error: 'Error interno' });
  });

  app.get('/api/admin/landings', guard, async () => listLandings(app.db));

  app.post('/api/admin/landings', guard, async (req, reply) => {
    const parsed = LandingInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Datos no válidos', issues: parsed.error.issues });
    return reply.code(201).send(await createLanding(app.db, parsed.data));
  });

  app.get('/api/admin/landings/:id', guard, async (req, reply) => {
    const params = IdParam.safeParse(req.params);
    const landing = params.success ? await getLanding(app.db, params.data.id) : null;
    return landing ?? reply.code(404).send({ error: 'No encontrada' });
  });

  app.put('/api/admin/landings/:id', guard, async (req, reply) => {
    const params = IdParam.safeParse(req.params);
    if (!params.success) return reply.code(404).send({ error: 'No encontrada' });
    const parsed = LandingInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Datos no válidos', issues: parsed.error.issues });
    const updated = await updateLanding(app.db, params.data.id, parsed.data);
    return updated ?? reply.code(404).send({ error: 'No encontrada' });
  });

  app.delete('/api/admin/landings/:id', guard, async (req, reply) => {
    const params = IdParam.safeParse(req.params);
    const removed = params.success ? await deleteLanding(app.db, params.data.id) : false;
    return removed ? reply.code(204).send() : reply.code(404).send({ error: 'No encontrada' });
  });

  app.get('/api/admin/settings/default-cta-url', guard, async () => ({ url: await getDefaultCtaUrl(app.db) }));

  app.put('/api/admin/settings/default-cta-url', guard, async (req, reply) => {
    const parsed = CtaBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Datos no válidos', issues: parsed.error.issues });
    await setDefaultCtaUrl(app.db, parsed.data.url);
    return { url: parsed.data.url };
  });
}
