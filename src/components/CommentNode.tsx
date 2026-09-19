'use client';

import { useActionState, useState } from 'react';
import {
  editComment,
  deleteComment,
  setCommentVisibility,
  adminHideComment,
  adminUnhideComment,
} from '@/lib/commentActions';
import type { ThreadNode } from '@/lib/comments';
import { CommentBody } from './CommentBody';
import { CommentForm } from './CommentForm';
import { longDate } from '@/lib/format';
import formStyles from '@/styles/form.module.css';
import styles from './CommentSection.module.css';

export function CommentNode({
  node,
  target,
}: {
  node: ThreadNode;
  target: { postId: number } | { recipeId: number };
}) {
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [editState, editAction, editPending] = useActionState(editComment, undefined);

  if (node.isTombstone) {
    return (
      <div className={styles.node} id={`comment-${node.id}`}>
        <p className={styles.tombstone}>— comment removed —</p>
        {node.replies.length > 0 && (
          <div className={styles.replies}>
            {node.replies.map((reply) => (
              <CommentNode key={reply.id} node={reply} target={target} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.node} id={`comment-${node.id}`}>
      <div className={styles.meta}>
        <span className={styles.author}>{node.authorName}</span>
        <span className={styles.date}>{longDate(node.createdAt)}</span>
        {node.visibility === 'private' && <span className={styles.badge}>private</span>}
        {node.status === 'hidden' && <span className={styles.badge}>hidden</span>}
      </div>

      {node.showHiddenNote && (
        <p className={formStyles.hint}>
          Only you and the blog&rsquo;s author can see this — it&rsquo;s hidden from the public page.
        </p>
      )}

      {editing ? (
        <form action={editAction} className={styles.form}>
          {editState?.error && <div className={formStyles.error}>{editState.error}</div>}
          <input type="hidden" name="id" value={node.id} />
          <textarea
            className={formStyles.textarea}
            style={{ minHeight: 80 }}
            name="body"
            defaultValue={node.body}
            maxLength={4000}
            required
            autoFocus
          />
          <div className={styles.formFooter}>
            <button className={formStyles.buttonSmall} type="button" onClick={() => setEditing(false)}>
              cancel
            </button>
            <button className={formStyles.button} type="submit" disabled={editPending}>
              {editPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <CommentBody text={node.body} />
      )}

      {!editing && (
        <div className={styles.actions}>
          {node.parentId === null && (
            <button className={styles.actionLink} type="button" onClick={() => setReplying((v) => !v)}>
              {replying ? 'cancel' : 'reply'}
            </button>
          )}
          {node.canEditNow && (
            <button className={styles.actionLink} type="button" onClick={() => setEditing(true)}>
              edit
            </button>
          )}
          {node.visibilityAction && (
            <form action={setCommentVisibility} style={{ display: 'inline' }}>
              <input type="hidden" name="id" value={node.id} />
              <input type="hidden" name="target" value={node.visibilityAction === 'make-private' ? 'private' : 'public'} />
              <button className={styles.actionLink} type="submit">
                {node.visibilityAction === 'make-private' ? 'make private' : 'make public'}
              </button>
            </form>
          )}
          {node.canDelete && (
            <form
              action={deleteComment}
              style={{ display: 'inline' }}
              onSubmit={(e) => {
                if (!confirm('Delete this comment?')) e.preventDefault();
              }}
            >
              <input type="hidden" name="id" value={node.id} />
              <button className={styles.actionLink} type="submit">
                delete
              </button>
            </form>
          )}
          {node.canModerate && node.status === 'visible' && (
            <form action={adminHideComment} style={{ display: 'inline' }}>
              <input type="hidden" name="id" value={node.id} />
              <button className={styles.actionLink} type="submit">
                hide
              </button>
            </form>
          )}
          {node.canModerate && node.status === 'hidden' && (
            <form action={adminUnhideComment} style={{ display: 'inline' }}>
              <input type="hidden" name="id" value={node.id} />
              <button className={styles.actionLink} type="submit">
                unhide
              </button>
            </form>
          )}
        </div>
      )}

      {replying && (
        <div className={styles.replyForm}>
          <CommentForm
            target={target}
            parentId={node.id}
            forcePrivate={node.visibility === 'private'}
            onPosted={() => setReplying(false)}
            autoFocus
          />
        </div>
      )}

      {node.replies.length > 0 && (
        <div className={styles.replies}>
          {node.replies.map((reply) => (
            <CommentNode key={reply.id} node={reply} target={target} />
          ))}
        </div>
      )}
    </div>
  );
}
