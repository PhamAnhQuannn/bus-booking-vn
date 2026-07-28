---
depends-on: []
type: CHORE
wave: 3
---

## Parent PRD

Plan: `C:\Users\mrimp\.claude\plans\with-all-the-issues-reactive-llama.md` — PR 6. GitHub #374.

## What to fix

**Pre-existing, not a regression** — the same tests fail on `cd08dcb`, before any of #344–#358
landed, and CI was green on every one of those PRs.

`pnpm test` on a clean tree (Windows, Git Bash) intermittently fails three tests, all with
`Error: Test timed out in 5000ms` — not assertion failures:

- `lib/jobs/__tests__/retentionSweeper.test.ts` → "runs the bulk guest-scrub UPDATE and counts its affected rows"
- `lib/jobs/__tests__/generateTicketPdfs.test.ts` → "claims paid-without-key rows, renders, uploads, stamps the key, enqueues email"
- `lib/jobs/__tests__/generateTicketPdfs.test.ts` → "skips the email enqueue when buyerEmail is null (still renders + uploads)"

It is the **first** test in each file that fails, paying module-init cost inside its own 5s budget.
Later tests in the same file pass in milliseconds:

```
× runs the bulk guest-scrub UPDATE and counts its affected rows   6153ms
✓ purges each expired KYB doc: deleteObject + stamps purgedAt     1031ms
✓ sums guest scrubs + KYB purges into rowsAffected                   1ms
```

Load-dependent rather than strictly deterministic: verified passing in isolation at ~2.08s and
failing under full-suite parallel load. `retentionSweeper` reproduced both ways during this work.

### Cause

`vitest.config.ts` sets **no** `testTimeout`, so Vitest's 5000ms default applies. The sibling
`vitest.integration.config.ts:11` already sets `testTimeout: 30_000`, but that is scoped to
`*.int.test.ts` and never reaches the unit config.

The heaviest known top-level import in this group is `@react-pdf/renderer` (the ticket-PDF
pipeline) — `lib/booking/__tests__/ticketPdf.test.ts` carries its own comment that
"react-pdf render in node is slow but works".

### Fix

Raise `testTimeout` in `vitest.config.ts` (proposed 15_000). A timeout is the right lever here:
nothing is hanging, the work simply exceeds a 5s budget on a cold module graph under parallel
load. Do not paper over it with retries.

Consider, if it recurs: a shared setup that pre-warms the PDF renderer, or moving the PDF suites
behind the integration config.

## Acceptance criteria

- [ ] `pnpm test` passes on a clean tree on Windows, repeatedly, with no timeout failures.
- [ ] The timeout value is set once in `vitest.config.ts` with a comment explaining why.
- [ ] No test is skipped or retried to achieve this.

## Blocked by

- none

## Files

- `vitest.config.ts`

## Severity

P3 — developer friction and a flaky local signal. CI has been green throughout; the risk is that a
suite everyone expects to flake stops being read.
