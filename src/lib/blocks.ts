import type { Block } from './schema';
import { renderMarkdown } from './markdown';

/** Word-counting only — rough, doesn't need to strip markdown syntax perfectly. */
export function blocksToPlainText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      if (b.type === 'text') return b.markdown;
      if (b.type === 'heading') return b.text;
      if (b.type === 'ps') return b.text;
      return '';
    })
    .join(' ');
}

/**
 * Full HTML for feed.xml's <content:encoded> — a plainer rendering than the
 * real page (no width variants, no live recipe lookups beyond what's passed
 * in), which is fine for an RSS reader. Blocks are admin-authored content,
 * same trust level as the old post.body ever was — this is not reader input.
 */
export function blocksToHtml(blocks: Block[], recipeLinks: Map<number, { slug: string; title: string }>, siteUrl: string): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'text':
          return renderMarkdown(b.markdown);
        case 'heading': {
          const tag = `h${b.level}`;
          return `<${tag}>${escapeHtml(b.text)}</${tag}>`;
        }
        case 'image': {
          const caption = b.caption ? `<figcaption>${escapeHtml(b.caption)}</figcaption>` : '';
          return `<figure><img src="${escapeAttr(b.url)}" alt="${escapeAttr(b.alt)}" />${caption}</figure>`;
        }
        case 'divider':
          return '<hr />';
        case 'ps': {
          const recipe = b.recipeId != null ? recipeLinks.get(b.recipeId) : null;
          const link = recipe
            ? ` <a href="${siteUrl}/recipes/${recipe.slug}">the recipe's here</a>.`
            : '';
          return `<p><strong>ps —</strong> ${escapeHtml(b.text)}${link}</p>`;
        }
        default:
          return '';
      }
    })
    .join('\n');
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!);
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;');
}
