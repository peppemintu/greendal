import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { posts, recipes } from '@/lib/schema';
import { shortDate } from '@/lib/format';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';

export default async function Desk() {
  const [allPosts, allRecipes] = await Promise.all([
    db.select().from(posts).orderBy(desc(posts.updatedAt)),
    db.select().from(recipes).orderBy(desc(recipes.updatedAt)),
  ]);

  return (
    <>
      <section style={{ marginBottom: 46 }}>
        <div className="sectionMark">
          <span className="hand">thoughts</span>
        </div>
        <Link href="/admin/thoughts/new" className={styles.button} style={{ textDecoration: 'none' }}>
          Write a thought
        </Link>

        <div style={{ marginTop: 22 }}>
          {allPosts.map((post) => (
            <div key={post.id} className={styles.listRow}>
              <Link href={`/admin/thoughts/${post.id}`} style={{ fontSize: 18, textDecoration: 'none', color: 'var(--ink)' }}>
                {post.title}
              </Link>
              <span className={`${styles.status} ${post.status === 'draft' ? styles.statusDraft : ''}`}>
                {post.status === 'draft' ? 'draft' : shortDate(post.publishedAt)}
              </span>
            </div>
          ))}
          {allPosts.length === 0 && (
            <p style={{ color: 'var(--ink-quiet)', fontSize: 15 }}>No thoughts yet.</p>
          )}
        </div>
      </section>

      <section>
        <div className="sectionMark">
          <span className="hand">recipes</span>
        </div>
        <Link href="/admin/recipes/new" className={styles.button} style={{ textDecoration: 'none' }}>
          Write a recipe
        </Link>

        <div style={{ marginTop: 22 }}>
          {allRecipes.map((recipe) => (
            <div key={recipe.id} className={styles.listRow}>
              <Link href={`/admin/recipes/${recipe.id}`} style={{ fontSize: 18, textDecoration: 'none', color: 'var(--ink)' }}>
                {recipe.title}
              </Link>
              <span className={`${styles.status} ${recipe.status === 'draft' ? styles.statusDraft : ''}`}>
                {recipe.status === 'draft' ? 'draft' : shortDate(recipe.publishedAt)}
              </span>
            </div>
          ))}
          {allRecipes.length === 0 && (
            <p style={{ color: 'var(--ink-quiet)', fontSize: 15 }}>No recipes yet.</p>
          )}
        </div>
      </section>
    </>
  );
}
