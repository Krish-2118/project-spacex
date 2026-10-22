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
