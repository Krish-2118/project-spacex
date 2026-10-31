-- ==============================================================================
-- MIGRATION (run once in the Supabase SQL editor): read-only 'viewer' role.
--
-- Why: some organisers need to see what the registration team sees (every registration, payment screenshots, ID
-- cards, the CSV export, seats, referrals and campus ambassadors) without being able to approve, reject or change
-- anything. Admins assign the role from the USERS tab of the admin dashboard.
-- This updates sections 1, 3, 5 and 9 of supabase/schema.sql: 'viewer' in the profiles role CHECK, the
-- can_view_registrations helper, and the registrations SELECT policy. The UPDATE policy stays on is_registration_staff,
-- so a viewer can't review a registration even through the Supabase API.
-- No existing row changes.
--
-- Run it BEFORE assigning the role to anyone (until then the role CHECK refuses 'viewer'). Deploying the code first is
-- fine: nobody has the role yet.
-- Kept out of supabase/migrations/ on purpose so the Supabase CLI never applies it automatically. Safe to re-run.
-- ==============================================================================

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'it-team', 'registration-team', 'viewer', 'admin'));

-- Who may READ every registration: the registration team and admins, plus the read-only 'viewer' role. Writes stay on
-- is_registration_staff, so a viewer can look at registrations but never review them.
CREATE OR REPLACE FUNCTION public.can_view_registrations(uid UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = uid AND uid = auth.uid() AND role IN ('admin', 'registration-team', 'viewer')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.can_view_registrations(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_registrations(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can view own registrations or staff can view all" ON public.registrations;
CREATE POLICY "Users can view own registrations or staff can view all" ON public.registrations FOR
SELECT TO authenticated USING (user_id = auth.uid() OR public.can_view_registrations(auth.uid()));
