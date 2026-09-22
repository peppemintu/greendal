/**
 * Runs once when the server process starts (both `next dev` and `next
 * start`) — see https://nextjs.org/docs/app/guides/instrumentation. Only
 * relevant here because this app runs as a long-lived `next start` process
 * in Docker, not on a serverless platform where nothing would be alive to
 * fire a timer between requests.
 *
 * Drives the weekly newsletter: rather than parse a cron expression, this
 * just re-checks hourly whether this week's letter has gone out yet.
 * sendWeeklyIssueIfDue() is idempotent per calendar week (a unique
 * newsletter_sends.weekStart), so checking far more often than needed is
 * harmless — the other 167 checks a week are two cheap SELECTs that no-op.
 * POST /api/newsletter/send still exists as a secret-protected manual
 * trigger, for forcing a send or checking in if this ever needs debugging.
 */
export async function register() {
  // register() also runs for the Edge runtime (middleware's own instance);
  // only the Node process should own the timer, or two would fire the check.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { sendWeeklyIssueIfDue } = await import('@/lib/newsletter');
  const CHECK_INTERVAL_MS = 60 * 60 * 1000;

  const check = async () => {
    try {
      const result = await sendWeeklyIssueIfDue();
      if (result.sent) {
        console.log(
          `[newsletter] sent this week's letter — ${result.postCount} post(s), ${result.recipientCount} recipient(s)`,
        );
      }
    } catch (err) {
      console.error('[newsletter] scheduled send check failed', err);
    }
  };

  check(); // catch up immediately in case the process was down when the week rolled over
  setInterval(check, CHECK_INTERVAL_MS);
}
