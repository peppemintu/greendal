import { db } from '@/lib/db';
import { subscribers, newsletterSends } from '@/lib/schema';
import { desc } from 'drizzle-orm';
import { getSettings } from '@/lib/queries';
import { previewWeeklyIssue, getSendSchedule, nextSendAt } from '@/lib/newsletter';
import { longDate, longDateTime } from '@/lib/format';
import { NewsletterSettingsForm } from '@/components/NewsletterSettingsForm';
import styles from '../../admin.module.css';

export const dynamic = 'force-dynamic';

export default async function AdminNewsletterPage() {
  const [siteSettings, allSubscribers, recentSends, preview, schedule, nextSend] = await Promise.all([
    getSettings(),
    db.select({ status: subscribers.status }).from(subscribers),
    db.select().from(newsletterSends).orderBy(desc(newsletterSends.weekStart)).limit(10),
    previewWeeklyIssue(),
    getSendSchedule(),
    nextSendAt(),
  ]);

  const counts = { active: 0, pending: 0, unsubscribed: 0 };
  for (const s of allSubscribers) counts[s.status]++;

  return (
    <>
      <div className="sectionMark">
        <span className="hand">newsletter</span>
      </div>

      <section style={{ marginBottom: 34, fontSize: 14.5, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <span>{counts.active} subscribed</span>
        <span style={{ color: 'var(--ink-quiet)' }}>{counts.pending} awaiting confirmation</span>
        <span style={{ color: 'var(--ink-quiet)' }}>{counts.unsubscribed} unsubscribed</span>
      </section>

      <NewsletterSettingsForm
        newsletterSubject={siteSettings.newsletterSubject ?? ''}
        newsletterIntro={siteSettings.newsletterIntro ?? ''}
        sendDay={schedule.day}
        sendHour={schedule.hour}
        nextSendLabel={longDateTime(nextSend)}
      />

      <section style={{ marginTop: 42 }}>
        <div className="sectionMark">
          <span className="hand">this week, right now</span>
        </div>
        {preview ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--ink-quiet)', marginBottom: 10 }}>
              {longDate(preview.weekStart)} – {longDate(preview.weekEnd - 1)} · {preview.posts.length} post
              {preview.posts.length === 1 ? '' : 's'} · would go to {counts.active} subscriber
              {counts.active === 1 ? '' : 's'}
            </p>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'var(--serif)',
                fontSize: 14,
                lineHeight: 1.6,
                background: 'var(--paper-deep)',
                border: '1px solid var(--rule)',
                borderRadius: 3,
                padding: '16px 18px',
              }}
            >
              {preview.sampleText}
            </pre>
          </>
        ) : (
          <p style={{ color: 'var(--ink-quiet)', fontSize: 15 }}>
            Nothing published yet this week — no letter would go out at the next scheduled send.
          </p>
        )}
      </section>

      <section style={{ marginTop: 42 }}>
        <div className="sectionMark">
          <span className="hand">sent</span>
        </div>
        {recentSends.length === 0 ? (
          <p style={{ color: 'var(--ink-quiet)', fontSize: 15 }}>No letters have gone out yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recentSends.map((send) => (
              <div key={send.id} className={styles.listRow}>
                <span>
                  {longDate(send.weekStart)} – {longDate(send.weekEnd - 1)}
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--ink-quiet)' }}>
                  {send.postCount} post{send.postCount === 1 ? '' : 's'} · {send.recipientCount} recipient
                  {send.recipientCount === 1 ? '' : 's'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
