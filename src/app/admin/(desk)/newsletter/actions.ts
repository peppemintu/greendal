'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { settings } from '@/lib/schema';
import { requireAdmin } from '@/lib/auth';

type State = { error?: string } | undefined;

export async function saveNewsletterSettings(_prev: State, form: FormData): Promise<State> {
  await requireAdmin();
  const keys = ['newsletterSubject', 'newsletterIntro'];
  for (const key of keys) {
    const value = String(form.get(key) ?? '');
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }
  revalidatePath('/admin/newsletter');
  return { error: undefined };
}
