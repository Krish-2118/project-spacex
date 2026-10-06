import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  phone: string | null;
  student_type: 'internal' | 'external';
  role: 'user' | 'it-team' | 'admin';
  enrollment_no?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Registration {
  id?: string;
  registration_id: string;
  user_id: string;
  name: string;
  email: string;
  college: string;
  phone: string;
  enrollment_no?: string | null;
  student_type: 'internal' | 'external';
  gender: 'male' | 'female' | 'others';
  payment_screenshot_url?: string | null;
  utr?: string | null;
  amount: number;
  status: 'pending' | 'confirmed' | 'rejected';
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type EventCategory = 'flagship events' | 'main events' | 'fun events' | 'dts events';

export interface EventItem {
  id?: string;
  title: string;
  description: string;
  poster_url: string;
  brochure_url?: string | null; // Optional Google Drive link
  category: EventCategory;
  format?: string;
  duration?: string;
  venue?: string;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface GalleryPhoto {
  id?: string;
  title?: string | null;
  image_url: string;
  file_id?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type GalleryItem = GalleryPhoto;

// Cookie-based storage adapter for Supabase Client: ZERO tokens or keys ever touch browser localStorage
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const nameEQ = encodeURIComponent(name) + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1);
    if (c.indexOf(nameEQ) === 0) {
      try {
        return decodeURIComponent(c.substring(nameEQ.length));
      } catch {
        return c.substring(nameEQ.length);
      }
    }
  }
  return null;
}

function setCookie(name: string, value: string, days = 7) {
  if (typeof document === 'undefined') return;
  const isHttps = typeof location !== 'undefined' && location.protocol === 'https:';
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${isHttps ? '; Secure' : ''}`;
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0; SameSite=Lax`;
}

export const cookieStorage = {
  getItem: (key: string): string | null => {
    return getCookie(key);
  },
  setItem: (key: string, value: string): void => {
    setCookie(key, value, 30);
    try {
      if (key.includes('-auth-token') && !key.includes('code-verifier')) {
        const parsed = JSON.parse(value);
        if (parsed.access_token) {
          setCookie('inn_access_token', parsed.access_token, 7);
        }
        if (parsed.refresh_token) {
          setCookie('inn_refresh_token', parsed.refresh_token, 30);
        }
      }
    } catch {}
  },
  removeItem: (key: string): void => {
    deleteCookie(key);
    if (key.includes('-auth-token') && !key.includes('code-verifier')) {
      deleteCookie('inn_access_token');
      deleteCookie('inn_refresh_token');
    }
  },
};

/**
 * Actively cleans out any residual tokens or auth keys from browser localStorage
 */
export function purgeLocalStorageTokens(): void {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith('sb-') ||
          k.includes('token') ||
          k.includes('auth') ||
          k === 'inv_login_intent')
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

// Client-side singleton Supabase client
let clientInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (clientInstance) return clientInstance;
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase URL or Key is missing in environment variables.');
  }

  // Purge any stale tokens from localStorage immediately
  purgeLocalStorageTokens();

  clientInstance = createClient(supabaseUrl, supabaseKey, {
    auth: {
      storage: cookieStorage, // Store PKCE code & tokens strictly in cookies; ZERO in localStorage!
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });
  return clientInstance;
}

/**
 * Strips sensitive auth tokens (access_token, refresh_token, code) from the browser URL address bar
 */
export function cleanAuthUrl() {
  if (typeof window === 'undefined') return;
  try {
    const hash = window.location.hash;
    const search = window.location.search;
    let urlChanged = false;

    let newHash = hash;
    if (hash && (hash.includes('access_token=') || hash.includes('refresh_token='))) {
      newHash = '';
      urlChanged = true;
    }

    let newSearch = search;
    if (
      search &&
      (search.includes('access_token=') ||
        search.includes('refresh_token=') ||
        search.includes('code=') ||
        search.includes('type='))
    ) {
      const params = new URLSearchParams(search);
      params.delete('access_token');
      params.delete('refresh_token');
      params.delete('expires_in');
      params.delete('token_type');
      params.delete('type');
      params.delete('code');
      const paramStr = params.toString();
      newSearch = paramStr ? `?${paramStr}` : '';
      urlChanged = true;
    }

    if (urlChanged) {
      const cleanUrl = window.location.pathname + newSearch + newHash;
      window.history.replaceState(null, '', cleanUrl);
    }
  } catch (err) {
    console.warn('cleanAuthUrl error:', err);
  }
}

// Helper to get server/admin client (with service role if available, or scoped to user token)
export function getSupabaseAdmin(token?: string): SupabaseClient {
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (serviceKey) {
    return createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  });
}

/**
 * Initiates Google OAuth with Supabase.
 * If internalOnly is true:
 * - passes `hd: nitrkl.ac.in` to hint Google to select @nitrkl.ac.in account
 * - records the internal intent to validate upon callback (in sessionStorage, NEVER localStorage)
 */
/** Public site OAuth returns to. Must also be listed in Supabase -> Authentication -> URL Configuration. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://project-spacex-seven.vercel.app').replace(/\/+$/, '');

/** Where Google sends the visitor back: the deployed site, or this machine when running locally (the PKCE verifier cookie lives there). */
export function getAuthRedirectUrl(): string {
  if (typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)) {
    return `${window.location.origin}/`;
  }
  return `${SITE_URL}/`;
}

export async function signInWithGoogle(options?: { internalOnly?: boolean }) {
  const supabase = getSupabase();
  const redirectTo = getAuthRedirectUrl();

  const queryParams: Record<string, string> = {
    prompt: 'select_account',
  };

  if (options?.internalOnly) {
    queryParams.hd = 'nitrkl.ac.in';
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('inv_login_intent', 'internal');
    }
  } else {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('inv_login_intent', 'external');
    }
  }

  // Ensure localStorage is 100% clean before starting OAuth
  purgeLocalStorageTokens();

  return await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams,
    },
  });
}

/**
 * Sign out current user from DB sessions, clear cookies, and reset auth state
 */
export async function signOutUser() {
  const supabase = getSupabase();
  // The logout request captures the auth cookies when it is sent, so the server can still drop the DB session.
  const serverLogout = fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
  // Revoke the Supabase session, but never let a slow network or a held auth lock keep the visitor signed in.
  const clientLogout = supabase.auth.signOut().catch((err) => ({ error: err }));
  const result = await Promise.race([
    Promise.all([serverLogout, clientLogout]).then(([, r]) => r),
    new Promise<{ error: null }>((res) => setTimeout(() => res({ error: null }), 3000)),
  ]);

  deleteCookie('inn_access_token');
  deleteCookie('inn_refresh_token');
  deleteCookie('inn_session_token');

  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';');
    for (const c of cookies) {
      const eqPos = c.indexOf('=');
      const name = eqPos > -1 ? c.substring(0, eqPos).trim() : c.trim();
      if (name.startsWith('sb-') || name.includes('auth') || name.includes('token')) {
        deleteCookie(name);
      }
    }
  }

  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('inv_login_intent');
    purgeLocalStorageTokens();
    // Cached registrations hold personal data (phone, UTR, proof URLs): don't leave them on shared computers.
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('inv_reg_')) localStorage.removeItem(k);
      }
    } catch {}
  }
  return result;
}

/**
 * Persists the user's active session and tokens into the database (user_sessions)
 * Sets an HttpOnly cookie so tokens never live in browser localStorage.
 */
export async function saveSessionToDatabase(session: Session | null): Promise<boolean> {
  if (!session || !session.access_token || !session.user) return false;
  try {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: session.access_token,
        refreshToken: session.refresh_token || null,
        expiresAt: session.expires_at || null,
        userId: session.user.id,
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn('saveSessionToDatabase error:', err);
    return false;
  }
}

/**
 * Fetches the user session directly from the database using the HttpOnly cookie.
 */
export async function fetchSessionFromDatabase(): Promise<{
  user: UserProfile | null;
  tokens: { access_token: string; refresh_token?: string } | null;
}> {
  try {
    const res = await fetch('/api/auth/session');
    if (!res.ok) return { user: null, tokens: null };
    const data = await res.json();
    if (data.success && data.user) {
      return { user: data.user, tokens: data.tokens || null };
    }
    return { user: null, tokens: null };
  } catch (err) {
    console.warn('fetchSessionFromDatabase error:', err);
    return { user: null, tokens: null };
  }
}

/**
 * Fetch or initialize user profile from profiles table
 */
export async function getOrCreateUserProfile(user: User | null): Promise<UserProfile | null> {
  const supabase = getSupabase();
  if (!user || !user.id) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (data && !error) {
      return data as UserProfile;
    }

    // Determine initial student type from email
    const email = user.email || '';
    const isInternal = email.toLowerCase().endsWith('@nitrkl.ac.in');
    const studentType = isInternal ? 'internal' : 'external';
    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      email.split('@')[0] ||
      'Explorer';

    const avatarUrl =
      user.user_metadata?.avatar_url ||
      user.user_metadata?.picture ||
      '';

    const phone =
      user.user_metadata?.phone ||
      user.phone ||
      null;

    // If not found via client select, use server API to securely initialize/fetch profile
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          userId: user.id,
          email,
          fullName,
          avatarUrl,
          phone,
          studentType,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.profile) {
          return json.profile as UserProfile;
        }
      }
    } catch (apiErr) {
      console.warn('/api/auth/profile fallback failed:', apiErr);
    }

    // Secondary fallback: attempt direct client select/upsert
    const newProfile: Partial<UserProfile> = {
      id: user.id,
      email,
      full_name: fullName,
      avatar_url: avatarUrl,
      phone,
      student_type: studentType,
      role: 'user',
    };

    const { data: inserted, error: insertError } = await supabase
      .from('profiles')
      .upsert(newProfile)
      .select()
      .maybeSingle();

    if (insertError) {
      if (insertError.code === '23503') {
        console.warn('Stale session detected: user ID not found in auth.users. Purging invalid session...');
        await supabase.auth.signOut();
        return null;
      }
      console.warn('Client direct profile insert notice:', insertError.message);
      return null;
    }

    return inserted as UserProfile;
  } catch (err) {
    console.error('Error in getOrCreateUserProfile:', err);
    return null;
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>
): Promise<{ success: boolean; error?: string; profile?: UserProfile }> {
  const supabase = getSupabase();
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, profile: data as UserProfile };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update profile';
    return { success: false, error: message };
  }
}

/**
 * Fetch existing registration for a user with local caching and server fallback
 */
export async function fetchUserRegistration(userId: string, email?: string): Promise<Registration | null> {
  // Check local cache first for instant rendering
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(`inv_reg_${userId}`) || (email ? localStorage.getItem(`inv_reg_${email}`) : null);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.registration_id || parsed.id)) {
          // Re-verify in background with server
          setTimeout(() => {
            fetchUserRegistrationServer(userId, email);
          }, 50);
          return parsed as Registration;
        }
      }
    } catch {
      // Ignore cache errors
    }
  }

  return fetchUserRegistrationServer(userId, email);
}

export async function fetchUserRegistrationServer(userId: string, email?: string): Promise<Registration | null> {
  const supabase = getSupabase();
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    // 1. Try server endpoint which bypasses client RLS policies
    const res = await fetch('/api/register', {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (res.ok) {
      const result = await res.json();
      if (result.success && result.registration) {
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`inv_reg_${userId}`, JSON.stringify(result.registration));
            if (email) localStorage.setItem(`inv_reg_${email}`, JSON.stringify(result.registration));
          } catch {}
        }
        return result.registration as Registration;
      }
    }
  } catch (apiErr) {
    console.warn('API /api/register GET error, falling back to direct query:', apiErr);
  }

  // 2. Fallback: direct Supabase query
  try {
    const { data, error } = await supabase
      .from('registrations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Error fetching registration:', error);
      return null;
    }
    if (data && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`inv_reg_${userId}`, JSON.stringify(data));
      } catch {}
    }
    return data as Registration;
  } catch (err) {
    console.error('Registration fetch failed:', err);
    return null;
  }
}

/**
 * Create a new registration
 * Passes through /api/register which is protected by server auth middleware
 */
export async function createRegistration(
  regData: Omit<Registration, 'id' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; registration?: Registration; alreadyRegistered?: boolean; error?: string }> {
  try {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(regData),
    });

    const result = await res.json();
    if (!res.ok) {
      if (result.registration) {
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`inv_reg_${regData.user_id}`, JSON.stringify(result.registration));
            if (regData.email) localStorage.setItem(`inv_reg_${regData.email}`, JSON.stringify(result.registration));
          } catch {}
        }
        return { success: true, registration: result.registration, alreadyRegistered: true };
      }
      return { success: false, error: result.message || result.error || 'Registration failed' };
    }

    if (result.registration && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`inv_reg_${regData.user_id}`, JSON.stringify(result.registration));
        if (regData.email) localStorage.setItem(`inv_reg_${regData.email}`, JSON.stringify(result.registration));
      } catch {}
    }
    return { success: true, registration: result.registration, alreadyRegistered: !!result.alreadyRegistered };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create registration';
    return { success: false, error: message };
  }
}

