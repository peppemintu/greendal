import type { Metadata } from 'next';

// Covers /login /register /forgot /reset /verify in one place — none of
// them belong in search results, and none can export metadata themselves
// since they're 'use client' pages (except verify, which inherits this too).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
