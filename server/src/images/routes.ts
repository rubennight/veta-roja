import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { images } from '../db/schema';
import { MAX_IMAGE_BYTES, UnsupportedImageError, processImage } from './process';

export async function registerImageRoutes(app: FastifyInstance): Promise<void> {
  const { uploadsDir } = app.config;
  await fs.mkdir(uploadsDir, { recursive: true });

  await app.register(multipart, { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } });
  await app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: '/uploads/',
    index: false,
    dotfiles: 'deny',
    maxAge: '1y',
    immutable: true,
  });

  app.post('/api/admin/images', { preHandler: app.requireAdmin }, async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: 'Falta el archivo (campo "file")' });

    let original: Buffer;
    try {
      original = await file.toBuffer();
    } catch {
      return reply.code(413).send({ error: 'La imagen supera los 5 MB' });
    }
    if (file.file.truncated) return reply.code(413).send({ error: 'La imagen supera los 5 MB' });

    let processed;
    try {
      processed = await processImage(original);
    } catch (err) {
      if (err instanceof UnsupportedImageError) return reply.code(415).send({ error: err.message });
      throw err;
    }

    const id = randomUUID();
    const fileName = `${id}.webp`;
    await fs.writeFile(path.join(uploadsDir, fileName), processed.data);
    await fs.writeFile(path.join(uploadsDir, `${id}.jpg`), processed.share);
    await app.db.insert(images).values({
      id,
      file: fileName,
      width: processed.width,
      height: processed.height,
      bytes: processed.data.length,
    });
    return reply.code(201).send({ id, url: `/uploads/${fileName}`, width: processed.width, height: processed.height });
  });
}
