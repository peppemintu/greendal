import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { sendWeeklyIssueIfDue } from '@/lib/newsletter';

/**
 * The app checks for itself, hourly, whether this week's letter is due (see
 * instrumentation.ts) — this endpoint isn't needed for that. It's kept as a
 * secret-protected manual trigger: force a send now, or confirm the
 * scheduled check is actually running. Idempotent per week
 * (sendWeeklyIssueIfDue checks newsletter_sends before doing anything), so
 * calling it is always safe, whether or not the week's letter already went out.
 */
export async function POST(request: Request) {
  const secret = process.env.NEWSLETTER_CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'NEWSLETTER_CRON_SECRET is not set.' }, { status: 500 });
  }

  const auth = request.headers.get('authorization') ?? '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const expected = Buffer.from(secret);
  const given = Buffer.from(provided);
  const authorized = given.length === expected.length && timingSafeEqual(given, expected);
  if (!authorized) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }

  const result = await sendWeeklyIssueIfDue();
  return NextResponse.json(result);
}
