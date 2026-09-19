import 'server-only';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { rateLimits } from './schema';

/**
 * The site sits behind a Cloudflare Tunnel, so the connection's own address
 * is the tunnel's, not the visitor's — every request would look like the
 * same client. The real one arrives in this header. Falls back to
 * x-forwarded-for for local dev, where there's no tunnel in front at all.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get('cf-connecting-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

/**
 * Fixed-window limiter: at most `max` calls per `windowSeconds` for a given
 * key. Returns true and counts the call if under the limit, false if not
 * (the caller should not proceed). "unknown" IPs (see getClientIp) share one
 * bucket per key — acceptable since that only happens outside the tunnel.
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const t = Math.floor(Date.now() / 1000);
  const [row] = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);

  if (!row || row.resetAt <= t) {
    await db
      .insert(rateLimits)
      .values({ key, count: 1, resetAt: t + windowSeconds })
      .onConflictDoUpdate({ target: rateLimits.key, set: { count: 1, resetAt: t + windowSeconds } });
    return true;
  }

  if (row.count >= max) return false;

  await db.update(rateLimits).set({ count: row.count + 1 }).where(eq(rateLimits.key, key));
  return true;
}
