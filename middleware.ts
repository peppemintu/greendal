import { NextResponse, type NextRequest } from 'next/server';

const COOKIE = 'greendal_session';

/**
 * Optimistic gate only: this runs on the Edge runtime, which can't reach
 * the database, so all it can confirm is that a session cookie exists — not
 * that it's still valid, unexpired, or belongs to an admin. The
 * authoritative check is getCurrentUser() in src/lib/auth.ts, called by
 * every page and action that cares who's asking. This just keeps a
 * logged-out visitor from loading the page at all.
 */
export function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE)?.value;
  if (token) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/admin/:path*', '/account/:path*'] };
