/**
 * Sanitize a user-supplied `returnTo` redirect target.
 *
 * Only same-origin relative paths are allowed. Anything else — absolute URLs
 * (`https://evil.tld`), protocol-relative (`//evil.tld`), or backslash tricks
 * (`/\evil.tld`) — falls back to `fallback`. This blocks the post-login open-redirect
 * (issue 021): an attacker link must not be able to bounce an authenticated user off-site.
 *
 * Accepts a value that starts with a single `/` not followed by `/` or `\`.
 */
export function safeReturnTo(raw: string | null | undefined, fallback = '/'): string {
  if (!raw) return fallback;
  return /^\/(?![/\\])/.test(raw) ? raw : fallback;
}
