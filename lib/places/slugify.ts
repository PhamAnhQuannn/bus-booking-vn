/**
 * Vietnamese-aware slugification for Place names (Issue 262).
 *
 * Converts "Hà Nội" → "ha-noi", "Đà Nẵng" → "da-nang", etc.
 * Mirrors the SQL equivalent: lower(unaccent_immutable(name)) with
 * non-alphanumeric replaced by hyphens.
 */

export function slugify(name: string): string {
  return (
    name
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unnamed'
  );
}
