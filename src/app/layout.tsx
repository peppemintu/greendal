import type { Metadata } from 'next';
import { Newsreader } from 'next/font/google';
import { getCurrentUser } from '@/lib/auth';
import { UserProvider, type PublicUser } from '@/lib/UserContext';
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentUser();
  const user: PublicUser | null = currentUser && {
    displayName: currentUser.displayName,
    role: currentUser.role,
    emailVerified: Boolean(currentUser.emailVerifiedAt),
  };

  return (
    <html lang="en" className={newsreader.variable}>
      <body style={{ fontFamily: `var(--font-newsreader), ${'Georgia, serif'}` }}>
        <UserProvider user={user}>{children}</UserProvider>
      </body>
    </html>
  );
}
