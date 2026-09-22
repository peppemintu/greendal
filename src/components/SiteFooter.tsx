import Link from 'next/link';

/**
 * subscribeSlot is a prop, not a static import of NewsletterSubscribeBox in
 * here — that component is a server-only async Server Component (reads the
 * session, hits the DB), and this footer is rendered from a few 'use client'
 * pages too (login/register/forgot/reset — the whole file is a client
 * boundary there for their form hooks). A static import here would drag
 * server-only code across that boundary and fail the build. Server-component
 * pages pass the slot in; those four transactional auth pages just don't.
 */
export function SiteFooter({ note, subscribeSlot }: { note?: string; subscribeSlot?: React.ReactNode }) {
  return (
    <footer
      style={{
        marginTop: 60,
        background: 'var(--forest)',
        color: 'var(--sage)',
        padding: '28px var(--gutter)',
      }}
    >
      <div
        style={{
          maxWidth: 1000,
          margin: '0 auto',
          display: 'flex',
          gap: 18,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 13.5,
        }}
      >
        <span>{note || 'come in, take your shoes off.'}</span>
        <span style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href="/feed.xml" style={{ color: 'var(--linen-on-dark)' }}>
            rss
          </Link>
          {subscribeSlot}
        </span>
      </div>
    </footer>
  );
}
