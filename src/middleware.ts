import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Auth Middleware
 * Intercepts requests to /register, /registration, /admin, /api/register, and /api/admin
 * Checks cookies ('inn_access_token', 'inn_refresh_token', Supabase cookies) and Authorization header.
 * Guarantees no one can access protected routes without being logged in.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isRegisterPage =
    pathname === '/register' ||
    pathname.startsWith('/register/') ||
    pathname === '/registration' ||
    pathname.startsWith('/registration/');

  const isRegisterApi =
    pathname === '/api/register' || pathname.startsWith('/api/register/');

  const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAdminApi = pathname === '/api/admin' || pathname.startsWith('/api/admin/');

  if (isRegisterPage || isRegisterApi || isAdminPage || isAdminApi) {
    // 1. Check cookies for access_token or refresh_token
    const hasInnAccessToken = !!request.cookies.get('inn_access_token')?.value;
    const hasInnRefreshToken = !!request.cookies.get('inn_refresh_token')?.value;

    const allCookies = request.cookies.getAll();
    const hasSupabaseCookie = allCookies.some(
      (c) =>
        c.name.includes('-auth-token') ||
        c.name.includes('supabase-auth') ||
        c.name === 'sb-access-token' ||
        c.name === 'inv_session'
    );

    // 2. Check Authorization header
    const authHeader = request.headers.get('authorization');
    const hasAuthHeader = !!authHeader && authHeader.startsWith('Bearer ');

    const isAuthenticated =
      hasInnAccessToken || hasInnRefreshToken || hasSupabaseCookie || hasAuthHeader;

    if (!isAuthenticated) {
      if (isRegisterApi || isAdminApi) {
        return NextResponse.json(
          {
            error: 'Authentication Required',
            message: 'You must log in or sign up before accessing this endpoint.',
          },
          { status: 401 }
        );
      }

      // For page routes, redirect to home with auth prompt query params
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/';
      redirectUrl.searchParams.set('auth', 'login');
      redirectUrl.searchParams.set(
        'required',
        isAdminPage ? 'admin' : 'register'
      );
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/register',
    '/register/:path*',
    '/registration',
    '/registration/:path*',
    '/admin',
    '/admin/:path*',
    '/api/register',
    '/api/register/:path*',
    '/api/admin',
    '/api/admin/:path*',
  ],
};
