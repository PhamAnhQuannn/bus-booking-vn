---
priority: must
source: security-review
fingerprint: sec-open-redirect-returnto
severity: P1
---

## Parent PRD

`issues/prd.md` (fix-issue derived from a PR #2 security-review finding — no parent slice)

## What to build

Fix: open redirect via the `returnTo` query param. Surfaced by /security-review in
security/open-redirect at `app/auth/login/page.tsx:35,60` and
`app/auth/register/page.tsx:76,192`.

`returnTo = searchParams.get('returnTo') ?? '/'` is passed straight to
`router.push(returnTo)` after a successful auth with no validation. A crafted link
(`/auth/login?returnTo=https://evil.tld` or protocol-relative `//evil.tld`) bounces a
freshly-authenticated user off-site — a post-login phishing primitive.

Suggested fix: accept only same-origin relative paths. Extract a shared helper
`lib/auth/safeReturnTo.ts`:

```ts
export function safeReturnTo(raw: string | null, fallback = '/'): string {
  if (!raw) return fallback;
  // must be a single-slash absolute path; reject //host, /\host, and absolute URLs
  return /^\/(?![/\\])/.test(raw) ? raw : fallback;
}
```

Apply in both login and register where `returnTo` is read.

## Acceptance criteria

- [ ] `returnTo` values not matching `^/(?![/\\])` (e.g. `https://evil.tld`, `//evil.tld`,
      `/\evil.tld`) fall back to `/`; legitimate paths like `/account/bookings` pass through.
- [ ] Both `app/auth/login` and `app/auth/register` route through the shared `safeReturnTo()`.
- [ ] A unit test covers the reject + pass-through cases.
- [ ] /security-review no longer emits fingerprint `sec-open-redirect-returnto`.

## Blocked by

None - can start immediately.
