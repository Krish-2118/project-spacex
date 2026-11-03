-- From section 2 of supabase/schema.sql, for a database that already has the rest. Safe to run more than once. The app works
-- without it: these only make two frequent reads faster.
--   idx_registrations_email:         GET /api/register looks a user up by id OR email on every poll; without an index on
--                                    email, each lookup scans the whole table.
--   idx_registrations_created_at_id: the admin list reads in (created_at, id) order, a page at a time.
CREATE INDEX IF NOT EXISTS idx_registrations_email ON public.registrations(email);
CREATE INDEX IF NOT EXISTS idx_registrations_created_at_id ON public.registrations(created_at, id);
