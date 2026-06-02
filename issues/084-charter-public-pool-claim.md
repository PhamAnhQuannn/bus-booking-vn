---
depends-on: [083-charter-operator-assigned]
type: FEATURE
wave: 6
spec: [S17, SYS19]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S17] / [SYS19]

## What to build

The **public pool + first-accept-wins atomic claim** — the charter concurrency one-way door.
Two approved operators must never both claim the same published request.

- Public-pool view in the operator Charter tab: requests `PUBLISHED` + unclaimed, visible to
  APPROVED operators.
- **Atomic claim**: `UPDATE CharterRequest SET assigneeOperatorId = ?, status = 'accepted'
  WHERE id = ? AND status = 'published' AND assigneeOperatorId IS NULL` (or SELECT … FOR
  UPDATE) — first commit wins; **losers get 409 already-claimed**. (Mistake-Log concurrent-
  write test rule: add a two-operators-racing integration test.)
- Win/loss notifications (issue 058).

## Acceptance criteria

- [ ] Public pool lists PUBLISHED unclaimed requests to APPROVED operators only.
- [ ] Two operators claiming the same request concurrently → exactly one wins, the other gets
      409 already-claimed (integration test).
- [ ] Win → ACCEPTED (assignee set); loss → 409, request unchanged.
- [ ] Win/loss notifications enqueued.

## Blocked by

- Blocked by `issues/083-charter-operator-assigned.md`

## User stories addressed

- [S17] public pool + first-accept-wins claim (409 to losers).
