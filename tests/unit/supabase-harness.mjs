// Minimal local stand-in for a Supabase project, used to exercise supabase/schema.sql (RLS, triggers, grants)
// with real Postgres semantics via PGlite. Mirrors what matters for authorization:
//   * roles anon / authenticated / service_role (BYPASSRLS), with Supabase's default grants on `public`;
//   * auth.users plus auth.uid() / auth.role() / auth.jwt(), driven by request.jwt.claim.* settings as PostgREST does.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const SUPABASE_BOOTSTRAP = `
CREATE ROLE anon NOLOGIN NOINHERIT;
CREATE ROLE authenticated NOLOGIN NOINHERIT;
CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;

CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id UUID PRIMARY KEY,
  email TEXT,
  phone TEXT,
  email_confirmed_at TIMESTAMPTZ,
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb
);

CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')::text
$$;
CREATE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('sub', auth.uid(), 'role', auth.role())
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
`;

export const SCHEMA_SQL = readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8');

/**
 * Fresh database with supabase/schema.sql applied. `beforeSchema(db)` runs first, to simulate upgrading a database
 * that was created by an older version of the script.
 */
export async function createDb({ runSchemaTwice = false, beforeSchema } = {}) {
  const db = await PGlite.create();
  await db.exec(SUPABASE_BOOTSTRAP);
  if (beforeSchema) await beforeSchema(db);
  await db.exec(SCHEMA_SQL);
  if (runSchemaTwice) await db.exec(SCHEMA_SQL);
  return db;
}

let n = 0;
/** Creates an auth user the way GoTrue would (no JWT claims => trusted context); returns its id. */
export async function signUp(db, email, { confirmed = true, meta = {} } = {}) {
  n += 1;
  const id = `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  await db.query(
    'INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES ($1, $2, $3, $4)',
    [id, email, confirmed ? new Date().toISOString() : null, JSON.stringify(meta)]
  );
  return id;
}

/** Dashboard / SQL editor context (superuser, no JWT). */
export async function asOwner(db, sql, params) {
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', '', false);`);
  return db.query(sql, params);
}

/**
 * Runs one statement as a PostgREST request would: SET ROLE to the JWT role, with the JWT claims set.
 * `who` is { role: 'anon' | 'authenticated' | 'service_role', id?: uuid }.
 */
export async function as(db, who, sql, params) {
  await db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub', '${who.id ?? ''}', false), ` +
      `set_config('request.jwt.claim.role', '${who.role}', false); SET ROLE ${who.role};`
  );
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('RESET ROLE');
  }
}

/** Like `as`, but resolves to the error message (or null if the statement succeeded). */
export async function errorOf(db, who, sql, params) {
  try {
    await as(db, who, sql, params);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
