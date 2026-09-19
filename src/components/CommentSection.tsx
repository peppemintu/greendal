'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCurrentUser } from '@/lib/UserContext';
import { CommentNode } from './CommentNode';
import { CommentForm } from './CommentForm';
import type { ThreadNode } from '@/lib/comments';
import styles from './CommentSection.module.css';

export function CommentSection({
  target,
  nodes,
  visibleCount,
}: {
  target: { postId: number } | { recipeId: number };
  nodes: ThreadNode[];
  visibleCount: number;
}) {
  const user = useCurrentUser();
  const pathname = usePathname();
  const next = encodeURIComponent(pathname);

  return (
    <section className={styles.section} id="comments">
      <div className="sectionMark">
        <span className="hand">
          {visibleCount === 0 ? 'say something' : `${visibleCount} comment${visibleCount === 1 ? '' : 's'}`}
        </span>
      </div>

      {nodes.length === 0 ? (
        <p className={styles.empty}>Nobody&rsquo;s said anything yet.</p>
      ) : (
        <div className={styles.list}>
          {nodes.map((node) => (
            <CommentNode key={node.id} node={node} target={target} />
          ))}
        </div>
      )}

      <div className={styles.writeBox}>
        {!user && (
          <p className={styles.prompt}>
            <Link href={`/login?next=${next}`}>sign in</Link> or{' '}
            <Link href={`/register?next=${next}`}>make an account</Link> to leave a comment.
          </p>
        )}
        {user && !user.emailVerified && (
          <p className={styles.prompt}>
            Confirm your email to comment — see your <Link href="/account">account page</Link>.
          </p>
        )}
        {user?.emailVerified && <CommentForm target={target} />}
      </div>
    </section>
  );
}
