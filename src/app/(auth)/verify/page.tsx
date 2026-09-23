import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { authTokens, users } from '@/lib/schema';
import { hashToken } from '@/lib/authTokens';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { NewsletterSubscribeBox } from '@/components/NewsletterSubscribeBox';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'confirm your email' };

/**
 * A GET link, deliberately. Some corporate mail scanners pre-fetch links in
 * incoming email to check them for malware, which would burn a single-use
 * token before the real person ever clicks it — so this one stays valid for
 * repeat hits within its window instead of being consumed on first use. The
 * worst a scanner can do is confirm an email early, which is harmless.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? await tryVerify(token) : 'missing';

  return (
    <>
      <SiteHeader />
      <main className="shell shell--narrow" style={{ paddingTop: 60, paddingBottom: 40 }}>
        <span className="hand" style={{ fontSize: 30 }}>
          {result === 'ok' ? 'confirmed' : "that didn't work"}
        </span>
        <p style={{ fontSize: 16.5, lineHeight: 1.65, color: 'var(--ink-quiet)', marginTop: 14 }}>
          {result === 'ok' && 'Your email is confirmed — you can comment now.'}
          {result === 'missing' && "That link is missing its token."}
          {result === 'expired' && 'That confirmation link is invalid or has expired.'}
        </p>
        {result !== 'ok' && (
          <p style={{ marginTop: 10 }}>
            <Link href="/account">request a new one from your account page</Link>, or{' '}
            <Link href="/login">sign in</Link>.
          </p>
        )}
        {result === 'ok' && (
          <p style={{ marginTop: 10 }}>
            <Link href="/">back to the site</Link>
          </p>
        )}
      </main>
      <SiteFooter subscribeSlot={<NewsletterSubscribeBox />} />
    </>
  );
}

async function tryVerify(token: string): Promise<'ok' | 'expired'> {
  const t = Math.floor(Date.now() / 1000);
  const [row] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, hashToken(token)), eq(authTokens.purpose, 'verify_email')))
    .limit(1);

  if (!row || row.expiresAt < t) return 'expired';

  const [user] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
  if (!user) return 'expired';

  if (!user.emailVerifiedAt) {
    await db.update(users).set({ emailVerifiedAt: t, updatedAt: t }).where(eq(users.id, user.id));
  }
  if (!row.usedAt) {
    await db.update(authTokens).set({ usedAt: t }).where(eq(authTokens.id, row.id));
  }
  return 'ok';
}
