import Link from 'next/link';
import { desc, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes, comments } from '@/lib/schema';
import { archiveRecipe, unarchiveRecipe } from '@/app/admin/actions';
import { AdminEntryRow } from '@/components/AdminEntryRow';
import { shortDate } from '@/lib/format';
import styles from '../../admin.module.css';

export const dynamic = 'force-dynamic';

type Filter = 'drafts' | 'published' | 'archive';
const FILTERS: Filter[] = ['drafts', 'published', 'archive'];

export default async function AdminRecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  const { filter: rawFilter, q: rawQ } = await searchParams;
  const filter: Filter = (FILTERS as string[]).includes(rawFilter ?? '') ? (rawFilter as Filter) : 'published';
  const q = (rawQ ?? '').trim().toLowerCase();

  const [allRecipes, commentRows] = await Promise.all([
    db.select().from(recipes).orderBy(desc(recipes.updatedAt)),
    db.select({ recipeId: comments.recipeId }).from(comments).where(ne(comments.status, 'deleted')),
  ]);

  const countByRecipe = new Map<number, number>();
  for (const c of commentRows) {
    if (c.recipeId == null) continue;
    countByRecipe.set(c.recipeId, (countByRecipe.get(c.recipeId) ?? 0) + 1);
  }

  const filtered = allRecipes
    .filter((r) => {
      if (filter === 'archive') return Boolean(r.archivedAt);
      if (r.archivedAt) return false;
      if (filter === 'drafts') return r.status === 'draft';
      return r.status === 'published';
    })
    .filter((r) => (q ? r.title.toLowerCase().includes(q) : true));

  return (
    <>
      <div className="sectionMark">
        <span className="hand">recipes</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, fontSize: 13.5 }}>
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={f === 'published' ? '/admin/recipes' : `/admin/recipes?filter=${f}`}
              style={{
                textDecoration: filter === f ? 'underline' : 'none',
                color: filter === f ? 'var(--rust)' : 'var(--ink-quiet)',
              }}
            >
              {f}
            </Link>
          ))}
        </div>
        <Link href="/admin/recipes/new" className={styles.button} style={{ textDecoration: 'none' }}>
          Write a recipe
        </Link>
      </div>

      <form method="get" style={{ marginBottom: 24 }}>
        {filter !== 'published' && <input type="hidden" name="filter" value={filter} />}
        <input
          className={styles.input}
          type="search"
          name="q"
          defaultValue={q}
          placeholder="search by title…"
          style={{ maxWidth: 320 }}
        />
      </form>

      {filtered.length === 0 && <p style={{ color: 'var(--ink-quiet)', fontSize: 15 }}>Nothing here.</p>}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {filtered.map((recipe) => (
          <AdminEntryRow
            key={recipe.id}
            id={recipe.id}
            title={recipe.title}
            editHref={`/admin/recipes/${recipe.id}`}
            publicHref={recipe.status === 'published' && !recipe.archivedAt ? `/recipes/${recipe.slug}` : null}
            statusLabel={recipe.archivedAt ? 'archived' : recipe.status === 'draft' ? 'draft' : shortDate(recipe.publishedAt)}
            count={countByRecipe.get(recipe.id) ?? 0}
            archived={Boolean(recipe.archivedAt)}
            archiveAction={archiveRecipe}
            unarchiveAction={unarchiveRecipe}
          />
        ))}
      </div>
    </>
  );
}
