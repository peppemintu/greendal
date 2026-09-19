'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { comments, posts, recipes, users } from './schema';
import { getCurrentUser, requireAdmin } from './auth';
import { hasPublicReplies, canChangeVisibility, EDIT_WINDOW_SECONDS } from './comments';
import { checkRateLimit } from './rateLimit';
import { sendEmail } from './email';

export type FormState = { error?: string; message?: string } | undefined;

const now = () => Math.floor(Date.now() / 1000);

function siteUrl(): string {
  return process.env.SITE_URL ?? 'http://localhost:3000';
}

async function pathFor(row: { postId: number | null; recipeId: number | null }): Promise<string> {
  if (row.postId) {
    const [p] = await db.select({ slug: posts.slug }).from(posts).where(eq(posts.id, row.postId)).limit(1);
    return p ? `/thoughts/${p.slug}` : '/';
  }
  const [r] = await db.select({ slug: recipes.slug }).from(recipes).where(eq(recipes.id, row.recipeId!)).limit(1);
  return r ? `/recipes/${r.slug}` : '/';
}

function revalidateComment(path: string) {
  revalidatePath(path);
  revalidatePath('/admin/comments');
}

/**
 * Fire-and-forget by design (docs/design/users-comments-editor.md §3): a
 * slow mail API shouldn't hold up posting a comment. Safe here because this
 * is a persistent self-hosted Node process, not a serverless function that
 * gets frozen the instant a response is sent — the promise keeps running.
 */
function notifyComment(
  row: { id: number; postId: number | null; recipeId: number | null; parentId: number | null; authorId: number; visibility: 'public' | 'private'; body: string },
  authorDisplayName: string,
  path: string,
) {
  notifyCommentImpl(row, authorDisplayName, path).catch((e) => {
    console.error('[comments] notification failed:', e instanceof Error ? e.message : e);
  });
}

async function notifyCommentImpl(
  row: { id: number; postId: number | null; recipeId: number | null; parentId: number | null; authorId: number; visibility: 'public' | 'private'; body: string },
  authorDisplayName: string,
  path: string,
): Promise<void> {
  const link = `${siteUrl()}${path}#comment-${row.id}`;

  const [admin] = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
  if (admin && admin.id !== row.authorId) {
    const tag = row.visibility === 'private' ? '[private] ' : '';
    await sendEmail({
      to: admin.email,
      subject: `${tag}new comment on greendal`,
      text: `${authorDisplayName} commented:\n\n${row.body}\n\n${link}`,
    });
  }

  if (row.parentId) {
    const [parent] = await db.select().from(comments).where(eq(comments.id, row.parentId)).limit(1);
    if (parent && parent.authorId !== row.authorId) {
      const [parentAuthor] = await db.select().from(users).where(eq(users.id, parent.authorId)).limit(1);
      if (parentAuthor && parentAuthor.notifyOnReply && !parentAuthor.archivedAt && !parentAuthor.blockedAt) {
        await sendEmail({
          to: parentAuthor.email,
          subject: 'someone replied to your comment — greendal',
          text: `${authorDisplayName} replied to your comment:\n\n${row.body}\n\n${link}`,
        });
      }
    }
  }
}

export async function createComment(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Sign in to comment.' };
  if (!user.emailVerifiedAt) return { error: 'Confirm your email first — see your account page.' };

  if (!(await checkRateLimit(`comment:${user.id}`, 5, 10 * 60))) {
    return { error: "That's a lot of comments at once — try again in a bit." };
  }

  const body = String(form.get('body') ?? '').trim();
  if (!body) return { error: "Comment can't be empty." };
  if (body.length > 4000) return { error: 'Keep it under 4000 characters.' };

  const postId = form.get('postId') ? Number(form.get('postId')) : null;
  const recipeId = form.get('recipeId') ? Number(form.get('recipeId')) : null;
  if ((postId ? 1 : 0) + (recipeId ? 1 : 0) !== 1) {
    return { error: "Missing what this comment is on." };
  }

  let path: string;
  if (postId) {
    const [post] = await db.select({ slug: posts.slug, status: posts.status }).from(posts).where(eq(posts.id, postId)).limit(1);
    if (!post || post.status !== 'published') return { error: "Can't comment here." };
    path = `/thoughts/${post.slug}`;
  } else {
    const [recipe] = await db.select({ slug: recipes.slug, status: recipes.status }).from(recipes).where(eq(recipes.id, recipeId!)).limit(1);
    if (!recipe || recipe.status !== 'published') return { error: "Can't comment here." };
    path = `/recipes/${recipe.slug}`;
  }

  let visibility: 'public' | 'private' = form.get('private') ? 'private' : 'public';
  const parentId = form.get('parentId') ? Number(form.get('parentId')) : null;
  if (parentId) {
    const [parent] = await db.select().from(comments).where(eq(comments.id, parentId)).limit(1);
    if (!parent || parent.status !== 'visible') {
      return { error: 'That comment is no longer there to reply to.' };
    }
    if (parent.parentId !== null) {
      return { error: 'Replies only go one level deep — reply to the top-level comment.' };
    }
    if ((postId && parent.postId !== postId) || (recipeId && parent.recipeId !== recipeId)) {
      return { error: 'That reply target moved. Reload and try again.' };
    }
    // Forced, not a checkbox the replier controls — a public reply to a
    // private comment would out both its content and its existence.
    if (parent.visibility === 'private') visibility = 'private';
  }

  const t = now();
  const [row] = await db
    .insert(comments)
    .values({ postId, recipeId, authorId: user.id, parentId, body, visibility, status: 'visible', createdAt: t, updatedAt: t })
    .returning({
      id: comments.id,
      postId: comments.postId,
      recipeId: comments.recipeId,
      parentId: comments.parentId,
      authorId: comments.authorId,
      visibility: comments.visibility,
      body: comments.body,
    });

  revalidateComment(path);
  notifyComment(row, user.displayName, path);
  return { message: 'Posted.' };
}

export async function editComment(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Sign in first.' };

  const id = Number(form.get('id'));
  const body = String(form.get('body') ?? '').trim();
  if (!body) return { error: "Comment can't be empty." };
  if (body.length > 4000) return { error: 'Keep it under 4000 characters.' };

  const [row] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
  if (!row || row.authorId !== user.id) return { error: 'Not your comment.' };
  if (row.status !== 'visible') return { error: "Can't edit that anymore." };

  const t = now();
  if (t - row.createdAt > EDIT_WINDOW_SECONDS) {
    return { error: 'The 15-minute edit window has passed.' };
  }

  await db.update(comments).set({ body, updatedAt: t, editedAt: t }).where(eq(comments.id, id));
  revalidateComment(await pathFor(row));
  return { message: 'Saved.' };
}

/** Own comment (any status) or admin (any comment) — matches the design's "you or the admin" rule. */
export async function deleteComment(form: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const id = Number(form.get('id'));
  const [row] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
  if (!row) return;
  if (row.authorId !== user.id && user.role !== 'admin') return;

  await db.update(comments).set({ status: 'deleted', updatedAt: now() }).where(eq(comments.id, id));
  revalidateComment(await pathFor(row));
}

/**
 * Toggles public/private on one comment. The client is expected to only
 * show this control when canChangeVisibility() already says yes (per the
 * design: a disabled button should explain why, not just be grey) — this
 * is the enforcement backstop, not the primary UX, so it fails silently
 * rather than returning a message through a channel the plain toggle form
 * doesn't have.
 */
export async function setCommentVisibility(form: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const id = Number(form.get('id'));
  const target = form.get('target') === 'private' ? 'private' : 'public';
  const [row] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
  if (!row || row.status !== 'visible') return;

  const publicReplies = await hasPublicReplies(id);
  const decision = canChangeVisibility(user, row, target, publicReplies);
  if (!decision.allowed) return;

  await db.update(comments).set({ visibility: target, updatedAt: now() }).where(eq(comments.id, id));
  revalidateComment(await pathFor(row));
}

export async function adminHideComment(form: FormData) {
  await requireAdmin();
  const id = Number(form.get('id'));
  const [row] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
  if (!row) return;
  await db.update(comments).set({ status: 'hidden', updatedAt: now() }).where(eq(comments.id, id));
  revalidateComment(await pathFor(row));
}

export async function adminUnhideComment(form: FormData) {
  await requireAdmin();
  const id = Number(form.get('id'));
  const [row] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
  if (!row) return;
  await db.update(comments).set({ status: 'visible', updatedAt: now() }).where(eq(comments.id, id));
  revalidateComment(await pathFor(row));
}
