import { listPosts, getSettings } from '@/lib/queries';
import { renderMarkdown } from '@/lib/markdown';

export const dynamic = 'force-dynamic';

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  );
}

export async function GET() {
  const site = process.env.SITE_URL ?? 'http://localhost:3000';
  const [posts, settings] = await Promise.all([listPosts(30), getSettings()]);

  const items = posts
    .map(
      (p) => `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${site}/thoughts/${p.slug}</link>
      <guid isPermaLink="true">${site}/thoughts/${p.slug}</guid>
      <pubDate>${new Date((p.publishedAt ?? 0) * 1000).toUTCString()}</pubDate>
      <description>${escapeXml(p.dek ?? '')}</description>
      <content:encoded><![CDATA[${renderMarkdown(p.body)}]]></content:encoded>
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
