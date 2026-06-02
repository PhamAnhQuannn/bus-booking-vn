---
depends-on: []
type: CHORE
wave: 0.5
spec: [S09]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S09] (OUT: charts/BI)

## What to build

Remove the orphaned chart components — [S09] explicitly lists charts/BI as OUT, and these
are imported by no app page (dead code per `rebuild-mismatches.md`).

- Delete `components/charts/RevenueLineChart.tsx`, `components/charts/BookingStatusDonut.tsx`,
  `components/charts/ChartTheme.tsx` (+ the `components/charts/` dir if it empties).
- Remove any now-unused chart dependency from `package.json` if it has no other consumer
  (grep the lib import across the repo first).
- Confirm zero remaining imports (grep `RevenueLineChart`, `BookingStatusDonut`,
  `ChartTheme`).

## Acceptance criteria

- [ ] The 3 chart components deleted; no import references remain.
- [ ] Unused charting dependency removed from `package.json` (only if no other consumer).
- [ ] Build + typecheck green.

## Blocked by

- none

## User stories addressed

- [S09] keep operator dashboard simple — charts/BI are OUT.
