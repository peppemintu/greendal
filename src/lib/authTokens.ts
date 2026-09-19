import 'server-only';
import { randomBytes, createHash } from 'node:crypto';
import { db } from './db';
import { authTokens } from './schema';

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Creation is shared between verify-email and reset-password. Consuming a
 * token isn't — a reset token is strictly single-use (checked at password
 * submission, a POST), while a verify-email token deliberately isn't
 * (checked on a bare GET, which corporate email scanners pre-fetch to scan
 * for malware; a single-use token would already be burned before the human
 * ever clicks it). See src/app/(auth)/verify/page.tsx and resetPassword().
 */
export async function createAuthToken(
  userId: number,
  purpose: 'verify_email' | 'reset_password',
  ttlSeconds: number,
): Promise<string> {
  const raw = randomBytes(32).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  await db.insert(authTokens).values({
    userId,
    purpose,
    tokenHash: hashToken(raw),
    expiresAt: now + ttlSeconds,
    createdAt: now,
  });
  return raw;
}
