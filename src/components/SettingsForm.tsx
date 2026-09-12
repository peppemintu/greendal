'use client';

import { useActionState } from 'react';
import { saveSettings } from '@/app/admin/actions';
import styles from '@/app/admin/admin.module.css';

export function SettingsForm({ settings }: { settings: Record<string, string> }) {
  const [state, action, pending] = useActionState(saveSettings, undefined);

  return (
    <form action={action}>
      <div className="sectionMark">
        <span className="hand">site text</span>
      </div>
      {state && !state.error && (
        <p style={{ color: 'var(--rust)', fontSize: 15 }}>Saved.</p>
      )}

      <label className={styles.field}>
        <span className={styles.label}>tagline</span>
        <textarea
          className={styles.input}
          style={{ minHeight: 80, resize: 'vertical' }}
          name="tagline"
          defaultValue={settings.tagline ?? ''}
        />
        <p className={styles.hint}>The paragraph under the wordmark on the home page.</p>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>footer line</span>
        <input className={styles.input} name="footerNote" defaultValue={settings.footerNote ?? ''} />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>about — heading</span>
        <input className={styles.input} name="aboutTitle" defaultValue={settings.aboutTitle ?? ''} />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>about — body</span>
        <textarea className={styles.textarea} name="aboutBody" defaultValue={settings.aboutBody ?? ''} />
        <p className={styles.hint}>Markdown, same as a thought.</p>
      </label>

      <div className={styles.sticky}>
        <button className={styles.button} type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
