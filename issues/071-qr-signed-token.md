---
depends-on: []
type: FEATURE
wave: 4
spec: [SYS08, S03]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS08] / [S03]

## What to build

The **QR signed-token** lib. Today there is no QR anywhere; the PDF prints none. Spec
[SYS08]: QR = a **signed token (JWT)** → a public read-only verify page; the QR holds no
secret and needs no DB call to generate.

- `lib/ticketing` token mint/verify: sign a compact JWT (booking ref + minimal claims, short
  enough for a QR) with a dedicated ticketing key; verify on the public page (issue 072).
  The token carries no secret/PII beyond the lookup key.
- QR image generation from the token (a `qrcode` lib) — used by the PDF (issue 074) + the
  confirmation/verify surfaces.
- Token is stable per booking (re-download yields the same QR) but verifiable + tamper-evident.

## Acceptance criteria

- [ ] `mintTicketToken(booking)` + `verifyTicketToken(token)` (JWT, dedicated key).
- [ ] Token holds no secret/PII beyond the lookup key; tamper → verify fails.
- [ ] QR image renders from the token.
- [ ] Stable per booking; re-mint is deterministic.
- [ ] Unit tests: mint/verify/tamper/expiry-if-any.

## Blocked by

- none

## User stories addressed

- [S03]/[SYS08] ticket QR = signed token → scannable proof.
