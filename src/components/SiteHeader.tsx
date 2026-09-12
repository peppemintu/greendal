'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Squiggle } from './Squiggle';
import styles from './SiteHeader.module.css';

const LINKS = [
  { href: '/thoughts', label: 'thoughts' },
  { href: '/recipes', label: 'recipes' },
  { href: '/about', label: 'about' },
];

export function SiteHeader({
  variant = 'compact',
  tagline,
}: {
  variant?: 'home' | 'compact';
  tagline?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isHome = variant === 'home';

  return (
    <header className={styles.dark}>
      <div className={`${styles.bar} ${isHome ? '' : styles.barPlain}`}>
        {isHome ? (
          <span className={styles.eyebrow}>{new Date().getFullYear()} · a blog</span>
        ) : (
          <Link href="/" className={styles.wordmarkSmall}>
            greendal
          </Link>
        )}

        <nav className={styles.nav}>
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={styles.navLink}
              data-current={pathname.startsWith(link.href)}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger className={styles.menuButton}>menu</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className={styles.overlay} />
            <Dialog.Content className={styles.sheet}>
              <VisuallyHidden asChild>
                <Dialog.Title>Site menu</Dialog.Title>
              </VisuallyHidden>
              <div className={styles.sheetTop}>
                <Link href="/" className={styles.wordmarkSmall} onClick={() => setOpen(false)}>
                  greendal
                </Link>
                <Dialog.Close className={styles.menuButton} style={{ display: 'block' }}>
                  close
                </Dialog.Close>
              </div>
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={styles.sheetLink}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      {isHome && (
        <div className={styles.hero}>
          <h1 className={styles.wordmark}>greendal</h1>
          <Squiggle width={300} />
          {tagline && <p className={styles.tagline}>{tagline}</p>}
        </div>
      )}
    </header>
  );
}
