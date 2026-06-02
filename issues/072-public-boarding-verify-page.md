---
depends-on: [071-qr-signed-token]
type: FEATURE
wave: 4
spec: [SYS08, S03]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS08] / [S03]

## What to build

The **public boarding verify page** — the SOURCE OF TRUTH for plate/type/departure/status.
Today `app/booking/confirmation/[token]/page.tsx` is a post-purchase confirmation keyed by a
192-bit token (live read, no self-fetch — good) but it's NOT a signed-JWT boarding-verify
page and shows no `providerTxnId` / no single-use check-in.

- A public, no-login verify page keyed by the **signed ticket token** (issue 071): live
  in-process read of booking + trip → shows ref, trip, seat count, **PAID** status,
  **`providerTxnId`**, current bus **plate + type + departure** (live = reflects reassign).
- This page is authoritative over the emailed PDF snapshot (spec [SYS08]); the PDF is a
  point-in-time copy.
- Reuse the existing live-read / no-self-fetch pattern from the confirmation page; keep the
  192-bit confirmation token page OR fold it into this verify page (decide + document — avoid
  two near-duplicate pages).
- Surfaces the check-in state (issue 073) read-only.

## Acceptance criteria

- [ ] Public verify page resolves a valid ticket token → ref/trip/seats/PAID/providerTxnId/
      plate/type/departure (live read).
- [ ] Invalid/tampered token → not-found/invalid (no leak).
- [ ] Plate/type/departure reflect the CURRENT trip (post-reassign), proving source-of-truth.
- [ ] No login required; no self-fetch (in-process lib read).
- [ ] Confirmation-page duplication resolved (one canonical page or documented split).

## Blocked by

- Blocked by `issues/071-qr-signed-token.md`

## User stories addressed

- [S03]/[SYS08] QR/link opens a read-only verification page (ref/trip/seats/PAID/txn),
  source of truth.
