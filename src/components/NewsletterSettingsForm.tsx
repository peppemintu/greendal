'use client';

import { useActionState } from 'react';
import { saveNewsletterSettings } from '@/app/admin/(desk)/newsletter/actions';
import styles from '@/app/admin/admin.module.css';

const DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export function NewsletterSettingsForm({
  newsletterSubject,
  newsletterIntro,
  sendDay,
  sendHour,
  nextSendLabel,
}: {
  newsletterSubject: string;
  newsletterIntro: string;
  sendDay: number;
  sendHour: number;
  nextSendLabel: string;
}) {
  const [state, action, pending] = useActionState(saveNewsletterSettings, undefined);

  return (
    <form action={action}>
      {state?.error && <div className={styles.error}>{state.error}</div>}
      {state && !state.error && <p style={{ color: 'var(--rust)', fontSize: 15 }}>Saved.</p>}

      <label className={styles.field}>
        <span className={styles.label}>subject line</span>
        <input
          className={styles.input}
          name="newsletterSubject"
          defaultValue={newsletterSubject}
          placeholder="this week's letters"
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>intro</span>
        <textarea
          className={styles.input}
          style={{ minHeight: 120, resize: 'vertical' }}
          name="newsletterIntro"
          defaultValue={newsletterIntro}
          placeholder="A line or two at the top of every letter, before the list of posts."
        />
        <p className={styles.hint}>
          What goes out every week, above the list of that week&rsquo;s posts. Leave empty to skip straight to the list.
        </p>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>sends weekly on</span>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className={styles.input} name="newsletterSendDay" defaultValue={sendDay} style={{ width: 'auto' }}>
            {DAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <select className={styles.input} name="newsletterSendHour" defaultValue={sendHour} style={{ width: 'auto' }}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00 UTC
              </option>
            ))}
          </select>
        </div>
        <p className={styles.hint}>
          Checked hourly, not fired exactly on the dot — the letter goes out on the first check after this
          time. No per-subscriber timezone exists anywhere else in this project, so this is UTC.
          Next send: <strong>{nextSendLabel}</strong>.
        </p>
      </label>

      <div className={styles.sticky}>
        <button className={styles.button} type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
