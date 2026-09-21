'use client';

import { useActionState } from 'react';
import { subscribeToNewsletter } from '@/lib/subscriberActions';
import { NewsletterTooltip } from './NewsletterTooltip';
import formStyles from '@/styles/form.module.css';
import styles from './NewsletterSubscribeBox.module.css';

const TOOLTIP_TEXT = 'A short letter once a week, recapping whatever got posted. Unsubscribe anytime.';

export function NewsletterSubscribeForm() {
  const [state, action, pending] = useActionState(subscribeToNewsletter, undefined);

  if (state?.message) {
    return (
      <span className={styles.wrap}>
        <span className={styles.message}>{state.message}</span>
        <NewsletterTooltip text={TOOLTIP_TEXT} />
      </span>
    );
  }

  return (
    <form action={action} className={styles.wrap}>
      <span className={styles.form}>
        <input type="text" name="website" className={formStyles.honeypot} tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <input
          type="email"
          name="email"
          placeholder="your email"
          required
          className={styles.input}
          aria-label="Email address"
        />
        <button type="submit" className={styles.button} disabled={pending}>
          {pending ? '…' : 'subscribe'}
        </button>
      </span>
      {state?.error && <span className={styles.error}>{state.error}</span>}
      <NewsletterTooltip text={TOOLTIP_TEXT} />
    </form>
  );
}
