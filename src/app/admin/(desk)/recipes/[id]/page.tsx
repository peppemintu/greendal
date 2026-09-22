import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes, type Ingredient, type Step } from '@/lib/schema';
import { RecipeForm, type RecipeDraft } from '@/components/RecipeForm';
import { toLocalInput } from '@/lib/datetime';

export const dynamic = 'force-dynamic';

const BLANK: RecipeDraft = {
  slug: '', title: '', intro: '', heroImage: '',
  handsOnMinutes: '', handsOnApprox: false, totalMinutes: '', totalApprox: false, baseServings: '2',
  yieldLabel: '{n} as dinner', ingredients: [], steps: [],
  pullNote: '', headnote: '', status: 'draft', publishedAtLocal: '',
};

export default async function EditRecipe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === 'new') return <RecipeForm draft={BLANK} />;

  const [row] = await db.select().from(recipes).where(eq(recipes.id, Number(id))).limit(1);
  if (!row) notFound();

  return (
    <RecipeForm
      draft={{
        id: row.id,
        slug: row.slug,
        title: row.title,
        intro: row.intro ?? '',
        heroImage: row.heroImage ?? '',
        handsOnMinutes: row.handsOnMinutes ? String(row.handsOnMinutes) : '',
        handsOnApprox: Boolean(row.handsOnApprox),
        totalMinutes: row.totalMinutes ? String(row.totalMinutes) : '',
        totalApprox: Boolean(row.totalApprox),
        baseServings: String(row.baseServings),
        yieldLabel: row.yieldLabel,
        ingredients: JSON.parse(row.ingredients) as Ingredient[],
        steps: JSON.parse(row.steps) as Step[],
        pullNote: row.pullNote ?? '',
        headnote: row.headnote ?? '',
        status: row.status,
        publishedAtLocal: toLocalInput(row.publishedAt),
      }}
    />
  );
}
