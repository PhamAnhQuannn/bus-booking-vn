---
depends-on: []
type: FEAT
wave: 2
---

## Parent PRD

Plan: `C:\Users\mrimp\.claude\plans\with-all-the-issues-reactive-llama.md` — PR 5. GitHub #371.

## What to fix

`app/admin/(console)/page.tsx:231-235` renders the orphan-payment tile **outside** the
`canSeeFinance` gate, while the ROLE MATRIX comment in the same file (`:22-24`) states SUPPORT
must not see money-flow failures.

What makes it structural rather than cosmetic: `lib/auth/requireAdminPage.ts` enforces
authentication and TOTP but performs **no role check** — it takes no parameters and returns
`{adminId, role, totpVerified}`. The in-page boolean is therefore the page's entire RBAC, and
anything rendered outside it has no fallback gate at any layer.

The leaked value is a single integer, so exposure is low. The missing gate is the finding.

### Ship now (small)

1. Move the orphan tile inside `canSeeFinance`; update the ROLE MATRIX comment to match.
2. `page.tsx:258` renders `lastError` raw, which can echo the recipient that `maskRecipient`
   masks two lines above (Resend surfaces it in `error.message`, `lib/notification/email.ts:171`).
   Redact it.
3. Add `lastError` to the logger redact list (`lib/logger.ts:53-110`) — it has no entry today.

### Defer (explicitly, with a trigger)

Giving `requireAdminPage` a role parameter is the durable fix, but it touches **11 files** —
10 pages plus the console layout — each with its own hand-typed role literal and no shared
helper (`SUPER_ADMIN` alone; `SUPER_ADMIN|FINANCE`; `SUPER_ADMIN|SUPPORT`). Mechanical but not
small, and it is a pure refactor of a surface with a trivially small, known admin user set.

**Trigger: a 3rd distinct admin/operator org onboards.** Until then the in-page booleans are
adequate and the risk is bounded by who holds an admin account.

Affected callers, for whoever picks the refactor up: `layout.tsx:30`, `page.tsx:85`,
`system/page.tsx:50`, `finance/page.tsx:66`, `charter/page.tsx:55`, `operators/page.tsx:60`,
`operators/[id]/page.tsx:60`, `moderation/page.tsx:33`, `approvals/page.tsx:41`,
`users/page.tsx:61`, `users/[kind]/[id]/page.tsx:32`.

## Acceptance criteria

- [ ] SUPPORT cannot see the orphan-payment tile.
- [ ] ROLE MATRIX comment matches what the page actually renders.
- [ ] `lastError` is redacted in the UI and on the logger redact list.
- [ ] A test asserts the tile is absent for a SUPPORT role context.
- [ ] The deferred role-param refactor is written down with its trigger, not silently dropped.

## Blocked by

- none

## Files

- `app/admin/(console)/page.tsx`, `lib/auth/requireAdminPage.ts`, `lib/logger.ts`

## Severity

P2 — a single integer to an already-authenticated internal role. The structural gap is the point.
