-- ==============================================================================
-- INNOVISION 2026 · COMPLETE FRESH START DATABASE SCHEMA
-- Drops all existing tables, triggers, and functions, then recreates clean schema
-- ==============================================================================

-- 0. CLEAN DROP OF EXISTING TABLES, TRIGGERS & FUNCTIONS (OPTIONAL FRESH START)
-- Uncomment the block below if you want to wipe everything and restart completely:
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
-- DROP FUNCTION IF EXISTS public.is_admin(UUID) CASCADE;
-- DROP FUNCTION IF EXISTS public.is_staff(UUID) CASCADE;
-- DROP FUNCTION IF EXISTS public.get_user_role(UUID) CASCADE;
-- DROP FUNCTION IF EXISTS public.protect_profile_role() CASCADE;

-- DROP TABLE IF EXISTS public.user_sessions CASCADE;
-- DROP TABLE IF EXISTS public.registrations CASCADE;
-- DROP TABLE IF EXISTS public.profiles CASCADE;
-- DROP TABLE IF EXISTS public.events CASCADE;
-- DROP TABLE IF EXISTS public.tickets CASCADE;

-- The college ID card upload was removed from registration. To also delete the old column (and any stored
-- ID-card URLs) from a database created with an earlier version of this script, uncomment:
-- ALTER TABLE public.registrations DROP COLUMN IF EXISTS id_card_url;


-- 1. CREATE PROFILES TABLE (Safe IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  student_type TEXT DEFAULT 'external' CHECK (student_type IN ('internal', 'external')),
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'it-team', 'admin')),
  enrollment_no TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);


-- 2. CREATE REGISTRATIONS TABLE (Safe IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  college TEXT NOT NULL,
  phone TEXT NOT NULL,
  enrollment_no TEXT,
  student_type TEXT NOT NULL CHECK (student_type IN ('internal', 'external')),
  gender TEXT NOT NULL, -- 'male' | 'female' | 'others' (see registrations_gender_check)
  payment_proof_path TEXT, -- object path in the private 'payment-proofs' Storage bucket ('<user_id>/<uuid>.<ext>')
  utr TEXT,
  amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Upgrade tables created by earlier versions of this script.
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS payment_proof_path TEXT;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'registrations' AND column_name = 'id_card_url'
  ) THEN
    ALTER TABLE public.registrations ALTER COLUMN id_card_url DROP NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_registrations_user_id ON public.registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON public.registrations(status);
CREATE INDEX IF NOT EXISTS idx_registrations_reg_id ON public.registrations(registration_id);

-- Ensure registrations do not allow students from ITER - SOA
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'registrations' AND table_schema = 'public') THEN
    ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_no_iter_soa;
    ALTER TABLE public.registrations ADD CONSTRAINT registrations_no_iter_soa
    CHECK (
      college IS NULL OR (
        college !~* '\m(iter|soa)\M'
        AND college !~* 'institute of technical education'
        AND college !~* 'siksha.*anusandhan'
      )
    ) NOT VALID;
  END IF;
END $$;


-- Field validation in the database itself, so it also applies to direct Supabase API writes that skip /api/register.
-- NOT VALID: enforced for new/updated rows without failing on legacy data.
DO $$
BEGIN
  ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_id_card_url_check;
  -- NULL is tolerated only on legacy rows created before the column existed (so staff can still review them);
  -- trg_require_registration_gender makes it mandatory for every new registration.
  ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_gender_check;
  ALTER TABLE public.registrations ADD CONSTRAINT registrations_gender_check
    CHECK (gender IS NULL OR gender IN ('male', 'female', 'others'));
  -- A payment proof is a path inside the registrant's OWN folder of the private bucket, never a URL, and never
  -- another user's file (even through the service role).
  ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_payment_proof_path_check;
  ALTER TABLE public.registrations ADD CONSTRAINT registrations_payment_proof_path_check
    CHECK (payment_proof_path IS NULL OR (
      payment_proof_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif|heic)$'
      AND split_part(payment_proof_path, '/', 1) = user_id::text
    ));
  ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_name_check;
  ALTER TABLE public.registrations ADD CONSTRAINT registrations_name_check
    CHECK (char_length(name) BETWEEN 1 AND 100) NOT VALID;
  ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_college_check;
  ALTER TABLE public.registrations ADD CONSTRAINT registrations_college_check
    CHECK (char_length(college) BETWEEN 1 AND 200) NOT VALID;
  ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_phone_check;
  ALTER TABLE public.registrations ADD CONSTRAINT registrations_phone_check
    CHECK (phone ~ '^[6-9][0-9]{9}$') NOT VALID;
  ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_utr_check;
  ALTER TABLE public.registrations ADD CONSTRAINT registrations_utr_check
    CHECK (utr IS NULL OR utr ~ '^[0-9]{12}$') NOT VALID;
  ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_enrollment_no_check;
  ALTER TABLE public.registrations ADD CONSTRAINT registrations_enrollment_no_check
    CHECK (enrollment_no IS NULL OR char_length(enrollment_no) <= 50) NOT VALID;
  ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_registration_id_format_check;
  ALTER TABLE public.registrations ADD CONSTRAINT registrations_registration_id_format_check
    CHECK (registration_id ~ '^IV26-[0-9]{4}$') NOT VALID;

  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_full_name_check;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_full_name_check
    CHECK (full_name IS NULL OR char_length(full_name) <= 120) NOT VALID;
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_url_check;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_url_check
    CHECK (avatar_url IS NULL OR avatar_url = '' OR (avatar_url ~* '^https://[^\s"''<>]+$' AND char_length(avatar_url) <= 2048)) NOT VALID;
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_check;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_phone_check
    CHECK (phone IS NULL OR char_length(phone) <= 20) NOT VALID;
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_enrollment_no_check;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_enrollment_no_check
    CHECK (enrollment_no IS NULL OR char_length(enrollment_no) <= 50) NOT VALID;
END $$;


-- Gender is required on every new registration, whoever inserts it (API with service role or a direct API call).
CREATE OR REPLACE FUNCTION public.require_registration_gender() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.gender IS NULL THEN
    RAISE EXCEPTION 'gender is required (male, female or others)' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_require_registration_gender ON public.registrations;
CREATE TRIGGER trg_require_registration_gender
  BEFORE INSERT ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.require_registration_gender();

-- LEGACY payment_screenshot_url (ImageKit proof URLs from before the move to private Supabase Storage).
-- Fresh databases never get this column. On databases that still have it, it is kept read-only until
-- scripts/migrate-payment-proofs.mjs has copied and verified every proof into the payment-proofs bucket; then
-- supabase/manual/drop_legacy_payment_screenshot_url.sql removes it. Until then: no new URL can be written
-- (insert or update); a reference can only be kept as is or cleared.
CREATE OR REPLACE FUNCTION public.reject_payment_proof_urls() RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(NEW.payment_screenshot_url, '') <> ''
     AND (TG_OP = 'INSERT' OR NEW.payment_screenshot_url IS DISTINCT FROM OLD.payment_screenshot_url) THEN
    RAISE EXCEPTION 'payment_screenshot_url is no longer accepted: store the private payment_proof_path instead'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_reject_payment_proof_urls ON public.registrations;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'registrations' AND column_name = 'payment_screenshot_url'
  ) THEN
    ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_payment_screenshot_url_check;
    ALTER TABLE public.registrations ADD CONSTRAINT registrations_payment_screenshot_url_check
      CHECK (payment_screenshot_url IS NULL OR payment_screenshot_url = '' OR (payment_screenshot_url ~* '^https://[^\s"''<>]+$' AND char_length(payment_screenshot_url) <= 2048)) NOT VALID;
    CREATE TRIGGER trg_reject_payment_proof_urls
      BEFORE INSERT OR UPDATE ON public.registrations
      FOR EACH ROW EXECUTE FUNCTION public.reject_payment_proof_urls();
  ELSE
    DROP FUNCTION IF EXISTS public.reject_payment_proof_urls();
  END IF;
END $$;


-- 3. HELPER FUNCTIONS FOR SECURITY (SECURITY DEFINER to avoid RLS recursion)
-- They only ever answer for the CALLER (uid must equal auth.uid()): the policies and triggers always pass auth.uid(),
-- and a signed-in user calling them via /rest/v1/rpc can't probe other users' roles (e.g. to find the admins).
CREATE OR REPLACE FUNCTION public.get_user_role(uid UUID) RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = uid AND uid = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin(uid UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = uid AND uid = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_staff(uid UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = uid AND uid = auth.uid() AND role IN ('admin', 'it-team')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;


-- 4. AUTO-HANDLE NEW SIGNUPS FROM GOOGLE AUTH
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
DECLARE
  v_student_type TEXT;
  v_full_name TEXT;
  v_avatar TEXT;
  v_phone TEXT;
BEGIN
  IF NEW.email ILIKE '%@nitrkl.ac.in' THEN
    v_student_type := 'internal';
  ELSE
    v_student_type := 'external';
  END IF;

  v_full_name := left(COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  ), 120);

  v_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    ''
  );
  IF v_avatar !~* '^https://[^\s"''<>]+$' OR char_length(v_avatar) > 2048 THEN
    v_avatar := '';
  END IF;

  v_phone := left(COALESCE(
    NEW.raw_user_meta_data->>'phone',
    NEW.phone,
    NULL
  ), 20);

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    phone,
    student_type,
    role
  ) VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    v_avatar,
    v_phone,
    v_student_type,
    'user'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    avatar_url = COALESCE(NULLIF(public.profiles.avatar_url, ''), EXCLUDED.avatar_url),
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile or staff can view all" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile or admins can view all" ON public.profiles;
CREATE POLICY "Users can view own profile or admins can view all" ON public.profiles FOR
SELECT TO authenticated USING (auth.uid() = id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR
INSERT TO authenticated WITH CHECK (auth.uid() = id AND role = 'user');

DROP POLICY IF EXISTS "Users can update own details" ON public.profiles;
CREATE POLICY "Users can update own details" ON public.profiles FOR
UPDATE TO authenticated USING (auth.uid() = id OR public.is_admin(auth.uid()))
WITH CHECK (auth.uid() = id OR public.is_admin(auth.uid()));

-- Protect privileged profile columns from end-user API calls (role, email, student_type, id, created_at).
-- Rules mirrored from /api/admin/users:
--   * regular users can never change role / email / student_type;
--   * admins may switch other users between 'user' and 'it-team' only;
--   * the 'admin' role can only be granted or revoked directly in the database.
-- Writes from the Supabase Dashboard / SQL Editor / service_role backend (auth.role() <> 'authenticated') are trusted.
DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_profile_role();

CREATE OR REPLACE FUNCTION public.protect_profile_fields() RETURNS TRIGGER AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT email INTO v_email FROM auth.users WHERE id = NEW.id;
    NEW.role := 'user';
    NEW.email := COALESCE(v_email, NEW.email);
    NEW.student_type := CASE WHEN lower(COALESCE(v_email, '')) LIKE '%@nitrkl.ac.in' THEN 'internal' ELSE 'external' END;
    RETURN NEW;
  END IF;

  NEW.id := OLD.id;
  NEW.created_at := OLD.created_at;
  NEW.email := OLD.email;
  NEW.student_type := OLD.student_type;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_admin(auth.uid())
       OR OLD.role = 'admin'
       OR NEW.role = 'admin' THEN
      NEW.role := OLD.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- Registrations Policies
DROP POLICY IF EXISTS "Users can view own registrations or staff can view all" ON public.registrations;
CREATE POLICY "Users can view own registrations or staff can view all" ON public.registrations FOR
SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- No direct INSERT for end users: every registration is created by /api/register (service role), which applies the
-- rules the database can't (ITER - SOA email domain, proof object really uploaded by the same user, rate limits). The INSERT privilege itself is revoked in section 11; the insert trigger below stays as defense in depth.
DROP POLICY IF EXISTS "Users can create their registration" ON public.registrations;

DROP POLICY IF EXISTS "Staff can review pending registrations" ON public.registrations;
CREATE POLICY "Staff can review pending registrations" ON public.registrations FOR
UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Registrations inserted directly through the Supabase API by an end user can't choose their own status, fee,
-- student type or email: these are derived from the verified auth account exactly like /api/register does.
CREATE OR REPLACE FUNCTION public.enforce_registration_insert() RETURNS TRIGGER AS $$
DECLARE
  v_email TEXT;
  v_confirmed TIMESTAMPTZ;
BEGIN
  IF COALESCE(auth.role(), '') <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  SELECT lower(email), email_confirmed_at INTO v_email, v_confirmed FROM auth.users WHERE id = auth.uid();

  -- Same ITER - SOA email rule as /api/register (isIterSoaEmail); the college CHECK only covers the typed name.
  IF v_email LIKE '%@soa.%' OR v_email LIKE '%@iter.%' THEN
    RAISE EXCEPTION 'Registration is not allowed for students from ITER - SOA.' USING ERRCODE = '42501';
  END IF;

  NEW.user_id := auth.uid();
  NEW.email := COALESCE(v_email, '');
  NEW.registration_id := 'IV26-' || (1000 + (('x' || substr(md5(gen_random_uuid()::text), 1, 7))::bit(28)::int % 9000))::text;
  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;
  IF v_email LIKE '%@nitrkl.ac.in' AND v_confirmed IS NOT NULL THEN
    NEW.student_type := 'internal';
    NEW.status := 'confirmed';
    NEW.amount := 0;
  ELSE
    NEW.student_type := 'external';
    NEW.status := 'pending';
    NEW.amount := 499;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_registration_insert ON public.registrations;
CREATE TRIGGER trg_enforce_registration_insert
  BEFORE INSERT ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_registration_insert();

-- Staff reviewing through the Supabase API may only move a PENDING registration to confirmed/rejected
-- ("once done cannot be altered"); every other column stays as submitted.
CREATE OR REPLACE FUNCTION public.enforce_registration_review() RETURNS TRIGGER AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF OLD.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Staff cannot review their own registration' USING ERRCODE = '42501';
  END IF;

  IF OLD.status <> 'pending' OR NEW.status NOT IN ('confirmed', 'rejected') THEN
    RAISE EXCEPTION 'Registration % is already % and cannot be altered', OLD.registration_id, OLD.status
      USING ERRCODE = '42501';
  END IF;

  v_status := NEW.status;
  NEW := OLD;
  NEW.status := v_status;
  NEW.reviewed_by := auth.uid();
  NEW.reviewed_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_registration_review ON public.registrations;
CREATE TRIGGER trg_enforce_registration_review
  BEFORE UPDATE ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_registration_review();

-- One registration per user, and one registration per UPI transaction (UTR).
-- Wrapped so the script still runs if legacy duplicate rows exist; clean them up and re-run to add the index.
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS uq_registrations_user_id ON public.registrations(user_id);
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'uq_registrations_user_id not created: duplicate user_id rows exist in registrations';
END $$;

DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS uq_registrations_utr ON public.registrations(utr)
    WHERE utr IS NOT NULL AND status <> 'rejected';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'uq_registrations_utr not created: duplicate UTR rows exist in registrations';
END $$;


-- 6. USER SESSIONS TABLE (Stores ONLY refresh_token in database; access_token is in cookies)
CREATE TABLE IF NOT EXISTS public.user_sessions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sessions" ON public.user_sessions;
CREATE POLICY "Users can view own sessions" ON public.user_sessions FOR
SELECT TO authenticated USING (user_id = auth.uid());

-- Session rows are written only by /api/auth/session and /api/auth/logout (service role); clients can't write them.
DROP POLICY IF EXISTS "Users can insert own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON public.user_sessions;

-- 7. EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  poster_url TEXT NOT NULL,
  brochure_url TEXT, -- Optional Google Drive link
  category TEXT NOT NULL CHECK (category IN ('flagship events', 'standout events', 'main events', 'dts events', 'fun events')),
  format TEXT DEFAULT 'Solo / Team',
  duration TEXT DEFAULT 'TBA',
  venue TEXT DEFAULT 'NIT Rourkela',
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_created_at ON public.events(created_at DESC);

-- Ensure check constraint on category is up to date if table already exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'events' AND table_schema = 'public') THEN
    ALTER TABLE public.events ALTER COLUMN brochure_url DROP NOT NULL;
    ALTER TABLE public.events ALTER COLUMN format DROP NOT NULL;
    ALTER TABLE public.events ALTER COLUMN duration DROP NOT NULL;
    ALTER TABLE public.events ALTER COLUMN venue DROP NOT NULL;
    ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_category_check;
    ALTER TABLE public.events ADD CONSTRAINT events_category_check CHECK (category IN ('flagship events', 'standout events', 'main events', 'dts events', 'fun events'));
    -- Brochure links are rendered as public hrefs: only Google Drive/Docs URLs (never javascript:/data:).
    ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_poster_url_check;
    ALTER TABLE public.events ADD CONSTRAINT events_poster_url_check
      CHECK (poster_url ~* '^https://[^\s"''<>]+$') NOT VALID;
    ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_brochure_url_check;
    ALTER TABLE public.events ADD CONSTRAINT events_brochure_url_check
      CHECK (brochure_url IS NULL OR brochure_url ~* '^https?://([a-z0-9-]+\.)*(drive|docs)\.google\.com/.+') NOT VALID;
  END IF;
END $$;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Anyone can view events (public and authenticated)
DROP POLICY IF EXISTS "Public can view events" ON public.events;
CREATE POLICY "Public can view events" ON public.events FOR
SELECT USING (true);

-- Authorized IT team member and admin can insert events
DROP POLICY IF EXISTS "Staff can insert events" ON public.events;
CREATE POLICY "Staff can insert events" ON public.events FOR
INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- Authorized IT team member and admin can update events
DROP POLICY IF EXISTS "Staff can update events" ON public.events;
CREATE POLICY "Staff can update events" ON public.events FOR
UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Authorized IT team member and admin can delete events
DROP POLICY IF EXISTS "Staff can delete events" ON public.events;
CREATE POLICY "Staff can delete events" ON public.events FOR
DELETE TO authenticated USING (public.is_staff(auth.uid()));


-- 8. GALLERY TABLE
CREATE TABLE IF NOT EXISTS public.gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT, -- Optional title for gallery photo
  image_url TEXT NOT NULL,
  file_id TEXT, -- ImageKit file ID
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gallery_created_at ON public.gallery(created_at DESC);

ALTER TABLE public.gallery DROP CONSTRAINT IF EXISTS gallery_image_url_check;
ALTER TABLE public.gallery ADD CONSTRAINT gallery_image_url_check
  CHECK (image_url ~* '^https://[^\s"''<>]+$') NOT VALID;

ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;

-- Anyone can view gallery images
DROP POLICY IF EXISTS "Public can view gallery" ON public.gallery;
CREATE POLICY "Public can view gallery" ON public.gallery FOR
SELECT USING (true);

-- Authorized IT team member and admin can insert gallery images
DROP POLICY IF EXISTS "Staff can insert gallery" ON public.gallery;
CREATE POLICY "Staff can insert gallery" ON public.gallery FOR
INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- Authorized IT team member and admin can update gallery images
DROP POLICY IF EXISTS "Staff can update gallery" ON public.gallery;
CREATE POLICY "Staff can update gallery" ON public.gallery FOR
UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Authorized IT team member and admin can delete gallery images
DROP POLICY IF EXISTS "Staff can delete gallery" ON public.gallery;
CREATE POLICY "Staff can delete gallery" ON public.gallery FOR
DELETE TO authenticated USING (public.is_staff(auth.uid()));


-- 9. FUNCTION PRIVILEGES
-- The role-helper functions are SECURITY DEFINER; don't let anonymous callers probe arbitrary users' roles via RPC.
-- (authenticated keeps EXECUTE because the RLS policies above call is_admin / is_staff.)
REVOKE EXECUTE ON FUNCTION public.get_user_role(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(UUID) TO authenticated;
-- get_user_role isn't used by any policy or by the app.
REVOKE EXECUTE ON FUNCTION public.get_user_role(UUID) FROM authenticated;


-- 10. AUTHORSHIP STAMPING FOR STAFF CONTENT
-- created_by / updated_by on events and gallery come from the caller's JWT; they can't be forged through the API.
CREATE OR REPLACE FUNCTION public.stamp_content_author() RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    IF TG_TABLE_NAME = 'gallery' THEN
      -- Only the title is editable; the image and its storage file id are fixed at upload time.
      NEW.image_url := OLD.image_url;
      NEW.file_id := OLD.file_id;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'events' THEN
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_stamp_events_author ON public.events;
CREATE TRIGGER trg_stamp_events_author
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.stamp_content_author();

DROP TRIGGER IF EXISTS trg_stamp_gallery_author ON public.gallery;
CREATE TRIGGER trg_stamp_gallery_author
  BEFORE INSERT OR UPDATE ON public.gallery
  FOR EACH ROW EXECUTE FUNCTION public.stamp_content_author();


-- 11. TABLE PRIVILEGES (defense in depth on top of RLS)
-- Supabase grants every table to anon/authenticated by default; RLS is then the only barrier. Remove what no client
-- needs so a future policy mistake can't expose private data. TRUNCATE/REFERENCES/TRIGGER are never needed by clients.
REVOKE ALL ON public.profiles, public.registrations, public.user_sessions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.events, public.gallery FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON public.profiles, public.registrations, public.user_sessions, public.events, public.gallery
  FROM authenticated;
REVOKE DELETE ON public.profiles, public.registrations FROM authenticated;
-- Registrations are created only by /api/register, session rows only by the auth API routes (both service role).
REVOKE INSERT ON public.registrations FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_sessions FROM authenticated;


-- 12. PRIVATE STORAGE BUCKET FOR PAYMENT PROOFS
-- Payment screenshots live in a PRIVATE bucket: no public URLs exist. Objects are written only by /api/upload (service
-- role) and named '<user_id>/<uuid>.<ext>' from the verified session. Re-running this script also forces the bucket back to private.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment-proofs', 'payment-proofs', false, 1048576,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Uploads: NO INSERT policy for users. A signed-in user's JWT plus the public key could otherwise upload straight to
-- Storage, skipping /api/upload's rate limit, magic-byte check and per-user limits (unbounded junk files that the
-- owner can't even delete). /api/upload writes with the service role after all its checks: server-chosen
-- '<user_id>/<uuid>.<ext>' name, and only before the user has registered. Dropped here so re-running this script
-- also removes the policy from databases created by an earlier version.
-- No UPDATE/DELETE policies either: a submitted proof can't be replaced or removed.
DROP POLICY IF EXISTS "Payment proofs: owners upload into their own folder" ON storage.objects;

-- Owners may see their own files (used by /api/register to confirm the upload exists). There is deliberately NO staff
-- policy: staff view proofs only through short-lived signed URLs minted server-side by
-- /api/admin/registrations/payment-proof, so they can't list the bucket or sign long-lived URLs themselves.
DROP POLICY IF EXISTS "Payment proofs: owners read their own files" ON storage.objects;
CREATE POLICY "Payment proofs: owners read their own files" ON storage.objects FOR
SELECT TO authenticated USING (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Guard rail: a RESTRICTIVE policy is ANDed with every other policy, so even a broad storage policy added later in
-- the dashboard (e.g. "authenticated can read all objects") can never expose another user's payment proof.
DROP POLICY IF EXISTS "Payment proofs: never outside the owner's folder" ON storage.objects;
CREATE POLICY "Payment proofs: never outside the owner's folder" ON storage.objects AS RESTRICTIVE FOR
ALL TO anon, authenticated
USING (bucket_id <> 'payment-proofs' OR (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id <> 'payment-proofs' OR (storage.foldername(name))[1] = auth.uid()::text);