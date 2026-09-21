import Link from 'next/link';
import { logout } from '@/app/(auth)/actions';
import { requireAdmin } from '@/lib/auth';
import styles from '../admin.module.css';

export const metadata = { title: 'writing desk', robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The one place a reader gets stopped from ever seeing the admin UI.
  // Every action under here checks requireAdmin() itself too — this layout
  // guards the page, not the mutations a page's forms submit to.
  await requireAdmin();

  return (
    <>
      <div className={styles.bar}>
        <Link href="/admin" style={{ color: 'var(--mint)', fontSize: 20, textDecoration: 'none' }}>
          greendal <span style={{ fontSize: 13, color: 'var(--sage)' }}>writing desk</span>
        </Link>
        <div className={styles.barLinks}>
          <Link href="/admin/thoughts">thoughts</Link>
          <Link href="/admin/recipes">recipes</Link>
          <Link href="/admin/comments">comments</Link>
          <Link href="/admin/readers">readers</Link>
          <Link href="/admin/newsletter">newsletter</Link>
          <Link href="/admin/settings">site text</Link>
          <Link href="/account">account</Link>
          <Link href="/">view site</Link>
          <form action={logout}>
            <button type="submit">sign out</button>
          </form>
        </div>
      </div>
      <div className={styles.wrap}>{children}</div>
    </>
  );
}
