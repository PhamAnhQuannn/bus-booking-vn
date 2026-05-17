---
name: slo-define
description: Define SLIs (indicators), SLOs (objectives), SLAs (contracts), and error budgets per service. Outputs SLO doc with measurement query + target + budget math to `docs/operate/slo-<service>.md`. Reads `/project-classify` to skip XS. Use when user says "SLO", "SLI", "SLA", "error budget", "availability target", "/slo-define", or before any reliability commitment.
output_size:
  XS: skip
  S: 1h
  M: 4h
  L: 8h
  XL: 8h
---

# /slo-define — Service Level Objectives

Invoke as `/slo-define`. SLA is the customer promise. SLO is the internal target stricter than SLA. SLI is what you measure to know.

## Why you'd care

Reliability targets without measured SLIs are just adjectives. Defining the indicator, objective, and error budget is what turns "we should be more reliable" into engineering decisions you can disagree with rationally.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Required inputs:
   - Service boundaries (which endpoint(s) does this SLO cover?)
   - Telemetry source (Prometheus, Datadog, CloudWatch, Honeycomb)
   - Customer-visible SLA if any (uptime guarantee, latency promise)
3. One SLO per critical user journey, not per microservice.

## Inputs
- Service + endpoint(s)
- User journey covered ("login completes", "checkout succeeds", "search returns")
- Existing SLA text if customer-facing
- Tolerance for downtime (minutes/quarter)

## Process

1. **Pick SLI type** per user journey:

   | SLI type | Definition | Example |
   |---|---|---|
   | Availability | good_requests / total_requests | HTTP 2xx+3xx / total non-5xx-from-client |
   | Latency | % of requests faster than threshold | p95 < 300ms |
   | Quality | % responses with correct data | search returns ≥1 result for non-empty query |
   | Freshness | % data within staleness budget | feed entries <5min old |
   | Correctness | % outputs matching ground truth | invoice math matches order total |

2. **Define SLI with exact query** — paste the actual PromQL/MetricQL/equivalent:
   ```promql
   sum(rate(http_requests_total{job="checkout",status!~"5.."}[5m]))
   /
   sum(rate(http_requests_total{job="checkout"}[5m]))
   ```
   No "we measure availability" hand-waving. The query IS the SLI.

3. **Pick SLO target** — stricter than SLA. Common targets:

   | Target | Downtime budget / 30d | Use case |
   |---|---|---|
   | 99% | 7h 12m | internal tools |
   | 99.5% | 3h 36m | non-critical SaaS |
   | 99.9% | 43m 12s | standard B2B SaaS |
   | 99.95% | 21m 36s | payments, auth |
   | 99.99% | 4m 19s | infra primitives |
   | 99.999% | 26s | telecom, only with serious redundancy |

   Rule: SLA promised - 0.1% buffer = SLO. Never set SLO = SLA.

4. **Error budget math**:
   - Budget = (1 − SLO) × time_window
   - Burn rate alerts: 2% of monthly budget in 1h = fast burn (page); 10% in 6h = slow burn (ticket)
   - See `/error-budget-policy` for spend rules

5. **Multi-window multi-burn-rate alerts** (Google SRE pattern):

   | Severity | Window | Burn rate | Action |
   |---|---|---|---|
   | Page | 1h + 5m | >14.4× | wake oncall |
   | Page | 6h + 30m | >6× | wake oncall |
   | Ticket | 3d + 6h | >1× | next business day |

6. **Document edge cases** — what does NOT count as a bad event:
   - 4xx from bad client input (not server's fault)
   - Planned maintenance window (if SLA allows)
   - Force majeure / upstream provider outages (only if SLA carves out)

7. **Review cadence** — quarterly. SLOs that never burn budget are too loose. SLOs that always burn are too tight.

## Output

Write `docs/operate/slo-<service>.md`:

```markdown
# SLO — <service> / <user journey>
**Date:** <YYYY-MM-DD> | **Owner:** <team> | **Review:** quarterly

## User journey
<one-sentence: "user submits checkout and gets confirmation page">

## SLI
- Type: <availability/latency/quality/freshness/correctness>
- Query:
  ```promql
  <exact query>
  ```
- Source: <Prometheus instance / Datadog dashboard ID>

## SLO
- Target: <99.9%> over rolling 30d
- Customer SLA (if any): <99.5% — SLO is 0.4 buffer below SLA>
- Error budget: <43m 12s downtime / 30d>

## Burn-rate alerts
| Severity | Window | Threshold | Routing |
|---|---|---|---|
| Page | 1h | >14.4× | PagerDuty <service>-oncall |
| Page | 6h | >6× | PagerDuty <service>-oncall |
| Ticket | 3d | >1× | Linear <team> |

## Exclusions
- 4xx from client validation errors
- <other carve-outs>

## Budget policy
- See `docs/operate/error-budget-policy-<service>.md`

## Last quarter
- Budget consumed: <X%>
- Notable burns: <incident ids>
```

## Verification
- One SLO per user journey, not per microservice.
- SLI query is executable (paste-and-run).
- SLO target stricter than customer SLA.
- Burn-rate alerts wired (not just dashboards).
- Exclusions written, not assumed.
- Quarterly review on calendar.
