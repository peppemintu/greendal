import Link from 'next/link';
import { desc, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { comments, users, posts, recipes } from '@/lib/schema';
import { AdminCommentRow, type AdminCommentRowData } from '@/components/AdminCommentRow';

export const dynamic = 'force-dynamic';

type Filter = 'all' | 'private' | 'public' | 'hidden' | 'posts' | 'recipes';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'all' },
  { value: 'private', label: 'private' },
  { value: 'public', label: 'public' },
  { value: 'hidden', label: 'hidden' },
  { value: 'posts', label: 'to posts' },
  { value: 'recipes', label: 'to recipes' },
];

export default async function AdminCommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: rawFilter } = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.value === rawFilter) ? (rawFilter as Filter) : 'all';

  // "deleted" is invisible even to the admin through the UI (design doc §4) —
  // it only exists as a database row, not something this feed shows.
  const rows = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      recipeId: comments.recipeId,
      parentId: comments.parentId,
      authorName: users.displayName,
      body: comments.body,
      visibility: comments.visibility,
      status: comments.status,
      createdAt: comments.createdAt,
      postSlug: posts.slug,
      postTitle: posts.title,
      recipeSlug: recipes.slug,
      recipeTitle: recipes.title,
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .leftJoin(posts, eq(comments.postId, posts.id))
    .leftJoin(recipes, eq(comments.recipeId, recipes.id))
    .where(ne(comments.status, 'deleted'))
    .orderBy(desc(comments.createdAt));

  const filtered = rows.filter((r) => {
    switch (filter) {
      case 'private':
        return r.visibility === 'private';
      case 'public':
        return r.visibility === 'public';
      case 'hidden':
        return r.status === 'hidden';
      case 'posts':
        return r.postId !== null;
      case 'recipes':
        return r.recipeId !== null;
      default:
        return true;
    }
  }) as (AdminCommentRowData & { status: 'visible' | 'hidden' })[];

  return (
    <>
      <div className="sectionMark">
        <span className="hand">comments</span>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 26, fontSize: 13.5 }}>
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === 'all' ? '/admin/comments' : `/admin/comments?filter=${f.value}`}
            style={{
              textDecoration: filter === f.value ? 'underline' : 'none',
              color: filter === f.value ? 'var(--rust)' : 'var(--ink-quiet)',
            }}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {filtered.length === 0 && <p style={{ color: 'var(--ink-quiet)', fontSize: 15 }}>Nothing here.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {filtered.map((row) => (
          <AdminCommentRow key={row.id} row={row} />
        ))}
      </div>
    </>
  );
}
