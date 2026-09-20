import { notFound } from 'next/navigation';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { posts, recipes, type Block } from '@/lib/schema';
import { PostEditor, type PostDraft } from '@/components/PostEditor';
import { toLocalInput } from '@/lib/datetime';

export const dynamic = 'force-dynamic';

const BLANK: PostDraft = {
  slug: '', title: '', dek: '', blocks: [], status: 'draft', publishedAtLocal: '',
};

export default async function EditThought({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipeOptions = await db
    .select({ id: recipes.id, title: recipes.title, slug: recipes.slug })
    .from(recipes)
    .orderBy(desc(recipes.updatedAt));

  if (id === 'new') return <PostEditor draft={BLANK} recipeOptions={recipeOptions} />;

  const [row] = await db.select().from(posts).where(eq(posts.id, Number(id))).limit(1);
  if (!row) notFound();

  return (
    <PostEditor
      recipeOptions={recipeOptions}
      draft={{
        id: row.id,
        slug: row.slug,
        title: row.title,
        dek: row.dek ?? '',
        blocks: JSON.parse(row.blocks) as Block[],
        status: row.status,
        publishedAtLocal: toLocalInput(row.publishedAt),
      }}
    />
  );
}
