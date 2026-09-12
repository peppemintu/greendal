import type { Metadata } from 'next';
import { Newsreader } from 'next/font/google';
import '@/styles/globals.css';

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-newsreader',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'greendal', template: '%s · greendal' },
  description: 'Thoughts, mostly at night. Recipes, mostly at noon.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={newsreader.variable}>
      <body style={{ fontFamily: `var(--font-newsreader), ${'Georgia, serif'}` }}>{children}</body>
    </html>
  );
}
