import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clientIp, createRateLimiter, isCrossSiteMutation } from '@/lib/security';

// Largest legitimate body: a 2MB upload plus multipart overhead. Bigger requests are refused before buffering.
const MAX_API_BODY_BYTES = 3 * 1024 * 1024;

// Per-IP flood limits (best-effort, per server instance; put Cloudflare rate limiting in front for global limits).
// Deliberately generous: many students share one campus NAT address. Per-user limits live in the routes.
const mutationLimiter = createRateLimiter({ limit: 300, windowMs: 60 * 1000 });
const authLimiter = createRateLimiter({ limit: 300, windowMs: 60 * 1000 });

const tooMany = () =>
  NextResponse.json(
    { error: 'Too Many Requests', message: 'Too many requests. Please slow down and try again shortly.' },
    { status: 429, headers: { 'Retry-After': '60' } }
  );

/**
 * Request proxy (formerly Middleware; renamed in Next.js 16).
 *
 * 1. CSRF: rejects cross-site POST/PATCH/PUT/DELETE requests to any /api route. Auth cookies are SameSite=Lax,
 *    and this same-origin check closes the remaining gaps (sibling subdomains, `text/plain` JSON bodies).
 * 2. Abuse limits on /api: request body size cap and per-IP rate limits for writes and auth endpoints.
 * 3. Optimistic auth gate for /register, /registration, /admin, /api/register and /api/admin: requests that carry
 *    no session at all are bounced early. This is NOT the authorization boundary; every route handler validates
 *    the token with Supabase and checks roles itself.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    if (isCrossSiteMutation(request)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Cross-site requests are not allowed.' },
        { status: 403 }
      );
    }

    if (Number(request.headers.get('content-length') || 0) > MAX_API_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload Too Large' }, { status: 413 });
    }

    const ip = clientIp(request.headers);
    if (pathname.startsWith('/api/auth/') && !authLimiter.hit(ip)) return tooMany();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !mutationLimiter.hit(ip)) return tooMany();
  }

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
    '/api/:path*',
  ],
};
