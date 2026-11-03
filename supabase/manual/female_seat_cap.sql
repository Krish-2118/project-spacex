-- ==============================================================================
-- MIGRATION (run once in the Supabase SQL editor): female seat cap.
--
-- Why: female registrations are capped at 350. At the cap the form shows Female and Others as FULL and the server refuses
-- them before any payment details are shown. A UPI payment can't be refunded, so a student who may already have paid
-- keeps access (see female_seat_kept below), which can take the count slightly over the cap in rare cases.
-- This adds section 21 of supabase/schema.sql. Existing registrations are not changed.
--
-- Run this BEFORE deploying the code that uses it: the new form's payment step fails without it. The code deployed now
-- keeps working once this has run.
-- Kept out of supabase/migrations/ on purpose so the Supabase CLI never applies it automatically. Safe to re-run: it never
-- changes the cap once set.
--
-- To change the cap:   UPDATE public.registration_counter SET female_cap = 400 WHERE id = 1;
-- To see the count:    SELECT public.female_seats_status();
-- ==============================================================================

-- 21. FEMALE SEAT CAP
-- Female registrations that are pending or confirmed, in any phase, count towards registration_counter.female_cap.
-- Others doesn't count towards it, but is closed along with Female at the cap. Separate from the seat counter: Male
-- registrations are never affected. A rejection frees the seat. Only the server reads and writes these.
ALTER TABLE public.registration_counter ADD COLUMN IF NOT EXISTS female_cap INTEGER NOT NULL DEFAULT 350;

-- The gender a payment pass was issued for. Set only while Female and Others were open to this student: 'female' holds a
-- seat until pay_by, and 'female' or 'others' lets the student submit at the cap until submit_by.
ALTER TABLE public.payment_passes ADD COLUMN IF NOT EXISTS gender TEXT;

DO $$
BEGIN
  ALTER TABLE public.registration_counter DROP CONSTRAINT IF EXISTS registration_counter_female_cap_check;
  ALTER TABLE public.registration_counter ADD CONSTRAINT registration_counter_female_cap_check
    CHECK (female_cap BETWEEN 0 AND 10000);
  ALTER TABLE public.payment_passes DROP CONSTRAINT IF EXISTS payment_passes_gender_check;
  ALTER TABLE public.payment_passes ADD CONSTRAINT payment_passes_gender_check
    CHECK (gender IS NULL OR gender IN ('male', 'female', 'others'));
END $$;

-- Seats taken: female registrations, plus female students on the payment step (without this hold, everyone paying at 349
-- would get in). p_user_id leaves out that student's own hold.
CREATE OR REPLACE FUNCTION public.female_seats_taken(p_user_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
  SELECT (SELECT count(*) FROM public.registrations WHERE gender = 'female' AND status IN ('pending', 'confirmed'))::INT
       + (SELECT count(*) FROM public.payment_passes
          WHERE gender = 'female' AND used_at IS NULL AND pay_by > now() AND user_id IS DISTINCT FROM p_user_id)::INT;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Who may still choose Female or Others at the cap, because they may already have paid: a live pass issued for one of
-- them before the cap, a payment staff allowed, or a registration rejected for a reason that doesn't question the payment.
CREATE OR REPLACE FUNCTION public.female_seat_kept(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.payment_passes
    WHERE user_id = p_user_id AND used_at IS NULL AND submit_by > now()
      AND (issued_by IS NOT NULL OR gender IN ('female', 'others'))
  ) OR COALESCE((
    SELECT r.status = 'rejected' AND r.gender IN ('female', 'others')
      AND r.rejection_reason IN ('unclear_screenshot', 'utr_mismatch') AND r.amount > 0
    FROM public.registrations r WHERE r.user_id = p_user_id ORDER BY r.created_at DESC LIMIT 1
  ), false);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- GET /api/seats, GET /api/admin/seats and GET /api/register/female-access.
CREATE OR REPLACE FUNCTION public.female_seats_status(p_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
  SELECT jsonb_build_object(
    'cap', c.female_cap,
    'registered', (SELECT count(*) FROM public.registrations WHERE gender = 'female' AND status IN ('pending', 'confirmed')),
    'full', public.female_seats_taken() >= c.female_cap,
    'keeps_access', p_user_id IS NOT NULL AND public.female_seat_kept(p_user_id))
  FROM public.registration_counter c WHERE c.id = 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- POST /api/register/start-payment: issue_payment_pass (section 20) with the cap in front of it. Adds one answer:
--   state 'female_full': no pass and no payment details for this gender.
-- FOR UPDATE, for Female and Others only, makes students reaching for the last seat take turns.
CREATE OR REPLACE FUNCTION public.start_payment_for_gender(p_user_id UUID, p_fresh BOOLEAN, p_gender TEXT)
RETURNS JSONB AS $$
DECLARE
  c public.registration_counter%ROWTYPE;
  p public.payment_passes%ROWTYPE;
  r public.registrations%ROWTYPE;
  v_capped BOOLEAN := COALESCE(p_gender IN ('female', 'others'), false);
  v_result JSONB;
BEGIN
  IF v_capped THEN
    SELECT * INTO c FROM public.registration_counter WHERE id = 1 FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'registration_counter has no row';
    END IF;
  END IF;

  SELECT * INTO p FROM public.payment_passes
  WHERE user_id = p_user_id AND used_at IS NULL AND submit_by > now()
  ORDER BY created_at DESC LIMIT 1;

  IF v_capped AND public.female_seats_taken(p_user_id) >= c.female_cap THEN
    IF public.female_seat_kept(p_user_id) THEN
      -- "I haven't paid" while the seats are full: nothing to honour.
      IF p_fresh AND c.closed_at IS NULL THEN
        RETURN jsonb_build_object('state', 'female_full');
      END IF;
      -- May already have paid, so they may continue with their proof, but aren't shown a way to pay again.
      IF p.id IS NOT NULL AND p.pay_by <= now() AND p.issued_by IS NULL THEN
        RETURN jsonb_build_object('state', 'already_paid', 'amount', p.amount, 'phase', p.phase, 'pay_seconds', 0, 'current_fee', NULL);
      END IF;
      IF p.id IS NULL THEN
        SELECT * INTO r FROM public.registrations WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 1;
        INSERT INTO public.payment_passes (user_id, phase, amount, pay_by, submit_by, gender)
        VALUES (p_user_id, r.phase, r.amount::INT, now(), now() + interval '24 hours', p_gender)
        RETURNING * INTO p;
        RETURN jsonb_build_object('state', 'already_paid', 'amount', p.amount, 'phase', p.phase, 'pay_seconds', 0, 'current_fee', NULL);
      END IF;
    -- With no phase open and no pass, the closed answer below is the one that matters.
    ELSIF c.closed_at IS NULL OR p.id IS NOT NULL THEN
      RETURN jsonb_build_object('state', 'female_full');
    END IF;
  END IF;

  v_result := public.issue_payment_pass(p_user_id, p_fresh);

  IF v_capped THEN
    UPDATE public.payment_passes SET gender = p_gender
    WHERE user_id = p_user_id AND used_at IS NULL AND submit_by > now();
  -- Another gender chosen on a renewed pass: a student who paid and picked wrongly must still be able to go back.
  ELSIF NOT p_fresh AND p.gender IN ('female', 'others') THEN
    UPDATE public.payment_passes SET gender = p.gender
    WHERE user_id = p_user_id AND used_at IS NULL AND submit_by > now() AND gender IS NULL;
  END IF;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- The last word, whoever inserts. /api/register looks for this message.
CREATE OR REPLACE FUNCTION public.guard_female_seats() RETURNS TRIGGER AS $$
DECLARE
  v_cap INTEGER;
BEGIN
  IF NEW.user_id IS NULL OR NEW.gender IS NULL OR NEW.gender NOT IN ('female', 'others')
     OR NEW.status NOT IN ('pending', 'confirmed') THEN
    RETURN NEW;
  END IF;
  SELECT female_cap INTO v_cap FROM public.registration_counter WHERE id = 1 FOR UPDATE;
  IF public.female_seats_taken(NEW.user_id) >= v_cap AND NOT public.female_seat_kept(NEW.user_id) THEN
    RAISE EXCEPTION 'Female and Others seats are full' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_guard_female_seats ON public.registrations;
CREATE TRIGGER trg_guard_female_seats
  BEFORE INSERT ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.guard_female_seats();

-- Only the server may call these; the helpers and the trigger need no grant.
REVOKE EXECUTE ON FUNCTION public.guard_female_seats() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.female_seats_taken(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.female_seat_kept(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.female_seats_status(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.start_payment_for_gender(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.female_seats_status(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.start_payment_for_gender(UUID, BOOLEAN, TEXT) TO service_role;
