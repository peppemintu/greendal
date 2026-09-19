'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { posts, recipes, settings } from '@/lib/schema';
import { requireAdmin } from '@/lib/auth';
import { slugify } from '@/lib/format';

type State = { error?: string } | undefined;

const now = () => Math.floor(Date.now() / 1000);

/** datetime-local ("2026-09-02T21:00") -> unix seconds. */
function toUnix(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  const ms = Date.parse(s.length <= 16 ? `${s}:00Z` : s);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim();
}

function num(form: FormData, key: string): number | null {
  const v = str(form, key);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function savePost(_prev: State, form: FormData): Promise<State> {
  await requireAdmin();
  const idRaw = str(form, 'id');
  const title = str(form, 'title');
  if (!title) return { error: 'A thought needs a title before it can be saved.' };

  const slug = slugify(str(form, 'slug') || title);
  if (!slug) return { error: 'That title produced an empty web address. Set the slug by hand.' };

  const status = str(form, 'status') === 'published' ? 'published' : 'draft';
  const publishedAt = toUnix(form.get('publishedAt')) ?? (status === 'published' ? now() : null);

  const values = {
    slug,
    title,
    dek: str(form, 'dek') || null,
    body: String(form.get('body') ?? ''),
    status: status as 'draft' | 'published',
    publishedAt,
    psRecipeId: num(form, 'psRecipeId'),
    psText: str(form, 'psText') || null,
    updatedAt: now(),
  };

  try {
    if (idRaw) {
      await db.update(posts).set(values).where(eq(posts.id, Number(idRaw)));
    } else {
      await db.insert(posts).values({ ...values, createdAt: now() });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes('UNIQUE')) {
      return { error: `The address /thoughts/${slug} is already taken. Pick another slug.` };
    }
    return { error: message };
  }

  revalidatePath('/');
  revalidatePath('/thoughts');
  redirect('/admin');
}

export async function saveRecipe(_prev: State, form: FormData): Promise<State> {
  await requireAdmin();
  const idRaw = str(form, 'id');
  const title = str(form, 'title');
  if (!title) return { error: 'A recipe needs a title before it can be saved.' };

  const slug = slugify(str(form, 'slug') || title);
  if (!slug) return { error: 'That title produced an empty web address. Set the slug by hand.' };

  const status = str(form, 'status') === 'published' ? 'published' : 'draft';
  const publishedAt = toUnix(form.get('publishedAt')) ?? (status === 'published' ? now() : null);

  const values = {
    slug,
    title,
    intro: str(form, 'intro') || null,
    heroImage: str(form, 'heroImage') || null,
    handsOnMinutes: num(form, 'handsOnMinutes'),
    totalMinutes: num(form, 'totalMinutes'),
    baseServings: Math.max(1, num(form, 'baseServings') ?? 2),
    yieldLabel: str(form, 'yieldLabel') || '{n} as dinner',
    ingredients: str(form, 'ingredients') || '[]',
    steps: str(form, 'steps') || '[]',
    pullNote: str(form, 'pullNote') || null,
    headnote: str(form, 'headnote') || null,
    status: status as 'draft' | 'published',
    publishedAt,
    updatedAt: now(),
  };

  try {
    if (idRaw) {
      await db.update(recipes).set(values).where(eq(recipes.id, Number(idRaw)));
    } else {
      await db.insert(recipes).values({ ...values, createdAt: now() });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes('UNIQUE')) {
      return { error: `The address /recipes/${slug} is already taken. Pick another slug.` };
    }
    return { error: message };
  }

  revalidatePath('/');
  revalidatePath('/recipes');
  redirect('/admin');
}

export async function deletePost(form: FormData) {
  await requireAdmin();
  const id = Number(form.get('id'));
  if (id) await db.delete(posts).where(eq(posts.id, id));
  revalidatePath('/');
  redirect('/admin');
}

export async function deleteRecipe(form: FormData) {
  await requireAdmin();
  const id = Number(form.get('id'));
  if (id) await db.delete(recipes).where(eq(recipes.id, id));
  revalidatePath('/');
  redirect('/admin');
}

export async function saveSettings(_prev: State, form: FormData): Promise<State> {
  await requireAdmin();
  const keys = ['tagline', 'footerNote', 'aboutTitle', 'aboutBody'];
  for (const key of keys) {
    const value = String(form.get(key) ?? '');
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }
  revalidatePath('/');
  revalidatePath('/about');
  return { error: undefined };
}
