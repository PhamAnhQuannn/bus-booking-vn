---
name: definition-of-done-pre
description: Pre-launch definition of "done" per feature class — code, tests, docs, security, perf, observability, comms. Outputs to `docs/inception/definition-of-done-<project>.md`. Use when user says "definition of done", "DoD", "ship checklist", "merge criteria", "/definition-of-done-pre", or week 1 of building.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /definition-of-done-pre — Without DoD, "Done" Means Different Things To Different People

## Why you'd care

"Done" without a checklist means tests written for the happy path, no log line on the failure branch, README untouched, and the feature works locally but throws 500s when the first paying customer hits it. Two weeks later the founder is excavating a bug nobody can repro because observability was skipped at ship, and the prospect from Friday's demo asked a docs question that has no answer. A per-feature-class DoD locks the minimum bar before the first sprint and stops the slow drift toward "done means it compiles."

Solo founder shipping fast = define DoD by feature class. Two-week regrets come from skipping observability or docs.

## Pre-flight
Run after `/nfr-template`. Pairs with `/launch-checklist`, `/acceptance-criteria`.

## Inputs
- Feature classes you'll ship (UI, API, migration, integration, infra).
- NFR baseline.
- Team size / capacity (solo vs team changes what's required).

## Process
1. **Tier features:**
   - **T1** — critical paths (auth, billing, core product flow)
   - **T2** — important but recoverable (settings, secondary flows)
   - **T3** — convenience (preferences, low-traffic admin)
2. **Per tier define mandatory DoD axes:**
   - Code reviewed (self-review for solo / peer for team)
   - Tests: unit + integration coverage
   - Manual smoke test
   - Type-safe (no `any`)
   - Linted (no warnings)
   - Observability: logs + metrics
   - Error handling
   - Docs (README + internal note)
   - Performance check (within NFR budget)
   - Accessibility (WCAG 2.2 AA)
   - Security (auth check, input validation, secrets not logged)
   - Migration plan if DB schema touched
   - Rollback plan if risky
   - Feature flag if uncertain
   - Customer comms if user-facing change
3. **By feature class:** UI vs API vs migration each have different essentials.
4. **Anti-pattern:** make DoD so heavy nothing ships. Be honest about what you skip at each tier.
5. **Skip rules** — explicit "we will not require X for T3" — surface tradeoffs.
6. **Living doc** — adjust after first 10 features shipped.

## Output
Write `docs/inception/definition-of-done-<project>.md`:

```markdown
# Definition of Done — <project>
**Date:** <YYYY-MM-DD>
**Team:** Solo (Founder B = eng)

## Tiers
- **T1** — auth, billing, core workflow, data integrity
- **T2** — secondary flows (settings, profile, share)
- **T3** — convenience (preferences, low-traffic admin)

## DoD by tier
| Check | T1 | T2 | T3 |
|-------|----|----|-----|
| Self code review | ✓ | ✓ | ✓ |
| Unit tests | ✓ | ✓ | optional |
| Integration tests | ✓ | ✓ | — |
| Manual smoke | ✓ | ✓ | ✓ |
| Type-safe (no `any`) | ✓ | ✓ | ✓ |
| Lint clean | ✓ | ✓ | ✓ |
| Logs at decision points | ✓ | ✓ | — |
| Metrics (custom event) | ✓ | optional | — |
| Error handling + user message | ✓ | ✓ | minimal |
| Internal docs note | ✓ | ✓ | optional |
| README updated | ✓ | optional | — |
| Performance within budget | ✓ | ✓ | optional |
| Accessibility (WCAG AA) | ✓ | ✓ | ✓ (if user-facing) |
| Security review | ✓ | ✓ | minimal |
| Migration plan | ✓ (if schema) | ✓ (if schema) | ✓ (if schema) |
| Rollback plan | ✓ | optional | — |
| Feature flag | ✓ (if risky) | optional | — |
| Customer comms | ✓ (if user-facing) | ✓ (if user-facing) | — |

## By feature class

### UI feature
**Required:**
- WCAG 2.2 AA pass (axe-core clean)
- Mobile responsive (verified at 375px)
- Loading + empty + error states
- Keyboard-only nav works
- No console errors

**Skip at T3:** mobile design, dark mode

### API endpoint
**Required:**
- OpenAPI / contract updated
- Auth check
- Input validation (Zod schema)
- Error responses follow contract
- Rate limit (if public)
- Logs request + response (PII-stripped)
- Metric: request count + p95 latency

**Skip at T3:** rate limiting, detailed metrics

### Database migration
**Required (all tiers):**
- Reversible migration written
- Lock budget estimated (< 5s for online tables)
- Backfill plan if not-null column added
- Tested on staging clone first
- Backup verified < 24h old before deploy
- Rollback script written

**Never skip** — even T3 migrations can hose prod

### External integration
**Required:**
- Retry / timeout / circuit-breaker
- Fallback UX if dep down
- Secret rotation procedure
- Vendor SLA noted in runbook
- Cost monitoring (avoid surprise bills)

**Skip at T3:** advanced fallback (just show error)

### Background job
**Required:**
- Idempotent
- Logging per run
- Failure alert routed
- Retry policy
- Max runtime budget

## Per-tier "skipped on purpose"
**T1:** never skip anything above
**T2:** can skip detailed metrics, README polish if shipping urgent
**T3:** skip integration tests, perf measurement, separate docs entry

## Examples
**T1 (auth password reset):** all 17 axes required. No exceptions.

**T2 (user profile edit):** smoke + lint + WCAG + auth check + logs. Skip rollback plan (low risk).

**T3 (theme toggle preference):** smoke + lint + WCAG. Skip tests + metrics.

## Anti-patterns
- ❌ "Done means it works on my machine" — too loose
- ❌ DoD so heavy you bypass it for "small" things — encourages bypass culture
- ❌ Same DoD for all tiers — wastes capacity on T3
- ❌ Treating DoD as a final-gate checklist (should be during dev, not after)

## Review cadence
- After first 10 features: adjust DoD based on what bit us
- Before launch: tighten T1 / T2
- Quarterly: revisit

## Pitfalls flagged
- [ ] Tiered DoD (not one-size-fits-all)
- [ ] By-feature-class essentials defined
- [ ] Explicit "what we skip" per tier (not implicit)
- [ ] Migration DoD never skipped (even T3)
- [ ] Anti-patterns flagged
- [ ] Living-doc cadence set

## Next
- Acceptance criteria per issue → `/acceptance-criteria`
- Launch checklist → `/launch-checklist`
- NFR alignment → `/nfr-template`
- Code review process → `/code-review-policy`
```

## Verification
- 3 tiers defined (T1/T2/T3).
- DoD axes vary by tier.
- Per-feature-class essentials.
- Migration DoD non-skippable.
- Skip rules explicit per tier.
- Anti-patterns + review cadence.
