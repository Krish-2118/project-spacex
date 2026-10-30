-- ==============================================================================
-- MIGRATION (run once in the Supabase SQL editor): college ID card upload.
--
-- Why: every participant's college ID card must be on file. New registrants upload a photo of the front of their
-- card in the registration form; students who registered before this upload it from MY PASS. Staff can't approve a
-- registration until its ID card is uploaded, and may ask a student for a new one.
-- This adds section 19 of supabase/schema.sql: the id_card_path / id_card_uploaded_at / id_card_reupload_reason
-- columns, trg_require_id_card_for_approval and the private 'id-cards' Storage bucket with its policies.
-- No existing row changes: every registration starts without an ID card ("ID card pending" on MY PASS).
--
-- Run it BEFORE deploying the code (the new code writes the new columns), then deploy straight away: until the deploy,
-- approving a registration fails because no one can upload an ID card yet.
-- Kept out of supabase/migrations/ on purpose so the Supabase CLI never applies it automatically. Safe to re-run.
-- ==============================================================================
-- Every registration carries a photo of the front of the registrant's college ID card, in the PRIVATE 'id-cards'
-- bucket (same rules as payment proofs, section 12: written only by the server with the service role, named
-- '<user_id>/<uuid>.<ext>', no public URLs, staff view it through short-lived signed URLs).
-- New registrations upload it in the form (/api/register requires it). Registrations made before this section have
-- none: the student uploads it from MY PASS (POST /api/id-card), even after registrations close.
-- Staff can't confirm a registration without one (trg_require_id_card_for_approval). A card can't be swapped by the
-- student; staff may ask for a new one (POST /api/admin/registrations/id-card), which clears id_card_path and stores
-- why in id_card_reupload_reason (values match ID_CARD_REUPLOAD_REASONS in src/lib/id-cards.ts). The old file stays.
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS id_card_path TEXT;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS id_card_uploaded_at TIMESTAMPTZ;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS id_card_reupload_reason TEXT;

DO $$
BEGIN
  -- Like registrations_payment_proof_path_check: a path inside the registrant's OWN folder, never a URL.
  ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_id_card_path_check;
  ALTER TABLE public.registrations ADD CONSTRAINT registrations_id_card_path_check
    CHECK (id_card_path IS NULL OR (
      id_card_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|heic)$'
      AND split_part(id_card_path, '/', 1) = user_id::text
    ));
  ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_id_card_reupload_reason_check;
  ALTER TABLE public.registrations ADD CONSTRAINT registrations_id_card_reupload_reason_check
    CHECK (id_card_reupload_reason IS NULL OR (
      id_card_path IS NULL
      AND id_card_reupload_reason IN ('unclear_photo', 'not_an_id_card', 'details_mismatch')
    ));
END $$;

-- Refuses confirming a registration that has no ID card, whoever updates: the service role included.
-- /api/admin/registrations looks for this message.
CREATE OR REPLACE FUNCTION public.require_id_card_for_approval() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed' AND NEW.id_card_path IS NULL THEN
    RAISE EXCEPTION 'ID card required before approval' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_require_id_card_for_approval ON public.registrations;
CREATE TRIGGER trg_require_id_card_for_approval
  BEFORE UPDATE OF status ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.require_id_card_for_approval();

-- Internal: only the trigger above uses it.
REVOKE EXECUTE ON FUNCTION public.require_id_card_for_approval() FROM PUBLIC, anon, authenticated, service_role;

-- The private bucket. Re-running this script also forces it back to private. 2 MiB: the form shrinks large photos
-- before uploading (src/lib/compress-image.ts); must match ID_CARD_MAX_BYTES in src/lib/security.ts.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('id-cards', 'id-cards', false, 2097152,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- No INSERT, UPDATE or DELETE policy for users: only /api/id-card writes, with the service role, after its checks.
-- Owners may see their own files (used by /api/register to confirm the upload exists). No staff policy: staff get
-- short-lived signed URLs from /api/admin/registrations/id-card.
DROP POLICY IF EXISTS "ID cards: owners read their own files" ON storage.objects;
CREATE POLICY "ID cards: owners read their own files" ON storage.objects FOR
SELECT TO authenticated USING (
  bucket_id = 'id-cards'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Guard rail, as for payment proofs: even a broad storage policy added later can't expose another user's ID card.
DROP POLICY IF EXISTS "ID cards: never outside the owner's folder" ON storage.objects;
CREATE POLICY "ID cards: never outside the owner's folder" ON storage.objects AS RESTRICTIVE FOR
ALL TO anon, authenticated
USING (bucket_id <> 'id-cards' OR (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id <> 'id-cards' OR (storage.foldername(name))[1] = auth.uid()::text);
