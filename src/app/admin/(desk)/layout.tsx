import Link from 'next/link';
import { logout } from '../actions';
import styles from '../admin.module.css';

export const metadata = { title: 'writing desk', robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className={styles.bar}>
        <Link href="/admin" style={{ color: 'var(--mint)', fontSize: 20, textDecoration: 'none' }}>
          greendal <span style={{ fontSize: 13, color: 'var(--sage)' }}>writing desk</span>
        </Link>
        <div className={styles.barLinks}>
          <Link href="/admin/settings">site text</Link>
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
