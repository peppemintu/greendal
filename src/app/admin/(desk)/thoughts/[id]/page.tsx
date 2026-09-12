import { notFound } from 'next/navigation';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { posts, recipes } from '@/lib/schema';
import { PostForm, type PostDraft } from '@/components/PostForm';
import { toLocalInput } from '@/lib/datetime';

export const dynamic = 'force-dynamic';

const BLANK: PostDraft = {
  slug: '', title: '', dek: '', body: '', status: 'draft',
  publishedAtLocal: '', psRecipeId: '', psText: '',
};

export default async function EditThought({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipeOptions = await db
    .select({ id: recipes.id, title: recipes.title })
    .from(recipes)
    .orderBy(desc(recipes.updatedAt));

  if (id === 'new') return <PostForm draft={BLANK} recipeOptions={recipeOptions} />;

  const [row] = await db.select().from(posts).where(eq(posts.id, Number(id))).limit(1);
  if (!row) notFound();

  return (
    <PostForm
      recipeOptions={recipeOptions}
      draft={{
        id: row.id,
        slug: row.slug,
        title: row.title,
        dek: row.dek ?? '',
        body: row.body,
        status: row.status,
        publishedAtLocal: toLocalInput(row.publishedAt),
        psRecipeId: row.psRecipeId ? String(row.psRecipeId) : '',
        psText: row.psText ?? '',
      }}
    />
  );
}
