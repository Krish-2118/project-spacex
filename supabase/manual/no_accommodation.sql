-- ==============================================================================
-- MIGRATION (run once in the Supabase SQL editor): accommodation.
--
-- Why: registrations made so far include accommodation. From now on, every new Female and Others registration is without
-- it, and Male is optional until an admin closes it on the admin dashboard. The fee doesn't change, and every registration
-- still takes a seat on the counter. This adds section 22 of supabase/schema.sql. Existing registrations keep accommodation.
--
-- Run this BEFORE deploying the code that uses it: the new form's payment step fails without it. The code deployed now
-- keeps working once this has run, with Female and Others refused as full until the new code goes live.
-- Kept out of supabase/migrations/ on purpose so the Supabase CLI never applies it automatically. Safe to re-run.
-- Don't re-run female_seat_cap.sql afterwards: it restores the old cap rules.
--
-- To see the counts:
--   SELECT gender, accommodation, count(*) FROM public.registrations
--   WHERE status IN ('pending', 'confirmed') GROUP BY 1, 2 ORDER BY 1, 2;
-- ==============================================================================

-- 22. ACCOMMODATION
-- Registrations made before this section keep accommodation. From here on, every new Female and Others registration is
-- without it, and Male is optional until an admin closes it (registration_counter.male_accommodation_open). The fee is the
-- same either way, and every registration still takes a seat on the counter. registration_counter.female_cap no longer
-- stops anyone: it only counts Female registrations with accommodation. Only the server reads and writes these.
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS accommodation BOOLEAN NOT NULL DEFAULT true;

-- What the student was told when they started paying: true or false. NULL means the pass came before this section, or is
-- a payment staff allowed that the student hasn't continued yet.
ALTER TABLE public.payment_passes ADD COLUMN IF NOT EXISTS accommodation BOOLEAN;

ALTER TABLE public.registration_counter ADD COLUMN IF NOT EXISTS male_accommodation_open BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.registration_counter ADD COLUMN IF NOT EXISTS male_accommodation_updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.registration_counter ADD COLUMN IF NOT EXISTS male_accommodation_updated_at TIMESTAMPTZ;

-- Replaces section 21's version: only accommodation counts towards the cap.
CREATE OR REPLACE FUNCTION public.female_seats_taken(p_user_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
  SELECT (SELECT count(*) FROM public.registrations WHERE gender = 'female' AND accommodation AND status IN ('pending', 'confirmed'))::INT
       + (SELECT count(*) FROM public.payment_passes
          WHERE gender = 'female' AND accommodation IS DISTINCT FROM false AND used_at IS NULL AND pay_by > now()
            AND user_id IS DISTINCT FROM p_user_id)::INT;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Replaces section 21's version, for GET /api/admin/seats: only accommodation counts as registered.
CREATE OR REPLACE FUNCTION public.female_seats_status(p_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
  SELECT jsonb_build_object(
    'cap', c.female_cap,
    'registered', (SELECT count(*) FROM public.registrations WHERE gender = 'female' AND accommodation AND status IN ('pending', 'confirmed')),
    'full', public.female_seats_taken() >= c.female_cap,
    'keeps_access', p_user_id IS NOT NULL AND public.female_seat_kept(p_user_id))
  FROM public.registration_counter c WHERE c.id = 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- POST /api/register/start-payment: issue_payment_pass (section 20), deciding accommodation in front of it and saving the
-- decision on the pass. Replaces start_payment_for_gender, which stays only for the code deployed while this is being run.
--   state 'accommodation_closed': a Male student asked for accommodation after it closed. No pass, no payment details.
-- Every other answer gains 'accommodation': what the form shows above the payment details.
-- A Male student quoted accommodation before it closed keeps it: they may already have paid, and UPI can't be refunded.
-- "I haven't paid" (p_fresh, while a phase is open) gives that up.
CREATE OR REPLACE FUNCTION public.start_payment_with_accommodation(p_user_id UUID, p_fresh BOOLEAN, p_gender TEXT, p_no_accommodation BOOLEAN)
RETURNS JSONB AS $$
DECLARE
  c public.registration_counter%ROWTYPE;
  p public.payment_passes%ROWTYPE;
  v_accommodation BOOLEAN;
  v_result JSONB;
BEGIN
  SELECT * INTO c FROM public.registration_counter WHERE id = 1 FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'registration_counter has no row';
  END IF;

  SELECT * INTO p FROM public.payment_passes
  WHERE user_id = p_user_id AND used_at IS NULL AND submit_by > now()
  ORDER BY created_at DESC LIMIT 1;

  IF p_gender IS DISTINCT FROM 'male' THEN
    v_accommodation := false;
  ELSIF NOT c.male_accommodation_open AND p.id IS NOT NULL AND p.accommodation IS DISTINCT FROM false
        AND (NOT p_fresh OR c.closed_at IS NOT NULL) THEN
    v_accommodation := true;
  ELSIF p_no_accommodation THEN
    v_accommodation := false;
  ELSIF c.male_accommodation_open THEN
    v_accommodation := true;
  ELSE
    RETURN jsonb_build_object('state', 'accommodation_closed');
  END IF;

  v_result := public.issue_payment_pass(p_user_id, p_fresh);
  IF v_result->>'state' = 'closed' THEN
    RETURN v_result;
  END IF;

  UPDATE public.payment_passes SET accommodation = v_accommodation, gender = p_gender
  WHERE user_id = p_user_id AND used_at IS NULL AND submit_by > now();
  RETURN v_result || jsonb_build_object('accommodation', v_accommodation);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Replaces section 20's version. Adds what /api/register needs to decide accommodation: the decision saved on the pass,
-- and whether Male accommodation is open.
CREATE OR REPLACE FUNCTION public.resolve_registration_payment(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  c public.registration_counter%ROWTYPE;
  p public.payment_passes%ROWTYPE;
  r public.registrations%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.registration_counter WHERE id = 1 FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'registration_counter has no row';
  END IF;

  SELECT * INTO p FROM public.payment_passes
  WHERE user_id = p_user_id AND used_at IS NULL AND submit_by > now()
  ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'allowed', true, 'amount', p.amount, 'phase', p.phase, 'pass_id', p.id, 'pay_by', p.pay_by,
      'allowed_by', p.issued_by,
      'late', (c.closed_at IS NOT NULL OR p.phase <> c.phase) AND now() > p.pay_by,
      'pass_accommodation', p.accommodation, 'male_accommodation_open', c.male_accommodation_open);
  END IF;

  r := public.inherited_registration_payment(p_user_id, c);
  IF r.id IS NOT NULL THEN
    RETURN jsonb_build_object('allowed', true, 'amount', r.amount, 'phase', r.phase, 'late', true,
      'male_accommodation_open', c.male_accommodation_open);
  END IF;

  IF c.closed_at IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'amount', c.fee_inr, 'phase', c.phase, 'late', false,
      'male_accommodation_open', c.male_accommodation_open);
  END IF;
  RETURN jsonb_build_object('allowed', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- The last word, whoever inserts. Replaces section 21's trg_guard_female_seats. /api/register looks for these messages. A
-- row that doesn't say otherwise means accommodation, so the Female and Others message is also what the code deployed
-- while this is being run gets, and it already shows that as full.
CREATE OR REPLACE FUNCTION public.guard_registration_accommodation() RETURNS TRIGGER AS $$
BEGIN
  IF NOT NEW.accommodation OR NEW.user_id IS NULL OR NEW.status NOT IN ('pending', 'confirmed') THEN
    RETURN NEW;
  END IF;
  IF NEW.gender IN ('female', 'others') THEN
    RAISE EXCEPTION 'Female and Others seats are full' USING ERRCODE = '23514';
  END IF;
  IF NOT (SELECT male_accommodation_open FROM public.registration_counter WHERE id = 1) AND NOT EXISTS (
    SELECT 1 FROM public.payment_passes
    WHERE user_id = NEW.user_id AND used_at IS NULL AND submit_by > now() AND accommodation IS DISTINCT FROM false
  ) THEN
    RAISE EXCEPTION 'Male accommodation is closed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_guard_female_seats ON public.registrations;
DROP FUNCTION IF EXISTS public.guard_female_seats();
DROP TRIGGER IF EXISTS trg_guard_registration_accommodation ON public.registrations;
CREATE TRIGGER trg_guard_registration_accommodation
  BEFORE INSERT ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.guard_registration_accommodation();

-- Replaces section 13's version: the scanner's details also say whether accommodation is included.
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
    'enrollment_no', r.enrollment_no, 'college', r.college, 'phone', r.phone, 'utr', r.utr,
    'accommodation', r.accommodation
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Only the server may call these; the helpers and the trigger need no grant.
REVOKE EXECUTE ON FUNCTION public.guard_registration_accommodation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.start_payment_with_accommodation(UUID, BOOLEAN, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_payment_with_accommodation(UUID, BOOLEAN, TEXT, BOOLEAN) TO service_role;
