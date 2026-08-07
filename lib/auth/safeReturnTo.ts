/**
 * Sanitize a user-supplied `returnTo` redirect target.
 *
 * Only same-origin relative paths are allowed. Anything else — absolute URLs
 * (`https://evil.tld`), protocol-relative (`//evil.tld`), or backslash tricks
 * (`/\evil.tld`) — falls back to `fallback`. This blocks the post-login open-redirect
 * (issue 021): an attacker link must not be able to bounce an authenticated user off-site.
 *
 * Accepts a value that starts with a single `/` not followed by `/` or `\`.
 *
 * Rejects any value containing an ASCII C0 control char (tab/CR/LF/NUL/…) first:
 * the WHATWG URL parser strips those before interpreting the string, so
 * `"/\t/evil.tld"` would pass the leading-slash regex yet resolve, post-strip, to
 * `"//evil.tld"` — a protocol-relative cross-origin URL. Checking the pre-strip
 * string alone is insufficient once the value reaches `new URL()` (the OAuth
 * callback's `NextResponse.redirect` path). Over-rejection is the safe failure.
 */
export function safeReturnTo(raw: string | null | undefined, fallback = '/'): string {
  if (!raw) return fallback;
  // Reject C0 control chars (tab/CR/LF/NUL/…) that URL parsers strip pre-parse.
  if (/[\x00-\x1f]/.test(raw)) return fallback;
  return /^\/(?![/\\])/.test(raw) ? raw : fallback;
}
