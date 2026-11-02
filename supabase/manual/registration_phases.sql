-- ==============================================================================
-- MIGRATION (run once in the Supabase SQL editor): registration phases.
--
-- Why: when the seat counter reaches 0 registrations close, and admins later start the next phase by hand with a new
-- fee and new numbers. A UPI payment can't be stopped or refunded, so the server remembers the fee it quoted each
-- student and honours it, and everyone else goes through the helpdesk.
-- This adds section 20 of supabase/schema.sql. Existing registrations become phase 1 and keep their amount. The counter
-- keeps its current numbers: phase 1 at Rs 999, closed straight away only if seats left is already 0.
--
-- Run this BEFORE deploying the code that uses it: the new form refuses to show payment details without it.
-- After this, do NOT re-run seat_counter_and_reregistration.sql: it would put back the old counter trigger (re-running
-- this file repairs that).
-- Kept out of supabase/migrations/ on purpose so the Supabase CLI never applies it automatically. Safe to re-run: it
-- never changes the phase, fee or numbers once they exist.
-- ==============================================================================

-- 20. REGISTRATION PHASES
-- Registrations sell in phases, one at a time. registration_counter holds the current phase and its fee. A phase is
-- open until closed_at is set, which happens by itself the moment seats_left reaches 0, however it got there. Only
-- start_registration_phase() (an admin, POST /api/admin/seats/phase) opens the next one: editing the numbers never does.
ALTER TABLE public.registration_counter ADD COLUMN IF NOT EXISTS phase INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.registration_counter ADD COLUMN IF NOT EXISTS fee_inr INTEGER NOT NULL DEFAULT 999;
ALTER TABLE public.registration_counter ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- phase: the phase whose fee it was charged at. submitted_late: submitted after its phase closed and after the time
-- allowed for paying, so staff must check the payment date against pay_by on the bank statement. allowed_by: the staff
-- member who allowed it through the helpdesk. amount: the full fee owed. amount_due: the part still to be paid (asked
-- for by staff when someone paid too little: there are no refunds, so they pay the difference rather than the whole
-- fee again), and top_up_utr is the UTR of that second payment.
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS phase INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS submitted_late BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS pay_by TIMESTAMPTZ;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS allowed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS amount_due INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS top_up_utr TEXT;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS top_up_recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS top_up_recorded_at TIMESTAMPTZ;

DO $$
BEGIN
  -- 100000 matches MAX_FEE in src/lib/seats.ts.
  ALTER TABLE public.registration_counter DROP CONSTRAINT IF EXISTS registration_counter_phase_check;
  ALTER TABLE public.registration_counter ADD CONSTRAINT registration_counter_phase_check
    CHECK (phase >= 1 AND fee_inr BETWEEN 1 AND 100000);
  ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_amount_due_check;
  ALTER TABLE public.registrations ADD CONSTRAINT registrations_amount_due_check
    CHECK (amount_due BETWEEN 0 AND 100000);
  ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_top_up_utr_check;
  ALTER TABLE public.registrations ADD CONSTRAINT registrations_top_up_utr_check
    CHECK (top_up_utr IS NULL OR top_up_utr ~ '^[0-9]{12}$');
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_registrations_top_up_utr ON public.registrations(top_up_utr)
  WHERE top_up_utr IS NOT NULL;

-- Closes the phase the moment the count reaches 0: in the same statement, so simultaneous registrations can't slip past.
CREATE OR REPLACE FUNCTION public.close_registration_phase_at_zero() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.seats_left = 0 AND NEW.closed_at IS NULL THEN
    NEW.closed_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_close_registration_phase_at_zero ON public.registration_counter;
CREATE TRIGGER trg_close_registration_phase_at_zero
  BEFORE INSERT OR UPDATE OF seats_left ON public.registration_counter
  FOR EACH ROW EXECUTE FUNCTION public.close_registration_phase_at_zero();

UPDATE public.registration_counter SET closed_at = now() WHERE seats_left = 0 AND closed_at IS NULL;

-- Replaces section 17's version. The count only moves for a registration of the current phase while that phase is open:
-- a rejection after closing can't reopen sales, and a late or older-phase registration doesn't touch the new phase's
-- count. The WHERE clause does the check, so it holds even if a phase closes at the same moment.
CREATE OR REPLACE FUNCTION public.move_registration_counter() RETURNS TRIGGER AS $$
DECLARE
  v_held BOOLEAN := false;
  v_holds BOOLEAN := false;
  v_phase INTEGER;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_held := COALESCE(OLD.status IN ('pending', 'confirmed'), false);
    v_phase := OLD.phase;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_holds := COALESCE(NEW.status IN ('pending', 'confirmed'), false);
    v_phase := NEW.phase;
  END IF;
  IF v_holds AND NOT v_held THEN
    UPDATE public.registration_counter SET seats_left = GREATEST(seats_left - 1, 0)
    WHERE id = 1 AND phase = v_phase AND closed_at IS NULL;
  ELSIF v_held AND NOT v_holds THEN
    UPDATE public.registration_counter SET seats_left = LEAST(seats_left + 1, total_seats)
    WHERE id = 1 AND phase = v_phase AND closed_at IS NULL;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Replaces section 5's version: the fee is the current phase's, and the phase columns can't be chosen by the inserter.
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
  SELECT fee_inr, phase INTO NEW.amount, NEW.phase FROM public.registration_counter WHERE id = 1;
  NEW.submitted_late := false;
  NEW.pay_by := NULL;
  NEW.allowed_by := NULL;
  NEW.amount_due := 0;
  NEW.top_up_utr := NULL;
  NEW.top_up_recorded_by := NULL;
  NEW.top_up_recorded_at := NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Refuses approval while part of the fee is still due, whoever updates: the service role included.
-- /api/admin/registrations looks for this message.
CREATE OR REPLACE FUNCTION public.require_amount_paid_for_approval() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed' AND NEW.amount_due > 0 THEN
    RAISE EXCEPTION 'Amount due before approval' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_require_amount_paid_for_approval ON public.registrations;
CREATE TRIGGER trg_require_amount_paid_for_approval
  BEFORE UPDATE OF status ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.require_amount_paid_for_approval();

-- One UPI transaction pays for one thing: a top-up's UTR can't be any registration's UTR, in either direction. The same
-- code and wording as uq_registrations_utr, so /api/register answers it the same way.
CREATE OR REPLACE FUNCTION public.guard_top_up_utr() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.top_up_utr IS NOT NULL AND (
    NEW.top_up_utr = NEW.utr
    OR EXISTS (SELECT 1 FROM public.registrations r WHERE r.utr = NEW.top_up_utr AND r.status <> 'rejected' AND r.id <> NEW.id)
  ) THEN
    RAISE EXCEPTION 'This utr is already used by a registration' USING ERRCODE = '23505';
  END IF;
  IF NEW.utr IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.registrations r WHERE r.top_up_utr = NEW.utr AND r.id <> NEW.id) THEN
    RAISE EXCEPTION 'This utr is already used by a top-up' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_guard_top_up_utr ON public.registrations;
CREATE TRIGGER trg_guard_top_up_utr
  BEFORE INSERT OR UPDATE OF utr, top_up_utr ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.guard_top_up_utr();

-- A payment pass is the server's record of the fee quoted to a student. The form shows payment details only with a pass
-- and until pay_by; the student may submit at that fee until submit_by, even after the phase closes or the fee rises.
-- issued_by is set when staff allowed a payment through the helpdesk (POST /api/admin/registrations/payment-pass); note
-- says why. used_at is set once it is turned into a registration, or replaced by a newer pass. Only the server reads
-- and writes these.
CREATE TABLE IF NOT EXISTS public.payment_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phase INTEGER NOT NULL,
  amount INTEGER NOT NULL CHECK (amount BETWEEN 1 AND 100000),
  pay_by TIMESTAMPTZ NOT NULL,
  submit_by TIMESTAMPTZ NOT NULL,
  issued_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 300),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_passes_user ON public.payment_passes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_passes_in_progress ON public.payment_passes(pay_by) WHERE used_at IS NULL;

ALTER TABLE public.payment_passes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_passes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.payment_passes TO service_role;

-- The registration a student may re-register from without paying again: their latest, rejected for a reason that doesn't
-- question the payment itself, at a fee that isn't the current open one (otherwise they just get the current fee).
CREATE OR REPLACE FUNCTION public.inherited_registration_payment(p_user_id UUID, p_counter public.registration_counter)
RETURNS public.registrations AS $$
DECLARE
  r public.registrations%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.registrations WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 1;
  IF FOUND AND r.status = 'rejected' AND r.rejection_reason IN ('unclear_screenshot', 'utr_mismatch') AND r.amount > 0
     AND (p_counter.closed_at IS NOT NULL OR r.phase <> p_counter.phase) THEN
    RETURN r;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- POST /api/register/start-payment. Answers:
--   state 'pay': a pass, show the payment details until pay_by.
--   state 'already_paid': a pass, but the time to pay has passed: no payment details, only "already paid? continue".
--     current_fee is set when a phase is open, so the student can pay that instead.
--   state 'closed': no pass and no phase open.
-- p_fresh: the student hasn't paid and wants the current fee, replacing any older pass. Ignored while closed.
-- FOR SHARE orders this against a registration closing the phase: a pass issued a moment before closing stands.
CREATE OR REPLACE FUNCTION public.issue_payment_pass(p_user_id UUID, p_fresh BOOLEAN DEFAULT false)
RETURNS JSONB AS $$
DECLARE
  c public.registration_counter%ROWTYPE;
  p public.payment_passes%ROWTYPE;
  r public.registrations%ROWTYPE;
  v_open BOOLEAN;
  v_state TEXT := 'pay';
BEGIN
  SELECT * INTO c FROM public.registration_counter WHERE id = 1 FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'registration_counter has no row';
  END IF;
  v_open := c.closed_at IS NULL;

  IF NOT (p_fresh AND v_open) THEN
    SELECT * INTO p FROM public.payment_passes
    WHERE user_id = p_user_id AND used_at IS NULL AND submit_by > now()
    ORDER BY created_at DESC LIMIT 1;
    IF FOUND THEN
      IF p.pay_by <= now() THEN
        v_state := 'already_paid';
      END IF;
      -- The student's own pass in the phase still open simply renews below, at the same fee.
      IF p.pay_by > now() OR p.issued_by IS NOT NULL OR NOT v_open OR p.phase <> c.phase THEN
        RETURN jsonb_build_object(
          'state', v_state, 'amount', p.amount, 'phase', p.phase,
          'pay_seconds', GREATEST(EXTRACT(EPOCH FROM p.pay_by - now()), 0)::INT,
          'current_fee', CASE WHEN v_open THEN c.fee_inr END);
      END IF;
    ELSE
      r := public.inherited_registration_payment(p_user_id, c);
      IF r.id IS NOT NULL THEN
        INSERT INTO public.payment_passes (user_id, phase, amount, pay_by, submit_by)
        VALUES (p_user_id, r.phase, r.amount::INT, now(), now() + interval '24 hours')
        RETURNING * INTO p;
        RETURN jsonb_build_object(
          'state', 'already_paid', 'amount', p.amount, 'phase', p.phase, 'pay_seconds', 0,
          'current_fee', CASE WHEN v_open THEN c.fee_inr END);
      END IF;
    END IF;
  END IF;

  IF NOT v_open THEN
    RETURN jsonb_build_object('state', 'closed');
  END IF;

  UPDATE public.payment_passes SET used_at = now() WHERE user_id = p_user_id AND used_at IS NULL;
  -- 15 minutes to pay, 24 hours to submit. After that: the current fee, or the helpdesk.
  INSERT INTO public.payment_passes (user_id, phase, amount, pay_by, submit_by)
  VALUES (p_user_id, c.phase, c.fee_inr, now() + interval '15 minutes', now() + interval '24 hours')
  RETURNING * INTO p;
  RETURN jsonb_build_object(
    'state', 'pay', 'amount', p.amount, 'phase', p.phase,
    'pay_seconds', GREATEST(EXTRACT(EPOCH FROM p.pay_by - now()), 0)::INT,
    'current_fee', c.fee_inr);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- POST /api/register: what this submit is charged and whether it may go ahead at all. Never reads the request: a pass
-- first, then a payment re-submitted after a rejection, then the current fee if a phase is open. Otherwise refused.
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
      'late', (c.closed_at IS NOT NULL OR p.phase <> c.phase) AND now() > p.pay_by);
  END IF;

  r := public.inherited_registration_payment(p_user_id, c);
  IF r.id IS NOT NULL THEN
    RETURN jsonb_build_object('allowed', true, 'amount', r.amount, 'phase', r.phase, 'late', true);
  END IF;

  IF c.closed_at IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'amount', c.fee_inr, 'phase', c.phase, 'late', false);
  END IF;
  RETURN jsonb_build_object('allowed', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- POST /api/admin/seats/phase. The only way to reopen. Refused while a phase is open, so a double click or a stale
-- screen can't skip a phase or change the fee under students who are paying.
CREATE OR REPLACE FUNCTION public.start_registration_phase(p_fee INTEGER, p_total INTEGER, p_left INTEGER, p_admin UUID)
RETURNS VOID AS $$
DECLARE
  c public.registration_counter%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.registration_counter WHERE id = 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'registration_counter has no row';
  END IF;
  IF c.closed_at IS NULL THEN
    RAISE EXCEPTION 'Phase % is still open', c.phase USING ERRCODE = '55000';
  END IF;
  IF p_left < 1 THEN
    RAISE EXCEPTION 'A new phase needs at least one seat' USING ERRCODE = '23514';
  END IF;
  UPDATE public.registration_counter
  SET phase = c.phase + 1, fee_inr = p_fee, total_seats = p_total, seats_left = p_left, closed_at = NULL,
      updated_by = p_admin, updated_at = now()
  WHERE id = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Only the server may call these; the triggers need no grant.
REVOKE EXECUTE ON FUNCTION public.close_registration_phase_at_zero() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.require_amount_paid_for_approval() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.guard_top_up_utr() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.inherited_registration_payment(UUID, public.registration_counter) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.issue_payment_pass(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_registration_payment(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.start_registration_phase(INTEGER, INTEGER, INTEGER, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_payment_pass(UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_registration_payment(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.start_registration_phase(INTEGER, INTEGER, INTEGER, UUID) TO service_role;
