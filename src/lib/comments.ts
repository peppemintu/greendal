import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { db } from './db';
import { comments, users, type CommentRow } from './schema';

export type Viewer = { id: number; role: 'admin' | 'reader' } | null;

/** How long a reader can still edit their own comment. Shared with commentActions.ts, the enforcement side. */
export const EDIT_WINDOW_SECONDS = 15 * 60;

export type ThreadNode = {
  id: number;
  /** null = top-level. Drives whether the "reply" button shows — replies don't get one, one level is the cap. */
  parentId: number | null;
  authorId: number;
  authorName: string;
  body: string;
  visibility: 'public' | 'private';
  status: 'visible' | 'hidden' | 'deleted';
  createdAt: number;
  editedAt: number | null;
  /** Viewer authored this one — drives "edit"/"delete" buttons. */
  isOwn: boolean;
  /**
   * Viewer can't see the real content; this node exists only so its visible
   * replies have somewhere to nest. Rendered as a neutral placeholder, no
   * author name or body sent to the client at all.
   */
  isTombstone: boolean;
  /** Author viewing their own hidden comment — show "hidden from the public page". */
  showHiddenNote: boolean;
  /** Server-computed so the client never has to re-derive (or trust) these against a stale clock or role. */
  canEditNow: boolean;
  canDelete: boolean;
  canModerate: boolean;
  /** The one visibility flip available to this viewer right now, or null for none. */
  visibilityAction: 'make-private' | 'make-public' | null;
  replies: ThreadNode[];
};

/**
 * docs/design/users-comments-editor.md §4's rule, extended with the one
 * follow-up it calls out explicitly: a hidden comment's own author still
 * sees it (with a note), even though the base rule below would say
 * "status != visible -> admin only". `deleted` gets no such exception —
 * per the design, nobody sees a deleted comment's content through the UI,
 * admin included; it only exists as a database row.
 */
function isVisibleTo(viewer: Viewer, comment: CommentRow, parentAuthorId: number | null): boolean {
  if (comment.status === 'deleted') return false;

  if (comment.status === 'hidden') {
    if (viewer?.role === 'admin') return true;
    return viewer?.id === comment.authorId;
  }

  if (comment.visibility === 'public') return true;

  if (!viewer) return false;
  if (viewer.role === 'admin') return true;
  if (viewer.id === comment.authorId) return true;
  if (parentAuthorId !== null && viewer.id === parentAuthorId) return true;
  return false;
}

type Target = { postId: number } | { recipeId: number };

/**
 * All comments for a post or recipe, as a tree for the given viewer (one
 * level deep — a reply's parentId always points at a top-level comment, so
 * this never needs to recurse past that). Comments the viewer can't see are
 * dropped unless they have visible replies, in which case a tombstone
 * stands in so the thread doesn't look broken.
 */
export async function getCommentThread(
  target: Target,
  viewer: Viewer,
): Promise<{ nodes: ThreadNode[]; visibleCount: number }> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const rows = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      recipeId: comments.recipeId,
      authorId: comments.authorId,
      parentId: comments.parentId,
      body: comments.body,
      visibility: comments.visibility,
      status: comments.status,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      editedAt: comments.editedAt,
      authorName: users.displayName,
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where('postId' in target ? eq(comments.postId, target.postId) : eq(comments.recipeId, target.recipeId))
    .orderBy(asc(comments.createdAt));

  const byId = new Map(rows.map((r) => [r.id, r]));
  const childrenOf = new Map<number, typeof rows>();
  const topLevel: typeof rows = [];
  for (const r of rows) {
    if (r.parentId === null) {
      topLevel.push(r);
    } else {
      const siblings = childrenOf.get(r.parentId) ?? [];
      siblings.push(r);
      childrenOf.set(r.parentId, siblings);
    }
  }

  function build(row: (typeof rows)[number]): ThreadNode | null {
    const parentAuthorId = row.parentId !== null ? (byId.get(row.parentId)?.authorId ?? null) : null;
    const visible = isVisibleTo(viewer, row as CommentRow, parentAuthorId);
    const replies = (childrenOf.get(row.id) ?? [])
      .map(build)
      .filter((n): n is ThreadNode => n !== null);

    if (!visible) {
      if (replies.length === 0) return null;
      return {
        id: row.id,
        parentId: row.parentId,
        authorId: row.authorId,
        authorName: '',
        body: '',
        visibility: row.visibility,
        status: row.status,
        createdAt: row.createdAt,
        editedAt: null,
        isOwn: false,
        isTombstone: true,
        showHiddenNote: false,
        canEditNow: false,
        canDelete: false,
        canModerate: false,
        visibilityAction: null,
        replies,
      };
    }

    const isOwn = viewer?.id === row.authorId;
    const isAdmin = viewer?.role === 'admin';
    // A public+visible reply is visible to every viewer kind unconditionally
    // (see isVisibleTo above), so checking the already-filtered tree for one
    // is equivalent to a fresh "does this have public replies" query.
    const hasPublicReply = replies.some((r) => !r.isTombstone && r.visibility === 'public' && r.status === 'visible');

    let visibilityAction: ThreadNode['visibilityAction'] = null;
    if (viewer && row.status === 'visible') {
      const target = row.visibility === 'public' ? 'private' : 'public';
      const decision = canChangeVisibility(viewer, row, target, hasPublicReply);
      if (decision.allowed) visibilityAction = target === 'private' ? 'make-private' : 'make-public';
    }

    return {
      id: row.id,
      parentId: row.parentId,
      authorId: row.authorId,
      authorName: row.authorName,
      body: row.body,
      visibility: row.visibility,
      status: row.status,
      createdAt: row.createdAt,
      editedAt: row.editedAt,
      isOwn,
      isTombstone: false,
      showHiddenNote: row.status === 'hidden' && !isAdmin && isOwn,
      canEditNow: isOwn && row.status === 'visible' && nowSeconds - row.createdAt <= EDIT_WINDOW_SECONDS,
      canDelete: (isOwn || isAdmin) && row.status !== 'deleted',
      canModerate: isAdmin && row.status !== 'deleted',
      visibilityAction,
      replies,
    };
  }

  const nodes = topLevel.map(build).filter((n): n is ThreadNode => n !== null);
  return { nodes, visibleCount: countVisible(nodes) };
}

function countVisible(nodes: ThreadNode[]): number {
  let n = 0;
  for (const node of nodes) {
    if (!node.isTombstone) n++;
    n += countVisible(node.replies);
  }
  return n;
}

/** Does this comment have any reply that's public and not hidden/deleted? Gates privatizing it. */
export async function hasPublicReplies(commentId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: comments.id })
    .from(comments)
    .where(
      and(eq(comments.parentId, commentId), eq(comments.status, 'visible'), eq(comments.visibility, 'public')),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * The authoritative check for a visibility flip — callers (the server
 * action) still re-fetch the comment and hasPublicReplies() themselves
 * rather than trusting anything the client sent; this is shared logic, not
 * a substitute for that.
 */
export function canChangeVisibility(
  viewer: { id: number; role: 'admin' | 'reader' },
  comment: { authorId: number; visibility: 'public' | 'private' },
  target: 'public' | 'private',
  publicRepliesExist: boolean,
): { allowed: boolean; reason?: string } {
  const isOwn = viewer.id === comment.authorId;
  if (!isOwn && viewer.role !== 'admin') return { allowed: false, reason: 'Not your comment.' };

  if (target === 'private' && publicRepliesExist) {
    return { allowed: false, reason: 'This has public replies — sort those out first.' };
  }

  if (isOwn) return { allowed: true };

  // Admin acting on someone else's comment: public -> private (moderation) only.
  if (comment.visibility === 'public' && target === 'private') return { allowed: true };
  return { allowed: false, reason: "You can hide someone else's comment, not publish it." };
}
