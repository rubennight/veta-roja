import { describe, expect, it } from 'vitest';
import { DEFAULT_QR_STYLE, QrStyleSchema, contrastRatio, qrStyleToQuery } from '../src/qr';

describe('estilo del QR', () => {
  it('sin parámetros devuelve el estilo por omisión: negro sobre blanco, martillo y hoz', () => {
    const style = QrStyleSchema.parse({});
    expect(style).toEqual(DEFAULT_QR_STYLE);
    expect(style.logo).toBe(true);
    expect(style.fg).toBe('#000000');
    expect(style.bg).toBe('#ffffff');
  });

  it('acepta colores con o sin # y los normaliza en minúsculas', () => {
    expect(QrStyleSchema.parse({ fg: 'CC0000' }).fg).toBe('#cc0000');
    expect(QrStyleSchema.parse({ fg: '#AaBbCc' }).fg).toBe('#aabbcc');
  });

  it('rechaza colores inválidos, formas desconocidas y tamaños fuera de rango', () => {
    expect(QrStyleSchema.safeParse({ fg: 'rojo' }).success).toBe(false);
    expect(QrStyleSchema.safeParse({ fg: 'url(javascript:1)' }).success).toBe(false);
    expect(QrStyleSchema.safeParse({ body: 'estrella' }).success).toBe(false);
    expect(QrStyleSchema.safeParse({ size: 100 }).success).toBe(false);
    expect(QrStyleSchema.safeParse({ size: 99999 }).success).toBe(false);
    expect(QrStyleSchema.safeParse({ logoSize: 60 }).success).toBe(false);
  });

  it('logo=0 / logo=1 llegan como texto desde la dirección y se vuelven booleanos', () => {
    expect(QrStyleSchema.parse({ logo: '0' }).logo).toBe(false);
    expect(QrStyleSchema.parse({ logo: '1' }).logo).toBe(true);
  });

  it('el fondo puede ser transparente ("none")', () => {
    expect(QrStyleSchema.parse({ bg: 'none' }).bg).toBe('none');
  });

  it('qrStyleToQuery solo escribe lo que difiere del estilo por omisión y se lee de vuelta igual', () => {
    expect(qrStyleToQuery(DEFAULT_QR_STYLE)).toBe('');
    const custom = QrStyleSchema.parse({ body: 'dots', eyeFrame: 'circle', fg: '#cc0000', gradient: 'linear', fg2: '#220000', logo: '0' });
    const query = qrStyleToQuery(custom);
    expect(QrStyleSchema.parse(Object.fromEntries(new URLSearchParams(query)))).toEqual(custom);
  });

  it('un estilo ya procesado (con colores de ojos en null) vuelve a ser válido', () => {
    const style = QrStyleSchema.parse({ bg: 'none', logo: false });
    expect(QrStyleSchema.parse(JSON.parse(JSON.stringify(style)))).toEqual(style);
  });

  it('contrastRatio: negro/blanco = 21, igual color = 1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
  });
});
