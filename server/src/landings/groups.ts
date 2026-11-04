import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { landingGroups, landings } from '../db/schema';

export type Group = typeof landingGroups.$inferSelect;
export type GroupSummary = Group & { landingCount: number };

export class GroupNameTakenError extends Error {
  constructor(public groupName: string) {
    super(`Ya existe un grupo llamado "${groupName}"`);
  }
}

export class GroupNotFoundError extends Error {
  constructor() {
    super('El grupo no existe');
  }
}

const isUniqueViolation = (err: unknown): boolean =>
  (err as { code?: string; cause?: { code?: string } })?.code === '23505' ||
  (err as { cause?: { code?: string } })?.cause?.code === '23505';

export async function listGroups(db: Db): Promise<GroupSummary[]> {
  return db
    .select({
      id: landingGroups.id,
      name: landingGroups.name,
      createdAt: landingGroups.createdAt,
      landingCount: sql<number>`count(${landings.id})::int`,
    })
    .from(landingGroups)
    .leftJoin(landings, eq(landings.groupId, landingGroups.id))
    .groupBy(landingGroups.id)
    .orderBy(sql`lower(${landingGroups.name})`);
}

export async function createGroup(db: Db, name: string): Promise<Group> {
  try {
    const [row] = await db.insert(landingGroups).values({ name }).returning();
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new GroupNameTakenError(name);
    throw err;
  }
}

/** Devuelve null si el grupo no existe. */
export async function renameGroup(db: Db, id: string, name: string): Promise<Group | null> {
  try {
    const [row] = await db.update(landingGroups).set({ name }).where(eq(landingGroups.id, id)).returning();
    return row ?? null;
  } catch (err) {
    if (isUniqueViolation(err)) throw new GroupNameTakenError(name);
    throw err;
  }
}

/** Sus landings no se borran: la clave foránea las deja sin grupo. */
export async function deleteGroup(db: Db, id: string): Promise<boolean> {
  const rows = await db.delete(landingGroups).where(eq(landingGroups.id, id)).returning({ id: landingGroups.id });
  return rows.length > 0;
}
