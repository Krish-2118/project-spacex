-- ==============================================================================
-- POST-MIGRATION STEP: remove the legacy ImageKit payment-proof column.
--
-- Run ONLY after `node --env-file=.env scripts/migrate-payment-proofs.mjs cleanup --confirm-delete` has reported
-- every registration as migrated (payment_screenshot_url cleared, Supabase copy verified).
--
-- Kept out of supabase/migrations/ on purpose so the Supabase CLI never applies it automatically.
-- Safe to re-run. It refuses to do anything while any registration still holds an ImageKit URL.
-- ==============================================================================

DO $$
DECLARE
  v_remaining INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'registrations' AND column_name = 'payment_screenshot_url'
  ) THEN
    RAISE NOTICE 'payment_screenshot_url already removed; nothing to do';
    RETURN;
  END IF;

  EXECUTE 'SELECT count(*) FROM public.registrations WHERE COALESCE(payment_screenshot_url, '''') <> '''''
    INTO v_remaining;
  IF v_remaining > 0 THEN
    RAISE EXCEPTION '% registration(s) still reference an ImageKit payment proof; run the migration (copy, verify, cleanup) first', v_remaining;
  END IF;

  DROP TRIGGER IF EXISTS trg_reject_payment_proof_urls ON public.registrations;
  DROP FUNCTION IF EXISTS public.reject_payment_proof_urls();
  ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_payment_screenshot_url_check;
  ALTER TABLE public.registrations DROP COLUMN payment_screenshot_url;
  RAISE NOTICE 'Removed legacy column public.registrations.payment_screenshot_url';
END $$;
