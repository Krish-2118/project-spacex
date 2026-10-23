-- ==============================================================================
-- MIGRATION (run once in the Supabase SQL editor): campus ambassadors.
--
-- Why: any signed-in student can get a permanent CA- referral code (GET MY CODE on the home page) without
-- registering, registrants may enter it in the existing referral field, and admins / the registration team see each
-- ambassador's registrations in the admin dashboard's AMBASSADORS tab.
-- This adds the campus_ambassadors table (no client access at all), registrations.ambassador_id with its checks,
-- index and guard trigger, and the staff-only ambassador_leaderboard view. No existing column, policy or row changes.
--
-- Run this before (or together with) deploying the code that uses it: until then GET MY CODE, CA codes and the
-- AMBASSADORS tab fail (registering without a CA code keeps working).
-- Requires add_referrals.sql (section 14) to have been run. Matches section 16 of supabase/schema.sql. Kept out of
-- supabase/migrations/ on purpose so the Supabase CLI never applies it automatically. Safe to re-run.
-- ==============================================================================

-- Any signed-in student can become a campus ambassador: GET MY CODE on the home page (POST /api/ambassador/code)
-- creates their row, matched on the verified email of their session, the first time they ask. The section's APPLY
-- button only opens the organisers' Google Form (src/config/ambassador.ts); nothing here depends on it.
-- Each ambassador gets one permanent code, 'CA' + 6 characters from the referral alphabet (shown as CA-K7QM2X), that
-- any number of registrants may enter in the registration form's referral field. An ambassador doesn't have to
-- register. If they do, their registration also gets its own 6-character referral_code (section 14), which keeps the
-- normal referral rules (it counts on the referral leaderboard, never here) and never affects their ambassador code.
--
-- A registration names at most one referrer: a registrant's code (referred_by) or an ambassador's (ambassador_id),
-- never both, never the registrant's own ambassador code and never a revoked one. ambassador_id never changes once
-- written, whoever writes (trg_guard_registration_ambassador: trg_enforce_registration_review only binds staff calling
-- the Supabase API, not the service role the app's routes use).
-- An ambassador's registrations count once confirmed (payment approved); pending ones are shown apart, rejected ones
-- never count. Staff can revoke an ambassador (abuse): their code is then refused for new registrations, and the ones
-- already made stay counted. An ambassador whose code has been used can't be deleted (ON DELETE RESTRICT).
--
-- No client role can read or write any of this, an ambassador's own row included: every access goes through server
-- routes that verify the caller first (service role): POST /api/ambassador/code, POST /api/register/check-code,
-- POST /api/register and the admin dashboard's AMBASSADORS tab (/api/admin/ambassadors, admins and the registration
-- team only).
CREATE TABLE IF NOT EXISTS public.campus_ambassadors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  college TEXT,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.campus_ambassadors DROP CONSTRAINT IF EXISTS campus_ambassadors_email_check;
  ALTER TABLE public.campus_ambassadors ADD CONSTRAINT campus_ambassadors_email_check
    CHECK (email = lower(email) AND char_length(email) <= 254 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
  ALTER TABLE public.campus_ambassadors DROP CONSTRAINT IF EXISTS campus_ambassadors_name_check;
  ALTER TABLE public.campus_ambassadors ADD CONSTRAINT campus_ambassadors_name_check
    CHECK (char_length(name) BETWEEN 1 AND 120);
  ALTER TABLE public.campus_ambassadors DROP CONSTRAINT IF EXISTS campus_ambassadors_college_check;
  ALTER TABLE public.campus_ambassadors ADD CONSTRAINT campus_ambassadors_college_check
    CHECK (college IS NULL OR char_length(college) <= 200);
  ALTER TABLE public.campus_ambassadors DROP CONSTRAINT IF EXISTS campus_ambassadors_code_check;
  ALTER TABLE public.campus_ambassadors ADD CONSTRAINT campus_ambassadors_code_check
    CHECK (code ~ '^CA[A-HJ-NP-Z2-9]{6}$');
  ALTER TABLE public.campus_ambassadors DROP CONSTRAINT IF EXISTS campus_ambassadors_status_check;
  ALTER TABLE public.campus_ambassadors ADD CONSTRAINT campus_ambassadors_status_check
    CHECK (status IN ('active', 'revoked'));
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_campus_ambassadors_email ON public.campus_ambassadors(email);
CREATE UNIQUE INDEX IF NOT EXISTS uq_campus_ambassadors_code ON public.campus_ambassadors(code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_campus_ambassadors_user_id ON public.campus_ambassadors(user_id);

CREATE OR REPLACE FUNCTION public.new_ambassador_code() RETURNS TEXT AS $$
DECLARE
  v_alphabet CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes BYTEA;
  v_code TEXT;
BEGIN
  LOOP
    -- Built like new_referral_code() (section 14): 6 uniform characters from CSPRNG bytes, after the 'CA' prefix.
    v_bytes := uuid_send(gen_random_uuid());
    v_code := 'CA';
    FOR i IN 0..5 LOOP
      v_code := v_code || substr(v_alphabet, 1 + get_byte(v_bytes, i) % 32, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.campus_ambassadors WHERE code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$ LANGUAGE plpgsql VOLATILE SET search_path = public;

-- The code is generated by the database on insert (a code sent with the insert is replaced) and never changes; the
-- email is stored trimmed and lower-cased. Changing the email unlinks the account that owned the old one.
CREATE OR REPLACE FUNCTION public.protect_campus_ambassador() RETURNS TRIGGER AS $$
BEGIN
  NEW.email := lower(btrim(NEW.email));
  IF TG_OP = 'INSERT' THEN
    NEW.code := public.new_ambassador_code();
    NEW.created_at := now();
  ELSE
    NEW.id := OLD.id;
    NEW.code := OLD.code;
    NEW.created_at := OLD.created_at;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      NEW.user_id := NULL;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_campus_ambassador ON public.campus_ambassadors;
CREATE TRIGGER trg_protect_campus_ambassador
  BEFORE INSERT OR UPDATE ON public.campus_ambassadors
  FOR EACH ROW EXECUTE FUNCTION public.protect_campus_ambassador();

ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS ambassador_id UUID
  REFERENCES public.campus_ambassadors(id) ON DELETE RESTRICT;

DO $$
BEGIN
  ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_one_referrer_check;
  ALTER TABLE public.registrations ADD CONSTRAINT registrations_one_referrer_check
    CHECK (referred_by IS NULL OR ambassador_id IS NULL);
END $$;

CREATE INDEX IF NOT EXISTS idx_registrations_ambassador_id ON public.registrations(ambassador_id);

-- On insert: the ambassador must be active and must not be the registrant (same email or the same account). The row
-- is locked while the registration is written, so a revoke running at the same moment waits for it.
-- On update: ambassador_id can't change, for every role.
-- /api/register checks the same rules first and shows these errors on the referral field.
CREATE OR REPLACE FUNCTION public.guard_registration_ambassador() RETURNS TRIGGER AS $$
DECLARE
  v_amb public.campus_ambassadors%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.ambassador_id IS DISTINCT FROM OLD.ambassador_id THEN
      RAISE EXCEPTION 'The campus ambassador of registration % cannot be changed', OLD.registration_id
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.ambassador_id IS NOT NULL THEN
    SELECT * INTO v_amb FROM public.campus_ambassadors WHERE id = NEW.ambassador_id FOR SHARE;
    IF FOUND AND v_amb.status <> 'active' THEN
      RAISE EXCEPTION 'This campus ambassador code is no longer active' USING ERRCODE = '23514';
    END IF;
    IF FOUND AND (v_amb.email = lower(NEW.email) OR v_amb.user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'A campus ambassador cannot use their own campus ambassador code' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_guard_registration_ambassador ON public.registrations;
CREATE TRIGGER trg_guard_registration_ambassador
  BEFORE INSERT OR UPDATE ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.guard_registration_ambassador();

-- Staff leaderboard (GET /api/admin/ambassadors): one row per ambassador, revoked ones included but unranked.
-- rank counts confirmed registrations among active ambassadors (ties share a rank) and is computed over the whole
-- board, before any filter the API adds. No contact details: the API adds the email (this table) and the phone (the
-- ambassador's profile) for staff only.
-- security_invoker, and no privilege for any client role: only the service role (server routes) can read it.
DROP VIEW IF EXISTS public.ambassador_leaderboard;
CREATE VIEW public.ambassador_leaderboard WITH (security_invoker = true) AS
SELECT
  (CASE WHEN a.status = 'active'
    THEN rank() OVER (PARTITION BY a.status = 'active' ORDER BY COALESCE(c.confirmed, 0) DESC) END)::INT AS rank,
  a.id, a.code, a.name, a.college, a.status, a.created_at,
  COALESCE(c.confirmed, 0)::INT AS confirmed_registrations,
  COALESCE(c.pending, 0)::INT AS pending_registrations
FROM public.campus_ambassadors a
LEFT JOIN (
  SELECT
    ambassador_id,
    count(*) FILTER (WHERE status = 'confirmed') AS confirmed,
    count(*) FILTER (WHERE status = 'pending') AS pending
  FROM public.registrations
  WHERE ambassador_id IS NOT NULL
  GROUP BY ambassador_id
) c ON c.ambassador_id = a.id;

ALTER TABLE public.campus_ambassadors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campus_ambassadors FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ambassador_leaderboard FROM PUBLIC, anon, authenticated;

-- Internal: only the triggers above use these.
REVOKE EXECUTE ON FUNCTION public.new_ambassador_code() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.protect_campus_ambassador() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.guard_registration_ambassador() FROM PUBLIC, anon, authenticated, service_role;
