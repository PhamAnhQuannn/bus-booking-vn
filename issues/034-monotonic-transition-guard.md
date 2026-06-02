---
depends-on: []
type: FIX
wave: 0
spec: [S12, SYS05, SYS06]
---

> 🔎 **Reality-check 2026-06-01: REAL but MINOR (low priority).** `processWebhook.ts:155-161,229-234`
> already guard every transition with `WHERE status='awaiting_payment'`, so the live regress
> (paid→pending) is already prevented. This issue only adds the EXPLICIT single-source transition
> map for future-proofing. Defer behind 033/035; not urgent.

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S12] / [SYS05] / [SYS06]

## What to build

Make the booking/payment state machine's **monotonic-transition** rule explicit. Today
forward updates are guarded only by an incidental `WHERE status='awaiting_payment'`
(`processWebhook.ts:143-149`) — it works (a replayed pending can't regress a paid row)
but there is no named state-machine layer, so a new transition added later could silently
allow `paid → pending`.

- Add an explicit allowed-transition map / guard (e.g. `assertForwardTransition(from, to)`
  or a `WHERE status IN (<legal predecessors>)` derived from one source-of-truth map) so
  every booking money-state write rejects backward/illegal moves.
- Cover: `awaiting_payment → paid`, `awaiting_payment → payment_failed_expired`,
  `paid → completed`, `paid → trip_cancelled`; reject `paid → awaiting_payment`,
  `completed → paid`, any regress.
- Out-of-order / replayed webhooks that would regress are ignored (no-op, logged).
- Keep the change minimal + co-located with the existing webhook update path; do NOT
  rename enum values here (the `paid_operator_notified → paid` split is Wave 7).

## Acceptance criteria

- [ ] A replayed/older webhook that would move a `paid` booking back to `awaiting_payment`
      is rejected (row unchanged), asserted by test.
- [ ] All legal forward transitions still succeed (happy path).
- [ ] The legal-transition set lives in ONE place (map/function), not scattered WHERE
      literals.
- [ ] Illegal transition attempt is logged, not thrown to the webhook caller (still 200).

## Blocked by

- none

## User stories addressed

- [S12]/[SYS06] truth from server webhook; monotonic transitions reject backward moves.
