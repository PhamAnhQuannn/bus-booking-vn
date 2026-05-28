---
priority: must
source: pr-review + code-review
fingerprint: test-api-op-activity-missing
severity: P1
---

## Parent PRD

`issues/prd.md` (fix-issue derived from PR #4 reviews — no parent slice)

## What to build

Fix: new operator endpoint `app/api/op/activity/route.ts` has no test. Admin/operator
routes sit on a risk path (tenant isolation, JWT gating). Code-level review confirmed
the handler is well-structured (`requireOperatorAuth()` wraps, limit clamped 1–100,
`withErrorHandler` envelopes throw) — but the test that proves the gate keeps holding
is missing.

Suggested fix: add `app/api/op/activity/__tests__/route.int.test.ts` covering:
- 401 without an operator session
- tenant scoping (operator A's request never returns operator B's events)
- happy-path response shape (`{ events: [...] }`)
- limit clamp (limit=9999 → ≤100; limit=-5 → ≥1; limit="abc" → 30 fallback)

## Acceptance criteria

- [ ] Test file exists at `app/api/op/activity/__tests__/route.int.test.ts`.
- [ ] All four cases above pass.
- [ ] `pnpm test:integration` green.
- [ ] /code-review no longer emits fingerprint `test-api-op-activity-missing`.

## Blocked by

None - can start immediately.
