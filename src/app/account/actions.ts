'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { getCurrentUser, destroySession, destroyAllSessions } from '@/lib/auth';

export type FormState = { error?: string; message?: string } | undefined;

export async function updateAccount(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Sign in first.' };

  const displayName = String(form.get('displayName') ?? '')
    .trim()
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 60);
  if (!displayName) return { error: 'Tell us what to call you.' };

  await db
    .update(users)
    .set({ displayName, notifyOnReply: form.get('notifyOnReply') ? 1 : 0, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(users.id, user.id));

  return { message: 'Saved.' };
}

/** Closes the account: not deleted, just can't be signed into. See design doc §2. */
export async function closeAccount() {
  const user = await getCurrentUser();
  if (!user) redirect('/');

  await db
    .update(users)
    .set({ archivedAt: Math.floor(Date.now() / 1000) })
    .where(eq(users.id, user.id));
  // Clears this browser's cookie too, not just the row it points to.
  await destroySession();
  await destroyAllSessions(user.id);
  redirect('/');
}
