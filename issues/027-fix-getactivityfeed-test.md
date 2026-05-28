---
priority: should
source: code-review
fingerprint: test-getactivityfeed-missing
severity: P2
---

## Parent PRD

`issues/prd.md` (fix-issue derived from PR #4 code-review)

## What to build

Fix: `lib/op/getActivityFeed.ts` is a new exported tenant-scoped data function
(~200 lines, 4 parallel Prisma reads + merge-sort + slice). No test added. Non-risk
path (read-only) but enough logic to deserve coverage.

Suggested cases for `lib/op/__tests__/getActivityFeed.int.test.ts`:
- empty result returns `[]`
- merge-sort returns events in timestamp DESC order
- result truncated at `limit`
- `trip.low_capacity` events skip trips below the 0.9 threshold
- `capacity === 0` is skipped (divide-by-zero guard)
- tenant isolation (operator A doesn't see operator B's bookings/trips)
- day-bucketed `low_capacity` IDs prevent the same trip re-firing within a day

## Acceptance criteria

- [ ] Integration test file exists at `lib/op/__tests__/getActivityFeed.int.test.ts`.
- [ ] All cases above pass.
- [ ] /code-review no longer emits fingerprint `test-getactivityfeed-missing`.

## Blocked by

None - can start immediately. Can be co-implemented with issue 024 (similar setup).
