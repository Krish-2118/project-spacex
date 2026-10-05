import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

/**
 * /register page route
 * Protected by Next.js middleware and server-side cookie check.
 * If authenticated, redirects to the main experience with the registration overlay open.
 * If unauthenticated, redirects to login/signup.
 */
export default async function RegisterPage() {
  const cookieStore = await cookies();
  const hasAuth =
    cookieStore.has('inn_access_token') ||
    cookieStore.has('inn_refresh_token') ||
    cookieStore.getAll().some(
      (c) =>
        c.name.includes('-auth-token') ||
        c.name.includes('supabase-auth') ||
        c.name === 'sb-access-token'
    );

  if (!hasAuth) {
    redirect('/?auth=login&required=register');
  }

  redirect('/?open=register');
}
