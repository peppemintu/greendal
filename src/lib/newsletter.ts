import 'server-only';
import { randomBytes } from 'node:crypto';
import { and, eq, gte, lt, isNull, asc } from 'drizzle-orm';
import { db } from './db';
import { posts, subscribers, newsletterSends } from './schema';
import { sendEmail } from './email';
import { getSettings } from './queries';
import { hashToken } from './authTokens';

const now = () => Math.floor(Date.now() / 1000);

function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

function siteUrl(): string {
  return process.env.SITE_URL ?? 'http://localhost:3000';
}

const WEEK_SECONDS = 7 * 24 * 60 * 60;

/**
 * Monday 00:00 UTC on or before `reference`. UTC throughout, deliberately:
 * the blog has no per-post or per-subscriber timezone anywhere else, so
 * picking one here would be arbitrary. Pick the crontab's fire time with
 * that in mind.
 */
function mondayOnOrBefore(reference: Date): number {
  const d = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()));
  const daysSinceMonday = (d.getUTCDay() + 6) % 7; // Mon=0 ... Sun=6
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return Math.floor(d.getTime() / 1000);
}

/**
 * The most recently completed Mon-Sun week as seen from `reference` — what
 * a cron firing each Monday morning should recap. This is the window the
 * actual send uses.
 */
export function computeLastWeekBounds(reference: Date = new Date()): { weekStart: number; weekEnd: number } {
  const weekEnd = mondayOnOrBefore(reference);
  return { weekStart: weekEnd - WEEK_SECONDS, weekEnd };
}

/**
 * The week `reference` currently sits in, still in progress — what the
 * admin preview shows, since "this week, right now" should mean today, not
 * whatever the last completed send already covered.
 */
export function computeCurrentWeekBounds(reference: Date = new Date()): { weekStart: number; weekEnd: number } {
  const weekStart = mondayOnOrBefore(reference);
  return { weekStart, weekEnd: weekStart + WEEK_SECONDS };
}

type WeekPost = { title: string; dek: string | null; slug: string; publishedAt: number | null };

/** Published, non-archived posts whose publishedAt falls in [weekStart, weekEnd). */
async function postsForWeek(weekStart: number, weekEnd: number): Promise<WeekPost[]> {
  return db
    .select({ title: posts.title, dek: posts.dek, slug: posts.slug, publishedAt: posts.publishedAt })
    .from(posts)
    .where(
      and(
        eq(posts.status, 'published'),
        isNull(posts.archivedAt),
        gte(posts.publishedAt, weekStart),
        lt(posts.publishedAt, weekEnd),
      ),
    )
    .orderBy(asc(posts.publishedAt));
}

/**
 * Renders one subscriber's copy of an issue — the only part that varies
 * per-recipient is the unsubscribe link, everything else is shared.
 */
function renderIssueText(opts: {
  intro: string;
  weekPosts: WeekPost[];
  unsubscribeUrl: string;
  footerNote: string;
}): string {
  const { intro, weekPosts, unsubscribeUrl, footerNote } = opts;
  const lines: string[] = [];
  if (intro.trim()) {
    lines.push(intro.trim(), '');
  }
  lines.push(`${weekPosts.length} thing${weekPosts.length === 1 ? '' : 's'} this week:`, '');
  for (const p of weekPosts) {
    lines.push(`— ${p.title}`);
    if (p.dek) lines.push(`  ${p.dek}`);
    lines.push(`  ${siteUrl()}/thoughts/${p.slug}`, '');
  }
  if (footerNote.trim()) lines.push(footerNote.trim(), '');
  lines.push('—', `Unsubscribe: ${unsubscribeUrl}`);
  return lines.join('\n');
}

export type IssuePreview = {
  subject: string;
  weekStart: number;
  weekEnd: number;
  posts: WeekPost[];
  sampleText: string;
};

/**
 * Builds what's accumulated so far in the current, still-in-progress week —
 * the admin preview of what would go out this coming Monday if writing
 * stopped right now. Doesn't send or record anything. Returns null when
 * there's nothing to recap yet.
 */
export async function previewWeeklyIssue(reference: Date = new Date()): Promise<IssuePreview | null> {
  const { weekStart, weekEnd } = computeCurrentWeekBounds(reference);
  const weekPosts = await postsForWeek(weekStart, weekEnd);
  if (weekPosts.length === 0) return null;

  const siteSettings = await getSettings();
  const subject = siteSettings.newsletterSubject || "this week's letters";
  const intro = siteSettings.newsletterIntro ?? '';
  const footerNote = siteSettings.footerNote ?? '';

  const sampleText = renderIssueText({
    intro,
    weekPosts,
    unsubscribeUrl: `${siteUrl()}/unsubscribe?token=<your-link>`,
    footerNote,
  });

  return { subject, weekStart, weekEnd, posts: weekPosts, sampleText };
}

export type SendResult =
  | { sent: true; postCount: number; recipientCount: number }
  | { sent: false; reason: 'already-sent' | 'no-posts' };

/**
 * The actual weekly send, called from the cron-protected route. Idempotent
 * per week via newsletter_sends' unique weekStart — safe to call more than
 * once for the same week (a retry, a misfire) without double-mailing.
 */
export async function sendWeeklyIssueIfDue(reference: Date = new Date()): Promise<SendResult> {
  const { weekStart, weekEnd } = computeLastWeekBounds(reference);

  const [already] = await db
    .select({ id: newsletterSends.id })
    .from(newsletterSends)
    .where(eq(newsletterSends.weekStart, weekStart))
    .limit(1);
  if (already) return { sent: false, reason: 'already-sent' };

  const weekPosts = await postsForWeek(weekStart, weekEnd);
  if (weekPosts.length === 0) return { sent: false, reason: 'no-posts' };

  const siteSettings = await getSettings();
  const subject = siteSettings.newsletterSubject || "this week's letters";
  const intro = siteSettings.newsletterIntro ?? '';
  const footerNote = siteSettings.footerNote ?? '';

  const activeSubscribers = await db
    .select({ email: subscribers.email, unsubscribeToken: subscribers.unsubscribeToken })
    .from(subscribers)
    .where(eq(subscribers.status, 'active'));

  let recipientCount = 0;
  // Sequential, not Promise.all — most providers rate-limit per second, and
  // a personal blog's list is small enough that this finishes in seconds
  // regardless. A queue would only matter at a scale this never expects to hit.
  for (const sub of activeSubscribers) {
    const unsubscribeUrl = `${siteUrl()}/unsubscribe?token=${sub.unsubscribeToken}`;
    const text = renderIssueText({ intro, weekPosts, unsubscribeUrl, footerNote });
    const result = await sendEmail({ to: sub.email, subject, text });
    if (result.ok) recipientCount++;
  }

  await db.insert(newsletterSends).values({
    weekStart,
    weekEnd,
    sentAt: now(),
    postCount: weekPosts.length,
    recipientCount,
  });

  return { sent: true, postCount: weekPosts.length, recipientCount };
}

/** Creates (or refreshes) a subscriber row and returns the raw confirm token, if one was minted. */
export async function upsertPendingSubscriber(email: string): Promise<{ status: 'pending' | 'active'; confirmToken?: string }> {
  const [existing] = await db.select().from(subscribers).where(eq(subscribers.email, email)).limit(1);

  if (existing?.status === 'active') return { status: 'active' };

  if (existing?.status === 'unsubscribed') {
    // They already proved control of this address once, before unsubscribing —
    // no need to make them confirm a second time.
    await db.update(subscribers).set({ status: 'active', unsubscribedAt: null }).where(eq(subscribers.id, existing.id));
    return { status: 'active' };
  }

  const confirmToken = randomToken();
  const unsubscribeToken = randomToken();

  if (existing) {
    // Still pending from an earlier attempt — resend rather than duplicate.
    await db
      .update(subscribers)
      .set({ confirmTokenHash: hashToken(confirmToken) })
      .where(eq(subscribers.id, existing.id));
    return { status: 'pending', confirmToken };
  }

  await db.insert(subscribers).values({
    email,
    status: 'pending',
    confirmTokenHash: hashToken(confirmToken),
    unsubscribeToken,
    createdAt: now(),
  });
  return { status: 'pending', confirmToken };
}

/**
 * Confirmation is deliberately not single-use — see auth_tokens' purpose
 * comment in schema.ts and authTokens.ts for the full reasoning (a mail
 * scanner's link-prefetch would otherwise burn it before the human clicks).
 * A confirm click is idempotent regardless, so re-checking an already-used
 * token here is harmless.
 */
export async function confirmSubscription(rawToken: string): Promise<'confirmed' | 'invalid'> {
  const tokenHash = hashToken(rawToken);
  const [row] = await db.select().from(subscribers).where(eq(subscribers.confirmTokenHash, tokenHash)).limit(1);
  if (!row) return 'invalid';
  if (row.status !== 'active') {
    await db
      .update(subscribers)
      .set({ status: 'active', confirmedAt: row.confirmedAt ?? now() })
      .where(eq(subscribers.id, row.id));
  }
  return 'confirmed';
}

export async function findSubscriberByUnsubscribeToken(rawToken: string) {
  const [row] = await db.select().from(subscribers).where(eq(subscribers.unsubscribeToken, rawToken)).limit(1);
  return row ?? null;
}

export async function unsubscribeByToken(rawToken: string): Promise<'unsubscribed' | 'invalid'> {
  const row = await findSubscriberByUnsubscribeToken(rawToken);
  if (!row) return 'invalid';
  if (row.status !== 'unsubscribed') {
    await db.update(subscribers).set({ status: 'unsubscribed', unsubscribedAt: now() }).where(eq(subscribers.id, row.id));
  }
  return 'unsubscribed';
}

/** For the reader-account toggle — their account email is already confirmed, so this skips straight to active/unsubscribed with no token step. */
export async function setReaderSubscription(userId: number, email: string, subscribe: boolean): Promise<void> {
  const [existing] = await db.select().from(subscribers).where(eq(subscribers.email, email)).limit(1);

  if (!existing) {
    if (!subscribe) return; // nothing to unsubscribe from
    await db.insert(subscribers).values({
      email,
      userId,
      status: 'active',
      unsubscribeToken: randomToken(),
      createdAt: now(),
      confirmedAt: now(),
    });
    return;
  }

  await db
    .update(subscribers)
    .set({
      userId,
      status: subscribe ? 'active' : 'unsubscribed',
      confirmedAt: subscribe ? (existing.confirmedAt ?? now()) : existing.confirmedAt,
      unsubscribedAt: subscribe ? null : now(),
    })
    .where(eq(subscribers.id, existing.id));
}

/**
 * Called from an account email change — keeps an existing subscription
 * pointed at the reader's new address instead of silently continuing to
 * mail the one they just moved away from. Best-effort: if the new address
 * already belongs to an unrelated subscriber row (someone else's guest
 * signup, say), leave both rows alone rather than trying to merge them.
 */
export async function migrateSubscriberEmail(userId: number, newEmail: string): Promise<void> {
  const [existing] = await db.select().from(subscribers).where(eq(subscribers.userId, userId)).limit(1);
  if (!existing) return;

  try {
    await db.update(subscribers).set({ email: newEmail }).where(eq(subscribers.id, existing.id));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!message.includes('UNIQUE')) throw e;
  }
}

export async function isReaderSubscribed(email: string): Promise<boolean> {
  const [row] = await db
    .select({ status: subscribers.status })
    .from(subscribers)
    .where(eq(subscribers.email, email))
    .limit(1);
  return row?.status === 'active';
}
