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

type PostFormValues = {
  slug: string;
  title: string;
  dek: string | null;
  blocks: string;
  status: 'draft' | 'published';
  publishedAt: number | null;
  updatedAt: number;
};

type PostValuesResult = { ok: true; values: PostFormValues } | { ok: false; error: string };

function postValuesFromForm(form: FormData): PostValuesResult {
  const title = str(form, 'title');
  if (!title) return { ok: false, error: 'A thought needs a title before it can be saved.' };

  const slug = slugify(str(form, 'slug') || title);
  if (!slug) return { ok: false, error: 'That title produced an empty web address. Set the slug by hand.' };

  const status = str(form, 'status') === 'published' ? 'published' : 'draft';
  const publishedAt = toUnix(form.get('publishedAt')) ?? (status === 'published' ? now() : null);

  return {
    ok: true,
    values: {
      slug,
      title,
      dek: str(form, 'dek') || null,
      blocks: str(form, 'blocks') || '[]',
      status: status as 'draft' | 'published',
      publishedAt,
      updatedAt: now(),
    },
  };
}

export async function savePost(_prev: State, form: FormData): Promise<State> {
  await requireAdmin();
  const idRaw = str(form, 'id');
  const parsed = postValuesFromForm(form);
  if (!parsed.ok) return { error: parsed.error };

  try {
    if (idRaw) {
      await db.update(posts).set(parsed.values).where(eq(posts.id, Number(idRaw)));
    } else {
      await db.insert(posts).values({ ...parsed.values, createdAt: now() });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes('UNIQUE')) {
      return { error: `The address /thoughts/${parsed.values.slug} is already taken. Pick another slug.` };
    }
    return { error: message };
  }

  revalidatePath('/');
  revalidatePath('/thoughts');
  revalidatePath('/admin/thoughts');
  redirect('/admin/thoughts');
}

/**
 * Same upsert as savePost, but returns instead of redirecting — for the
 * editor's autosave timer, which must not navigate the admin away mid-edit.
 * The first autosave of a brand-new post creates its row and hands back the
 * new id, which the client then folds into its own state so later autosaves
 * become updates.
 */
export async function autosavePost(form: FormData): Promise<{ id: number } | { error: string }> {
  await requireAdmin();
  const idRaw = str(form, 'id');
  const parsed = postValuesFromForm(form);
  if (!parsed.ok) return { error: parsed.error };

  try {
    if (idRaw) {
      await db.update(posts).set(parsed.values).where(eq(posts.id, Number(idRaw)));
      revalidatePath('/admin/thoughts');
      return { id: Number(idRaw) };
    }
    const [row] = await db
      .insert(posts)
      .values({ ...parsed.values, createdAt: now() })
      .returning({ id: posts.id });
    revalidatePath('/admin/thoughts');
    return { id: row.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes('UNIQUE')) {
      return { error: `The address /thoughts/${parsed.values.slug} is already taken.` };
    }
    return { error: message };
  }
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
    handsOnApprox: form.get('handsOnApprox') ? 1 : 0,
    totalMinutes: num(form, 'totalMinutes'),
    totalApprox: form.get('totalApprox') ? 1 : 0,
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

export async function archivePost(form: FormData) {
  await requireAdmin();
  const id = Number(form.get('id'));
  if (id) await db.update(posts).set({ archivedAt: now() }).where(eq(posts.id, id));
  revalidatePath('/');
  revalidatePath('/thoughts');
  revalidatePath('/admin/thoughts');
  redirect('/admin/thoughts');
}

export async function unarchivePost(form: FormData) {
  await requireAdmin();
  const id = Number(form.get('id'));
  if (id) await db.update(posts).set({ archivedAt: null }).where(eq(posts.id, id));
  revalidatePath('/');
  revalidatePath('/thoughts');
  revalidatePath('/admin/thoughts');
}

export async function archiveRecipe(form: FormData) {
  await requireAdmin();
  const id = Number(form.get('id'));
  if (id) await db.update(recipes).set({ archivedAt: now() }).where(eq(recipes.id, id));
  revalidatePath('/');
  revalidatePath('/recipes');
  revalidatePath('/admin/recipes');
  redirect('/admin/recipes');
}

export async function unarchiveRecipe(form: FormData) {
  await requireAdmin();
  const id = Number(form.get('id'));
  if (id) await db.update(recipes).set({ archivedAt: null }).where(eq(recipes.id, id));
  revalidatePath('/');
  revalidatePath('/recipes');
  revalidatePath('/admin/recipes');
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
