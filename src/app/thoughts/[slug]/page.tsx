import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { Squiggle } from '@/components/Squiggle';
import { CommentSection } from '@/components/CommentSection';
import { getPost, getNeighbours, getRecipe, getSettings } from '@/lib/queries';
import { renderMarkdown } from '@/lib/markdown';
import { longDate, readingTime } from '@/lib/format';
import { db } from '@/lib/db';
import { recipes as recipesTable } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { getCommentThread } from '@/lib/comments';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const post = await getPost((await params).slug);
  if (!post) return { title: 'not found' };
  return {
    title: post.title,
    description: post.dek ?? undefined,
    openGraph: { title: post.title, description: post.dek ?? undefined, type: 'article' },
  };
}

export default async function ThoughtPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post || post.status !== 'published') notFound();

  const [{ prev, next }, settings, currentUser] = await Promise.all([
    getNeighbours(post.publishedAt),
    getSettings(),
    getCurrentUser(),
  ]);
  const viewer = currentUser && { id: currentUser.id, role: currentUser.role };
  const thread = await getCommentThread({ postId: post.id }, viewer);

  let psRecipe: { slug: string; title: string } | null = null;
  if (post.psRecipeId) {
    const [row] = await db
      .select({ slug: recipesTable.slug, title: recipesTable.title })
      .from(recipesTable)
      .where(eq(recipesTable.id, post.psRecipeId))
      .limit(1);
    psRecipe = row ?? null;
  }

  return (
    <>
      <SiteHeader />
      <main className="shell shell--narrow" style={{ paddingTop: 50, paddingBottom: 20 }}>
        <span className="hand" style={{ fontSize: 26 }}>
          thoughts
        </span>
        <div
          style={{
            marginTop: 10,
            fontSize: 12.5,
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            color: 'var(--moss)',
          }}
        >
          {longDate(post.publishedAt)} · {readingTime(post.body)} min
        </div>
        <h1
          style={{
            margin: '12px 0 0',
            fontSize: 'clamp(32px, 6vw, 46px)',
            lineHeight: 1.15,
            color: 'var(--ink)',
          }}
        >
          {post.title}
        </h1>
        <Squiggle width={180} color="var(--rust)" />

        <div
          className="prose"
          style={{ marginTop: 26 }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }}
        />

        {psRecipe && (
          <aside
            style={{
              margin: '36px 0 0',
              padding: '22px 26px',
              background: 'var(--paper-deep)',
              border: '1px solid var(--rule-soft)',
              display: 'flex',
              gap: 18,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <span className="hand" style={{ fontSize: 34 }}>
              ps
            </span>
            <span style={{ flex: 1, minWidth: 200, fontSize: 16, lineHeight: 1.55, color: '#28382e' }}>
              {post.psText}{' '}
              <Link href={`/recipes/${psRecipe.slug}`}>the recipe&rsquo;s here</Link>.
            </span>
          </aside>
        )}

        <nav
          style={{
            margin: '42px 0 0',
            paddingTop: 22,
            borderTop: '1px solid var(--rule)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 20,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {prev ? (
            <Link href={`/thoughts/${prev.slug}`} style={{ textDecoration: 'none' }}>
              ← {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/thoughts/${next.slug}`} style={{ textDecoration: 'none', textAlign: 'right' }}>
              {next.title} →
            </Link>
          ) : (
            <span />
          )}
        </nav>

        <CommentSection target={{ postId: post.id }} nodes={thread.nodes} visibleCount={thread.visibleCount} />
      </main>
      <SiteFooter note={settings.footerNote} />
    </>
  );
}
