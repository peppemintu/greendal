'use client';

import { useActionState } from 'react';
import { updateAccount, closeAccount } from '@/app/account/actions';
import { resendVerification } from '@/app/(auth)/actions';
import styles from '@/styles/form.module.css';

export type AccountUser = {
  email: string;
  displayName: string;
  emailVerified: boolean;
  notifyOnReply: boolean;
};

export function AccountPanel({ user }: { user: AccountUser }) {
  const [profileState, profileAction, profilePending] = useActionState(updateAccount, undefined);
  const [verifyState, verifyAction, verifyPending] = useActionState(resendVerification, undefined);

  return (
    <>
      {!user.emailVerified && (
        <div className={styles.error} style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ flex: 1 }}>
            Your email isn&rsquo;t confirmed yet — you can&rsquo;t comment until it is.
          </span>
          <form action={verifyAction}>
            <button className={styles.buttonSmall} type="submit" disabled={verifyPending}>
              {verifyPending ? 'Sending…' : 'Resend the link'}
            </button>
          </form>
        </div>
      )}
      {verifyState?.message && <div className={styles.message}>{verifyState.message}</div>}
      {verifyState?.error && <div className={styles.error}>{verifyState.error}</div>}

      <form action={profileAction}>
        {profileState?.error && <div className={styles.error}>{profileState.error}</div>}
        {profileState?.message && <div className={styles.message}>{profileState.message}</div>}

        <label className={styles.field}>
          <span className={styles.label}>email</span>
          <input className={styles.input} value={user.email} disabled />
          <p className={styles.hint}>Not shown to anyone. Changing it isn&rsquo;t supported yet.</p>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>your name</span>
          <input className={styles.input} name="displayName" defaultValue={user.displayName} required maxLength={60} />
          <p className={styles.hint}>What shows under your comments.</p>
        </label>

        <label className={styles.field} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" name="notifyOnReply" defaultChecked={user.notifyOnReply} />
          <span>email me when someone replies to my comment</span>
        </label>

        <button className={styles.button} type="submit" disabled={profilePending}>
          {profilePending ? 'Saving…' : 'Save'}
        </button>
      </form>

      <div style={{ marginTop: 46, paddingTop: 22, borderTop: '1px solid var(--rule)' }}>
        <p style={{ fontSize: 14.5, color: 'var(--ink-quiet)', marginBottom: 12 }}>
          Closing your account signs you out everywhere and stops you signing back in. Your past
          comments stay up under your name — they don&rsquo;t disappear with you.
        </p>
        <form
          action={closeAccount}
          onSubmit={(e) => {
            if (!confirm('Close your account? You can ask the blog’s owner to reopen it later.')) {
              e.preventDefault();
            }
          }}
        >
          <button className={styles.buttonGhost} type="submit">
            Close my account
          </button>
        </form>
      </div>
    </>
  );
}
