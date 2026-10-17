import { NextResponse, type NextRequest } from 'next/server';

const COOKIE = 'greendal_session';
/** Keep in sync with SESSION_MAX_AGE in src/lib/auth.ts. */
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Two jobs:
 *
 * 1. Optimistic gate for /admin and /account: this runs on the Edge runtime,
 *    which can't reach the database, so all it can confirm is that a session
 *    cookie exists — not that it's still valid, unexpired, or belongs to an
 *    admin. The authoritative check is getCurrentUser() in src/lib/auth.ts,
 *    called by every page and action that cares who's asking. This just
 *    keeps a logged-out visitor from loading the page at all.
 *
 * 2. Sliding cookie expiry: getCurrentUser() runs during Server Component
 *    rendering (the root layout), where Next.js forbids setting cookies —
 *    doing so throws and takes the whole page down. So the browser cookie's
 *    lifetime is pushed forward here instead, on every page request, while
 *    getCurrentUser() only extends the session row in the database. The
 *    database expiry stays authoritative; a cookie outliving its row is
 *    just ignored.
 */
export function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE)?.value;
  const { pathname } = request.nextUrl;
  const isProtected = pathname.startsWith('/admin') || pathname.startsWith('/account');

  if (!token) {
    if (!isProtected) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  response.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

export const config = {
  // Every page, but not static assets, images or uploads.
  matcher: ['/((?!_next/static|_next/image|uploads/|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js)$).*)'],
};
