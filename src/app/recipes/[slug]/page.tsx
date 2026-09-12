import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { RecipeDetail } from '@/components/RecipeDetail';
import { getRecipe, getSettings } from '@/lib/queries';
import type { Ingredient, Step } from '@/lib/schema';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const recipe = await getRecipe((await params).slug);
  if (!recipe) return { title: 'not found' };
  return {
    title: recipe.title,
    description: recipe.intro ?? undefined,
    openGraph: {
      title: recipe.title,
      description: recipe.intro ?? undefined,
      images: recipe.heroImage ? [recipe.heroImage] : undefined,
    },
  };
}

export default async function RecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const recipe = await getRecipe(slug);
  if (!recipe || recipe.status !== 'published') notFound();
  const settings = await getSettings();

  return (
    <>
      <SiteHeader />
      <main className="shell" style={{ paddingTop: 44 }}>
        <RecipeDetail
          recipe={{
            title: recipe.title,
            intro: recipe.intro,
            heroImage: recipe.heroImage,
            handsOnMinutes: recipe.handsOnMinutes,
            totalMinutes: recipe.totalMinutes,
            baseServings: recipe.baseServings,
            yieldLabel: recipe.yieldLabel,
            ingredients: JSON.parse(recipe.ingredients) as Ingredient[],
            steps: JSON.parse(recipe.steps) as Step[],
            pullNote: recipe.pullNote,
            headnote: recipe.headnote,
          }}
        />
      </main>
      <SiteFooter note={settings.footerNote} />
    </>
  );
}
