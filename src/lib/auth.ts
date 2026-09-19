import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { sessions, users, type UserRow } from './schema';

const COOKIE = 'greendal_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
/** Sliding expiry only writes to the DB (and re-sets the cookie) this often. */
const SESSION_REFRESH_AFTER = 60 * 60 * 24; // 1 day

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

function now(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * "scrypt$N$r$p$saltBase64$hashBase64" — the cost parameters travel with the
 * hash so they can change later without breaking existing passwords.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  const actual = scryptSync(password, salt, expected.length, { N, r, p });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

/**
 * Issues a new opaque session for a user and sets the cookie. Call this on
 * login and after a password change — never reuse an old session id across
 * a privilege change.
 */
export async function createSession(userId: number): Promise<void> {
  const id = randomBytes(32).toString('base64url');
  const t = now();
  await db.insert(sessions).values({
    id,
    userId,
    createdAt: t,
    expiresAt: t + SESSION_MAX_AGE,
    lastSeenAt: t,
  });
  (await cookies()).set(COOKIE, id, cookieOptions(SESSION_MAX_AGE));
}

/** Destroys the current browser's session (its cookie), signing that device out. */
export async function destroySession(): Promise<void> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, token));
  (await cookies()).delete(COOKIE);
}

/** Destroys every session for a user — used on password reset. */
export async function destroyAllSessions(userId: number): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * The authoritative check. middleware.ts only knows whether a session cookie
 * is present at all (it can't reach the database from the Edge runtime) —
 * this is what actually confirms the session is valid and the account is in
 * good standing, and it's what every page and action that cares about
 * identity calls. A blocked or archived account stops working here
 * immediately, without waiting for its cookie to expire.
 */
export async function getCurrentUser(): Promise<UserRow | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const t = now();
  const [session] = await db.select().from(sessions).where(eq(sessions.id, token)).limit(1);
  if (!session || session.expiresAt < t) return null;

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user || user.blockedAt || user.archivedAt) return null;

  if (t - session.lastSeenAt > SESSION_REFRESH_AFTER) {
    const expiresAt = t + SESSION_MAX_AGE;
    await db.update(sessions).set({ lastSeenAt: t, expiresAt }).where(eq(sessions.id, token));
    (await cookies()).set(COOKIE, token, cookieOptions(SESSION_MAX_AGE));
  }

  return user;
}

export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === 'admin';
}

/**
 * middleware.ts only confirms *some* session cookie is present on
 * /admin/:path* — now that readers have sessions too, that's not enough to
 * let a request into an admin action. Every admin server action calls this
 * itself; the admin layout also calls it so a reader never even sees the
 * form, but the layout redirect alone would not stop a hand-crafted POST
 * straight to the action.
 */
export async function requireAdmin(): Promise<UserRow> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') redirect('/login');
  return user;
}
