'use client';

import { useActionState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { register } from '../actions';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import styles from '@/styles/form.module.css';

function RegisterForm() {
  const next = useSearchParams().get('next') ?? '';
  const [state, action, pending] = useActionState(register, undefined);

  return (
    <form action={action} style={{ maxWidth: 360, margin: '70px auto', padding: '0 20px' }}>
      <div className="hand" style={{ fontSize: 40 }}>
        come in
      </div>
      <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--ink-quiet)', margin: '8px 0 24px' }}>
        An account lets you comment on thoughts and recipes.
      </p>
      {state?.error && <div className={styles.error}>{state.error}</div>}
      {next && <input type="hidden" name="next" value={next} />}

      {/* Hidden from people, visible to form-filling bots. */}
      <label className={styles.honeypot} aria-hidden="true">
        website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>your name</span>
        <input className={styles.input} name="displayName" autoFocus required maxLength={60} />
        <p className={styles.hint}>What shows under your comments.</p>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>email</span>
        <input className={styles.input} type="email" name="email" required />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>password</span>
        <input className={styles.input} type="password" name="password" required minLength={10} />
        <p className={styles.hint}>At least 10 characters.</p>
      </label>

      <button className={styles.button} type="submit" disabled={pending}>
        {pending ? 'Signing up…' : 'Sign up'}
      </button>

      <p style={{ fontSize: 14, marginTop: 18, color: 'var(--ink-quiet)' }}>
        already have an account? <Link href="/login">sign in</Link>
      </p>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <>
      <SiteHeader />
      <Suspense>
        <RegisterForm />
      </Suspense>
      <SiteFooter />
    </>
  );
}
