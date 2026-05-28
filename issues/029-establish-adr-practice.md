---
priority: should
source: architect-review
fingerprint: arch-no-adr-directory
severity: P2
---

## Parent PRD

`issues/prd.md` (fix-issue derived from PR #4 architect-review — project-wide gap)

## What to build

Fix: no `docs/adr/` directory exists in the repo. PR #4's `recharts@^3.8.1` is the
trigger that surfaced this, but the underlying gap is broader — every
architecturally-significant choice already in code is unrecorded:

- Prisma ORM choice (vs Drizzle / Kysely)
- Next.js App Router (vs Pages Router)
- base-ui + shadcn split for primitives
- Tailwind for styling
- Zustand for client state
- jose-JWT for auth tokens (vs next-auth)
- bb_csrf double-submit middleware (Issue 007)
- otpProof single-use JWT (Issue 007)
- FunnelEvent append-only event log (already on master)
- MoMo PSP integration vs stub gateway split (memory: payment-deferral-strategy)
- recharts as chart library (PR #4 trigger)

Suggested fix: start `docs/adr/` with `/adr-writer`. Backfill the major pre-existing
decisions one ADR per cycle:

- `0001-prisma-orm.md`
- `0002-next-app-router.md`
- `0003-base-ui-and-shadcn.md`
- `0004-recharts-chart-library.md`  ← unblocks PR #4 dep
- `0005-bb-csrf-double-submit.md`
- `0006-otpProof-single-use-jwt.md`
- (incremental from there)

Subsequent ADR-triggering PRs land their own ADR alongside (architect-review's
Category 4 will then have something to check against).

## Acceptance criteria

- [ ] `docs/adr/` directory exists with at least the first 4 ADRs written.
- [ ] An `0000-template.md` (per Michael Nygard convention) is committed for future
      authors to copy.
- [ ] `/architect-review` Category 4 stops flagging `recharts` (because
      `0004-recharts-chart-library.md` exists).

## Blocked by

None - can start immediately. Best done as a dedicated docs-only PR.
