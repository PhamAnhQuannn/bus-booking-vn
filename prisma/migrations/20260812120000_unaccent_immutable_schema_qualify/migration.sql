-- unaccent_immutable (defined in 20260517221513_init) resolved `unaccent` through the CALLER's
-- search_path. There is no ?schema= in DATABASE_URL and no SET search_path in app code, so under
-- CI load / pooled connections resolution intermittently failed with
--   ERROR: function unaccent(unknown, text) does not exist
-- which zeroed out diacritic-insensitive trip search (lib/trips/searchTrips.ts) and timed out every
-- search e2e. Schema-qualify public.unaccent so resolution never depends on search_path. The
-- extension was installed with no SCHEMA clause (CREATE EXTENSION IF NOT EXISTS unaccent) → it lives
-- in public on dev/CI/prod. Signature, output, and IMMUTABLE are unchanged, so the existing
-- trip_route_unaccent_idx GIN index stays valid — no reindex.
CREATE OR REPLACE FUNCTION unaccent_immutable(text) RETURNS text
  AS $$ SELECT public.unaccent('unaccent', $1) $$ LANGUAGE sql IMMUTABLE;
