import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { sessions, users } from '../db/schema';

export const MIN_PASSWORD_LENGTH = 12;

function assertStrongEnough(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
  }
}

export const hashPassword = (password: string) => argon2.hash(password, { type: argon2.argon2id });

export const verifyPassword = (hash: string, password: string) => argon2.verify(hash, password);

export async function createAdmin(db: Db, username: string, password: string): Promise<void> {
  assertStrongEnough(password);
  await db.insert(users).values({ username, passwordHash: await hashPassword(password) });
}

/** Cambia la contraseña y cierra todas las sesiones abiertas de ese usuario. */
export async function setAdminPassword(db: Db, username: string, password: string): Promise<void> {
  assertStrongEnough(password);
  const [user] = await db.select().from(users).where(eq(users.username, username));
  if (!user) throw new Error(`No existe el usuario "${username}"`);
  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, user.id));
  await db.delete(sessions).where(eq(sessions.userId, user.id));
}
