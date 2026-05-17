---
name: non-functional-baseline
description: Inception-phase NFR baseline — rough numbers for perf, security, a11y, scale, cost. Outputs to `docs/inception/nfr-baseline-<project>.md`. Use when user says "NFR baseline", "non-functional baseline", "rough SLO", "/non-functional-baseline", or before `/nfr-template` in Design phase.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /non-functional-baseline — Rough NFR Numbers

## Why you'd care

Without rough NFR numbers at inception, scope, capacity, and cost are all under-specified — and the design phase discovers them in the worst order. The baseline anchors the conversation before commit-to-build.

Full NFR spec lives in Design phase. This is the inception sanity check — are the rough numbers achievable?

## Pre-flight
None. Feeds `/nfr-template`, `/capacity-plan`, `/cost-model`.

## Inputs
- Architecture sketch.
- Expected load (rough).

## Process
1. **Performance** — p95 latency target, page-load LCP target, API throughput RPS.
2. **Availability** — SLO % (99.0 / 99.5 / 99.9 — pick honestly, not aspirationally).
3. **Security** — auth method, secrets handling, data-at-rest encryption, OWASP-top-10 awareness.
4. **Accessibility** — WCAG 2.2 AA target if consumer-facing, level otherwise.
5. **Scalability** — concurrent users, ceiling before re-architecting.
6. **i18n** — locales day 1, locales planned.
7. **Observability** — what you'll see (logs / metrics / traces) and where (Vercel logs / Datadog / Grafana / homegrown).
8. **Compliance** — GDPR / CCPA / HIPAA / PCI / SOC2 — which apply, which deferred.
9. **Cost ceiling** — $/mo at MVP scale, $/user fully loaded.

## Output
Write `docs/inception/nfr-baseline-<project>.md`:

```markdown
# NFR Baseline — <project>
**Date:** <YYYY-MM-DD>

## Performance
- API p95 latency: <X> ms
- Page LCP p75: <X> s
- Throughput: <X> RPS peak

## Availability
- SLO: 99.<X>%
- Allowed monthly downtime: <X> min

## Security
- Auth: <method>
- Secrets: <store>
- Encryption at rest: <Y/N>
- TLS: <version>
- OWASP triaged: <Y/N — deep dive in `/threat-model`>

## Accessibility
- Target: WCAG 2.2 <level>
- Tested via: <axe-core / manual / both>

## Scalability
- Concurrent users at MVP: <X>
- Ceiling before re-architecture: <X>

## i18n
- Day 1: <en-US>
- Planned: <list>

## Observability
- Logs: <where>
- Metrics: <where>
- Errors: <Sentry / homegrown>
- Alerts: <email / Slack / PagerDuty>

## Compliance
| Regime | Applies? | Deferred to |
|--------|----------|-------------|
| GDPR | Y/N | `/gdpr-preflight` |
| CCPA | Y/N | `/ccpa-preflight` |
| HIPAA | Y/N | `/hipaa-preflight` |
| PCI | Y/N | `/pci-preflight` |
| SOC 2 | Y/N | `/soc2-readiness-pre` |

## Cost ceiling
- MVP fixed: $<X>/mo
- Per-user variable: $<X>
- Break-even users: <N>

## Next
- Deep spec → `/nfr-template`
- Capacity math → `/capacity-plan`
- Cost model → `/cost-model`
```

## Verification
- Every section has a number, not "TBD".
- SLO matches realistic ops capacity.
- Compliance regimes triaged Y/N.
- Cost ceiling has both fixed + variable.
