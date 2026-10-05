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
  id_card_url TEXT, -- Nullable: Internal students do NOT need an ID card
  payment_screenshot_url TEXT,
  utr TEXT,
  amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure id_card_url is nullable if table already existed
ALTER TABLE public.registrations ALTER COLUMN id_card_url DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_registrations_user_id ON public.registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON public.registrations(status);
CREATE INDEX IF NOT EXISTS idx_registrations_reg_id ON public.registrations(registration_id);


-- 3. HELPER FUNCTIONS FOR SECURITY (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.get_user_role(uid UUID) RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = uid;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin(uid UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = uid AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_staff(uid UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = uid AND role IN ('admin', 'it-team')
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

  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  v_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    ''
  );

  v_phone := COALESCE(
    NEW.raw_user_meta_data->>'phone',
    NEW.phone,
    NULL
  );

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
CREATE POLICY "Users can view own profile or staff can view all" ON public.profiles FOR
SELECT TO authenticated USING (auth.uid() = id OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR
INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own details" ON public.profiles;
CREATE POLICY "Users can update own details" ON public.profiles FOR
UPDATE TO authenticated USING (auth.uid() = id OR public.is_admin(auth.uid()))
WITH CHECK (auth.uid() = id OR public.is_admin(auth.uid()));

-- Protect role column: regular users cannot alter their role
CREATE OR REPLACE FUNCTION public.protect_profile_role() RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.role IS DISTINCT FROM NEW.role) THEN
    -- If the update is executed by an authenticated client user who is not an admin, revert it.
    -- Updates made directly via Supabase Dashboard, Table Editor, SQL Editor, or backend service_role
    -- have auth.role() IS NULL or 'service_role' (not 'authenticated'), and are safely allowed.
    IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
      NEW.role := OLD.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- Registrations Policies
DROP POLICY IF EXISTS "Users can view own registrations or staff can view all" ON public.registrations;
CREATE POLICY "Users can view own registrations or staff can view all" ON public.registrations FOR
SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Users can create their registration" ON public.registrations;
CREATE POLICY "Users can create their registration" ON public.registrations FOR
INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Staff can review pending registrations" ON public.registrations;
CREATE POLICY "Staff can review pending registrations" ON public.registrations FOR
UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));


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

DROP POLICY IF EXISTS "Users can insert own sessions" ON public.user_sessions;
CREATE POLICY "Users can insert own sessions" ON public.user_sessions FOR
INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own sessions" ON public.user_sessions;
CREATE POLICY "Users can update own sessions" ON public.user_sessions FOR
UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own sessions" ON public.user_sessions;
CREATE POLICY "Users can delete own sessions" ON public.user_sessions FOR
DELETE TO authenticated USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_profile_role();