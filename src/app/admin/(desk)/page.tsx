import Link from 'next/link';
import { desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { posts, recipes, comments } from '@/lib/schema';
import { shortDate } from '@/lib/format';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';

export default async function Desk() {
  const [allPosts, allRecipes, visibleComments] = await Promise.all([
    db.select().from(posts).where(isNull(posts.archivedAt)).orderBy(desc(posts.updatedAt)),
    db.select().from(recipes).where(isNull(recipes.archivedAt)).orderBy(desc(recipes.updatedAt)),
    db.select({ visibility: comments.visibility }).from(comments).where(eq(comments.status, 'visible')),
  ]);
  const privateCount = visibleComments.filter((c) => c.visibility === 'private').length;

  const draftPosts = allPosts.filter((p) => p.status === 'draft');
  const draftRecipes = allRecipes.filter((r) => r.status === 'draft');

  const recent = [
    ...allPosts.map((p) => ({ kind: 'thought' as const, id: p.id, title: p.title, updatedAt: p.updatedAt })),
    ...allRecipes.map((r) => ({ kind: 'recipe' as const, id: r.id, title: r.title, updatedAt: r.updatedAt })),
  ]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8);

  return (
    <>
      <div style={{ display: 'flex', gap: 14, marginBottom: 26 }}>
        <Link href="/admin/thoughts/new" className={styles.button} style={{ textDecoration: 'none' }}>
          Write a thought
        </Link>
        <Link href="/admin/recipes/new" className={styles.buttonGhost} style={{ textDecoration: 'none' }}>
          Write a recipe
        </Link>
      </div>

      <section style={{ marginBottom: 34, fontSize: 14.5 }}>
        {(draftPosts.length > 0 || draftRecipes.length > 0) && (
          <div style={{ marginBottom: 6 }}>
            {draftPosts.length > 0 && (
              <Link href="/admin/thoughts?filter=drafts">
                {draftPosts.length} draft thought{draftPosts.length === 1 ? '' : 's'}
              </Link>
            )}
            {draftPosts.length > 0 && draftRecipes.length > 0 && <span style={{ color: 'var(--ink-quiet)' }}> · </span>}
            {draftRecipes.length > 0 && (
              <Link href="/admin/recipes?filter=drafts">
                {draftRecipes.length} draft recipe{draftRecipes.length === 1 ? '' : 's'}
              </Link>
            )}
          </div>
        )}
        <div>
          <Link href="/admin/comments">
            {visibleComments.length} comment{visibleComments.length === 1 ? '' : 's'}
          </Link>
          {privateCount > 0 && (
            <span style={{ color: 'var(--ink-quiet)' }}> · {privateCount} private</span>
          )}
        </div>
      </section>

      <section>
        <div className="sectionMark">
          <span className="hand">recent activity</span>
        </div>

        <div style={{ marginTop: 18 }}>
          {recent.map((item) => (
            <div key={`${item.kind}-${item.id}`} className={styles.listRow}>
              <Link
                href={item.kind === 'thought' ? `/admin/thoughts/${item.id}` : `/admin/recipes/${item.id}`}
                style={{ fontSize: 16, textDecoration: 'none', color: 'var(--ink)' }}
              >
                {item.title}
              </Link>
              <span className={styles.status}>
                {item.kind} · {shortDate(item.updatedAt)}
              </span>
            </div>
          ))}
          {recent.length === 0 && (
            <p style={{ color: 'var(--ink-quiet)', fontSize: 15 }}>Nothing yet.</p>
          )}
        </div>
      </section>
    </>
  );
}
