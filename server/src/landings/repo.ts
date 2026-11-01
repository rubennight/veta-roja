import { eq } from 'drizzle-orm';
import type { LandingInput } from '@veta-roja/shared';
import type { Db } from '../db/client';
import { landings, slugRedirects } from '../db/schema';

export type Landing = typeof landings.$inferSelect;
export type LandingSummary = Pick<Landing, 'id' | 'slug' | 'title' | 'themeId' | 'status' | 'updatedAt'>;

export class SlugTakenError extends Error {
  constructor(public slug: string) {
    super(`El slug "${slug}" ya está en uso`);
  }
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Un slug está libre si no lo usa otra landing ni es redirección de otra landing. */
async function assertSlugFree(tx: Tx | Db, slug: string, ownId?: string): Promise<void> {
  const [taken] = await tx.select({ id: landings.id }).from(landings).where(eq(landings.slug, slug));
  if (taken && taken.id !== ownId) throw new SlugTakenError(slug);
  const [redirect] = await tx
    .select({ landingId: slugRedirects.landingId })
    .from(slugRedirects)
    .where(eq(slugRedirects.oldSlug, slug));
  if (redirect && redirect.landingId !== ownId) throw new SlugTakenError(slug);
}

export async function createLanding(db: Db, input: LandingInput): Promise<Landing> {
  return db.transaction(async (tx) => {
    await assertSlugFree(tx, input.slug);
    const [row] = await tx.insert(landings).values(input).returning();
    return row;
  });
}

export async function getLanding(db: Db, id: string): Promise<Landing | null> {
  const [row] = await db.select().from(landings).where(eq(landings.id, id));
  return row ?? null;
}

export async function listLandings(db: Db): Promise<LandingSummary[]> {
  return db
    .select({
      id: landings.id,
      slug: landings.slug,
      title: landings.title,
      themeId: landings.themeId,
      status: landings.status,
      updatedAt: landings.updatedAt,
    })
    .from(landings)
    .orderBy(landings.updatedAt);
}

/** Devuelve null si la landing no existe. Si cambia el slug, deja una redirección desde el anterior. */
export async function updateLanding(db: Db, id: string, input: LandingInput): Promise<Landing | null> {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(landings).where(eq(landings.id, id));
    if (!current) return null;
    if (input.slug !== current.slug) {
      await assertSlugFree(tx, input.slug, id);
      await tx.delete(slugRedirects).where(eq(slugRedirects.oldSlug, input.slug));
      await tx.insert(slugRedirects).values({ oldSlug: current.slug, landingId: id });
    }
    const [row] = await tx
      .update(landings)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(landings.id, id))
      .returning();
    return row;
  });
}

export async function deleteLanding(db: Db, id: string): Promise<boolean> {
  const rows = await db.delete(landings).where(eq(landings.id, id)).returning({ id: landings.id });
  return rows.length > 0;
}

export type PublicLookup =
  | { kind: 'found'; landing: Landing }
  | { kind: 'redirect'; slug: string }
  | { kind: 'unavailable' };

/** Resuelve un slug público. Solo las landings publicadas son visibles; todo lo demás es "unavailable". */
export async function findPublicLanding(db: Db, slug: string): Promise<PublicLookup> {
  const [direct] = await db.select().from(landings).where(eq(landings.slug, slug));
  if (direct) return direct.status === 'published' ? { kind: 'found', landing: direct } : { kind: 'unavailable' };

  const [redirect] = await db.select().from(slugRedirects).where(eq(slugRedirects.oldSlug, slug));
  if (!redirect) return { kind: 'unavailable' };
  const target = await getLanding(db, redirect.landingId);
  return target && target.status === 'published' ? { kind: 'redirect', slug: target.slug } : { kind: 'unavailable' };
}

export function resolveCtaUrl(landing: Pick<Landing, 'ctaUrl'>, defaultUrl: string | null): string | null {
  return landing.ctaUrl ?? defaultUrl ?? null;
}
