'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { requestPasswordReset } from '../actions';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import styles from '@/styles/form.module.css';

export default function ForgotPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  return (
    <>
      <SiteHeader />
      <form action={action} style={{ maxWidth: 340, margin: '70px auto', padding: '0 20px' }}>
        <div className="hand" style={{ fontSize: 40 }}>
          forgot it?
        </div>
        <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--ink-quiet)', margin: '8px 0 24px' }}>
          We&rsquo;ll send a link to reset it.
        </p>
        {state?.error && <div className={styles.error}>{state.error}</div>}
        {state?.message && <div className={styles.message}>{state.message}</div>}

        <label className={styles.field}>
          <span className={styles.label}>email</span>
          <input className={styles.input} type="email" name="email" autoFocus required />
        </label>

        <button className={styles.button} type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Send reset link'}
        </button>

        <p style={{ fontSize: 14, marginTop: 18, color: 'var(--ink-quiet)' }}>
          <Link href="/login">back to sign in</Link>
        </p>
      </form>
      <SiteFooter />
    </>
  );
}
