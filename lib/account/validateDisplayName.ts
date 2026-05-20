/**
 * Display name validation using Intl.Segmenter for grapheme count.
 *
 * Rule: 4–100 Unicode grapheme clusters (not .length — prevents multi-byte
 * characters from miscounting).
 */

export const DISPLAY_NAME_MIN = 4;
export const DISPLAY_NAME_MAX = 100;

export type DisplayNameError = 'TOO_SHORT' | 'TOO_LONG';

const segmenter = new Intl.Segmenter();

/**
 * Validate a display name.
 * Returns null if valid, or an error code string if invalid.
 */
export function validateDisplayName(name: string): DisplayNameError | null {
  const graphemes = [...segmenter.segment(name)];
  if (graphemes.length < DISPLAY_NAME_MIN) return 'TOO_SHORT';
  if (graphemes.length > DISPLAY_NAME_MAX) return 'TOO_LONG';
  return null;
}

/**
 * Count grapheme clusters in a string.
 */
export function graphemeLength(s: string): number {
  return [...segmenter.segment(s)].length;
}
