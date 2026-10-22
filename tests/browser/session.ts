// Test-only transport boundary. Production still uses the authenticated Supabase session.
export const getSupabase = () => ({ auth: { getSession: async () => ({ data: { session: null } }) } });
