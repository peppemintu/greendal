'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from './auth';
import { checkRateLimit, getClientIp } from './rateLimit';
import { sendEmail } from './email';
import { upsertPendingSubscriber, unsubscribeByToken, setReaderSubscription } from './newsletter';

export type FormState = { error?: string; message?: string } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim();
}

function siteUrl(): string {
  return process.env.SITE_URL ?? 'http://localhost:3000';
}

/**
 * The guest/unconfirmed-reader path: just an email address, no account.
 * Same honeypot trick as register() — a bot that fills the hidden field
 * gets a normal-looking success with nothing actually created.
 */
export async function subscribeToNewsletter(_prev: FormState, form: FormData): Promise<FormState> {
  if (str(form, 'website')) {
    return { message: 'Check your inbox to confirm.' };
  }

  const ip = await getClientIp();
  if (!(await checkRateLimit(`subscribe:${ip}`, 5, 60 * 60))) {
    return { error: 'Too many attempts from here. Try again in a bit.' };
  }

  const email = str(form, 'email').toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "That doesn't look like an email address." };
  if (!(await checkRateLimit(`subscribe-email:${email}`, 3, 60 * 60))) {
    return { message: 'Check your inbox to confirm.' }; // don't reveal repeated-attempt state on a specific address
  }

  const result = await upsertPendingSubscriber(email);
  if (result.status === 'active') {
    return { message: "You're already subscribed." };
  }

  const link = `${siteUrl()}/confirm-subscription?token=${result.confirmToken}`;
  await sendEmail({
    to: email,
    subject: 'confirm your subscription — greendal',
    text: `Someone (hopefully you) asked to get greendal's weekly letter at this address.\n\nConfirm it here:\n\n${link}\n\nIf that wasn't you, ignore this — nothing happens until it's confirmed.`,
  });

  return { message: 'Check your inbox to confirm.' };
}

/**
 * The confirmed-reader path: no email round-trip, since their account email
 * is already verified. Identity comes only from the session, never from the
 * form, so this can't be used to toggle someone else's subscription. A bare
 * server action bound to a plain <form> (no useActionState) — the button
 * itself re-renders from the fresh DB state, nothing to report back.
 */
export async function toggleReaderSubscription(form: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const subscribe = str(form, 'subscribe') === 'true';
  await setReaderSubscription(user.id, user.email, subscribe);
  revalidatePath('/');
}

/**
 * Only reachable via a POST from the confirm page below — the GET that gets
 * you there never unsubscribes anything by itself. A mail scanner
 * pre-fetching the emailed link only loads that page; it can't submit a
 * form, so it can't unsubscribe someone who never clicked "unsubscribe".
 */
export async function unsubscribeAction(form: FormData): Promise<never> {
  const token = str(form, 'token');
  if (token) await unsubscribeByToken(token);
  redirect(`/unsubscribe?token=${encodeURIComponent(token)}&done=1`);
}
