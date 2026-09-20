'use client';

import Link from 'next/link';
import styles from '@/app/admin/admin.module.css';

export function AdminEntryRow({
  id,
  title,
  editHref,
  publicHref,
  statusLabel,
  count,
  archived,
  archiveAction,
  unarchiveAction,
}: {
  id: number;
  title: string;
  editHref: string;
  publicHref: string | null;
  statusLabel: string;
  count: number;
  archived: boolean;
  archiveAction: (form: FormData) => void;
  unarchiveAction: (form: FormData) => void;
}) {
  return (
    <div className={styles.listRow} style={{ flexWrap: 'wrap', gap: 12 }}>
      <div>
        <Link href={editHref} style={{ fontSize: 17, textDecoration: 'none', color: 'var(--ink)' }}>
          {title}
        </Link>
        <div style={{ fontSize: 12.5, color: 'var(--ink-quiet)', marginTop: 2 }}>
          {statusLabel} · {count} comment{count === 1 ? '' : 's'}
          {publicHref && (
            <>
              {' · '}
              <Link href={publicHref}>view on site</Link>
            </>
          )}
        </div>
      </div>
      <div>
        {archived ? (
          <form action={unarchiveAction}>
            <input type="hidden" name="id" value={id} />
            <button className={styles.buttonSmall} type="submit">
              restore
            </button>
          </form>
        ) : (
          <form
            action={archiveAction}
            onSubmit={(e) => {
              if (!confirm(`Archive "${title}"? It disappears from the site but stays in the archive.`)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={id} />
            <button className={styles.buttonSmall} type="submit">
              archive
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
