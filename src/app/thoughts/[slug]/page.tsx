import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { inArray } from 'drizzle-orm';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { Squiggle } from '@/components/Squiggle';
import { CommentSection } from '@/components/CommentSection';
import { BlockRenderer } from '@/components/BlockRenderer';
import { getPost, getNeighbours, getSettings } from '@/lib/queries';
import { blocksToPlainText } from '@/lib/blocks';
import { longDate, readingTime } from '@/lib/format';
import { db } from '@/lib/db';
import { recipes, type Block } from '@/lib/schema';
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

  const blocks = JSON.parse(post.blocks) as Block[];

  const [{ prev, next }, settings, currentUser] = await Promise.all([
    getNeighbours(post.publishedAt),
    getSettings(),
    getCurrentUser(),
  ]);
  const viewer = currentUser && { id: currentUser.id, role: currentUser.role };
  const thread = await getCommentThread({ postId: post.id }, viewer);

  const recipeIds = [
    ...new Set(
      blocks.filter((b): b is Extract<Block, { type: 'ps' }> => b.type === 'ps' && b.recipeId != null).map((b) => b.recipeId!),
    ),
  ];
  const recipeRows = recipeIds.length
    ? await db.select({ id: recipes.id, slug: recipes.slug, title: recipes.title }).from(recipes).where(inArray(recipes.id, recipeIds))
    : [];
  const recipeLinks = new Map(recipeRows.map((r) => [r.id, { slug: r.slug, title: r.title }]));

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
          {longDate(post.publishedAt)} · {readingTime(blocksToPlainText(blocks))} min
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

        <div style={{ marginTop: 26 }}>
          <BlockRenderer blocks={blocks} recipeLinks={recipeLinks} />
        </div>

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
