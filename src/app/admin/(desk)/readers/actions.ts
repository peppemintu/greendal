'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { requireAdmin } from '@/lib/auth';

const now = () => Math.floor(Date.now() / 1000);

export async function blockReader(form: FormData) {
  await requireAdmin();
  const id = Number(form.get('id'));
  await db.update(users).set({ blockedAt: now(), updatedAt: now() }).where(eq(users.id, id));
  revalidatePath('/admin/readers');
}

export async function unblockReader(form: FormData) {
  await requireAdmin();
  const id = Number(form.get('id'));
  await db.update(users).set({ blockedAt: null, updatedAt: now() }).where(eq(users.id, id));
  revalidatePath('/admin/readers');
}

/** Undoes a reader closing their own account — see design doc §2's "closing, not deleting". */
export async function restoreReader(form: FormData) {
  await requireAdmin();
  const id = Number(form.get('id'));
  await db.update(users).set({ archivedAt: null, updatedAt: now() }).where(eq(users.id, id));
  revalidatePath('/admin/readers');
}
