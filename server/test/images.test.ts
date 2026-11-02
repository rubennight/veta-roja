import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { loginAsAdmin, makeTestApp, type TestApp } from './helpers';

let t: TestApp;
let cookies: { vr_session: string };

beforeAll(async () => {
  t = await makeTestApp();
});
afterAll(async () => {
  await t.close();
});
beforeEach(async () => {
  await t.reset();
  cookies = await loginAsAdmin(t);
});

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#c00000' } });

function multipart(file: Buffer, filename: string, contentType: string) {
  const boundary = '----vetaroja' + Math.random().toString(16).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { payload: Buffer.concat([head, file, tail]), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

const upload = (file: Buffer, filename: string, contentType: string, withSession = true) => {
  const { payload, headers } = multipart(file, filename, contentType);
  return t.app.inject({ method: 'POST', url: '/api/admin/images', payload, headers, cookies: withSession ? cookies : undefined });
};

describe('subida de imágenes', () => {
  it('convierte un PNG de 3000 px a WebP de 1600 px de ancho', async () => {
    const res = await upload(await solid(3000, 1500).png().toBuffer(), 'grande.png', 'image/png');
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.width).toBe(1600);
    expect(body.height).toBe(800);
    expect(body.url).toBe(`/uploads/${body.id}.webp`);
    const meta = await sharp(path.join(t.config.uploadsDir, `${body.id}.webp`)).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(1600);
  });

  it('no agranda una imagen de 800 px', async () => {
    const res = await upload(await solid(800, 400).jpeg().toBuffer(), 'chica.jpg', 'image/jpeg');
    expect(res.statusCode).toBe(201);
    expect(res.json().width).toBe(800);
  });

  it('rechaza un SVG con <script> con 415', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>');
    expect((await upload(svg, 'x.svg', 'image/svg+xml')).statusCode).toBe(415);
  });

  it('rechaza un GIF con 415', async () => {
    const gif = await solid(20, 20).gif().toBuffer();
    expect((await upload(gif, 'x.gif', 'image/gif')).statusCode).toBe(415);
  });

  it('rechaza un .jpg cuyo contenido es texto, aunque declare image/jpeg', async () => {
    expect((await upload(Buffer.from('esto no es una imagen'), 'falso.jpg', 'image/jpeg')).statusCode).toBe(415);
  });

  it('rechaza un archivo de más de 5 MB con 413', async () => {
    const big = Buffer.alloc(6 * 1024 * 1024, 1);
    expect((await upload(big, 'enorme.png', 'image/png')).statusCode).toBe(413);
  });

  it('sin sesión da 401', async () => {
    const res = await upload(await solid(10, 10).png().toBuffer(), 'a.png', 'image/png', false);
    expect(res.statusCode).toBe(401);
  });

  it('un rechazo no deja archivos en uploadsDir', async () => {
    const before = fs.readdirSync(t.config.uploadsDir).sort();
    expect((await upload(Buffer.from('basura'), 'x.png', 'image/png')).statusCode).toBe(415);
    expect(fs.readdirSync(t.config.uploadsDir).sort()).toEqual(before);
  });
});

describe('copia para compartir', () => {
  it('además del WebP guarda un JPEG de hasta 1200 px de ancho, servido como image/jpeg', async () => {
    const res = await upload(await solid(3000, 1500).png().toBuffer(), 'grande.png', 'image/png');
    const { id } = res.json();
    const meta = await sharp(path.join(t.config.uploadsDir, `${id}.jpg`)).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(1200);
    const served = await t.app.inject({ method: 'GET', url: `/uploads/${id}.jpg` });
    expect(served.statusCode).toBe(200);
    expect(served.headers['content-type']).toBe('image/jpeg');
  });

  it('una imagen con transparencia se aplana sobre blanco en el JPEG (sin fondo negro)', async () => {
    const png = await sharp({ create: { width: 40, height: 40, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const { id } = (await upload(png, 't.png', 'image/png')).json();
    const { data } = await sharp(path.join(t.config.uploadsDir, `${id}.jpg`)).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(240);
  });
});

describe('servicio de /uploads', () => {
  it('sirve el archivo con cabecera immutable y tipo image/webp', async () => {
    const { id } = (await upload(await solid(100, 100).png().toBuffer(), 'a.png', 'image/png')).json();
    const res = await t.app.inject({ method: 'GET', url: `/uploads/${id}.webp` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/webp');
    expect(res.headers['cache-control']).toMatch(/immutable/);
    expect(res.headers['cache-control']).toMatch(/max-age=31536000/);
  });

  it('no sale de la carpeta de subidas', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/uploads/..%2f..%2fpackage.json' });
    expect([400, 403, 404]).toContain(res.statusCode);
  });
});
