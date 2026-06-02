---
depends-on: [044-place-entity]
type: FEATURE
wave: 6
spec: [SYS19, S16]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS19] / [S16]

## What to build

The `CharterRequest` model + state machine (foundation for the charter marketplace). Today
only a presentational contact form exists; no model, ref, or state.

- `model CharterRequest(id, ref, customerId?, contactName, contactPhone, contactEmail,
  originPlaceId, destinations Json/relation, startDate, endDate|durationDays, passengers,
  vehicleType, budget, notes, status, assigneeOperatorId?, publishedAt?, claimByAt?,
  acceptByAt?, rejectionReason?, createdAt)` + migration. Pickup/destinations reference
  `Place` (issue 044). **Guest-allowed** (`customerId` optional + contact snapshot).
- State machine (service-enforced): `SUBMITTED → ADMIN_REVIEW → {ASSIGNED_DIRECT | PUBLISHED
  | REJECTED}`; `ASSIGNED_DIRECT → ACCEPTED | DECLINED→ADMIN_REVIEW | (timeout)→ADMIN_REVIEW`;
  `PUBLISHED → ACCEPTED(claim) | EXPIRED→ADMIN_REVIEW`; `ACCEPTED → COMPLETED | CANCELLED`.
- Ref generator (charter-scoped). `lib/charter` home (per SYS20).
- **Payment = lead-gen / operator-direct** (S15#9) — NO charter payment rail; price negotiated
  off-platform. Do NOT wire the fixed-price booking flow.

## Acceptance criteria

- [ ] `CharterRequest` model + migration; pickup/destinations reference Place; guest-allowed.
- [ ] State machine service enforces all legal edges; rejects illegal transitions.
- [ ] Charter ref generator.
- [ ] No charter payment rail (lead-gen default documented inline).
- [ ] Unit tests for the state machine transitions.

## Blocked by

- Blocked by `issues/044-place-entity.md`

## User stories addressed

- [S16]/[SYS19] CharterRequest entity + state machine; guest-allowed; lead-gen payment.
