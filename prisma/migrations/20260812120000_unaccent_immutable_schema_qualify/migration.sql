-- unaccent_immutable (defined in 20260517221513_init) resolved BOTH the `unaccent` function AND the
-- `'unaccent'` text-search dictionary through the CALLER's search_path. There is no ?schema= in
-- DATABASE_URL and no SET search_path in app code, so under CI load / pooled connections resolution
-- intermittently failed with
--   ERROR: function unaccent(unknown, text) does not exist          (function not on search_path)
-- and, once the function is qualified, the same missing-search_path state also breaks the dictionary:
--   ERROR: text search dictionary "unaccent" does not exist         (dictionary not on search_path)
-- Both were reproduced against postgres:16 with `SET search_path = ''`. Qualifying only the function
-- is therefore NOT enough. Pin the function's own search_path so both the function and the dictionary
-- resolve from `public` (where CREATE EXTENSION IF NOT EXISTS unaccent installed them on dev/CI/prod),
-- independent of the caller. Body, signature, output and IMMUTABLE are unchanged, so the existing
-- trip_route_unaccent_idx GIN index stays valid — verified CREATE INDEX + REINDEX both succeed with
-- this definition. This zeroed out diacritic-insensitive trip search (lib/trips/searchTrips.ts) and
-- timed out every search e2e.
CREATE OR REPLACE FUNCTION unaccent_immutable(text) RETURNS text
  AS $$ SELECT unaccent('unaccent', $1) $$ LANGUAGE sql IMMUTABLE SET search_path = public, pg_catalog;
