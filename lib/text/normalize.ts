/**
 * Vietnamese diacritic-insensitive normalize.
 *
 *   normalizeVi('Tổng quan') -> 'tong quan'
 *   normalizeVi('Đặt vé')    -> 'dat ve'
 *
 * Pure function — safe in any context. Used by the command palette search and
 * any other Vietnamese-text matching path.
 */
export function normalizeVi(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
}

/** Token-prefix match — every token in `query` must appear in `index`. */
export function fuzzyMatchVi(query: string, index: string): boolean {
  const q = normalizeVi(query)
  if (!q) return true
  return q.split(/\s+/).every((t) => index.includes(t))
}
