'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { getCurrentUser, destroySession, destroyAllSessions } from '@/lib/auth';
import { createAuthToken } from '@/lib/authTokens';
import { sendEmail } from '@/lib/email';
import { checkRateLimit } from '@/lib/rateLimit';
import { migrateSubscriberEmail } from '@/lib/newsletter';

export type FormState = { error?: string; message?: string } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function siteUrl(): string {
  return process.env.SITE_URL ?? 'http://localhost:3000';
}

export async function updateAccount(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Sign in first.' };

  const displayName = String(form.get('displayName') ?? '')
    .trim()
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 60);
  if (!displayName) return { error: 'Tell us what to call you.' };

  await db
    .update(users)
    .set({ displayName, notifyOnReply: form.get('notifyOnReply') ? 1 : 0, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(users.id, user.id));

  return { message: 'Saved.' };
}

/**
 * Changing addresses drops the account's email-verified status, same as a
 * fresh registration — the new address hasn't been proven yet, so it goes
 * through the same verify_email link before comments (or the newsletter
 * reader toggle) work again.
 */
export async function changeEmail(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Sign in first.' };

  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "That doesn't look like an email address." };
  if (email === user.email) return { error: "That's already your email." };

  if (!(await checkRateLimit(`change-email:${user.id}`, 5, 60 * 60))) {
    return { error: 'Too many attempts. Try again in a bit.' };
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { error: 'That email is already registered to an account.' };

  const t = Math.floor(Date.now() / 1000);
  await db
    .update(users)
    .set({ email, emailVerifiedAt: null, updatedAt: t })
    .where(eq(users.id, user.id));

  // Keeps an existing newsletter subscription following the account rather
  // than quietly continuing to mail the address they just moved away from.
  await migrateSubscriberEmail(user.id, email);

  const token = await createAuthToken(user.id, 'verify_email', 60 * 60 * 48);
  const link = `${siteUrl()}/verify?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'confirm your new email — greendal',
    text: `Hi ${user.displayName},\n\nConfirm your new address to keep commenting on greendal:\n\n${link}\n\nThis link works for 48 hours. If you didn't ask for this change, write to the blog's owner.`,
  });

  // The "your email isn't confirmed" banner reads emailVerifiedAt from this
  // page's own server-fetched user, which a client action wouldn't otherwise refresh.
  revalidatePath('/account');
  return { message: 'Saved — check your new inbox to confirm it.' };
}

/** Closes the account: not deleted, just can't be signed into. See design doc §2. */
export async function closeAccount() {
  const user = await getCurrentUser();
  if (!user) redirect('/');

  await db
    .update(users)
    .set({ archivedAt: Math.floor(Date.now() / 1000) })
    .where(eq(users.id, user.id));
  // Clears this browser's cookie too, not just the row it points to.
  await destroySession();
  await destroyAllSessions(user.id);
  redirect('/');
}
