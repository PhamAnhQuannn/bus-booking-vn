/**
 * Browser-side CSRF token reader for double-submit submissions.
 *
 * Reads the bb_csrf cookie (set by proxy.ts on first GET) so client fetches
 * can echo it in the X-CSRF-Token header. Safe-method requests do not need it.
 */

const CSRF_COOKIE = 'bb_csrf';

export function readCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)bb_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export { CSRF_COOKIE };
