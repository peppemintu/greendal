'use client';

import Link from 'next/link';
import { useState } from 'react';
import { adminHideComment, adminUnhideComment, deleteComment } from '@/lib/commentActions';
import { CommentForm } from './CommentForm';
import { CommentBody } from './CommentBody';
import { longDate } from '@/lib/format';
import styles from './CommentSection.module.css';

export type AdminCommentRowData = {
  id: number;
  postId: number | null;
  recipeId: number | null;
  parentId: number | null;
  authorName: string;
  body: string;
  visibility: 'public' | 'private';
  status: 'visible' | 'hidden';
  createdAt: number;
  postSlug: string | null;
  postTitle: string | null;
  recipeSlug: string | null;
  recipeTitle: string | null;
};

export function AdminCommentRow({ row }: { row: AdminCommentRowData }) {
  const [replying, setReplying] = useState(false);
  const targetHref = row.postSlug
    ? `/thoughts/${row.postSlug}#comment-${row.id}`
    : `/recipes/${row.recipeSlug}#comment-${row.id}`;
  const targetTitle = row.postTitle ?? row.recipeTitle ?? '(untitled)';
  const target = row.postId != null ? { postId: row.postId } : { recipeId: row.recipeId! };

  return (
    <div className={styles.node}>
      <div className={styles.meta}>
        <span className={styles.author}>{row.authorName}</span>
        <span className={styles.date}>{longDate(row.createdAt)}</span>
        {row.visibility === 'private' && <span className={styles.badge}>private</span>}
        {row.status === 'hidden' && <span className={styles.badge}>hidden</span>}
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-quiet)', margin: '0 0 6px' }}>
        on <Link href={targetHref}>{targetTitle}</Link>
        {row.parentId !== null && ' · a reply'}
      </p>
      <CommentBody text={row.body} />

      <div className={styles.actions}>
        {row.parentId === null && (
          <button className={styles.actionLink} type="button" onClick={() => setReplying((v) => !v)}>
            {replying ? 'cancel' : 'reply'}
          </button>
        )}
        {row.status === 'visible' ? (
          <form action={adminHideComment} style={{ display: 'inline' }}>
            <input type="hidden" name="id" value={row.id} />
            <button className={styles.actionLink} type="submit">
              hide
            </button>
          </form>
        ) : (
          <form action={adminUnhideComment} style={{ display: 'inline' }}>
            <input type="hidden" name="id" value={row.id} />
            <button className={styles.actionLink} type="submit">
              unhide
            </button>
          </form>
        )}
        <form
          action={deleteComment}
          style={{ display: 'inline' }}
          onSubmit={(e) => {
            if (!confirm('Delete this comment?')) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={row.id} />
          <button className={styles.actionLink} type="submit">
            delete
          </button>
        </form>
      </div>

      {replying && (
        <div className={styles.replyForm}>
          <CommentForm
            target={target}
            parentId={row.id}
            forcePrivate={row.visibility === 'private'}
            onPosted={() => setReplying(false)}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}
