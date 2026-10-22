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
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'it-team', 'registration-team', 'admin')),
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

-- ITER - SOA students may register: drops the college CHECK that used to refuse them, on databases that still have it.
ALTER TABLE IF EXISTS public.registrations DROP CONSTRAINT IF EXISTS registrations_no_iter_soa;


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

  -- Profiles created before the 'registration-team' role existed still carry the old role CHECK (CREATE TABLE IF NOT
  -- EXISTS never updates it), which would refuse every assignment of the new role. Same list as the table definition.
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('user', 'it-team', 'registration-team', 'admin'));
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

CREATE OR REPLACE FUNCTION public.is_event_staff(uid UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = uid AND uid = auth.uid() AND role IN ('admin', 'it-team')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_registration_staff(uid UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = uid AND uid = auth.uid() AND role IN ('admin', 'registration-team')
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
--   * admins may switch other users between 'user', 'it-team', and 'registration-team' only;
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
SELECT TO authenticated USING (user_id = auth.uid() OR public.is_registration_staff(auth.uid()));

-- No direct INSERT for end users: every registration is created by /api/register (service role), which applies the
-- rules the database can't (proof object really uploaded by the same user, rate limits). The INSERT privilege itself is revoked in section 11; the insert trigger below stays as defense in depth.
DROP POLICY IF EXISTS "Users can create their registration" ON public.registrations;

DROP POLICY IF EXISTS "Staff can review pending registrations" ON public.registrations;
CREATE POLICY "Staff can review pending registrations" ON public.registrations FOR
UPDATE TO authenticated USING (public.is_registration_staff(auth.uid())) WITH CHECK (public.is_registration_staff(auth.uid()));

-- Registrations inserted directly through the Supabase API by an end user can't choose their own status, fee,
-- student type or email: these are derived from the verified auth account exactly like /api/register does.
-- There is no free tier: every registration starts 'pending' at 999 whatever the email domain; student_type is only
-- a reporting label (classifyStudentType in src/lib/security.ts).
CREATE OR REPLACE FUNCTION public.enforce_registration_insert() RETURNS TRIGGER AS $$
DECLARE
  v_email TEXT;
  v_confirmed TIMESTAMPTZ;
BEGIN
  IF COALESCE(auth.role(), '') <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  SELECT lower(email), email_confirmed_at INTO v_email, v_confirmed FROM auth.users WHERE id = auth.uid();

  NEW.user_id := auth.uid();
  NEW.email := COALESCE(v_email, '');
  NEW.registration_id := 'IV26-' || (1000 + (('x' || substr(md5(gen_random_uuid()::text), 1, 7))::bit(28)::int % 9000))::text;
  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;
  NEW.student_type := CASE WHEN v_email LIKE '%@nitrkl.ac.in' AND v_confirmed IS NOT NULL THEN 'internal' ELSE 'external' END;
  NEW.status := 'pending';
  NEW.amount := 999;
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
  sort_order INTEGER NOT NULL DEFAULT 0, -- Position within its category, set by staff in the admin Events tab
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
    ALTER TABLE public.events ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
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

CREATE INDEX IF NOT EXISTS idx_events_category_sort ON public.events(category, sort_order);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Anyone can view events (public and authenticated)
DROP POLICY IF EXISTS "Public can view events" ON public.events;
CREATE POLICY "Public can view events" ON public.events FOR
SELECT USING (true);

-- Authorized IT team member and admin can insert events
DROP POLICY IF EXISTS "Staff can insert events" ON public.events;
CREATE POLICY "Staff can insert events" ON public.events FOR
INSERT TO authenticated WITH CHECK (public.is_event_staff(auth.uid()));

-- Authorized IT team member and admin can update events
DROP POLICY IF EXISTS "Staff can update events" ON public.events;
CREATE POLICY "Staff can update events" ON public.events FOR
UPDATE TO authenticated USING (public.is_event_staff(auth.uid())) WITH CHECK (public.is_event_staff(auth.uid()));

-- Authorized IT team member and admin can delete events
DROP POLICY IF EXISTS "Staff can delete events" ON public.events;
CREATE POLICY "Staff can delete events" ON public.events FOR
DELETE TO authenticated USING (public.is_event_staff(auth.uid()));


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
INSERT TO authenticated WITH CHECK (public.is_event_staff(auth.uid()));

-- Authorized IT team member and admin can update gallery images
DROP POLICY IF EXISTS "Staff can update gallery" ON public.gallery;
CREATE POLICY "Staff can update gallery" ON public.gallery FOR
UPDATE TO authenticated USING (public.is_event_staff(auth.uid())) WITH CHECK (public.is_event_staff(auth.uid()));

-- Authorized IT team member and admin can delete gallery images
DROP POLICY IF EXISTS "Staff can delete gallery" ON public.gallery;
CREATE POLICY "Staff can delete gallery" ON public.gallery FOR
DELETE TO authenticated USING (public.is_event_staff(auth.uid()));


-- 9. FUNCTION PRIVILEGES
-- The role-helper functions are SECURITY DEFINER; don't let anonymous callers probe arbitrary users' roles via RPC.
-- (authenticated keeps EXECUTE because the RLS policies above call is_admin / is_event_staff / is_registration_staff.)
-- is_staff() was split into is_event_staff() and is_registration_staff(). Databases created before the split still
-- have it, and the oldest version answers for ANY uid with EXECUTE left to anon (anyone could probe who is staff).
-- No policy above uses it any more, so remove it; if something added outside this script still depends on it, keep
-- it but make sure nobody can call it.
DO $$
BEGIN
  DROP FUNCTION IF EXISTS public.is_staff(UUID);
EXCEPTION WHEN dependent_objects_still_exist THEN
  RAISE NOTICE 'public.is_staff(uuid) kept (other objects depend on it); EXECUTE revoked from everyone';
  REVOKE EXECUTE ON FUNCTION public.is_staff(UUID) FROM PUBLIC, anon, authenticated;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_user_role(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_event_staff(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_registration_staff(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_staff(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_registration_staff(UUID) TO authenticated;
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


-- 13. ENTRY PASSES AND CHECK-IN AT THE VENUE
-- Every confirmed registration has one QR entry pass. At the venue the registration team scans it, compares the
-- details with the person's college ID and checks them in: once per registration, ever.
-- Naming: "check-in" everywhere in the database and the code. The scanner's button reads "Approve", but approval
-- of a REGISTRATION (payment review) is a different thing and is untouched here.
--
-- The QR holds only an opaque random token (16 CSPRNG bytes, base64url, minted by POST /api/pass). The database
-- stores its SHA-256 (token_hash) and an AES-256-GCM ciphertext (token_ciphertext) that only the server can decrypt
-- (ENTRY_PASS_ENCRYPTION_KEY), so the owner sees the same QR again on any device.
-- Clients never write these tables: every change goes through the SECURITY DEFINER functions below, which check
-- the caller's role themselves and log to entry_audit_log.

CREATE TABLE IF NOT EXISTS public.entry_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE, -- hex SHA-256 of the QR token; NULL until the owner first opens the pass
  token_ciphertext TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  CONSTRAINT entry_passes_token_hash_check CHECK (token_hash IS NULL OR token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT entry_passes_token_pair_check CHECK ((token_hash IS NULL) = (token_ciphertext IS NULL)),
  CONSTRAINT entry_passes_token_ciphertext_check CHECK (token_ciphertext IS NULL OR char_length(token_ciphertext) <= 512),
  CONSTRAINT entry_passes_revoked_check CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
);

-- Never more than one active pass per registration (approving twice or re-running the backfill can't add one).
CREATE UNIQUE INDEX IF NOT EXISTS uq_entry_passes_active_registration
  ON public.entry_passes(registration_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_entry_passes_registration ON public.entry_passes(registration_id);

CREATE TABLE IF NOT EXISTS public.entry_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  pass_id UUID REFERENCES public.entry_passes(id) ON DELETE SET NULL,
  desk TEXT NOT NULL CHECK (char_length(desk) BETWEEN 1 AND 40),
  checked_in_by UUID NOT NULL REFERENCES public.profiles(id),
  scan_id UUID NOT NULL, -- chosen by the scanner per scan; a retry with the same scan_id is answered CHECKED_IN
  method TEXT NOT NULL CHECK (method IN ('qr', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES public.profiles(id),
  void_reason TEXT CHECK (void_reason IS NULL OR char_length(void_reason) BETWEEN 1 AND 200),
  CONSTRAINT entry_checkins_void_check
    CHECK ((voided_at IS NULL) = (voided_by IS NULL) AND (voided_at IS NULL) = (void_reason IS NULL))
);

-- One check-in per registration, whichever QR (old or reissued) was shown. This index, not application code, is what
-- makes two simultaneous Approves produce exactly one row. A voided check-in no longer counts.
CREATE UNIQUE INDEX IF NOT EXISTS uq_entry_checkins_registration
  ON public.entry_checkins(registration_id) WHERE voided_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_entry_checkins_created_at ON public.entry_checkins(created_at DESC);

-- Append-only trail of every scan, manual lookup, check-in, rejected attempt, void and reissue. No foreign keys:
-- the log must outlive deleted accounts and registrations.
CREATE TABLE IF NOT EXISTS public.entry_audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action TEXT NOT NULL CHECK (action IN ('lookup', 'manual_lookup', 'check_in', 'reject', 'void', 'reissue')),
  actor UUID NOT NULL,
  registration_id UUID,
  pass_id UUID,
  checkin_id UUID,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_entry_audit_log_created_at ON public.entry_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_audit_log_action ON public.entry_audit_log(action, created_at DESC);

ALTER TABLE public.entry_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_audit_log ENABLE ROW LEVEL SECURITY;

-- Owners see their own pass; admins see all. No INSERT/UPDATE/DELETE policies on any of the three tables.
DROP POLICY IF EXISTS "Owners can view their entry pass, admins all" ON public.entry_passes;
CREATE POLICY "Owners can view their entry pass, admins all" ON public.entry_passes FOR
SELECT TO authenticated USING (
  public.is_admin(auth.uid())
  -- Qualified: registrations has its own registration_id (the text IV26-NNNN code).
  OR EXISTS (SELECT 1 FROM public.registrations r WHERE r.id = entry_passes.registration_id AND r.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Admins can view check-ins" ON public.entry_checkins;
CREATE POLICY "Admins can view check-ins" ON public.entry_checkins FOR
SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view the entry audit log" ON public.entry_audit_log;
CREATE POLICY "Admins can view the entry audit log" ON public.entry_audit_log FOR
SELECT TO authenticated USING (public.is_admin(auth.uid()));

REVOKE ALL ON public.entry_passes, public.entry_checkins, public.entry_audit_log FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.entry_passes, public.entry_checkins, public.entry_audit_log FROM authenticated;
GRANT SELECT ON public.entry_passes, public.entry_checkins, public.entry_audit_log TO authenticated;


-- Pass lifecycle: a registration becoming 'confirmed' issues its pass; leaving 'confirmed' revokes it. A trigger, so it
-- runs in the same transaction as the status change whoever makes it (/api/admin/registrations, the API, SQL).
CREATE OR REPLACE FUNCTION public.issue_entry_pass(p_registration UUID) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.entry_passes (registration_id)
  SELECT r.id FROM public.registrations r WHERE r.id = p_registration AND r.status = 'confirmed'
  ON CONFLICT (registration_id) WHERE status = 'active' DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_entry_pass() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' THEN
    PERFORM public.issue_entry_pass(NEW.id);
  ELSE
    UPDATE public.entry_passes
    SET status = 'revoked', revoked_at = now(), revoke_reason = 'registration ' || COALESCE(NEW.status, 'unknown')
    WHERE registration_id = NEW.id AND status = 'active';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_entry_pass_lifecycle ON public.registrations;
CREATE TRIGGER trg_entry_pass_lifecycle
  AFTER INSERT OR UPDATE OF status ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.sync_entry_pass();

-- Issues passes for registrations confirmed before this section existed. Idempotent: returns how many it issued,
-- 0 on a second run. Run from the SQL editor (supabase/manual/backfill_entry_passes.sql); no API role may call it.
CREATE OR REPLACE FUNCTION public.backfill_entry_passes() RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.entry_passes (registration_id)
  SELECT r.id FROM public.registrations r WHERE r.status = 'confirmed'
  ON CONFLICT (registration_id) WHERE status = 'active' DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- What the scanner shows for a registration: VALID (with the details staff compare against the college ID),
-- ALREADY_CHECKED_IN (when, by whom, at which desk), or INVALID (a reason code, never personal data).
CREATE OR REPLACE FUNCTION public.entry_state(p_registration UUID, p_pass UUID, p_invalid_reason TEXT)
RETURNS JSONB AS $$
DECLARE
  r public.registrations%ROWTYPE;
  c RECORD;
BEGIN
  IF p_invalid_reason IS NOT NULL THEN
    RETURN jsonb_build_object('state', 'INVALID', 'reason', p_invalid_reason);
  END IF;

  SELECT * INTO r FROM public.registrations WHERE id = p_registration;
  IF NOT FOUND OR r.status <> 'confirmed' THEN
    RETURN jsonb_build_object('state', 'INVALID', 'reason', 'not_confirmed');
  END IF;

  SELECT ch.id, ch.created_at, ch.desk, ch.method, pr.full_name AS staff_name INTO c
  FROM public.entry_checkins ch LEFT JOIN public.profiles pr ON pr.id = ch.checked_in_by
  WHERE ch.registration_id = r.id AND ch.voided_at IS NULL;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'state', 'ALREADY_CHECKED_IN',
      'registration', r.id, 'registration_id', r.registration_id, 'name', r.name,
      'checkin_id', c.id, 'checked_in_at', c.created_at, 'checked_in_by', COALESCE(c.staff_name, 'Staff'),
      'desk', c.desk, 'method', c.method
    );
  END IF;

  RETURN jsonb_build_object(
    'state', 'VALID',
    'registration', r.id, 'registration_id', r.registration_id, 'name', r.name,
    'enrollment_no', r.enrollment_no, 'college', r.college, 'phone', r.phone, 'utr', r.utr
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Resolves a scanned token to its pass and registration, or an invalid reason. Malformed and unknown tokens are
-- both 'unknown'.
CREATE OR REPLACE FUNCTION public.entry_resolve_token(
  p_token TEXT, OUT pass_id UUID, OUT registration_id UUID, OUT invalid_reason TEXT
) AS $$
DECLARE
  p public.entry_passes%ROWTYPE;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[A-Za-z0-9_-]{22}$' THEN
    invalid_reason := 'unknown';
    RETURN;
  END IF;
  SELECT * INTO p FROM public.entry_passes WHERE token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  IF NOT FOUND THEN
    invalid_reason := 'unknown';
    RETURN;
  END IF;
  pass_id := p.id;
  registration_id := p.registration_id;
  IF p.status <> 'active' THEN
    invalid_reason := 'revoked';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.entry_require_registration_staff() RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_registration_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Registration team or admin access required' USING ERRCODE = '42501';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.entry_require_admin() RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- The one place a check-in row is written (QR and manual paths alike).
CREATE OR REPLACE FUNCTION public.entry_check_in(p_pass UUID, p_scan_id UUID, p_desk TEXT, p_method TEXT)
RETURNS JSONB AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_desk TEXT := btrim(COALESCE(p_desk, ''));
  v_reg public.registrations%ROWTYPE;
  v_id UUID;
  v_at TIMESTAMPTZ;
  v_existing RECORD;
  v_result JSONB;
BEGIN
  IF p_scan_id IS NULL THEN
    RAISE EXCEPTION 'scan_id is required' USING ERRCODE = '22023';
  END IF;
  IF v_desk !~ '^[A-Za-z0-9][A-Za-z0-9 ._#/()-]{0,39}$' THEN
    RAISE EXCEPTION 'Invalid desk name' USING ERRCODE = '22023';
  END IF;

  -- Re-validate everything; never trust an earlier lookup. FOR SHARE: a concurrent reissue waits for this check-in.
  SELECT r.* INTO v_reg
  FROM public.entry_passes p JOIN public.registrations r ON r.id = p.registration_id
  WHERE p.id = p_pass AND p.status = 'active' AND r.status = 'confirmed'
  FOR SHARE OF p;
  IF NOT FOUND THEN
    INSERT INTO public.entry_audit_log (action, actor, pass_id, detail)
    VALUES ('check_in', v_actor, p_pass, jsonb_build_object('result', 'INVALID', 'method', p_method, 'desk', v_desk));
    RETURN jsonb_build_object('state', 'INVALID', 'reason', 'revoked');
  END IF;

  IF v_reg.user_id = v_actor THEN
    RAISE EXCEPTION 'You cannot check in your own registration' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.entry_checkins (registration_id, pass_id, desk, checked_in_by, scan_id, method)
  VALUES (v_reg.id, p_pass, v_desk, v_actor, p_scan_id, p_method)
  ON CONFLICT (registration_id) WHERE voided_at IS NULL DO NOTHING
  RETURNING id, created_at INTO v_id, v_at;

  IF v_id IS NOT NULL THEN
    INSERT INTO public.entry_audit_log (action, actor, registration_id, pass_id, checkin_id, detail)
    VALUES ('check_in', v_actor, v_reg.id, p_pass, v_id,
            jsonb_build_object('result', 'CHECKED_IN', 'method', p_method, 'desk', v_desk, 'scan_id', p_scan_id));
    RETURN jsonb_build_object(
      'state', 'CHECKED_IN', 'registration', v_reg.id, 'registration_id', v_reg.registration_id, 'name', v_reg.name,
      'checkin_id', v_id, 'checked_in_at', v_at, 'desk', v_desk
    );
  END IF;

  -- Already checked in, or lost the race. The conflicting row is committed by now (ON CONFLICT waited for it).
  SELECT ch.id, ch.created_at, ch.desk, ch.scan_id, ch.checked_in_by INTO v_existing
  FROM public.entry_checkins ch WHERE ch.registration_id = v_reg.id AND ch.voided_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Check-in changed concurrently, please retry' USING ERRCODE = '40001';
  END IF;

  IF v_existing.scan_id = p_scan_id AND v_existing.checked_in_by = v_actor THEN
    -- The same Approve retried after a lost response: the earlier attempt did succeed.
    RETURN jsonb_build_object(
      'state', 'CHECKED_IN', 'registration', v_reg.id, 'registration_id', v_reg.registration_id, 'name', v_reg.name,
      'checkin_id', v_existing.id, 'checked_in_at', v_existing.created_at, 'desk', v_existing.desk
    );
  END IF;

  v_result := public.entry_state(v_reg.id, p_pass, NULL);
  INSERT INTO public.entry_audit_log (action, actor, registration_id, pass_id, checkin_id, detail)
  VALUES ('check_in', v_actor, v_reg.id, p_pass, v_existing.id,
          jsonb_build_object('result', 'ALREADY_CHECKED_IN', 'method', p_method, 'desk', v_desk));
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ---- Called by the app (POST /api/admin/entry/*) with the caller's own JWT ----

-- Scan: what the registration team sees before deciding. Changes nothing except the audit log.
CREATE OR REPLACE FUNCTION public.lookup_entry_pass(p_token TEXT) RETURNS JSONB AS $$
DECLARE
  t RECORD;
  v_result JSONB;
BEGIN
  PERFORM public.entry_require_registration_staff();
  SELECT * INTO t FROM public.entry_resolve_token(p_token);
  v_result := public.entry_state(t.registration_id, t.pass_id, t.invalid_reason);
  INSERT INTO public.entry_audit_log (action, actor, registration_id, pass_id, detail)
  VALUES ('lookup', auth.uid(), t.registration_id, t.pass_id, jsonb_build_object('result', v_result->>'state'));
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Damaged or missing QR: exact registration ID (IV26-NNNN) or roll number (enrollment_no).
CREATE OR REPLACE FUNCTION public.lookup_entry_manual(p_query TEXT) RETURNS JSONB AS $$
DECLARE
  v_query TEXT := btrim(COALESCE(p_query, ''));
  v_ids UUID[];
  v_pass UUID;
  v_result JSONB;
BEGIN
  PERFORM public.entry_require_registration_staff();
  IF char_length(v_query) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Enter a registration ID or roll number' USING ERRCODE = '22023';
  END IF;

  IF upper(v_query) ~ '^IV26-[0-9]{4}$' THEN
    SELECT array_agg(id) INTO v_ids FROM public.registrations WHERE registration_id = upper(v_query);
  ELSE
    SELECT array_agg(id) INTO v_ids FROM public.registrations
    WHERE lower(btrim(enrollment_no)) = lower(v_query) AND status = 'confirmed';
  END IF;

  IF COALESCE(cardinality(v_ids), 0) = 0 THEN
    v_result := jsonb_build_object('state', 'INVALID', 'reason', 'not_found');
  ELSIF cardinality(v_ids) > 1 THEN
    v_result := jsonb_build_object('state', 'AMBIGUOUS', 'count', cardinality(v_ids));
  ELSE
    SELECT id INTO v_pass FROM public.entry_passes WHERE registration_id = v_ids[1] AND status = 'active';
    v_result := public.entry_state(v_ids[1], v_pass, CASE WHEN v_pass IS NULL THEN 'not_confirmed' END);
  END IF;

  INSERT INTO public.entry_audit_log (action, actor, registration_id, pass_id, detail)
  VALUES ('manual_lookup', auth.uid(), CASE WHEN cardinality(v_ids) = 1 THEN v_ids[1] END, v_pass,
          jsonb_build_object('query', v_query, 'result', v_result->>'state'));
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- "Approve" on a scanned QR.
CREATE OR REPLACE FUNCTION public.check_in_entry_pass(p_token TEXT, p_scan_id UUID, p_desk TEXT) RETURNS JSONB AS $$
DECLARE
  t RECORD;
BEGIN
  PERFORM public.entry_require_registration_staff();
  SELECT * INTO t FROM public.entry_resolve_token(p_token);
  IF t.invalid_reason IS NOT NULL THEN
    INSERT INTO public.entry_audit_log (action, actor, registration_id, pass_id, detail)
    VALUES ('check_in', auth.uid(), t.registration_id, t.pass_id, jsonb_build_object('result', 'INVALID', 'method', 'qr'));
    RETURN jsonb_build_object('state', 'INVALID', 'reason', t.invalid_reason);
  END IF;
  RETURN public.entry_check_in(t.pass_id, p_scan_id, p_desk, 'qr');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- "Approve" after a manual lookup: the registration's current active pass, through the same entry_check_in.
CREATE OR REPLACE FUNCTION public.check_in_entry_registration(p_registration UUID, p_scan_id UUID, p_desk TEXT)
RETURNS JSONB AS $$
DECLARE
  v_pass UUID;
BEGIN
  PERFORM public.entry_require_registration_staff();
  SELECT id INTO v_pass FROM public.entry_passes WHERE registration_id = p_registration AND status = 'active';
  IF v_pass IS NULL THEN
    INSERT INTO public.entry_audit_log (action, actor, registration_id, detail)
    VALUES ('check_in', auth.uid(), p_registration, jsonb_build_object('result', 'INVALID', 'method', 'manual'));
    RETURN jsonb_build_object('state', 'INVALID', 'reason', 'not_confirmed');
  END IF;
  RETURN public.entry_check_in(v_pass, p_scan_id, p_desk, 'manual');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- "Reject": the details didn't match the college ID, or there was none. Changes nothing on the pass, which stays
-- usable so the case can be resolved later; only the attempt is logged.
CREATE OR REPLACE FUNCTION public.reject_entry_attempt(p_token TEXT, p_registration UUID, p_reason TEXT, p_note TEXT)
RETURNS JSONB AS $$
DECLARE
  v_note TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_reg UUID;
  v_pass UUID;
  v_invalid TEXT;
  v_state JSONB;
  t RECORD;
BEGIN
  PERFORM public.entry_require_registration_staff();
  IF p_reason IS NULL OR p_reason NOT IN ('id_mismatch', 'no_id', 'other') THEN
    RAISE EXCEPTION 'Invalid reason' USING ERRCODE = '22023';
  END IF;
  IF p_reason = 'other' AND v_note IS NULL THEN
    RAISE EXCEPTION 'Describe the reason' USING ERRCODE = '22023';
  END IF;
  IF char_length(COALESCE(v_note, '')) > 200 THEN
    RAISE EXCEPTION 'Note is too long' USING ERRCODE = '22023';
  END IF;
  IF (p_token IS NULL) = (p_registration IS NULL) THEN
    RAISE EXCEPTION 'Give either a token or a registration' USING ERRCODE = '22023';
  END IF;

  IF p_token IS NOT NULL THEN
    SELECT * INTO t FROM public.entry_resolve_token(p_token);
    v_reg := t.registration_id;
    v_pass := t.pass_id;
    v_invalid := t.invalid_reason;
  ELSE
    v_reg := p_registration;
    SELECT id INTO v_pass FROM public.entry_passes WHERE registration_id = p_registration AND status = 'active';
    IF v_pass IS NULL THEN v_invalid := 'not_confirmed'; END IF;
  END IF;

  v_state := public.entry_state(v_reg, v_pass, v_invalid);
  IF v_state->>'state' <> 'VALID' THEN
    RETURN v_state; -- nothing to reject: the scanner shows this state instead
  END IF;

  INSERT INTO public.entry_audit_log (action, actor, registration_id, pass_id, detail)
  VALUES ('reject', auth.uid(), v_reg, v_pass, jsonb_build_object(
    'reason', p_reason, 'note', v_note, 'method', CASE WHEN p_token IS NULL THEN 'manual' ELSE 'qr' END));
  RETURN jsonb_build_object('state', 'REJECTED', 'registration_id', v_state->>'registration_id', 'reason', p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Admin: undo a wrong check-in. Never deletes; the registration can then be checked in again.
CREATE OR REPLACE FUNCTION public.void_entry_checkin(p_checkin_id UUID, p_reason TEXT) RETURNS JSONB AS $$
DECLARE
  v_reason TEXT := btrim(COALESCE(p_reason, ''));
  v_reg UUID;
  v_pass UUID;
BEGIN
  PERFORM public.entry_require_admin();
  IF char_length(v_reason) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'A reason (up to 200 characters) is required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.entry_checkins
  SET voided_at = now(), voided_by = auth.uid(), void_reason = v_reason
  WHERE id = p_checkin_id AND voided_at IS NULL
  RETURNING registration_id, pass_id INTO v_reg, v_pass;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Check-in not found or already voided' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.entry_audit_log (action, actor, registration_id, pass_id, checkin_id, detail)
  VALUES ('void', auth.uid(), v_reg, v_pass, p_checkin_id, jsonb_build_object('reason', v_reason));
  RETURN jsonb_build_object('state', 'VOIDED', 'checkin_id', p_checkin_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Admin: new QR for a registration (lost or leaked pass); the old QR stops working at once. Blocked after check-in.
CREATE OR REPLACE FUNCTION public.reissue_entry_pass(p_registration UUID) RETURNS JSONB AS $$
DECLARE
  v_old UUID;
  v_new UUID;
BEGIN
  PERFORM public.entry_require_admin();
  IF NOT EXISTS (SELECT 1 FROM public.registrations WHERE id = p_registration AND status = 'confirmed') THEN
    RAISE EXCEPTION 'Only a confirmed registration has a pass' USING ERRCODE = 'P0002';
  END IF;

  -- FOR UPDATE waits for a check-in in progress on this pass, which the next statement then sees.
  SELECT id INTO v_old FROM public.entry_passes WHERE registration_id = p_registration AND status = 'active' FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.entry_checkins WHERE registration_id = p_registration AND voided_at IS NULL) THEN
    RAISE EXCEPTION 'Already checked in: the pass can no longer be reissued' USING ERRCODE = '55000';
  END IF;

  UPDATE public.entry_passes SET status = 'revoked', revoked_at = now(), revoke_reason = 'reissued' WHERE id = v_old;
  v_new := public.issue_entry_pass(p_registration);

  INSERT INTO public.entry_audit_log (action, actor, registration_id, pass_id, detail)
  VALUES ('reissue', auth.uid(), p_registration, v_new, jsonb_build_object('old_pass', v_old));
  RETURN jsonb_build_object('state', 'REISSUED', 'pass', v_new);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---- Called by POST /api/pass for the signed-in participant ----

-- The caller's own registration and pass. token_ciphertext is useless without the server's key.
CREATE OR REPLACE FUNCTION public.my_entry_pass() RETURNS JSONB AS $$
DECLARE
  r public.registrations%ROWTYPE;
  p public.entry_passes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.registrations WHERE user_id = auth.uid() ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('registration_status', 'none', 'pass_status', 'none');
  END IF;
  SELECT * INTO p FROM public.entry_passes WHERE registration_id = r.id
  ORDER BY (status = 'active') DESC, issued_at DESC LIMIT 1;
  RETURN jsonb_build_object(
    'registration_status', r.status, 'registration_id', r.registration_id, 'name', r.name,
    'pass', p.id, 'pass_status', COALESCE(p.status, 'none'), 'token_ciphertext', p.token_ciphertext,
    'checked_in', EXISTS (SELECT 1 FROM public.entry_checkins WHERE registration_id = r.id AND voided_at IS NULL)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Stores the token the server minted for the caller's own active pass, unless one is already stored (two tabs opening
-- the pass at once: the first wins and both get its ciphertext back).
CREATE OR REPLACE FUNCTION public.claim_entry_pass_token(p_pass UUID, p_hash TEXT, p_ciphertext TEXT) RETURNS TEXT AS $$
DECLARE
  v_cipher TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$' OR p_ciphertext IS NULL OR char_length(p_ciphertext) > 512 THEN
    RAISE EXCEPTION 'Invalid token data' USING ERRCODE = '22023';
  END IF;

  UPDATE public.entry_passes p SET token_hash = p_hash, token_ciphertext = p_ciphertext
  FROM public.registrations r
  WHERE p.id = p_pass AND p.status = 'active' AND p.token_hash IS NULL
    AND r.id = p.registration_id AND r.user_id = auth.uid() AND r.status = 'confirmed';

  SELECT p.token_ciphertext INTO v_cipher
  FROM public.entry_passes p JOIN public.registrations r ON r.id = p.registration_id
  WHERE p.id = p_pass AND p.status = 'active' AND r.user_id = auth.uid() AND r.status = 'confirmed';
  IF v_cipher IS NULL THEN
    RAISE EXCEPTION 'No active pass' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_cipher;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- Admin dashboard views. security_invoker: they run with the caller's rights, so the admin-only RLS on the entry
-- tables applies. Counts are per registration, over active passes and non-voided check-ins only.
DROP VIEW IF EXISTS public.entry_overview;
CREATE VIEW public.entry_overview WITH (security_invoker = true) AS
SELECT
  r.id AS registration, r.registration_id, r.name, r.enrollment_no, r.college,
  p.id AS pass_id, p.issued_at AS pass_issued_at, (p.token_hash IS NOT NULL) AS pass_opened,
  c.id AS checkin_id, c.created_at AS checked_in_at, c.desk, c.method, pr.full_name AS checked_in_by
FROM public.registrations r
LEFT JOIN public.entry_passes p ON p.registration_id = r.id AND p.status = 'active'
LEFT JOIN public.entry_checkins c ON c.registration_id = r.id AND c.voided_at IS NULL
LEFT JOIN public.profiles pr ON pr.id = c.checked_in_by
WHERE r.status = 'confirmed';

DROP VIEW IF EXISTS public.entry_checkin_feed;
CREATE VIEW public.entry_checkin_feed WITH (security_invoker = true) AS
SELECT
  c.id, c.created_at, c.desk, c.method, c.voided_at, c.void_reason,
  r.id AS registration, r.registration_id, r.name, r.enrollment_no,
  pr.full_name AS checked_in_by, pv.full_name AS voided_by
FROM public.entry_checkins c
JOIN public.registrations r ON r.id = c.registration_id
LEFT JOIN public.profiles pr ON pr.id = c.checked_in_by
LEFT JOIN public.profiles pv ON pv.id = c.voided_by;

DROP VIEW IF EXISTS public.entry_audit_feed;
CREATE VIEW public.entry_audit_feed WITH (security_invoker = true) AS
SELECT
  a.id, a.created_at, a.action, a.detail, a.registration_id AS registration, r.registration_id, r.name,
  pr.full_name AS actor_name, pr.email AS actor_email
FROM public.entry_audit_log a
LEFT JOIN public.registrations r ON r.id = a.registration_id
LEFT JOIN public.profiles pr ON pr.id = a.actor;

-- Admin dashboard tiles, from the same view (so they always agree with the list).
CREATE OR REPLACE FUNCTION public.entry_overview_counts() RETURNS JSONB AS $$
BEGIN
  PERFORM public.entry_require_admin();
  RETURN (
    SELECT jsonb_build_object(
      'confirmed', count(*), 'checked_in', count(checkin_id), 'not_checked_in', count(*) - count(checkin_id)
    )
    FROM public.entry_overview
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON public.entry_overview, public.entry_checkin_feed, public.entry_audit_feed FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.entry_overview, public.entry_checkin_feed, public.entry_audit_feed FROM authenticated;
GRANT SELECT ON public.entry_overview, public.entry_checkin_feed, public.entry_audit_feed TO authenticated;

-- Function privileges: the internal helpers can't be called through the API by anyone; the entry points only by
-- signed-in users, and each one checks the caller's role itself.
REVOKE EXECUTE ON FUNCTION public.issue_entry_pass(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_entry_pass() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.backfill_entry_passes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.entry_state(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.entry_resolve_token(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.entry_require_registration_staff() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.entry_require_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.entry_check_in(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.lookup_entry_pass(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lookup_entry_manual(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_in_entry_pass(TEXT, UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_in_entry_registration(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_entry_attempt(TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.void_entry_checkin(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reissue_entry_pass(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_entry_pass() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_entry_pass_token(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.entry_overview_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.entry_overview_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_entry_pass(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_entry_manual(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_in_entry_pass(TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_in_entry_registration(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_entry_attempt(TEXT, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_entry_checkin(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reissue_entry_pass(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_entry_pass() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_entry_pass_token(UUID, TEXT, TEXT) TO authenticated;


-- 14. REFERRALS
-- Every registration gets its own shareable referral_code when it is created (trg_assign_referral_code below); the
-- registrant sees it on their pass. Entering someone else's code while registering is optional: /api/register looks
-- it up and stores the referrer's registration in referred_by. A referral counts for the referrer once the referred
-- registration is confirmed (payment approved); pending ones are shown apart, rejected ones never count.
-- Both columns are fixed once written: staff reviewing through the API can only change status
-- (trg_enforce_registration_review copies every other column back from OLD).
-- Codes are 6 characters from an alphabet without look-alikes (no 0/O, no 1/I); the form upper-cases what is typed.
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.registrations(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.new_referral_code() RETURNS TEXT AS $$
DECLARE
  v_alphabet CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes BYTEA;
  v_code TEXT;
BEGIN
  LOOP
    -- The first 6 bytes of a v4 UUID are all CSPRNG output, and 256 is a multiple of 32, so every character is uniform.
    v_bytes := uuid_send(gen_random_uuid());
    v_code := '';
    FOR i IN 0..5 LOOP
      v_code := v_code || substr(v_alphabet, 1 + get_byte(v_bytes, i) % 32, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.registrations WHERE referral_code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$ LANGUAGE plpgsql VOLATILE SET search_path = public;

-- Always generated by the database, whoever inserts (a code in the insert is replaced). A trigger rather than a column
-- default: SECURITY DEFINER, so no API role needs EXECUTE on new_referral_code().
CREATE OR REPLACE FUNCTION public.assign_referral_code() RETURNS TRIGGER AS $$
BEGIN
  NEW.referral_code := public.new_referral_code();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_assign_referral_code ON public.registrations;
CREATE TRIGGER trg_assign_referral_code
  BEFORE INSERT ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.assign_referral_code();

-- Codes for registrations created before referrals existed. One row per statement, so each new code is checked
-- against the ones already handed out.
DO $$
DECLARE
  v_id UUID;
BEGIN
  FOR v_id IN SELECT id FROM public.registrations WHERE referral_code IS NULL ORDER BY created_at, id LOOP
    UPDATE public.registrations SET referral_code = public.new_referral_code() WHERE id = v_id;
  END LOOP;
END $$;

ALTER TABLE public.registrations ALTER COLUMN referral_code SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_referral_code_check;
  ALTER TABLE public.registrations ADD CONSTRAINT registrations_referral_code_check
    CHECK (referral_code ~ '^[A-HJ-NP-Z2-9]{6}$');
  ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_referred_by_check;
  ALTER TABLE public.registrations ADD CONSTRAINT registrations_referred_by_check
    CHECK (referred_by IS NULL OR referred_by <> id);
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_registrations_referral_code ON public.registrations(referral_code);
CREATE INDEX IF NOT EXISTS idx_registrations_referred_by ON public.registrations(referred_by);

-- Leaderboard for the admin dashboard (admins and the registration team, through GET /api/admin/referrals).
-- One row per referrer with at least one confirmed or pending referral; a rejected referrer is left out.
-- rank counts confirmed referrals only (ties share a rank) and is computed over the whole board, before any filter
-- the API adds, so searching never renumbers it.
-- security_invoker: it runs with the caller's rights, so the registrations RLS decides what is counted (a regular
-- user sees nothing: they can't read the rows of the people who used their code).
DROP VIEW IF EXISTS public.referral_leaderboard;
CREATE VIEW public.referral_leaderboard WITH (security_invoker = true) AS
SELECT
  rank() OVER (ORDER BY c.confirmed DESC)::INT AS rank,
  r.id, r.registration_id, r.name, r.email, r.college, r.referral_code, r.status, r.created_at,
  c.confirmed::INT AS confirmed_referrals,
  c.pending::INT AS pending_referrals
FROM (
  SELECT
    referred_by,
    count(*) FILTER (WHERE status = 'confirmed') AS confirmed,
    count(*) FILTER (WHERE status = 'pending') AS pending
  FROM public.registrations
  WHERE referred_by IS NOT NULL
  GROUP BY referred_by
) c
JOIN public.registrations r ON r.id = c.referred_by
WHERE r.status <> 'rejected' AND c.confirmed + c.pending > 0;

REVOKE ALL ON public.referral_leaderboard FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.referral_leaderboard FROM authenticated;
GRANT SELECT ON public.referral_leaderboard TO authenticated;

-- Internal: only the insert trigger and the backfill above use these.
REVOKE EXECUTE ON FUNCTION public.new_referral_code() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.assign_referral_code() FROM PUBLIC, anon, authenticated, service_role;


-- 15. PASS EXPERIENCE (durable one-time approval presentation)
-- Apply once before deploying the pass reveal. Also included in schema.sql for new installs.
-- No payment or registration fields are written by these functions.
CREATE TABLE IF NOT EXISTS public.pass_experiences (
  registration_id UUID PRIMARY KEY REFERENCES public.registrations(id) ON DELETE CASCADE,
  seen_at TIMESTAMPTZ,
  claim_id UUID,
  claim_until TIMESTAMPTZ
);
ALTER TABLE public.pass_experiences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pass_experiences FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_pass_experience(p_claim UUID) RETURNS TEXT AS $$
DECLARE
  r public.registrations%ROWTYPE;
  e public.pass_experiences%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501'; END IF;
  IF p_claim IS NULL THEN RAISE EXCEPTION 'Claim required' USING ERRCODE = '22023'; END IF;
  -- Lock the registration to serialize claims, acknowledgement and staff status changes.
  SELECT * INTO r FROM public.registrations WHERE user_id = auth.uid() ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR r.status <> 'confirmed' OR NOT EXISTS (
    SELECT 1 FROM public.entry_passes WHERE registration_id = r.id AND status = 'active'
  ) THEN RETURN 'ineligible'; END IF;
  INSERT INTO public.pass_experiences(registration_id) VALUES (r.id) ON CONFLICT DO NOTHING;
  SELECT * INTO e FROM public.pass_experiences WHERE registration_id = r.id FOR UPDATE;
  IF e.seen_at IS NOT NULL THEN RETURN 'seen'; END IF;
  IF e.claim_until > clock_timestamp() THEN RETURN 'busy'; END IF;
  UPDATE public.pass_experiences SET claim_id = p_claim, claim_until = clock_timestamp() + interval '30 seconds'
    WHERE registration_id = r.id;
  RETURN 'claimed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.acknowledge_pass_experience(p_claim UUID) RETURNS BOOLEAN AS $$
DECLARE
  r public.registrations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.registrations WHERE user_id = auth.uid() ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR r.status <> 'confirmed' THEN RETURN false; END IF;
  UPDATE public.pass_experiences SET seen_at = COALESCE(seen_at, clock_timestamp())
    WHERE registration_id = r.id AND claim_id = p_claim;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.claim_pass_experience(UUID), public.acknowledge_pass_experience(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_pass_experience(UUID), public.acknowledge_pass_experience(UUID) TO authenticated;
