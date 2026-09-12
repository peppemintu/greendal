import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { listPosts, getSettings } from '@/lib/queries';
import { shortDate, readingTime } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'thoughts' };

export default async function ThoughtsIndex() {
  const [items, settings] = await Promise.all([listPosts(), getSettings()]);

  return (
    <>
      <SiteHeader />
      <main className="shell shell--narrow" style={{ paddingTop: 46 }}>
        <span className="hand" style={{ fontSize: 30 }}>thoughts</span>
        <p style={{ margin: '10px 0 0', fontSize: 16.5, lineHeight: 1.65, color: 'var(--ink-quiet)', maxWidth: '32rem' }}>
          Everything, newest first. {items.length} in total.
        </p>

        <div style={{ marginTop: 34, display: 'flex', flexDirection: 'column' }}>
          {items.map((post) => (
            <article
              key={post.id}
              style={{ padding: '22px 0', borderTop: '1px solid var(--rule)' }}
            >
              <div style={{ fontSize: 11.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--moss)' }}>
                {shortDate(post.publishedAt)} · {readingTime(post.body)} min
              </div>
              <Link
                href={`/thoughts/${post.slug}`}
                style={{ display: 'block', marginTop: 4, fontSize: 27, fontWeight: 500, lineHeight: 1.25, color: 'var(--ink)', textDecoration: 'none' }}
              >
                {post.title}
              </Link>
              {post.dek && (
                <p style={{ margin: '6px 0 0', fontSize: 15.5, lineHeight: 1.6, color: 'var(--ink-quiet)' }}>
                  {post.dek}
                </p>
              )}
            </article>
          ))}
          {items.length === 0 && (
            <p style={{ color: 'var(--ink-quiet)' }}>Nothing published yet.</p>
          )}
        </div>
      </main>
      <SiteFooter note={settings.footerNote} />
    </>
  );
}
