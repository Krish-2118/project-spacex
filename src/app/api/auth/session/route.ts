import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * GET /api/auth/session
 * Validates session using cookies 'inn_access_token' and 'inn_refresh_token'.
 * ZERO tokens or keys in browser localStorage.
 */
export async function GET(req: NextRequest) {
  try {
    const accessToken = req.cookies.get('inn_access_token')?.value;
    const refreshToken = req.cookies.get('inn_refresh_token')?.value;

    if (!accessToken && !refreshToken) {
      return NextResponse.json({ success: false, session: null, user: null });
    }

    const supabase = getSupabaseAdmin();
    let activeUser = null;
    let currentAccessToken = accessToken;
    let currentRefreshToken = refreshToken;

    if (accessToken) {
      const userResult = await supabase.auth.getUser(accessToken);
      if (userResult.data?.user) {
        activeUser = userResult.data.user;
      }
    }

    // If access token has expired and refresh token is available, attempt token refresh
    if (!activeUser && currentRefreshToken) {
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession({
        refresh_token: currentRefreshToken,
      });

      if (!refreshErr && refreshed.session && refreshed.user) {
        currentAccessToken = refreshed.session.access_token;
        currentRefreshToken = refreshed.session.refresh_token;
        activeUser = refreshed.user;

        // Store ONLY the refresh_token in the database
        await supabase
          .from('user_sessions')
          .upsert(
            {
              user_id: activeUser.id,
              refresh_token: currentRefreshToken,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );
      }
    }

    if (!activeUser) {
      const res = NextResponse.json({ success: false, session: null, user: null });
      res.cookies.delete('inn_access_token');
      res.cookies.delete('inn_refresh_token');
      return res;
    }

    // Fetch user profile from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', activeUser.id)
      .maybeSingle();

    const res = NextResponse.json({
      success: true,
      user: profile || null,
      tokens: {
        access_token: currentAccessToken,
        refresh_token: currentRefreshToken,
      },
    });

    if (currentAccessToken) {
      res.cookies.set('inn_access_token', currentAccessToken, {
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    if (currentRefreshToken) {
      res.cookies.set('inn_refresh_token', currentRefreshToken, {
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return res;
  } catch (err: unknown) {
    console.error('Error fetching session:', err);
    const message = err instanceof Error ? err.message : 'Failed to fetch session';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/session
 * Stores ONLY the refresh_token in the database (user_sessions).
 * Stores access_token and refresh_token as cookies.
 * ZERO tokens in browser localStorage.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accessToken, refreshToken, userId } = body;

    if (!accessToken || !userId) {
      return NextResponse.json(
        { error: 'Missing accessToken or userId' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin(accessToken);

    // Verify token validity with Supabase Auth
    const { data: { user }, error: authErr } = await supabase.auth.getUser(accessToken);
    if (authErr || !user || user.id !== userId) {
      return NextResponse.json(
        { error: 'Invalid or mismatched auth credentials' },
        { status: 401 }
      );
    }

    // Ensure user profile exists in profiles table (admin client, no RLS issue)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!existingProfile) {
      const email = user.email || '';
      const isInternal = email.toLowerCase().endsWith('@nitrkl.ac.in');
      await supabase.from('profiles').upsert(
        {
          id: user.id,
          email,
          full_name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            email.split('@')[0] ||
            'Explorer',
          avatar_url:
            user.user_metadata?.avatar_url ||
            user.user_metadata?.picture ||
            '',
          student_type: isInternal ? 'internal' : 'external',
          role: 'user',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    }

    // Store ONLY the refresh_token in database (user_sessions table)
    if (refreshToken) {
      const { error: dbErr } = await supabase
        .from('user_sessions')
        .upsert(
          {
            user_id: user.id,
            refresh_token: refreshToken,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (dbErr) {
        console.warn('user_sessions DB insert notice:', dbErr.message);
      }
    }

    const response = NextResponse.json({
      success: true,
      message: 'Tokens stored as cookies and refresh token saved in database',
      sessionStoredInDb: true,
    });

    // Store access_token as cookie (7 days)
    response.cookies.set('inn_access_token', accessToken, {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
    });

    // Store refresh_token as cookie (30 days)
    if (refreshToken) {
      response.cookies.set('inn_refresh_token', refreshToken, {
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch (err: unknown) {
    console.error('Error saving session:', err);
    const message = err instanceof Error ? err.message : 'Failed to save session';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
