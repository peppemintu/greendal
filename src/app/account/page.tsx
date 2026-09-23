import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { NewsletterSubscribeBox } from '@/components/NewsletterSubscribeBox';
import { AccountPanel } from '@/components/AccountPanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'your account', robots: { index: false, follow: false } };

export default async function AccountPage() {
  // middleware only confirms a cookie is present, not that it's still good —
  // this is the real check, same as every other page that needs to know who's asking.
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/account');

  return (
    <>
      <SiteHeader />
      <main className="shell shell--narrow" style={{ paddingTop: 50, paddingBottom: 60 }}>
        <span className="hand" style={{ fontSize: 30 }}>
          your account
        </span>
        <div style={{ marginTop: 22, maxWidth: 420 }}>
          <AccountPanel
            user={{
              email: user.email,
              displayName: user.displayName,
              emailVerified: Boolean(user.emailVerifiedAt),
              notifyOnReply: Boolean(user.notifyOnReply),
            }}
          />
        </div>
      </main>
      <SiteFooter subscribeSlot={<NewsletterSubscribeBox />} />
    </>
  );
}
