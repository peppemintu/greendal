'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { settings } from '@/lib/schema';
import { requireAdmin } from '@/lib/auth';

type State = { error?: string } | undefined;

function intInRange(raw: FormDataEntryValue | null, min: number, max: number): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export async function saveNewsletterSettings(_prev: State, form: FormData): Promise<State> {
  await requireAdmin();

  const day = intInRange(form.get('newsletterSendDay'), 0, 6);
  const hour = intInRange(form.get('newsletterSendHour'), 0, 23);
  if (day === null || hour === null) {
    return { error: 'Pick a valid send day and hour.' };
  }

  const values: Record<string, string> = {
    newsletterSubject: String(form.get('newsletterSubject') ?? ''),
    newsletterIntro: String(form.get('newsletterIntro') ?? ''),
    newsletterSendDay: String(day),
    newsletterSendHour: String(hour),
  };
  for (const [key, value] of Object.entries(values)) {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }
  revalidatePath('/admin/newsletter');
  return { error: undefined };
}
