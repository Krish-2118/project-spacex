import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * POST /api/auth/logout
 * Deletes the user session from the database (user_sessions) and clears all auth cookies.
 */
export async function POST(req: NextRequest) {
  try {
    const accessToken = req.cookies.get('inn_access_token')?.value;

    if (accessToken) {
      try {
        const supabase = getSupabaseAdmin(accessToken);
        const { data: { user } } = await supabase.auth.getUser(accessToken);
        if (user) {
          await supabase
            .from('user_sessions')
            .delete()
            .eq('user_id', user.id);
        }
      } catch {}
    }

    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
    response.cookies.delete('inn_access_token');
    response.cookies.delete('inn_refresh_token');
    response.cookies.delete('inn_session_token');
    return response;
  } catch (err: unknown) {
    console.error('Error in auth logout API:', err);
    const response = NextResponse.json({ success: true });
    response.cookies.delete('inn_access_token');
    response.cookies.delete('inn_refresh_token');
    response.cookies.delete('inn_session_token');
    return response;
  }
}
