---
depends-on: [081-charter-request-model, 046-approval-gate-search-booking, 058-notification-dispatcher-stub]
type: FEATURE
wave: 6
spec: [S17, SYS19]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S17]

## What to build

Operator **Charter tab — directly-assigned requests** + accept/decline + accepted-contracts
list. Only **APPROVED** operators (trust gate, S14 / issue 046 capability helper) see charter.

- Operator Charter tab (`app/op/(console)/charter`, nav item in `navConfig.ts`): list requests
  `ASSIGNED_DIRECT` to me.
- **Accept** → ACCEPTED (surfaces customer contact + details for off-platform fulfillment).
  **Decline** → DECLINED → ADMIN_REVIEW (admin can reassign).
- **Accepted-contracts list** with customer contact + details.
- Assignment / accept / decline notifications (issue 058).
- Only APPROVED operators can see/act (gate via issue 046 capability helper).

## Acceptance criteria

- [ ] Charter tab lists directly-assigned requests for the operator.
- [ ] Accept → ACCEPTED + reveals customer contact; Decline → ADMIN_REVIEW.
- [ ] Accepted-contracts list shows contact + details.
- [ ] Only APPROVED operators see/act on charter (gated).
- [ ] Assignment/accept/decline notifications enqueued.

## Blocked by

- Blocked by `issues/081-charter-request-model.md`,
  `issues/046-approval-gate-search-booking.md`, `issues/058-notification-dispatcher-stub.md`

## User stories addressed

- [S17] operator Charter tab: assigned requests, accept/decline, accepted-contracts list.
