import { inArray } from 'drizzle-orm';
import { listPosts, getSettings } from '@/lib/queries';
import { blocksToHtml } from '@/lib/blocks';
import { db } from '@/lib/db';
import { recipes, type Block } from '@/lib/schema';

export const dynamic = 'force-dynamic';

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  );
}

export async function GET() {
  const site = process.env.SITE_URL ?? 'http://localhost:3000';
  const [posts, settings] = await Promise.all([listPosts(30), getSettings()]);

  const parsedBlocks = posts.map((p) => JSON.parse(p.blocks) as Block[]);
  const recipeIds = [
    ...new Set(
      parsedBlocks
        .flat()
        .filter((b): b is Extract<Block, { type: 'ps' }> => b.type === 'ps' && b.recipeId != null)
        .map((b) => b.recipeId!),
    ),
  ];
  const recipeRows = recipeIds.length
    ? await db.select({ id: recipes.id, slug: recipes.slug, title: recipes.title }).from(recipes).where(inArray(recipes.id, recipeIds))
    : [];
  const recipeLinks = new Map(recipeRows.map((r) => [r.id, { slug: r.slug, title: r.title }]));

  const items = posts
    .map(
      (p, i) => `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${site}/thoughts/${p.slug}</link>
      <guid isPermaLink="true">${site}/thoughts/${p.slug}</guid>
      <pubDate>${new Date((p.publishedAt ?? 0) * 1000).toUTCString()}</pubDate>
      <description>${escapeXml(p.dek ?? '')}</description>
      <content:encoded><![CDATA[${blocksToHtml(parsedBlocks[i], recipeLinks, site)}]]></content:encoded>
    </item>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>greendal</title>
    <link>${site}</link>
    <description>${escapeXml(settings.tagline ?? 'thoughts and recipes')}</description>
    <language>en</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
