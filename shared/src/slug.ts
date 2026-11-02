export const RESERVED_SLUGS = ['admin', 'api', 'l', 'uploads', 'themes', 'fonts', 'assets'] as const;

export function normalizeSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const SLUG_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return (
    slug.length >= 2 &&
    slug.length <= 60 &&
    SLUG_SHAPE.test(slug) &&
    !(RESERVED_SLUGS as readonly string[]).includes(slug)
  );
}
