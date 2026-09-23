import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { NewsletterSubscribeBox } from '@/components/NewsletterSubscribeBox';
import { listPosts, listRecipes, countPosts, getSettings } from '@/lib/queries';
import { shortDate, duration } from '@/lib/format';
import styles from './home.module.css';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [thoughts, recipes, total, settings] = await Promise.all([
    listPosts(4),
    listRecipes(4),
    countPosts(),
    getSettings(),
  ]);

  return (
    <>
      <SiteHeader variant="home" tagline={settings.tagline} />

      <main className="shell">
        <div className={styles.split}>
          <section className={styles.left}>
            <div className="sectionMark">
              <span className="hand">thoughts</span>
            </div>

            {thoughts.length === 0 ? (
              <p className={styles.empty}>
                Nothing written yet. <Link href="/admin">Start the first one.</Link>
              </p>
            ) : (
              <div className={styles.thoughtList}>
                {thoughts.map((post) => (
                  <article key={post.id}>
                    <div className={styles.thoughtDate}>{shortDate(post.publishedAt)}</div>
                    <Link href={`/thoughts/${post.slug}`} className={styles.thoughtTitle}>
                      {post.title}
                    </Link>
                    {post.dek && <p className={styles.thoughtDek}>{post.dek}</p>}
                  </article>
                ))}
              </div>
            )}

            {total > 0 && (
              <Link href="/thoughts" className={styles.more}>
                all {total} thought{total === 1 ? '' : 's'} →
              </Link>
            )}
          </section>

          <div className={styles.divider} />

          <section className={styles.right}>
            <div className="sectionMark">
              <span className="hand">recipes</span>
            </div>

            {recipes.length === 0 ? (
              <p className={styles.empty}>The cupboard is bare so far.</p>
            ) : (
              <div className={styles.recipeGrid}>
                {recipes.map((recipe) => (
                  <Link
                    key={recipe.id}
                    href={`/recipes/${recipe.slug}`}
                    className={styles.card}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.thumb}
                      src={recipe.heroImage ?? '/placeholder.svg'}
                      alt=""
                    />
                    <div className={styles.cardTitle}>{recipe.title}</div>
                    <div className={styles.cardMeta}>
                      {duration(recipe.totalMinutes)} · serves {recipe.baseServings}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <Link href="/recipes" className={styles.more}>
              the whole cupboard →
            </Link>
          </section>
        </div>
      </main>

      <SiteFooter note={settings.footerNote} subscribeSlot={<NewsletterSubscribeBox />} />
    </>
  );
}
