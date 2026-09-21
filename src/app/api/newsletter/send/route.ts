import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { sendWeeklyIssueIfDue } from '@/lib/newsletter';

/**
 * Fired by a crontab entry on the host (see README) — there's no scheduler
 * running inside the app itself. Idempotent per week (sendWeeklyIssueIfDue
 * checks newsletter_sends before doing anything), so an extra or repeated
 * cron fire is harmless, not a double-mailing.
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
