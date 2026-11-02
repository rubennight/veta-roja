import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { settings } from '../db/schema';

const DEFAULT_CTA_KEY = 'default_cta_url';

export async function getDefaultCtaUrl(db: Db): Promise<string | null> {
  const [row] = await db.select().from(settings).where(eq(settings.key, DEFAULT_CTA_KEY));
  return row?.value ?? null;
}

export async function setDefaultCtaUrl(db: Db, url: string | null): Promise<void> {
  if (url === null) {
    await db.delete(settings).where(eq(settings.key, DEFAULT_CTA_KEY));
    return;
  }
  await db
    .insert(settings)
    .values({ key: DEFAULT_CTA_KEY, value: url })
    .onConflictDoUpdate({ target: settings.key, set: { value: url } });
}
