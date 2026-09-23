import Link from 'next/link';
import { confirmSubscription } from '@/lib/newsletter';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { NewsletterSubscribeBox } from '@/components/NewsletterSubscribeBox';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'confirm your subscription', robots: { index: false, follow: false } };

/**
 * A GET link, deliberately — same reasoning as /verify: a mail scanner
 * pre-fetching this to check it for malware should be harmless, not burn a
 * single-use token before the real person clicks. See confirmSubscription().
 */
export default async function ConfirmSubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? await confirmSubscription(token) : 'invalid';

  return (
    <>
      <SiteHeader />
      <main className="shell shell--narrow" style={{ paddingTop: 60, paddingBottom: 40 }}>
        <span className="hand" style={{ fontSize: 30 }}>
          {result === 'confirmed' ? 'confirmed' : "that didn't work"}
        </span>
        <p style={{ fontSize: 16.5, lineHeight: 1.65, color: 'var(--ink-quiet)', marginTop: 14 }}>
          {result === 'confirmed'
            ? "You're subscribed — a letter goes out once a week, recapping whatever got posted."
            : 'That confirmation link is invalid. Try subscribing again from the home page.'}
        </p>
        <p style={{ marginTop: 10 }}>
          <Link href="/">back to the site</Link>
        </p>
      </main>
      <SiteFooter subscribeSlot={<NewsletterSubscribeBox />} />
    </>
  );
}
