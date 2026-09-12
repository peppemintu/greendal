import Link from 'next/link';

export function SiteFooter({ note }: { note?: string }) {
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
          alignItems: 'baseline',
          justifyContent: 'space-between',
          fontSize: 13.5,
        }}
      >
        <span>{note || 'come in, take your shoes off.'}</span>
        <span style={{ display: 'flex', gap: 18 }}>
          <Link href="/feed.xml" style={{ color: 'var(--linen-on-dark)' }}>
            rss
          </Link>
          <Link href="/admin" style={{ color: 'var(--linen-on-dark)' }}>
            write
          </Link>
        </span>
      </div>
    </footer>
  );
}
