import Link from 'next/link';
import { desc, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { posts, comments } from '@/lib/schema';
import { archivePost, unarchivePost } from '@/app/admin/actions';
import { AdminEntryRow } from '@/components/AdminEntryRow';
import { shortDate } from '@/lib/format';
import styles from '../../admin.module.css';

export const dynamic = 'force-dynamic';

type Filter = 'drafts' | 'published' | 'archive';
const FILTERS: Filter[] = ['drafts', 'published', 'archive'];

export default async function AdminThoughtsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  const { filter: rawFilter, q: rawQ } = await searchParams;
  const filter: Filter = (FILTERS as string[]).includes(rawFilter ?? '') ? (rawFilter as Filter) : 'published';
  const q = (rawQ ?? '').trim().toLowerCase();

  const [allPosts, commentRows] = await Promise.all([
    db.select().from(posts).orderBy(desc(posts.updatedAt)),
    db.select({ postId: comments.postId }).from(comments).where(ne(comments.status, 'deleted')),
  ]);

  const countByPost = new Map<number, number>();
  for (const c of commentRows) {
    if (c.postId == null) continue;
    countByPost.set(c.postId, (countByPost.get(c.postId) ?? 0) + 1);
  }

  const filtered = allPosts
    .filter((p) => {
      if (filter === 'archive') return Boolean(p.archivedAt);
      if (p.archivedAt) return false;
      if (filter === 'drafts') return p.status === 'draft';
      return p.status === 'published';
    })
    .filter((p) => (q ? p.title.toLowerCase().includes(q) : true));

  return (
    <>
      <div className="sectionMark">
        <span className="hand">thoughts</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, fontSize: 13.5 }}>
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={f === 'published' ? '/admin/thoughts' : `/admin/thoughts?filter=${f}`}
              style={{
                textDecoration: filter === f ? 'underline' : 'none',
                color: filter === f ? 'var(--rust)' : 'var(--ink-quiet)',
              }}
            >
              {f}
            </Link>
          ))}
        </div>
        <Link href="/admin/thoughts/new" className={styles.button} style={{ textDecoration: 'none' }}>
          Write a thought
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
        {filtered.map((post) => (
          <AdminEntryRow
            key={post.id}
            id={post.id}
            title={post.title}
            editHref={`/admin/thoughts/${post.id}`}
            publicHref={post.status === 'published' && !post.archivedAt ? `/thoughts/${post.slug}` : null}
            statusLabel={post.archivedAt ? 'archived' : post.status === 'draft' ? 'draft' : shortDate(post.publishedAt)}
            count={countByPost.get(post.id) ?? 0}
            archived={Boolean(post.archivedAt)}
            archiveAction={archivePost}
            unarchiveAction={unarchivePost}
          />
        ))}
      </div>
    </>
  );
}
