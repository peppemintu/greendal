import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { NewsletterSubscribeBox } from '@/components/NewsletterSubscribeBox';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="shell shell--narrow" style={{ paddingTop: 70, paddingBottom: 40 }}>
        <span className="hand" style={{ fontSize: 44 }}>nothing here</span>
        <p style={{ marginTop: 14, fontSize: 19.5, lineHeight: 1.7, color: 'var(--ink-soft)' }}>
          This page was either never written or has been quietly composted.
          Try <Link href="/thoughts">the thoughts</Link> or{' '}
          <Link href="/recipes">the cupboard</Link>.
        </p>
      </main>
      <SiteFooter subscribeSlot={<NewsletterSubscribeBox />} />
    </>
  );
}
