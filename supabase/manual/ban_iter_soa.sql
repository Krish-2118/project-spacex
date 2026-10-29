-- ==============================================================================
-- MIGRATION (run once in the Supabase SQL editor): ITER - SOA students may not register.
--
-- Why: ITER (Institute of Technical Education and Research) and SOA (Siksha 'O' Anusandhan) students are not allowed
-- at Innovision 2026. /api/register and the form refuse them by the college they type (any case or spelling: ITER,
-- I.T.E.R., iter-soa, SOA University, Shiksha O Anushandhan...) or by an @soa. / @iter. email; this makes the
-- database refuse them too, whoever inserts (the service role included).
-- This adds section 18 of supabase/schema.sql: public.is_iter_soa_college and trg_refuse_iter_soa_registration.
-- No existing row changes: registrations made before the ban stay, and staff can still confirm or reject them.
--
-- Run it before or after deploying the code: either refuses ITER - SOA on its own.
-- Kept out of supabase/migrations/ on purpose so the Supabase CLI never applies it automatically. Safe to re-run.
-- ==============================================================================

-- Students of ITER (Institute of Technical Education and Research) and SOA (Siksha 'O' Anusandhan) may not register.
-- True for any spelling of either name, whatever the case or punctuation: ITER, I.T.E.R., iter-soa, SOA University,
-- Institute of Technical Education & Research, Shiksha O Anushandhan... Must match isIterSoaCollege in
-- src/lib/validation.ts.
CREATE OR REPLACE FUNCTION public.is_iter_soa_college(p_college TEXT) RETURNS BOOLEAN AS $$
DECLARE
  v_spaced TEXT;
BEGIN
  IF p_college IS NULL THEN
    RETURN FALSE;
  END IF;
  -- "I.T.E.R., S.O.A" -> "i t e r s o a": accents and full-width letters folded, everything but a-z and 0-9 a space.
  v_spaced := btrim(regexp_replace(
    lower(regexp_replace(normalize(p_college, NFKD), '[\u0300-\u036f]', '', 'g')) COLLATE "C",
    '[^a-z0-9]+', ' ', 'g'
  ));
  RETURN v_spaced ~ '(^| )(iter|soa|soau|i t e r|s o a|s o a u)( |$)'
      OR replace(v_spaced, ' ', '') ~ '(itersoa|soaiter|technicaleducationa?n?d?research|sh?ik?s?h?a+o?a*nush?andh?a+n)';
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Refuses a registration from ITER - SOA, by its college or by an ITER / SOA email (@soa.ac.in, @iter.ac.in and their
-- subdomains, as isIterSoaEmail), whoever inserts: /api/register (service role) included. Registrations made before
-- the ban stay, and staff can still confirm or reject them: only a new row, or a change to its college or email, is
-- checked. /api/register looks for this message.
CREATE OR REPLACE FUNCTION public.refuse_iter_soa_registration() RETURNS TRIGGER AS $$
BEGIN
  IF public.is_iter_soa_college(NEW.college) OR lower(btrim(COALESCE(NEW.email, ''))) ~ '@([a-z0-9-]+\.)*(soa|iter)\.' THEN
    RAISE EXCEPTION 'ITER / SOA registrations are not allowed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_refuse_iter_soa_registration ON public.registrations;
CREATE TRIGGER trg_refuse_iter_soa_registration
  BEFORE INSERT OR UPDATE OF college, email ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.refuse_iter_soa_registration();

-- Internal: only the trigger above uses it.
REVOKE EXECUTE ON FUNCTION public.refuse_iter_soa_registration() FROM PUBLIC, anon, authenticated, service_role;
