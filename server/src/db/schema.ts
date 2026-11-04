import { sql } from 'drizzle-orm';
import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { Slide } from '@veta-roja/shared';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const landingGroups = pgTable(
  'landing_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // Un nombre es único sin importar mayúsculas.
  (t) => [uniqueIndex('landing_groups_name_lower_idx').on(sql`lower(${t.name})`)],
);

export const landings = pgTable('landings', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').references(() => landingGroups.id, { onDelete: 'set null' }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  themeId: text('theme_id').notNull(),
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  slides: jsonb('slides').$type<Slide[]>().notNull().default([]),
  ctaUrl: text('cta_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const slugRedirects = pgTable('slug_redirects', {
  oldSlug: text('old_slug').primaryKey(),
  landingId: uuid('landing_id')
    .notNull()
    .references(() => landings.id, { onDelete: 'cascade' }),
});

export const images = pgTable('images', {
  id: uuid('id').primaryKey(),
  file: text('file').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  bytes: integer('bytes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
