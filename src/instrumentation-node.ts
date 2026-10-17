import { sendWeeklyIssueIfDue } from '@/lib/newsletter';

/** Node-only half of instrumentation.ts — see the comment there. */
export function startNewsletterSchedule() {
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
