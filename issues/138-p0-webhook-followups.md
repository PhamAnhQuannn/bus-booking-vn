---
depends-on: [126-ratelimit-backend-barrel-regression]
type: CHORE
wave: 0
---

## Parent PRD

Plan: `C:\Users\mrimp\.claude\plans\with-all-the-issues-reactive-llama.md` — post-merge follow-ups.

## What to fix

Housekeeping that must happen **after** PR #378 (delete unreachable PSP webhook routes) and
PR #379 (ratelimit fail-open) are merged and deployed. Tracked so it is not lost between sessions.

### 1. Rotate `STUB_PAYMENT_SECRET` on Vercel

Its default is the literal `'dev-stub-payment-secret-local-only-change-me'`, published in this
public repo. Once PR #378 merges, no reachable route resolves a stub-backed gateway
(`POST /api/bookings/initiate` accepts only `bank_transfer | vnpay`, and vnpay is gated on
`PAYMENTS_STUB || VNPAY_ENABLED`), so this is **cleanup, not the mitigation** — the deletion is.
Set a real random value in Vercel Production.

Do **not** add a boot-blocking `superRefine` for it: an earlier draft of PR #378 did, and it would
have failed the deploy of a live site to guard a path that is no longer reachable.

### 2. File the P0 as a GitHub issue — after deploy, not before

The stub-webhook forgery chain (book a seat → read own `bookingRef` → sign a stub IPN with the
repo-published secret → POST `/api/payments/card/webhook` → booking `paid` + ledger credit +
operator payout due) was found during planning and has no GitHub issue. Per the user's decision
(fix first, then rotate), file it **once the fix is deployed** so the public repo does not
advertise a live exploit. Full write-up already in the CLAUDE.md mistake log.

### 3. Close resolved / no-op issues with evidence

- **#366 pickup dead refs — CLOSE as no-op.** Only comment fossils remain for `PickupArea` /
  `PickupPlaceKind` (the tables and enum were dropped in
  `20260622100000_remove_pickup_area_system`). `customPickupRequested` and the `PickupKind` enum
  are **live** across `schema.prisma`, `holdRepo`, `processWebhook`, `reconcilePayments`,
  `getManifest`, and the manifest UI — "cleaning" them would break production. Record this so the
  issue is not reopened.
- **#138, #140** — close WONTFIX. No PSP will be enabled; their routes are deleted.
- **#372, #375, #352, #377**, and the VNPay half of **#376** — closed by PR #378.

### 4. Add written trigger comments to every deferred issue

Silence is what let #350 ship. Each deferred issue gets its trigger recorded on the issue itself:

| Issue | Trigger |
|---|---|
| #331 reconciliation screen | >20 bookings/day for 2 weeks, or manual matching >30 min/day |
| #332 PaymentEvent PII retention | when #331 lands, or a retention-window policy is set |
| #336 ops-alert SPOF | when #331 lands |
| #371 `requireAdminPage` role param | 3rd distinct admin/operator org (11 files — see issue 131) |
| #137 DSAR / #136 complaints | customer-auth cluster ships, or first real request |
| #133 split-settlement | first external (non-family) operator — legal classification first |
| #143 observability | Sentry `SENTRY_DSN` only (captureException already wired); BetterStack deferred |
| #146 DPA / #144 eSMS | vendor-dependent |
| #365 MISA adapter | second e-invoice vendor evaluated |

### 5. Still blocked on the business

**#350** — `SiteFooter` ships a placeholder support hotline ("1900 xxxx"), invented business hours,
and four `href="#"` social links to every visitor. Needs the real hotline, support email, and
social handles. Until then it stays parked; the alternative is hiding the contact block entirely.

## Acceptance criteria

- [ ] `STUB_PAYMENT_SECRET` set to a real value in Vercel Production.
- [ ] P0 filed on GitHub after the fix is live.
- [ ] #366 closed with the "still live" evidence; #138/#140 closed WONTFIX.
- [ ] Every deferred issue carries its trigger as a comment.
- [ ] #350 either answered with real contact details or explicitly re-parked.

## Blocked by

- PR #378 and PR #379 merged + deployed (user merges; not automated).

## Files

- none (GitHub + Vercel operations)

## Severity

P2 — no code risk, but these are the loose ends that turn a completed remediation into a
half-finished one.
