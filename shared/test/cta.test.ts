import { describe, expect, it } from 'vitest';
import { isAllowedCtaUrl } from '../src/cta';

describe('isAllowedCtaUrl', () => {
  it('acepta enlaces https de WhatsApp', () => {
    expect(isAllowedCtaUrl('https://whatsapp.com/channel/abc')).toBe(true);
    expect(isAllowedCtaUrl('https://www.whatsapp.com/channel/abc')).toBe(true);
    expect(isAllowedCtaUrl('https://chat.whatsapp.com/xyz')).toBe(true);
    expect(isAllowedCtaUrl('https://wa.me/123')).toBe(true);
  });
  it('rechaza otros esquemas y hosts', () => {
    for (const u of [
      'javascript:alert(1)',
      'http://whatsapp.com/x',
      'https://evil.com/whatsapp.com',
      'https://whatsapp.com.evil.com/x',
      'https://user@evil.com@whatsapp.com/x',
      'data:text/html,x',
      '',
      'no es url',
    ])
      expect(isAllowedCtaUrl(u), u).toBe(false);
  });
});
