'use server';

import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, authTokens } from '@/lib/schema';
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  destroyAllSessions,
  getCurrentUser,
} from '@/lib/auth';
import { createAuthToken, hashToken } from '@/lib/authTokens';
import { sendEmail } from '@/lib/email';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export type FormState = { error?: string; message?: string } | undefined;

const now = () => Math.floor(Date.now() / 1000);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A precomputed hash checked when no matching account exists, so a login
// attempt against an unknown email takes the same time as a real one — the
// point of the identical error message is defeated if timing gives it away.
const DUMMY_HASH = hashPassword('this account does not exist, this is only for timing');

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim();
}

function normalizeEmail(form: FormData, key = 'email'): string {
  return str(form, key).toLowerCase();
}

function siteUrl(): string {
  return process.env.SITE_URL ?? 'http://localhost:3000';
}

function safeNext(value: FormDataEntryValue | null, fallback: string): string {
  const s = String(value ?? '');
  // Only ever redirect within this site — an absolute or protocol-relative
  // "next" would turn the login form into an open redirect.
  return s.startsWith('/') && !s.startsWith('//') ? s : fallback;
}

export async function register(_prev: FormState, form: FormData): Promise<FormState> {
  // Hidden field a real visitor never fills in. A bot that does gets the
  // same outcome as a real signup, with nothing actually created — no
  // error text that would tell it what tipped it off.
  if (str(form, 'website')) {
    redirect(safeNext(form.get('next'), '/'));
  }

  const ip = await getClientIp();
  if (!(await checkRateLimit(`register:${ip}`, 5, 60 * 60))) {
    return { error: 'Too many attempts from here. Try again in a bit.' };
  }

  const email = normalizeEmail(form);
  const displayName = str(form, 'displayName').replace(/[\r\n]+/g, ' ').slice(0, 60);
  const password = String(form.get('password') ?? '');

  if (!EMAIL_RE.test(email)) return { error: "That doesn't look like an email address." };
  if (!displayName) return { error: 'Tell us what to call you.' };
  if (password.length < 10) return { error: 'Password needs to be at least 10 characters.' };

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing?.archivedAt) {
    return {
      error: 'That address was used before and the account was closed. Write to the blog’s owner to restore it.',
    };
  }
  if (existing) {
    return { error: 'That email is already registered. Forgot your password?' };
  }

  const t = now();
  let userId: number;
  try {
    const [row] = await db
      .insert(users)
      .values({
        email,
        displayName,
        passwordHash: hashPassword(password),
        role: 'reader',
        notifyOnReply: 1,
        createdAt: t,
        updatedAt: t,
      })
      .returning({ id: users.id });
    userId = row.id;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes('UNIQUE')) {
      return { error: 'That email is already registered. Forgot your password?' };
    }
    return { error: message };
  }

  const token = await createAuthToken(userId, 'verify_email', 60 * 60 * 48);
  const link = `${siteUrl()}/verify?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'confirm your email — greendal',
    text: `Hi ${displayName},\n\nConfirm your address to comment on greendal:\n\n${link}\n\nThis link works for 48 hours. If you didn't sign up, ignore this.`,
  });

  await createSession(userId);
  redirect(safeNext(form.get('next'), '/'));
}

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  const ip = await getClientIp();
  if (!(await checkRateLimit(`login:${ip}`, 10, 15 * 60))) {
    return { error: 'Too many attempts from here. Try again in a bit.' };
  }

  const email = normalizeEmail(form);
  const password = String(form.get('password') ?? '');
  const genericError = "That email or password doesn't match.";

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const passwordOk = verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordOk) return { error: genericError };
  // Reachable only once the password has already checked out, so these two
  // don't leak anything an attacker without the password couldn't already see.
  if (user.archivedAt) {
    return { error: 'This account was closed. Write to the blog’s owner to restore it.' };
  }
  if (user.blockedAt) return { error: "You've been blocked from this site." };

  await createSession(user.id);
  const next = safeNext(form.get('next'), user.role === 'admin' ? '/admin' : '/');
  redirect(next);
}

export async function logout() {
  await destroySession();
  redirect('/');
}

export async function requestPasswordReset(_prev: FormState, form: FormData): Promise<FormState> {
  const ip = await getClientIp();
  const email = normalizeEmail(form);
  const generic: FormState = {
    message: "If that address has an account, we've sent a reset link.",
  };

  if (!EMAIL_RE.test(email)) return generic; // don't confirm/deny format-level either
  if (!(await checkRateLimit(`forgot-ip:${ip}`, 8, 60 * 60))) return generic;
  if (!(await checkRateLimit(`forgot-email:${email}`, 3, 60 * 60))) return generic;

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (user && !user.archivedAt) {
    const token = await createAuthToken(user.id, 'reset_password', 60 * 60);
    const link = `${siteUrl()}/reset?token=${token}`;
    await sendEmail({
      to: email,
      subject: 'reset your password — greendal',
      text: `A password reset was requested for this address.\n\n${link}\n\nThis link works for 1 hour and only once. If you didn't ask for this, ignore it — your password hasn't changed.`,
    });
  }

  return generic;
}

export async function resetPassword(_prev: FormState, form: FormData): Promise<FormState> {
  const ip = await getClientIp();
  if (!(await checkRateLimit(`reset:${ip}`, 20, 60 * 60))) {
    return { error: 'Too many attempts from here. Try again in a bit.' };
  }

  const token = str(form, 'token');
  const password = String(form.get('password') ?? '');
  const confirm = String(form.get('confirm') ?? '');

  if (!token) return { error: 'Missing reset link. Request a new one.' };
  if (password.length < 10) return { error: 'Password needs to be at least 10 characters.' };
  if (password !== confirm) return { error: "Passwords don't match." };

  const t = now();
  const [row] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, hashToken(token)), eq(authTokens.purpose, 'reset_password')))
    .limit(1);

  if (!row || row.usedAt || row.expiresAt < t) {
    return { error: 'That reset link is invalid or has expired. Request a new one.' };
  }

  await db.update(users).set({ passwordHash: hashPassword(password), updatedAt: t }).where(eq(users.id, row.userId));
  await db.update(authTokens).set({ usedAt: t }).where(eq(authTokens.id, row.id));
  await destroyAllSessions(row.userId);
  await createSession(row.userId);
  redirect('/account');
}

export async function resendVerification(): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Sign in first.' };
  if (user.emailVerifiedAt) return { message: 'Already confirmed.' };

  if (!(await checkRateLimit(`resend-verify:${user.id}`, 3, 60 * 60))) {
    return { error: 'Too many requests. Try again in a bit.' };
  }

  const token = await createAuthToken(user.id, 'verify_email', 60 * 60 * 48);
  const link = `${siteUrl()}/verify?token=${token}`;
  const result = await sendEmail({
    to: user.email,
    subject: 'confirm your email — greendal',
    text: `Hi ${user.displayName},\n\nConfirm your address to comment on greendal:\n\n${link}\n\nThis link works for 48 hours.`,
  });

  if (!result.ok) return { error: "Couldn't send the email just now. Try again shortly." };
  return { message: 'Sent — check your inbox.' };
}
