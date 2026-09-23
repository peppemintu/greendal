import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { NewsletterSubscribeBox } from '@/components/NewsletterSubscribeBox';
import { listRecipes, getSettings } from '@/lib/queries';
import { duration } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'recipes' };

export default async function RecipesIndex() {
  const [items, settings] = await Promise.all([listRecipes(), getSettings()]);

  return (
    <>
      <SiteHeader />
      <main className="shell" style={{ paddingTop: 46 }}>
        <span className="hand" style={{ fontSize: 30 }}>recipes</span>
        <p style={{ margin: '10px 0 0', fontSize: 16.5, lineHeight: 1.65, color: 'var(--ink-quiet)', maxWidth: '32rem' }}>
          The whole cupboard. Every one has a servings dial, so cook for however many turned up.
        </p>

        <div
          style={{
            marginTop: 34,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
            gap: '30px 24px',
          }}
        >
          {items.map((recipe) => (
            <Link key={recipe.id} href={`/recipes/${recipe.slug}`} style={{ textDecoration: 'none' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={recipe.heroImage ?? '/placeholder.svg'}
                alt=""
                style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 'var(--radius)', background: 'var(--paper-deep)' }}
              />
              <div style={{ marginTop: 9, fontSize: 19, fontWeight: 500, lineHeight: 1.3, color: 'var(--ink)' }}>
                {recipe.title}
              </div>
              <div style={{ marginTop: 3, fontSize: 11.5, color: 'var(--moss)' }}>
                {duration(recipe.totalMinutes)} · serves {recipe.baseServings}
              </div>
            </Link>
          ))}
          {items.length === 0 && <p style={{ color: 'var(--ink-quiet)' }}>Nothing cooked yet.</p>}
        </div>
      </main>
      <SiteFooter note={settings.footerNote} subscribeSlot={<NewsletterSubscribeBox />} />
    </>
  );
}
