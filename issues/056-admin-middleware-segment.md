---
depends-on: [054-admin-auth-core, 055-admin-totp-step-up]
type: FEATURE
wave: 1
spec: [S10, SYS14, SYS18, S15-8]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S10] / [SYS18] (S15#8 door posture)

## What to build

The `/admin` route segment + **Edge middleware guard** with separate cookie scope and
strict exact-match allowlist. S15#8: Stage-0 one-app `/admin` segment with separate
credential store + separate cookie scope + strict exact-match middleware + mandatory TOTP
(weaker-than-subdomain, accepted explicitly; Stage-1 = subdomain split later).

- `app/admin/` route segment (pages land in Wave 3; this issue creates the segment + its
  layout shell + the auth boundary).
- Extend `proxy.ts` middleware: verify the admin JWT via `jose.jwtVerify` (Edge-safe, no DB
  read) reading the role + 2FA claim (issue 055); redirect unauthenticated/▸non-TOTP to the
  admin login. Per Mistake-Log Issue 010: **exact-match `Set` allowlist** for admin free
  paths (login), NOT `startsWith` (prevents `/admin/login-bypass` sneak-throughs).
- Separate cookie scope for the admin realm (distinct cookie name/path from customer +
  operator); admin cookie never accepted on customer/operator routes.
- CSRF double-submit on all non-safe `/api/admin/*` (per SYS14 — gate + client helper +
  e2e prime in the same commit, Mistake-Log Issue 007).
- `/admin` is NOT linked from the public site / customer/operator login pages.

## Acceptance criteria

- [ ] `app/admin/` segment + layout exist behind the auth boundary.
- [ ] Middleware verifies admin JWT in Edge (no DB read); non-authed/non-TOTP → admin login
      redirect.
- [ ] Admin free-path allowlist is an exact-match Set (bypass-path test fails to sneak in).
- [ ] Admin cookie scope is distinct; rejected on customer/operator routes (+ vice-versa).
- [ ] CSRF enforced on non-safe `/api/admin/*`; client + e2e CSRF helpers shipped same commit.
- [ ] `/admin` not linked from any public/customer/operator page.

## Blocked by

- Blocked by `issues/054-admin-auth-core.md`, `issues/055-admin-totp-step-up.md`

## User stories addressed

- [S10]/[SYS18] separate door posture (S15#8); Edge-safe claim middleware; exact-match
  allowlist.
