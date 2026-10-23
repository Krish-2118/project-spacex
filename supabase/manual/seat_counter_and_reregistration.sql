-- ==============================================================================
-- MIGRATION (run once in the Supabase SQL editor): seat counter, and registering again after a rejection.
--
-- Why: the registration form shows how many seats are left (1300 to start, minus the registrations that already hold
-- a seat), admins can change both numbers in the dashboard, and a rejected student can register again (up to 3
-- registrations in all), seeing the reason staff gave.
-- This changes section 5 of supabase/schema.sql (the review trigger keeps the rejection reason; one ACTIVE registration
-- per user instead of one per user, ever) and adds section 17: registrations.rejection_reason, the attempts guard and
-- the registration_counter table with its trigger. No existing row changes.
--
-- Run this BEFORE deploying the code that uses it: until then the seat counter stays hidden, the admin SEAT COUNTER
-- card shows an error, rejecting a registration fails (it needs the rejection_reason column) and registering again is
-- refused by the old one-registration-per-user index.
-- Kept out of supabase/migrations/ on purpose so the Supabase CLI never applies it automatically. Safe to re-run: it
-- never resets the counter once it exists.
-- ==============================================================================

-- Section 5: staff reviewing through the Supabase API may only move a PENDING registration to confirmed/rejected
-- ("once done cannot be altered"); every other column stays as submitted, except the reason given with a rejection.
CREATE OR REPLACE FUNCTION public.enforce_registration_review() RETURNS TRIGGER AS $$
DECLARE
  v_status TEXT;
  v_reason TEXT;
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
  v_reason := CASE WHEN NEW.status = 'rejected' THEN NEW.rejection_reason END;
  NEW := OLD;
  NEW.status := v_status;
  NEW.rejection_reason := v_reason;
  NEW.reviewed_by := auth.uid();
  NEW.reviewed_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Section 5: one active (pending or confirmed) registration per user. Rejected registrations don't count, so a
-- rejected student may register again. Replaces uq_registrations_user_id (one registration per user, ever).
DROP INDEX IF EXISTS public.uq_registrations_user_id;
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS uq_registrations_active_user_id ON public.registrations(user_id)
    WHERE status <> 'rejected';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'uq_registrations_active_user_id not created: a user has two active registrations';
END $$;

-- Section 17:
-- Seat counter: the registration form shows "<seats_left> / <total_seats> seats left" (public GET /api/seats). Admins
-- set both numbers in the admin dashboard (PATCH /api/admin/seats). The count then moves by itself: every new
-- registration takes a seat (pending ones too: they have already paid), a rejection gives it back, approving changes
-- nothing. It never goes below 0 or above total_seats. When it reaches 0 the form stops before the payment step; a
-- submit from someone who was already paying is still accepted (it leaves the count at 0).
-- One row (id = 1). No client role can read or write it: the routes above use the service role, and the trigger below
-- is SECURITY DEFINER, so the count moves whoever changes a registration (the app, the Supabase API or the SQL editor).
CREATE TABLE IF NOT EXISTS public.registration_counter (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  total_seats INTEGER NOT NULL,
  seats_left INTEGER NOT NULL,
  -- The admin who last set the numbers by hand, and when (automatic moves don't change these).
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.registration_counter DROP CONSTRAINT IF EXISTS registration_counter_single_row_check;
  ALTER TABLE public.registration_counter ADD CONSTRAINT registration_counter_single_row_check CHECK (id = 1);
  -- 10000 matches MAX_SEATS in src/lib/seats.ts.
  ALTER TABLE public.registration_counter DROP CONSTRAINT IF EXISTS registration_counter_seats_check;
  ALTER TABLE public.registration_counter ADD CONSTRAINT registration_counter_seats_check
    CHECK (total_seats BETWEEN 0 AND 10000 AND seats_left BETWEEN 0 AND total_seats);
END $$;

-- First run: 1300 seats, less the registrations that already hold one. Re-running keeps the current numbers.
INSERT INTO public.registration_counter (id, total_seats, seats_left)
SELECT 1, 1300, GREATEST(1300 - count(*), 0)::INT
FROM public.registrations WHERE status IN ('pending', 'confirmed')
ON CONFLICT (id) DO NOTHING;

-- A registration holds a seat while it is pending or confirmed. The count moves when that changes: insert (-1),
-- rejection (+1), a rejection undone in the SQL editor (-1), a deleted registration that held a seat (+1).
CREATE OR REPLACE FUNCTION public.move_registration_counter() RETURNS TRIGGER AS $$
DECLARE
  v_held BOOLEAN := false;
  v_holds BOOLEAN := false;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_held := COALESCE(OLD.status IN ('pending', 'confirmed'), false);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_holds := COALESCE(NEW.status IN ('pending', 'confirmed'), false);
  END IF;
  IF v_holds AND NOT v_held THEN
    UPDATE public.registration_counter SET seats_left = GREATEST(seats_left - 1, 0) WHERE id = 1;
  ELSIF v_held AND NOT v_holds THEN
    UPDATE public.registration_counter SET seats_left = LEAST(seats_left + 1, total_seats) WHERE id = 1;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_move_registration_counter ON public.registrations;
CREATE TRIGGER trg_move_registration_counter
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.move_registration_counter();

ALTER TABLE public.registration_counter ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.registration_counter FROM PUBLIC, anon, authenticated;

-- Registering again: a rejected student may submit a new registration (uq_registrations_active_user_id, section 5,
-- only allows one pending or confirmed registration per user), up to 3 registrations in all: after a third rejection
-- the account can't register again. The rejected rows stay, with who rejected them and when.
-- Staff give a reason with every rejection made in the app (PATCH /api/admin/registrations); the student sees it on
-- their pass. Older rejections have none. The values match REJECTION_REASONS in src/lib/rejections.ts.
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

DO $$
BEGIN
  ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_rejection_reason_check;
  ALTER TABLE public.registrations ADD CONSTRAINT registrations_rejection_reason_check
    CHECK (rejection_reason IS NULL OR (
      status = 'rejected'
      AND rejection_reason IN ('unclear_screenshot', 'utr_mismatch', 'wrong_amount', 'duplicate_payment')
    ));
END $$;

-- Refuses a fourth registration, whoever inserts. 3 matches MAX_REGISTRATION_ATTEMPTS in src/lib/rejections.ts, and
-- /api/register looks for this message.
CREATE OR REPLACE FUNCTION public.guard_registration_attempts() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL
     AND (SELECT count(*) FROM public.registrations WHERE user_id = NEW.user_id AND status = 'rejected') >= 3 THEN
    RAISE EXCEPTION 'Registration attempts used up: this account has been rejected 3 times' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_guard_registration_attempts ON public.registrations;
CREATE TRIGGER trg_guard_registration_attempts
  BEFORE INSERT ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.guard_registration_attempts();

-- Internal: only the triggers above use these.
REVOKE EXECUTE ON FUNCTION public.move_registration_counter() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.guard_registration_attempts() FROM PUBLIC, anon, authenticated, service_role;
