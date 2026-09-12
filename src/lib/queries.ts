import 'server-only';
import { db } from './db';
import { posts, recipes, settings } from './schema';
import { and, desc, eq, isNotNull, lt, gt, asc } from 'drizzle-orm';

const published = (t: typeof posts | typeof recipes) =>
  and(eq(t.status, 'published'), isNotNull(t.publishedAt));

export async function listPosts(limit?: number) {
  const q = db.select().from(posts).where(published(posts)).orderBy(desc(posts.publishedAt));
  return limit ? q.limit(limit) : q;
}

export async function listRecipes(limit?: number) {
  const q = db.select().from(recipes).where(published(recipes)).orderBy(desc(recipes.publishedAt));
  return limit ? q.limit(limit) : q;
}

export async function countPosts() {
  const rows = await db.select({ id: posts.id }).from(posts).where(published(posts));
  return rows.length;
}

export async function getPost(slug: string) {
  const [row] = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
  return row ?? null;
}

export async function getRecipe(slug: string) {
  const [row] = await db.select().from(recipes).where(eq(recipes.slug, slug)).limit(1);
  return row ?? null;
}

/** Previous/next by publish date, for the footer of a post. */
export async function getNeighbours(publishedAt: number | null) {
  if (!publishedAt) return { prev: null, next: null };
  const [prev] = await db
    .select({ slug: posts.slug, title: posts.title })
    .from(posts)
    .where(and(published(posts), lt(posts.publishedAt, publishedAt)))
    .orderBy(desc(posts.publishedAt))
    .limit(1);
  const [next] = await db
    .select({ slug: posts.slug, title: posts.title })
    .from(posts)
    .where(and(published(posts), gt(posts.publishedAt, publishedAt)))
    .orderBy(asc(posts.publishedAt))
    .limit(1);
  return { prev: prev ?? null, next: next ?? null };
}

export async function getSetting(key: string, fallback = '') {
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return row?.value ?? fallback;
}

export async function getSettings() {
  const rows = await db.select().from(settings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>;
}
