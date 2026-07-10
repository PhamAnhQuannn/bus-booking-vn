-- Issue 262: backfill Place.slug for all existing rows where slug IS NULL.
-- Uses the same slugification logic as the TypeScript slugify():
--   1. translate đ/Đ → d (unaccent doesn't handle d-stroke)
--   2. unaccent_immutable strips remaining diacritics
--   3. lower() + regex replace non-alphanumeric → hyphens
--   4. trim leading/trailing hyphens
--
-- The Place_slug_key unique index already exists; if two places slugify to the
-- same value, the second UPDATE is a no-op (caught by WHERE slug IS NULL +
-- unique constraint — production should have distinct canonical names).

UPDATE "Place"
SET slug = regexp_replace(
  regexp_replace(
    lower(unaccent_immutable(translate("canonicalName", 'đĐ', 'dd'))),
    '[^a-z0-9]+', '-', 'g'
  ),
  '^-+|-+$', '', 'g'
)
WHERE slug IS NULL;
