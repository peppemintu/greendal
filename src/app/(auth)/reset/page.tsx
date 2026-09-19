'use client';

import { useActionState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { resetPassword } from '../actions';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import styles from '@/styles/form.module.css';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [state, action, pending] = useActionState(resetPassword, undefined);

  if (!token) {
    return (
      <div style={{ maxWidth: 340, margin: '70px auto', padding: '0 20px' }}>
        <div className={styles.error}>
          That link is missing its token. Request a new one from the sign-in page.
        </div>
      </div>
    );
  }

  return (
    <form action={action} style={{ maxWidth: 340, margin: '70px auto', padding: '0 20px' }}>
      <div className="hand" style={{ fontSize: 40 }}>
        new password
      </div>
      {state?.error && <div className={styles.error}>{state.error}</div>}
      <input type="hidden" name="token" value={token} />

      <label className={styles.field}>
        <span className={styles.label}>new password</span>
        <input className={styles.input} type="password" name="password" autoFocus required minLength={10} />
        <p className={styles.hint}>At least 10 characters.</p>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>type it again</span>
        <input className={styles.input} type="password" name="confirm" required minLength={10} />
      </label>

      <button className={styles.button} type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Set new password'}
      </button>
    </form>
  );
}

export default function ResetPage() {
  return (
    <>
      <SiteHeader />
      <Suspense>
        <ResetForm />
      </Suspense>
      <SiteFooter />
    </>
  );
}
