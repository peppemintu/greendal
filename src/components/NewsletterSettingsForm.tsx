'use client';

import { useActionState } from 'react';
import { saveNewsletterSettings } from '@/app/admin/(desk)/newsletter/actions';
import styles from '@/app/admin/admin.module.css';

export function NewsletterSettingsForm({
  newsletterSubject,
  newsletterIntro,
}: {
  newsletterSubject: string;
  newsletterIntro: string;
}) {
  const [state, action, pending] = useActionState(saveNewsletterSettings, undefined);

  return (
    <form action={action}>
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

      <div className={styles.sticky}>
        <button className={styles.button} type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
