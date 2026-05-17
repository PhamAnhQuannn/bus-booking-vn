---
name: blue-green-deploy
description: Blue-green deploy plan (parallel envs, DNS/LB cutover, smoke-on-green, instant rollback). Use when user says "blue-green", "zero downtime deploy", "/blue-green-deploy", or for L/XL releases where rolling/canary insufficient (e.g. major framework upgrade, breaking schema change paired with code, third-party dep version flip).
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 2h
  XL: 4h
---

# /blue-green-deploy — Parallel-Env Cutover Plan

## Why you'd care

Rolling deploys mix versions mid-flight — for ~10 minutes you have v1 and v2 instances both behind the LB, both talking to the same DB, both expecting their own schema shape. That works for additive changes; it silently corrupts data on breaking ones. Canary segments traffic but still mixes versions: 5% of users hit v2 while 95% hit v1, and any shared mutable state (cache key shape, queue message format, session schema) collides.

Blue-green keeps versions fully isolated. Green is a complete parallel stack on the new version. Blue keeps serving until you flip. Flip is atomic — one LB weight change or DNS swap moves 100% of traffic at once. Rollback is the same operation in reverse: flip back to blue, which is still warm.

Right tool for breaking-change releases: major framework upgrade (Next 13→15, Rails 6→7), runtime version bump (Node 18→22, Postgres 14→16), third-party dep major (Stripe API version flip, auth provider migration), or any schema change where new code + new schema must ship together with no version overlap window.

Invoke as `/blue-green-deploy`. Outputs `docs/release/blue-green-<feature>.md`.

## When This Skill Applies

Triggers:
- "blue-green", "zero-downtime deploy", "atomic cutover", "parallel env deploy"
- "/blue-green-deploy"
- Pre-release planning when class is L or XL and the change touches: framework major version, language runtime, DB engine version, auth/session format, cache key schema, queue message format.

Choose blue-green over canary when:
- **Versions can't coexist.** Breaking schema paired with code: v2 reads `purchase_orders` table, v1 reads `orders` table, and only one exists at a time.
- **Stateful protocol changes.** Session token format change, cache key namespace, websocket handshake version.
- **Third-party dep major.** Stripe API version, Auth0 → Clerk migration, where both versions writing to the upstream creates inconsistency.
- **Runtime upgrade.** Node 18→22 binary differences, Postgres 14→16 client driver, Python 3.10→3.12 — green needs its own infrastructure.

Choose canary instead when changes are additive, version-coexistent, and you want SLI-gated progression. Choose rolling when changes are routine and version-compatible.

## Pre-flight

1. **Capacity budget.** Blue-green doubles infra during the cutover window. Confirm the spend: 2× compute, 2× memory, possibly 2× DB connections (if green needs its own pool). If budget caps deploy size, fall back to canary or scheduled-maintenance-window deploy.
2. **Stateful concerns.** DB / cache / queue must support multi-version reads during the brief flip window, OR migration is paired and already in a backwards-compatible state. Cross-ref `/migration-author` zero-downtime 3-phase: blue-green flip happens between Phase 2 (backfill complete) and Phase 3 (contraction). Never flip during a destructive migration window.
3. **Required artifacts:**
   - `docs/release/rollback-plan-<service>.md` (rollback procedure — flip-back is the primary; backup-restore is the fallback)
   - `docs/operate/observability-<service>.md` (metrics wired on both blue and green)
   - Migration status confirmed in expand state (no pending contraction)
4. **Traffic shift mechanism confirmed:** LB weighted target groups (AWS ALB / GCP LB), service-mesh route swap (Istio VirtualService), DNS weighted record with low TTL, or platform-native (Vercel alias swap, Heroku pipeline promote, Cloud Run revision tag).

## Inputs

- Release version (current blue version, target green version)
- Traffic shift mechanism (LB weight / DNS swap / service mesh / platform alias)
- Smoke duration on green before flip (default: 30 min internal + 10 min metric watch)
- Flip authority (human-approved for L, automation-eligible for XL with strict SLI gates)
- Rollback SLA (e.g. "flip back within 5 min of SEV-1 trigger")
- DB migration interaction (paired? expand-only? none?)
- Blue retention window post-flip (default: 30 min for M, 2h for L, 24h for XL)

## Process

1. **Env-parity checklist** — green must be a clone of blue except for the version delta:
   - Same instance type, count, AZ distribution
   - Same env vars (audit secret values, not just keys — green pulling stale secret = silent break)
   - Same feature flags (LD/Statsig env pointing at same project)
   - Data fixture refresh: green app talks to same prod DB (default) OR a freshly-restored replica (for runtime upgrades where binary writes diverge)
   - Same logging/tracing endpoints, same alert routing
   - Health-check endpoint responding 200 on green before considering it ready

2. **Deploy to green, keep blue serving.** Green receives zero production traffic. Internal-only routing during smoke: VPN, header-gated route, internal LB target.

3. **Smoke-on-green protocol:**
   - Run `/prod-smoke` against green's internal endpoint (golden paths: signup → core action → payment)
   - Run `/a11y-runtime` if UI-touching change
   - Internal canary: route employees only (cookie-gated or IP-allowlist) for 10–30 min
   - Watch green's metrics in parallel to blue: error rate, p99 latency, saturation. Green should match blue ±10% under synthetic load.
   - Run any release-specific verification: framework-upgrade compat test suite, dep version smoke (Stripe webhook replay against green, etc.)

4. **Flip decision criteria** — gate the cutover on a small explicit table, not vibes:

   | Criterion | Threshold | Action if fail |
   |---|---|---|
   | Smoke suite | 100% pass | Abort, fix on green, re-smoke |
   | Internal canary error rate | ≤ baseline +10% | Abort, investigate |
   | Green p99 latency | ≤ blue p99 +20% | Abort or accept-with-note |
   | DB migration status | Expand complete, no pending contract | Halt — finish migration phase first |
   | Health-check uptime on green | 100% for last 10 min | Wait or abort |
   | Flip authority | Human-approved (L), auto-eligible (XL) | Wait for sign-off |

5. **Atomic flip:**
   - LB weight: `blue=100,green=0` → `blue=0,green=100` in one API call
   - DNS swap: CNAME/ALIAS record updated; pre-set TTL ≤ 60s starting 1h before flip
   - Service mesh: `kubectl apply` of new VirtualService routing
   - Platform alias: `vercel alias set <green-deployment> <prod-domain>` or equivalent
   - Confirm cutover via independent observer (curl from external network, synthetic monitor)

6. **Keep blue warm for N minutes.** Blue continues running, receiving zero traffic, ready for instant flip-back. Retention window:
   - M release: 30 min
   - L release: 2 hours
   - XL release: 24 hours (or until next business day)
   - Watch green's prod metrics during this window: error rate, latency, business KPIs (signups/min, checkout completion, etc.). Compare against pre-flip blue baseline.

7. **Drain + destroy blue** after the success window:
   - Verify green has been clean for the full retention window (no rollback events, metrics within tolerance)
   - Drain blue's connections (long-poll websockets given grace period)
   - Snapshot blue's logs / state for post-mortem reference
   - Tear down blue infra (or re-tag as "previous-blue" if platform supports cheap retention)
   - Update `docs/release/blue-green-<feature>.md` with actuals (smoke duration, flip timestamp, retention duration, outcome)

## Output Format

Write `docs/release/blue-green-<feature>.md`:

```markdown
# Blue-Green Deploy Plan — <feature> v<X> → v<Y>
**Date:** <YYYY-MM-DD> | **Class:** <M/L/XL> | **Mechanism:** <ALB/DNS/Istio/Vercel-alias>

## Env-parity checklist
- [ ] Instance type / count / AZ match
- [ ] Env vars + secrets values audited (not just keys)
- [ ] Feature flags pointing at same project
- [ ] Fixture / DB connection strategy: <shared-prod | replica>
- [ ] Logging / tracing / alerts wired on green
- [ ] Health-check 200 on green

## Traffic mechanism
- Mechanism: <ALB weighted target groups | Route53 weighted alias | Istio VirtualService | Vercel alias>
- Flip command: `<exact CLI or UI step>`
- Pre-flip TTL setting: <≤ 60s, set 1h before flip>

## Smoke protocol on green
1. /prod-smoke against `<internal-green-url>` — golden paths
2. /a11y-runtime if UI-touching
3. Internal canary (employees-only, cookie-gated) — 10–30 min
4. Release-specific verification: <e.g. Stripe webhook replay, framework compat suite>

## Flip decision criteria
| Criterion | Threshold | Status |
|---|---|:--:|
| Smoke pass | 100% | [ ] |
| Internal canary error rate | ≤ baseline +10% | [ ] |
| Green p99 | ≤ blue p99 +20% | [ ] |
| Migration status | Expand done, no pending contract | [ ] |
| Health-check uptime | 100% / 10min | [ ] |
| Flip authority sign-off | <name> | [ ] |

## Rollback steps
1. Trigger: <SEV-1 alert | manual call | SLI breach for 5min>
2. Flip command (reverse): `<exact CLI>`
3. Verify traffic on blue: curl + synthetic monitor
4. Post-incident: snapshot green logs, file post-mortem ticket
5. If rollback fails (e.g. blue already destroyed): fall back to `/rollback-plan` full procedure
6. Rollback SLA: flip-back within <5 min> of trigger

## DB migration interaction
- Migration slug: <ts>_<slug>
- Phase status at flip: <expand complete, contract pending>
- Contraction deploy: scheduled for <date>, separate window
- Rollback note: if flip-back happens, contraction stays unscheduled until next attempt

## Blue retention
- Hold blue warm for <30min | 2h | 24h>
- Drain command: `<exact CLI>`
- Destroy command: `<exact CLI>`

## Comms
- Status page: <update at flip moment>
- Slack: #deploys + #on-call
- Customer notify if SEV-1 during smoke or post-flip: <template link>
```

**Multi-vertical worked examples:**

*SaaS API — Next 13 → 15 major upgrade:*
- Blue = Next 13 stack on Vercel project A, Green = Next 15 stack on project B
- Mechanism: Vercel alias swap on prod domain
- Smoke: full E2E suite + internal-only header gate for 30 min
- Migration: none (framework-only)
- Retention: 2h (L class)

*Ecommerce — Rails 6.1 → 7.1 + Sidekiq 6 → 7:*
- Blue = old Rails app + old Sidekiq fleet, Green = new Rails + new Sidekiq
- Mechanism: AWS ALB weighted target groups (web tier) + separate worker fleet swap (workers tier)
- Smoke: order-placement golden path against green's internal LB, replay Stripe webhook samples
- Migration: paired — expand-phase done in prior deploy, contraction held until 24h post-flip
- Retention: 24h (XL class, holiday season)

*Fintech — Postgres 14 → 16 client driver + connection pool change:*
- Blue = old app with pg driver 14.x, Green = new app with pg driver 16.x and pgBouncer config update
- Mechanism: AWS ALB weighted target groups
- Smoke: full ledger-invariant suite on green (replay last 1000 transactions against green, compare hashes)
- Migration: none on schema; pg upgrade ran weeks earlier in expand-only mode
- Retention: 24h, with on-call paged for full window
- Rollback SLA: 2 min (regulator-facing latency reporting)

## Boundaries

This skill is a **deploy plan**, not infra provisioning. It:
- Does NOT write LB config, Terraform/Pulumi for parallel envs, or DNS records
- Does NOT provision green infrastructure — assumes IaC stack handles that
- Does NOT replace SLO definitions or observability wiring
- Assumes a **stateless app** at the request-handling layer — sticky-session apps need session-store migration plan separately
- Assumes **paired migration is already in safe state** (expand phase complete before flip); doesn't author the migration itself — that's `/migration-author`
- NOT for stateful single-master DBs without read-replica setup — flipping app traffic doesn't help if both versions write to the same single-master with incompatible schemas; needs a different pattern (logical replication + cutover)
- NOT for systems with long-lived connections (websockets, gRPC streams) without an explicit drain plan — those need additional connection-draining design

## Re-run Behavior

- Re-run per release. Each blue-green flip gets its own `docs/release/blue-green-<feature>.md`.
- Cumulative log: maintain `docs/release/blue-green-lineage.md` recording which version was green/blue at each release, flip timestamp, retention duration, and outcome. This is the audit trail for "which version were we on at <time>" questions during incident review.
- Do NOT edit a prior release's plan after flip; archive it. Supersede with a new file for the next release.
- If a flip aborts at the decision-criteria step, leave the plan file with a "ABORTED — <reason>" header and re-author for the next attempt.

## Auto-chain

- **Pairs with `/migration-author`** for releases that include breaking schema changes. The expand phase must ship in a prior deploy; the contraction phase must NOT be pending at flip time. Confirm via `/migration-author` notes.md status check.
- **Chains to `/deploy-health-gate`** immediately post-flip. The deploy-health-gate runs for the retention window, monitoring error rate / p95 / 5xx, and recommends flip-back if SLOs breach.
- **Falls back to `/rollback-plan`** if flip-back itself fails (e.g. blue already destroyed, LB API unresponsive, DNS propagation stuck). The rollback-plan covers code revert + DB restore + feature flag kill-switch.
- **Pre-flip, suggest `/prod-smoke`** for the smoke-on-green step, and `/a11y-runtime` if UI changes.

## Example Trigger

> User: "we're upgrading Postgres major version, plan the deploy"

→ `/blue-green-deploy` produces a plan with:
- Green = new app servers with pg16 client driver, talking to a logical-replica of prod DB (or to upgraded prod after upgrade window)
- Paired migration status: expand-only changes (pg14↔pg16 client-compat) shipped 2 weeks prior; no pending contraction
- Smoke window on green: 1 hour internal + 30 min metric watch
- Flip mechanism: ALB weighted target groups, single API call
- Retention: 24 hours warm blue (XL class)
- Rollback SLA: flip back within 2 min on SEV-1 trigger; falls back to `/rollback-plan` if blue destroyed
- Auto-chains to `/deploy-health-gate` for the 24h post-flip window
- Output: `docs/release/blue-green-pg16-upgrade.md`
