---
name: dr-drill
description: Run a disaster-recovery tabletop and (where safe) a live failover drill. Confirms backups restore, runbook steps work, RTO/RPO targets hold, and the on-call human can drive the recovery without the original author. Emits `docs/ops/dr-drill-YYYYMMDD.md` (tabletop log + live-failover timings + gaps). Use when user says "dr drill", "disaster recovery", "failover test", "restore drill", "/dr-drill", or before any XL pre-launch, regulated audit, or post-incident verification cycle.
output_size:
  XS: skip
  S:  skip
  M:  1h
  L:  2h
  XL: 4h
---

# /dr-drill — disaster-recovery tabletop + live failover

Invoke as `/dr-drill`. Pick a scenario, walk the runbook, optionally fail over for real, time everything, write the log.

## Why you'd care

A backup that has never been restored is a wish, not a backup. A runbook nobody has rehearsed reads fine on the page and stalls at step 4 at 3 a.m. Three failure shapes die when this drill happens:

- **Backup-rot** — nightly dump runs green for 18 months; first real restore reveals the dump was 0 bytes / wrong schema / missing the new tables.
- **Runbook-rot** — runbook says `kubectl …` but the cluster moved to a managed service six months ago; the step is fiction.
- **People-rot** — only the author knows the undocumented manual step ("oh you also have to flush the CDN"). Author is on PTO during the real outage.

The drill flushes all three out cheaply, in a window you chose, while the system is healthy.

## Pre-flight

1. Read `docs/classify/<project>.md`.
   - XS / S → SKIP (single-host hobby projects don't run DR drills).
   - M → tabletop only (no live failover).
   - L → tabletop + one live restore into a non-prod env.
   - XL → tabletop + live failover of at least one prod-class dependency.
2. Read `docs/ops/backup-restore.md` and `docs/ops/rollback-plan.md` if present — these are the runbooks under test.
3. Read `docs/inception/risk-register-<project>.md` — Red-tier infra risks become candidate scenarios.
4. Confirm a maintenance window or off-peak slot. **Never** run a live failover drill without explicit user go-ahead and a stated abort condition.

## Inputs

- Backup catalog (location, retention, last successful run).
- Stated RTO (recovery time objective) and RPO (recovery point objective). If absent, derive provisional values during the drill and flag for owner sign-off.
- On-call rota — name the human driving the drill (not the skill author).
- A non-prod restore target (staging cluster / scratch DB / read replica).

## Process

1. **Pick scenario.** One of: primary DB loss, region outage, secrets compromise, accidental destructive migration, vendor outage (auth provider, CDN, payments). Pick the one with the highest unmitigated risk-register score that has not been drilled in the last 6 months.
2. **Tabletop walk.** Read the runbook aloud step by step. At each step, the driver states what command they would run and what they expect to see. Recorder notes any step that is ambiguous, missing, or references dead infra.
3. **Live restore (M+).** Restore the most recent backup into the non-prod target. Time it from "decide to restore" to "service answering health check." Compare to stated RTO.
4. **Live failover (XL).** Within the maintenance window, execute the failover (DB promote, region cutover, traffic shift). Time the cutover. Compare to RTO. Verify data loss against RPO (last write timestamp before cutover vs first write after).
5. **Failback.** Return to primary cleanly. A drill is not done until you are back where you started with no leftover state.
6. **Gap log.** Every ambiguous step, every missing command, every RTO/RPO miss, every undocumented manual action → row in the gap table.
7. **Write** `docs/ops/dr-drill-YYYYMMDD.md`.

## Output Format

```markdown
# DR drill — <project> — <YYYY-MM-DD>
**Driver:** <name> · **Recorder:** <name> · **Scenario:** <primary-db-loss | region-outage | …>
**Window:** <HH:MM–HH:MM TZ> · **Mode:** tabletop | tabletop+restore | tabletop+failover

## Targets
- **RTO target:** <e.g. 30 min> · **RTO observed:** <e.g. 47 min> · **Verdict:** MISS
- **RPO target:** <e.g. 5 min> · **RPO observed:** <e.g. 2 min> · **Verdict:** PASS

## Timeline
| T+      | Step                                 | Expected                  | Actual                       | Note |
|---------|--------------------------------------|---------------------------|------------------------------|------|
| 00:00   | Declare scenario                     | —                         | —                            |      |
| 00:02   | Page on-call                         | PagerDuty ack ≤2m         | ack at 00:04                 | slow |
| 00:08   | Locate latest backup                 | s3://…/2026-05-14.dump    | found                        |      |
| 00:14   | Restore into staging                 | ≤10 min                   | 22 min — index rebuild slow  | gap  |
| 00:38   | Smoke checks                         | /health 200               | 200                          |      |
| 00:47   | Declare service restored             | —                         | —                            |      |

## Gaps found
| Sev | Step                  | Problem                                        | Owner | Fix-by |
|-----|-----------------------|------------------------------------------------|-------|--------|
| P1  | Restore into staging  | Index rebuild not parallelized → 2× RTO target | ops   | 2026-05-29 |
| P2  | CDN flush             | Step not in runbook; driver remembered ad-hoc  | ops   | 2026-05-22 |
| P3  | Backup verify         | Last verify ran 47 days ago (target ≤7)        | ops   | 2026-05-17 |

## Decisions taken
- Promote staging restore step to use `pg_restore --jobs=8`.
- Add explicit "flush CDN" step between restore and smoke.
- Cron the backup-verify to run hourly with alerting.

## Sign-off
- Driver: <name> · Recorder: <name> · Owner: <name> · Date: <YYYY-MM-DD>
```

## Verification

- Every gap row has an owner and a fix-by date — no orphan findings.
- RTO/RPO observed values are recorded even when targets are missed (especially when missed).
- Failback completed; no drill-residue (test rows, scratch buckets, leftover DNS) left in prod.
- File written to `docs/ops/dr-drill-YYYYMMDD.md`.
- Re-run after every P1 fix lands; the drill is not "passed" until P1 gaps close.

## Cross-skill references

- **Upstream:** `/risk-register` (scenario seed), `/backup-restore` (runbook under test), `/rollback-plan` (failback procedure), `/runbook` (operational steps).
- **Downstream:** `/launch-checklist` (XL pre-launch ship-block on outstanding P1 gaps), `/incident-postmortem` (real incident → drill the same scenario within 30 days), `/audit` (regulated projects).

## When to re-run

- Before any XL pre-launch (ship-block on P1 gaps).
- Within 30 days after any real Sev-1 incident (drill the scenario that just happened).
- Quarterly during mature stage.
- After any infra change touching backup/restore/failover paths.
- After any rota change where the new on-call has not driven a drill.
