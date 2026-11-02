const ALLOWED_HOSTS = new Set(['whatsapp.com', 'www.whatsapp.com', 'chat.whatsapp.com', 'wa.me']);

/** Solo enlaces https hacia WhatsApp. Rechaza cualquier otro esquema, host o credenciales incrustadas. */
export function isAllowedCtaUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    parsed.protocol === 'https:' &&
    ALLOWED_HOSTS.has(parsed.hostname) &&
    parsed.username === '' &&
    parsed.password === ''
  );
}
