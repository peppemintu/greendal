'use client';

import { useActionState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { login } from '../actions';
import styles from '../admin.module.css';

function LoginForm() {
  const next = useSearchParams().get('next') ?? '/admin';
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} style={{ maxWidth: 340, margin: '90px auto', padding: '0 20px' }}>
      <div className="hand" style={{ fontSize: 40 }}>welcome back</div>
      <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--ink-quiet)', margin: '8px 0 24px' }}>
        Sign in to write.
      </p>
      {state?.error && <div className={styles.error}>{state.error}</div>}
      <input type="hidden" name="next" value={next} />
      <label className={styles.field}>
        <span className={styles.label}>password</span>
        <input className={styles.input} type="password" name="password" autoFocus required />
      </label>
      <button className={styles.button} type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
