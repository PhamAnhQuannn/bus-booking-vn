---
name: canary-deploy
description: Progressive rollout plan (1% → 10% → 50% → 100%) with SLI-gated auto-rollback. Outputs canary plan + rollback triggers to `docs/release/canary-<service>.md`. Reads `/project-classify` to skip XS/S. Use when user says "canary", "progressive rollout", "blue-green", "shadow deploy", "/canary-deploy", or before any production deploy with >100 users.
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 2h
  XL: 4h
---

# /canary-deploy — Progressive Rollout

## Why you'd care

A 0→100% deploy is a guess that production looks like staging — and the guess fails publicly when it's wrong. SLI-gated canaries catch bad releases at 1% traffic, so the rollback is automatic and the customer impact is bounded instead of company-wide.

Invoke as `/canary-deploy`. Stop atomic 0→100% deploys. Stage traffic, gate on SLIs, auto-rollback on breach.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP.
2. Required artifacts:
   - `docs/operate/slo-<service>.md` (SLIs/SLOs defined — gate trigger source)
   - `docs/operate/observability-<service>.md` (metric source wired)
   - `docs/release/rollback-runbook-<service>.md` (rollback procedure)
3. Confirm traffic-split mechanism: load-balancer weight, service-mesh (Istio/Linkerd), feature-flag platform (LaunchDarkly), or DNS-weighted.

## Inputs
- Service name + version (current + canary)
- Target SLIs (p99 latency, error rate, saturation)
- Stage durations (default: 15m / 1h / 4h / 24h)
- Rollback authority (auto vs human-approve)

## Process

1. **Stage table** — define percent-of-traffic + soak time + gate-criteria:

   | Stage | % traffic | Soak | Auto-promote if | Auto-rollback if |
   |---|---:|---:|---|---|
   | 1 | 1% | 15m | error-rate ≤ baseline+10% AND p99 ≤ baseline+20% | breach 5min |
   | 2 | 10% | 1h | same | same |
   | 3 | 50% | 4h | same | same |
   | 4 | 100% | 24h monitor | n/a | breach 5min → rollback to last good |

2. **SLI gate definition** — exact thresholds:
   - Error rate: `errors / total` per minute, compared to last 7-day baseline at same hour-of-week
   - p99 latency: per-route, compared to baseline ±20%
   - Saturation: CPU/memory/queue-depth ≤ 80%
   - Custom business KPI (signups/min, checkout rate) optional

3. **Rollback decision tree**:
   - Auto if: error-rate >2× baseline for 5min, OR p99 >2× for 5min, OR any custom SEV-1 alert
   - Human-approved if: error-rate +10–100% baseline, OR ambiguous degradation
   - Always: incident-commander paged on rollback

4. **Mechanism pick** (decide per stack):
   - Kubernetes: Argo Rollouts / Flagger
   - AWS: CodeDeploy weighted target groups
   - Service mesh: Istio VirtualService weight
   - Feature flag: LD/Statsig %-rollout (user-bucketed, not traffic-weighted)

5. **Shadow option** (L/XL): 100% mirror traffic to canary, compare responses without serving. Use for stateful changes (DB migration, algorithm rewrites).

6. **Deploy day runbook** — paste exact CLI/UI steps per stage. Don't trust memory.

## Output

Write `docs/release/canary-<service>.md`:

```markdown
# Canary Plan — <service> v<X> → v<Y>
**Date:** <YYYY-MM-DD> | **Class:** <M/L/XL> | **Mechanism:** <Argo/Istio/LD/...>

## Stages
| Stage | % | Soak | Promote-if | Rollback-if |
|---|--:|--:|---|---|
| 1 | 1% | 15m | <criteria> | <criteria> |
| 2 | 10% | 1h | ... | ... |
| 3 | 50% | 4h | ... | ... |
| 4 | 100% | 24h | n/a | ... |

## SLI gates (exact)
- Error rate: <metric query + threshold>
- p99 latency: <query + threshold>
- Saturation: <queries>
- Business KPI: <optional query>

## Rollback authority
- Auto: <triggers>
- Human: <triggers + on-call name>

## Deploy-day runbook
1. <exact command>
2. <exact command>
...

## Comms
- Status page: <update at stage 3>
- Slack channel: #deploys
- Customer notify if SEV-1: <template link>
```

## Verification
- Each stage has %, soak, and explicit gate (no "watch dashboards" hand-wave).
- Rollback trigger is a query, not a vibe.
- Mechanism named and matches stack.
- Runbook has exact commands, not "deploy as usual".
- Shadow mode considered for L/XL stateful changes.
