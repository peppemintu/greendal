'use client';

import { useActionState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { login } from '../actions';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import styles from '@/styles/form.module.css';

function LoginForm() {
  const next = useSearchParams().get('next') ?? '';
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} style={{ maxWidth: 340, margin: '70px auto', padding: '0 20px' }}>
      <div className="hand" style={{ fontSize: 40 }}>
        welcome back
      </div>
      <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--ink-quiet)', margin: '8px 0 24px' }}>
        Sign in to read, comment, or write.
      </p>
      {state?.error && <div className={styles.error}>{state.error}</div>}
      {next && <input type="hidden" name="next" value={next} />}

      <label className={styles.field}>
        <span className={styles.label}>email</span>
        <input className={styles.input} type="email" name="email" autoFocus required />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>password</span>
        <input className={styles.input} type="password" name="password" required />
      </label>

      <button className={styles.button} type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>

      <p style={{ fontSize: 14, marginTop: 18, color: 'var(--ink-quiet)' }}>
        <Link href="/forgot">forgot your password?</Link>
        <br />
        no account yet? <Link href="/register">write one down</Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <>
      <SiteHeader />
      <Suspense>
        <LoginForm />
      </Suspense>
      <SiteFooter />
    </>
  );
}
