import Link from 'next/link';
import { findSubscriberByUnsubscribeToken } from '@/lib/newsletter';
import { unsubscribeAction } from '@/lib/subscriberActions';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import styles from '@/styles/form.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'unsubscribe', robots: { index: false, follow: false } };

/**
 * The GET here only ever renders a confirm page — it never unsubscribes
 * anything itself. Unsubscribing is a real state change (unlike confirming
 * a subscription), so it waits for an actual button press via POST; a mail
 * scanner pre-fetching this link to check it for malware would otherwise
 * unsubscribe someone who never clicked anything.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; done?: string }>;
}) {
  const { token, done } = await searchParams;
  const subscriber = token ? await findSubscriberByUnsubscribeToken(token) : null;

  let body: React.ReactNode;
  if (!token || !subscriber) {
    body = (
      <p style={{ fontSize: 16.5, lineHeight: 1.65, color: 'var(--ink-quiet)', marginTop: 14 }}>
        That unsubscribe link is invalid.
      </p>
    );
  } else if (done === '1' || subscriber.status === 'unsubscribed') {
    body = (
      <p style={{ fontSize: 16.5, lineHeight: 1.65, color: 'var(--ink-quiet)', marginTop: 14 }}>
        {subscriber.email} won&rsquo;t get the weekly letter anymore.
      </p>
    );
  } else {
    body = (
      <>
        <p style={{ fontSize: 16.5, lineHeight: 1.65, color: 'var(--ink-quiet)', marginTop: 14 }}>
          Stop sending the weekly letter to {subscriber.email}?
        </p>
        <form action={unsubscribeAction} style={{ marginTop: 18 }}>
          <input type="hidden" name="token" value={token} />
          <button className={styles.button} type="submit">
            Unsubscribe
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="shell shell--narrow" style={{ paddingTop: 60, paddingBottom: 40 }}>
        <span className="hand" style={{ fontSize: 30 }}>
          unsubscribe
        </span>
        {body}
        <p style={{ marginTop: 18 }}>
          <Link href="/">back to the site</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
