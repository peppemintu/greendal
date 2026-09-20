import Link from 'next/link';
import type { Block } from '@/lib/schema';
import { renderMarkdown } from '@/lib/markdown';
import { Squiggle } from './Squiggle';
import styles from './BlockRenderer.module.css';

/**
 * Blocks are admin-authored (the editor is admin-only) — same trust level
 * post.body always had, so text blocks go through dangerouslySetInnerHTML
 * via renderMarkdown same as before. This is not reader input; the escaping
 * discipline that matters for comments doesn't apply here.
 */
export function BlockRenderer({
  blocks,
  recipeLinks,
}: {
  blocks: Block[];
  recipeLinks: Map<number, { slug: string; title: string }>;
}) {
  return (
    <div className="prose">
      {blocks.map((block) => (
        <BlockItem key={block.id} block={block} recipeLinks={recipeLinks} />
      ))}
    </div>
  );
}

function BlockItem({
  block,
  recipeLinks,
}: {
  block: Block;
  recipeLinks: Map<number, { slug: string; title: string }>;
}) {
  switch (block.type) {
    case 'text':
      return (
        <div className={styles.block} dangerouslySetInnerHTML={{ __html: renderMarkdown(block.markdown) }} />
      );

    case 'heading': {
      const Heading = block.level === 2 ? 'h2' : 'h3';
      return <Heading className={styles.block}>{block.text}</Heading>;
    }

    case 'image': {
      const widthClass = block.width === 'wide' ? styles.wide : block.width === 'full' ? styles.full : '';
      return (
        <figure className={`${styles.figure} ${widthClass}`}>
          <img src={block.url} alt={block.alt} />
          {block.caption && <figcaption className={styles.caption}>{block.caption}</figcaption>}
        </figure>
      );
    }

    case 'divider':
      if (block.style === 'squiggle') {
        return (
          <div className={styles.dividerSquiggle}>
            <Squiggle width={140} />
          </div>
        );
      }
      if (block.style === 'dots') {
        return (
          <div className={styles.dividerDots}>
            <span />
            <span />
            <span />
          </div>
        );
      }
      return <hr className={styles.dividerRule} />;

    case 'ps': {
      const recipe = block.recipeId != null ? recipeLinks.get(block.recipeId) : null;
      return (
        <aside className={styles.psBox}>
          <span className={`hand ${styles.psLabel}`}>ps</span>
          <span className={styles.psText}>
            {block.text}
            {recipe && (
              <>
                {' '}
                <Link href={`/recipes/${recipe.slug}`}>the recipe&rsquo;s here</Link>.
              </>
            )}
          </span>
        </aside>
      );
    }

    default:
      return null;
  }
}
