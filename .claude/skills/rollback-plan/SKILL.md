---
name: rollback-plan
description: Author the rollback procedure for a release — code revert path, DB restore path, flag kill-switch fallback, per-phase reverse-migration block. Pre-written before deploy, exercised on guardrail breach. Use when user says "rollback plan", "revert plan", "how do we undo this", "/rollback-plan", or when `/feature-flag-rollout` / `/blue-green-deploy` / `/migration-author` chains here.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /rollback-plan — pre-written undo procedure for a release

## Why you'd care

Three failure modes hide inside any release without a written rollback plan:

- **No plan at all** = at 02:17 on a SEV-1, the on-call types `git revert <sha>` into Slack and prays. Half the time the revert won't apply because a later commit depends on the broken one. The other half, the migration is irreversible and nobody knew.
- **Plan exists but never exercised** = the "rollback procedure" in the wiki was last touched 14 months ago. Half the listed commands reference services that no longer exist. Discovered mid-incident.
- **Plan covers code but not data** = revert ships clean, but the DB migration that ran 40 minutes ago dropped a column. Now production runs old code against a schema it doesn't understand. The revert made things worse.

One pre-written plan, written before the release ships, exercised once in staging, covers all three. Code path + data path + flag path + the "blue is already destroyed" fallback path. The doc lives next to the release artifact so the on-call finds it in 30 seconds, not 15 minutes.

Invoke as `/rollback-plan`. Author it during release planning, not during the page.

## When This Skill Applies

Triggers (user phrases):
- "rollback plan", "revert plan", "how do we undo this"
- "if this breaks, what do we do", "/rollback-plan"
- "what's our backout procedure"

Auto-invoke:
- **From `/feature-flag-rollout`** — guardrail breach during ramp chains here (flag flip is the primary lever, code revert + DB restore are fallbacks).
- **From `/blue-green-deploy`** — flip-back-fails-too case (blue destroyed, LB API unresponsive, DNS propagation stuck) chains here.
- **From `/migration-author`** — every 3-phase migration ships with a paired rollback entry; this skill consumes the `## Rollback by phase` block.
- **Before any L-track release** — rollback plan is mandatory at L+. Ship-blocking if missing.

## Pre-flight

1. **Deploy artifact identified?** SHA, image tag, migration version, flag key — each lever must have a concrete handle. "Roll back the release" is not a procedure; "flip flag `pricing-v2` to 0% then revert SHA `a3f8e21`" is.
2. **Migration cross-ref.** If `/migration-author` ran for this release, read its `notes.md` `## Rollback by phase` block. Missing block → this skill refuses; either add the block or the rollback plan cannot proceed.
3. **Backup posture.** Latest PITR / snapshot timestamp known? Restore RPO/RTO documented? If no PITR and the migration is irreversible → ship-block; cannot rollback.
4. **Authority list.** Who can flip the flag / press the revert / restore the DB? Same authority chain as `/feature-flag-rollout` kill-switch.

## Inputs

- **Release slug** — matches the deploy ticket / PR / blue-green slug (`pricing-v2`, `pg16-upgrade`, `checkout-stripe-link`).
- **Levers available** — list in preferred order: flag kill → blue-green flip-back → code revert → DB restore → manual data fix.
- **Triggers** — what signal fires the rollback. Specific thresholds, not "things look bad".
- **Authority** — who decides + who executes (often different people during a page).
- **Communication path** — Slack channel, status page, customer email template ID.

## Process

1. **Inventory the levers, ordered fast → slow.**

   | Lever | When applicable | SLA | Reversible? | Side effects |
   |---|---|---:|:---:|---|
   | Flag kill (`flag → 0%`) | Feature behind flag | 5 min | ✓ | none (default branch resumes) |
   | Blue-green flip-back | Active blue retained | 2 min | ✓ | blue is now serving — green debug separately |
   | Container/image revert | No flag, no flip-back | 10 min | ✓ if no migration ran | rolling deploy of previous tag |
   | Code revert (`git revert`) | Image revert insufficient | 30 min | ✓ for code | new deploy cycle |
   | Forward-fix | Bug too entangled to revert cleanly | varies | – | another deploy under incident pressure |
   | DB restore (PITR) | Data corruption / irreversible migration | 30 min – 4h | ✓ at RPO | data loss between RPO and restore point |
   | Manual data fix | Surgical row-level repair | varies | ✓ | requires SQL on prod, two-person review |

   Pick the **lowest-impact lever that actually solves the failure mode**. Do not start at "DB restore" if "flip the flag" works.

2. **Define triggers — numeric thresholds, not vibes.**

   | Signal | Threshold | Lever |
   |---|---|---|
   | Error rate (per-route, flag-on cohort) | > baseline × 1.5 for 10 min | flag kill |
   | p95 latency (flag-on or green stack) | > baseline + 100ms for 10 min | flag kill / flip-back |
   | SEV-1 incident tagged with release slug | immediate | flag kill + escalate |
   | Data invariant breach (ledger drift, FK orphan, count mismatch) | any | DB restore path; escalate first |
   | Conversion / business KPI drop | > 5% relative for 1 eval window | flag kill |

   Each row maps to one lever. The on-call should not be picking levers under pressure — the matrix picks for them.

3. **Per-lever procedure.** For each lever in scope, write the exact command sequence. No prose. Copy-pasteable.

   ```
   ## Lever 1: Flag kill (primary)
   1. `ld flag set pricing-v2 --off`           # OR provider UI: Flags → pricing-v2 → Kill
   2. Verify: `curl -H "X-User: test" /price`  # expect old pricing
   3. SLA to 0% serving: 5 min (SDK cache TTL 30s + browser flush ≤4 min)
   4. Notify: Slack #incidents + status page
   5. Log: `docs/incidents/<date>-pricing-v2.md`

   ## Lever 2: Blue-green flip-back
   1. `aws elbv2 modify-listener --listener-arn $LISTENER --default-actions Type=forward,TargetGroupArn=$BLUE_TG`
   2. Verify traffic on blue: synthetic monitor green→0, blue→100%
   3. SLA: 2 min flip + 5 min monitor
   4. Snapshot green logs to S3 before tear-down
   5. If flip fails (blue destroyed) → Lever 4 (code revert) or Lever 6 (DB restore)
   ```

4. **Migration-paired rollback (read from `/migration-author` notes.md).**

   For 3-phase migrations, the reverse procedure diverges per phase. Copy the block from `notes.md` verbatim:

   | Phase failed | Reverse action | Data loss risk |
   |---|---|---|
   | Phase 1 (expand) | Drop new column. Old column untouched. | None |
   | Phase 2 (backfill) | Reset new column to NULL. Old column still authoritative. | None |
   | Phase 3 (contract) | Re-add old column nullable, backfill from new, restore code path reading old. | Possible if writes hit new-only window — needs PITR. |

   Missing `## Rollback by phase` in `notes.md` = this skill **refuses**. Fix the migration first.

5. **Communication path.** Pre-write the comms so they're paste-ready:

   - Slack `#incidents`: "Rolling back release `<slug>`. Cause: <signal>. Lever: <lever>. ETA: <SLA>."
   - Status page (if SEV1/2): incident open + 30-min update cadence per `/incident-commander-runbook`.
   - Customer email template ID (if customer-visible): saved in `templates/rollback-comms-<slug>.md`.

6. **Decision tree (one page, printable).** The on-call should be able to glance at one diagram and pick a path:

   ```
   Page fires
     │
     ├─ Feature behind flag?
     │    └─ YES → flip flag → 0%, monitor 10 min, done OR escalate
     │
     ├─ Blue-green active + blue retained?
     │    └─ YES → flip-back, monitor 5 min, snapshot green
     │
     ├─ Migration ran?
     │    └─ YES → read notes.md ## Rollback by phase → execute reverse
     │           └─ Phase 3 + writes to new-only? → escalate, DB restore likely
     │
     └─ Code-only revert → image revert OR `git revert`, redeploy
   ```

7. **Dry-run requirement.** The plan must be exercised in staging **once** before the release ships. Dry-run produces a timestamped log; missing dry-run log = the plan is unverified = ship-block at L+. Re-run when the underlying systems change shape (new flag provider, new DB platform, new LB).

## Output Format

Write `docs/release/rollback-plan-<slug>.md`:

```markdown
# Rollback plan — <release-slug>

**Owner:** <name> | **Release ticket:** <link> | **Created:** <YYYY-MM-DD>
**Dry-run log:** `docs/release/rollback-drill-<slug>-<YYYY-MM-DD>.log` ✓
**Companion docs:** `/feature-flag-rollout` (flag plan), `/migration-author` notes.md (DB plan), `/blue-green-deploy` doc (flip plan)

## Levers (fast → slow)

| # | Lever | SLA | When |
|--:|---|---:|---|
| 1 | Flag kill `pricing-v2 → 0%` | 5 min | Any guardrail breach |
| 2 | Blue-green flip-back | 2 min | Flag lever exhausted, blue retained |
| 3 | Image revert (deploy `<previous-tag>`) | 10 min | No flag, no flip-back |
| 4 | Code revert (`git revert <sha>`) | 30 min | Image revert insufficient |
| 5 | DB restore (PITR @ <timestamp>) | 30–60 min | Data corruption / Phase 3 contract failed |
| 6 | Manual data fix (two-person SQL) | varies | Surgical case |

## Triggers

| Signal | Threshold | Lever |
|---|---|---|
| Error rate | > baseline × 1.5 for 10 min | 1 |
| p95 latency | > baseline + 100ms for 10 min | 1 or 2 |
| SEV-1 tagged with `<slug>` | immediate | 1 + escalate |
| Ledger / FK invariant breach | any | escalate, then 5 |
| Conversion drop | > 5% relative, 1 window | 1 |

## Procedures (per lever)

### Lever 1 — Flag kill
\`\`\`bash
ld flag set pricing-v2 --off
curl -H "X-User: test" https://api/price   # expect old pricing
\`\`\`
- Notify: Slack `#incidents`, status page if SEV1/2
- Log: `docs/incidents/<date>-pricing-v2.md`
- After kill: fire `/post-mortem` if customer-visible

### Lever 2 — Blue-green flip-back
\`\`\`bash
aws elbv2 modify-listener --listener-arn $LISTENER \\
  --default-actions Type=forward,TargetGroupArn=$BLUE_TG
\`\`\`
- Verify traffic on blue (synthetic monitor)
- Snapshot green logs to S3 before tear-down
- If flip fails (blue destroyed) → Lever 4

### Lever 3 — Image revert
\`\`\`bash
kubectl set image deployment/api api=ghcr.io/co/api:v1.7.4
# OR aws ecs update-service --task-definition api:42
\`\`\`

### Lever 4 — Code revert
\`\`\`bash
git revert <sha> && git push origin main
# CI builds + deploys; verify after rollout
\`\`\`

### Lever 5 — DB restore (PITR)
- Target timestamp: <YYYY-MM-DDTHH:MM:SSZ> (RPO)
- Procedure: `aws rds restore-db-instance-to-point-in-time --source-db-instance-identifier <name> --target-db-instance-identifier <name>-restored --restore-time <ts>`
- Cutover: stop writes (flag), DNS swap, resume writes
- Data loss window: <ts> → now

## Migration rollback (from `/migration-author` notes.md)

\`\`\`
## Rollback by phase
Phase 1 (expand)   → DROP COLUMN price_v2;
Phase 2 (backfill) → UPDATE products SET price_v2 = NULL;
Phase 3 (contract) → ALTER TABLE products ADD COLUMN price NUMERIC; \\
                     UPDATE products SET price = price_v2; \\
                     deploy code reading `price` again.
\`\`\`
- Phase 3 reversal needs PITR if writes hit new-only window.

## Communication templates

**Slack `#incidents`:**
> Rolling back `<release-slug>`. Cause: <signal>. Lever: <lever>. ETA: <SLA>.

**Status page (SEV1/2):**
> Investigating elevated error rates on <surface>. Rollback in progress. Next update in 30 min.

**Customer email** (if customer-visible): `templates/rollback-comms-<slug>.md`

## Decision tree

[paste one-page diagram from process step 6]

## Authority

| Action | On-call | Eng lead | VP Eng |
|---|:--:|:--:|:--:|
| Flag kill (Lever 1) | ✓ | ✓ | ✓ |
| Flip-back (Lever 2) | ✓ | ✓ | ✓ |
| Image / code revert (3, 4) | ✓ | ✓ | ✓ |
| DB restore (5) | – | ✓ | ✓ |
| Manual data fix (6) | – | ✓ (with second eng) | ✓ |

## Dry-run

- Staging exercise: <YYYY-MM-DD> by <name>
- Log: `docs/release/rollback-drill-<slug>-<date>.log`
- Result: <PASS / FAIL — fixed before release shipped>

## Post-rollback

- Auto-chain to `/post-mortem` if customer-visible OR SEV1/2
- Auto-chain to `/post-mortem-lite` if internal-only + no customer impact
- Update `docs/incidents/<date>-<slug>.md` with: lever taken, SLA actual vs spec, data-loss window, follow-ups
```

## Boundaries

- **Not the same as `/incident-commander-runbook`.** IC runbook is who-does-what during a page. This skill is what-to-press to undo a specific release. Both fire together.
- **Not the same as `/feature-flag-rollout` kill-switch SLA.** That skill spec'd the flag-kill lever. This skill picks among flag-kill AND code-revert AND DB-restore AND manual fix.
- **Does not author migrations.** `/migration-author` owns the migration; this skill consumes its `## Rollback by phase` block. If the block is missing, refuse and bounce back to `/migration-author`.
- **Does not author post-mortems.** Auto-chains to `/post-mortem` after the rollback executes.
- **Forward-fix vs rollback.** If the bug is too entangled to revert cleanly (e.g. 14 commits landed since), the plan may say "forward-fix is faster than revert" — document that explicitly with the forward-fix outline. Default bias: revert if revert works.

## Auto-chain

- **Guardrail breach in `/feature-flag-rollout` ramp** → this skill fires (Lever 1 = flag kill).
- **`/blue-green-deploy` flip-back fails** → this skill fires (Lever 2 exhausted → Levers 3–5).
- **`/migration-author` 3-phase migration ships** → this skill is required at L+ to consume the `## Rollback by phase` block.
- **After execution** → auto-chain `/post-mortem` if customer-visible OR SEV1/2.

## Verification

- Plan exists before release ships at L+ (ship-block if missing).
- Every trigger row has a numeric threshold (not "looks bad").
- Every lever has a copy-pasteable command (no prose-only steps).
- Migration cross-ref present if migration ran (refuses if `## Rollback by phase` missing).
- Dry-run log timestamped + located in `docs/release/rollback-drill-<slug>-<date>.log`.
- Authority matrix written for each lever.
- Communication templates pre-written (Slack + status page + customer email).
