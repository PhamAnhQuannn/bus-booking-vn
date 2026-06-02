---
depends-on: []
type: FEATURE
wave: 0.5
spec: [S14, SYS14]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S14] / [SYS14]

## What to build

The **edge rate-limit** half of the S14 gate. `proxy.ts` enforces CSRF double-submit on all
non-safe `/api/*` but applies **no rate-limiting**; the limiter is invoked per-route in only ~5
handlers. Spec [S14]: "rate-limit + CSRF on all non-safe `/api/*` (customer + operator + admin);
webhooks exempt (HMAC)."

- In `proxy.ts`, layer an IP rate-limit on **all non-safe-method `/api/*`** requests (customer +
  operator + admin), alongside the existing CSRF check; reuse `lib/ratelimit`
  (`ratelimit.limit(ip)` → `{allowed, remaining, retryAfter}`), returning `429` + `Retry-After` on
  breach.
- Webhooks stay **exempt** (HMAC-authenticated) — reuse the exact-match exempt Set already used for
  CSRF, do not duplicate it.
- The `/search` RSC path is NOT `/api/*`; its protection stays per-route (issue 001). Document this
  in the issue — this ticket covers the `/api/*` edge only.

## Acceptance criteria

- [ ] Excess non-safe `/api/*` requests from one IP → `429` + `Retry-After` at the edge.
- [ ] Webhook routes (`/api/payments/*/webhook`) are unaffected (HMAC-exempt).
- [ ] Existing CSRF behavior unchanged; e2e CSRF prime still passes.
- [ ] Limiter falls back to in-memory when Redis unconfigured (matches `lib/ratelimit`).

## Blocked by

- none (reuses `lib/ratelimit` + the existing webhook exempt Set in `proxy.ts`).

## User stories addressed

- [S14] As platform, all non-safe API traffic is rate-limited at the edge so one actor can't flood
  customer/operator/admin endpoints.
