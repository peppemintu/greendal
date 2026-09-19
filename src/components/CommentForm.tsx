'use client';

import { useActionState, useEffect, useRef } from 'react';
import { createComment } from '@/lib/commentActions';
import formStyles from '@/styles/form.module.css';
import styles from './CommentSection.module.css';

export function CommentForm({
  target,
  parentId,
  forcePrivate,
  onPosted,
  autoFocus,
}: {
  target: { postId: number } | { recipeId: number };
  parentId?: number;
  forcePrivate?: boolean;
  onPosted?: () => void;
  autoFocus?: boolean;
}) {
  const [state, action, pending] = useActionState(createComment, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  // Server actions don't reset a form's fields on success the way a plain
  // HTML submit would — do it ourselves once the action reports success,
  // and only then, so a failed submission never eats what was typed.
  useEffect(() => {
    if (state?.message) {
      formRef.current?.reset();
      onPosted?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={action} className={styles.form}>
      {state?.error && <div className={formStyles.error}>{state.error}</div>}
      {'postId' in target ? (
        <input type="hidden" name="postId" value={target.postId} />
      ) : (
        <input type="hidden" name="recipeId" value={target.recipeId} />
      )}
      {parentId != null && <input type="hidden" name="parentId" value={parentId} />}

      <textarea
        className={formStyles.textarea}
        style={{ minHeight: parentId != null ? 80 : 120 }}
        name="body"
        maxLength={4000}
        required
        autoFocus={autoFocus}
        placeholder={parentId != null ? 'write a reply…' : 'say something…'}
      />

      <div className={styles.formFooter}>
        <label className={styles.privateToggle}>
          <input type="checkbox" name="private" defaultChecked={forcePrivate} disabled={forcePrivate} />
          only for the blog&rsquo;s author
        </label>
        <button className={formStyles.button} type="submit" disabled={pending}>
          {pending ? 'Posting…' : 'Post'}
        </button>
      </div>
      {forcePrivate && (
        <p className={formStyles.hint}>Forced private — you&rsquo;re replying to a private comment.</p>
      )}
    </form>
  );
}
