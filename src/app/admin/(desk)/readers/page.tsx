import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, comments } from '@/lib/schema';
import { blockReader, unblockReader, restoreReader } from './actions';
import { shortDate } from '@/lib/format';
import styles from '../../admin.module.css';

export const dynamic = 'force-dynamic';

type Filter = 'active' | 'blocked' | 'archived';
const FILTERS: Filter[] = ['active', 'blocked', 'archived'];

export default async function AdminReadersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: rawFilter } = await searchParams;
  const filter: Filter = (FILTERS as string[]).includes(rawFilter ?? '') ? (rawFilter as Filter) : 'active';

  // role='reader' only — the one admin account doesn't belong in this list.
  const readers = await db.select().from(users).where(eq(users.role, 'reader')).orderBy(desc(users.createdAt));

  const commentRows = await db.select({ authorId: comments.authorId }).from(comments);
  const countByAuthor = new Map<number, number>();
  for (const c of commentRows) countByAuthor.set(c.authorId, (countByAuthor.get(c.authorId) ?? 0) + 1);

  const filtered = readers.filter((r) => {
    if (filter === 'blocked') return Boolean(r.blockedAt);
    if (filter === 'archived') return Boolean(r.archivedAt);
    return !r.blockedAt && !r.archivedAt;
  });

  return (
    <>
      <div className="sectionMark">
        <span className="hand">readers</span>
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 24, fontSize: 13.5 }}>
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === 'active' ? '/admin/readers' : `/admin/readers?filter=${f}`}
            style={{
              textDecoration: filter === f ? 'underline' : 'none',
              color: filter === f ? 'var(--rust)' : 'var(--ink-quiet)',
            }}
          >
            {f}
          </Link>
        ))}
      </div>

      {filtered.length === 0 && <p style={{ color: 'var(--ink-quiet)', fontSize: 15 }}>Nobody here.</p>}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {filtered.map((r) => (
          <div key={r.id} className={styles.listRow} style={{ flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 16 }}>{r.displayName}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-quiet)', marginTop: 2 }}>
                {r.email} · {r.emailVerifiedAt ? 'confirmed' : 'unconfirmed'} ·{' '}
                {countByAuthor.get(r.id) ?? 0} comment{(countByAuthor.get(r.id) ?? 0) === 1 ? '' : 's'} · joined{' '}
                {shortDate(r.createdAt)}
              </div>
            </div>
            <div>
              {r.archivedAt ? (
                <form action={restoreReader}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className={styles.buttonSmall} type="submit">
                    restore
                  </button>
                </form>
              ) : r.blockedAt ? (
                <form action={unblockReader}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className={styles.buttonSmall} type="submit">
                    unblock
                  </button>
                </form>
              ) : (
                <form action={blockReader}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className={styles.buttonSmall} type="submit">
                    block
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
