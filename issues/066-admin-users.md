---
depends-on: [056-admin-middleware-segment]
type: FEATURE
wave: 3
spec: [S11]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S11] (Users tab)

## What to build

Admin **Users** tab — search customers + operators (both = "total users"), user detail,
suspend / reinstate.

- Search across Customer + Operator (paginated, cursor/seek per the list convention).
- User detail: profile + booking/activity summary (customer) or link to the operator detail
  (issue 067).
- Suspend / reinstate a customer account (distinct from operator suspend, which is the 045
  state machine). Suspend revokes sessions; reinstate restores. Audit-logged.
- Admin-guarded; support role can view + suspend, per least-privilege.

## Acceptance criteria

- [ ] Search returns customers + operators, paginated.
- [ ] User detail shows profile + activity; links to operator detail where applicable.
- [ ] Suspend revokes sessions; reinstate restores; both audit-logged.
- [ ] Behind admin auth; role-aware.

## Blocked by

- Blocked by `issues/056-admin-middleware-segment.md`

## User stories addressed

- [S11] admin Users: search customers+operators, detail, suspend/reinstate.
