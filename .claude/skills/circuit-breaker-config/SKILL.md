---
name: circuit-breaker-config
description: Closed/Open/Half-Open state machine + thresholds + fallback per upstream so one slow dependency doesn't tank the whole service. Outputs to `docs/design/circuit-breaker-<upstream>.md`. Reads `/project-classify` to skip XS. Use when user says "circuit breaker", "fail fast", "fallback", "trip threshold", "/circuit-breaker-config", or after any cascading-failure incident.
output_size:
  XS: skip
  S: 1h
  M: 4h
  L: 4h
  XL: 4h
---

# /circuit-breaker-config — Circuit Breaker Contract

## Why you'd care

One slow upstream + naive retries = thread-pool exhaustion = your whole service hangs. A configured breaker fails fast when the dependency is actually down, so the rest of the system keeps serving instead of cascading into a full outage.

Invoke as `/circuit-breaker-config`. Retries fix transient blips. Circuit breakers stop you from pounding a dependency that's actually down. Pair always with `/retry-backoff-policy`.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. List upstreams the service depends on; one breaker per upstream (not per call site).
3. Library decided: resilience4j (JVM), `opossum` (Node), `pybreaker` (Python), `gobreaker` (Go), or built-in mesh (Istio/Envoy).

## Inputs
- Upstream name + traffic volume (req/s peak)
- Failure definition (timeout, 5xx, gRPC UNAVAILABLE)
- Acceptable fallback (cached / degraded / 503)
- SLO of caller

## Process

1. **State machine** — three states, two transitions each:

   ```
                  failures > threshold
        ┌─────────────────────────────────────┐
        │                                     ▼
   ┌─────────┐                          ┌─────────┐
   │ CLOSED  │  trial succeeds          │  OPEN   │
   │ (normal)│ ◀───────────────────┐    │(fail-   │
   └─────────┘                     │    │  fast)  │
        ▲                          │    └─────────┘
        │ probe succeeds       ┌───┴─────┐    │
        │   (N in a row)       │HALF-OPEN│◀───┘ open_duration elapsed
        └──────────────────────│ (probe) │
                               └─────────┘
                                   │
                          probe fails: back to OPEN
   ```

2. **Thresholds** — per upstream, tune from traffic:

   | Parameter | Default | Tune up if | Tune down if |
   |---|---|---|---|
   | Failure-rate threshold | 50% | low traffic, flaky | high traffic, must fail fast |
   | Minimum-volume threshold | 20 req / 10s window | low-volume, noisy | high-volume, can sample |
   | Sliding-window size | 10s or 100 requests | bursty | steady |
   | Open duration | 30s | upstream takes long to recover | quick recovery |
   | Half-open probe count | 5 successes consecutively | want confidence | want fast recovery |
   | Slow-call threshold | p95 SLO × 2 | upstream legitimately slow | low latency budget |

3. **Per-tier table** — concrete starts:

   | Upstream class | Failure% | Min-vol | Open dur | Probes |
   |---|---:|---:|---:|---:|
   | Payment provider (Stripe) | 50% | 10 | 60s | 3 |
   | Internal RPC (chatty) | 50% | 50 | 10s | 5 |
   | Search (best-effort) | 30% | 20 | 30s | 5 |
   | Email/SMS (async) | 80% | 10 | 5min | 2 |
   | Database (critical) | 30% | 100 | 5s | 10 |

4. **Failure definition** — what counts:
   - Hard fail: connect refused, timeout, 5xx, gRPC UNAVAILABLE/DEADLINE_EXCEEDED
   - Slow call (counts as failure if exceeds threshold): latency > 2× p95 SLO
   - Does NOT count: 4xx (client bug, upstream is healthy)

5. **Fallback per upstream** — explicit, not "we'll figure it out":

   | Upstream | Fallback when OPEN | Customer experience |
   |---|---|---|
   | Recommendation service | empty list / popular items cache | degraded but works |
   | Payment | 503 + Retry-Later banner | blocked, but no double-charge risk |
   | Auth (critical) | NO fallback — 503 page | hard stop |
   | Search | DB LIKE query | slower but functional |
   | Avatar CDN | placeholder image | invisible degradation |

6. **Retry-breaker coordination** — order matters:
   - Outer layer: circuit-breaker check FIRST
   - If OPEN → fallback immediately, do not enter retry layer
   - If CLOSED/HALF-OPEN → retry layer with backoff
   - Half-open trial IS the retry; do not stack a retry on a half-open call

7. **Metrics + alerts** — required:
   - `circuit_breaker_state{upstream}` gauge (0=CLOSED, 1=HALF_OPEN, 2=OPEN)
   - `circuit_breaker_state_transitions_total{upstream,from,to}` counter
   - `circuit_breaker_calls_total{upstream,outcome=success|fail|rejected|slow}` counter
   - Alert: state==OPEN for >2min → page (something real is down)
   - Alert: state flapping (>3 transitions in 5min) → ticket (thresholds wrong)

8. **Anti-patterns**:
   - One global breaker for all upstreams — one slow dep trips the world
   - Breaker on retry layer only (no fallback) — same UX as no breaker
   - Threshold tuned in dev with no traffic — useless in prod
   - No half-open probes (just "open for 60s, then closed") — slams upstream the moment it comes back
   - Breaking on 4xx — sticks open forever, 4xx is client fault

## Output

Write `docs/design/circuit-breaker-<upstream>.md`:

```markdown
# Circuit Breaker — <upstream>
**Date:** <YYYY-MM-DD> | **Owner:** <team> | **Library:** <resilience4j/opossum/etc>

## Upstream
- Name: <e.g., Stripe>
- Traffic: <~50 rps peak>
- Failure definition: timeout, 5xx, gRPC UNAVAILABLE, slow > 800ms

## Thresholds
| Param | Value |
|---|---|
| Failure rate | 50% |
| Min volume | 20 req / 10s |
| Window | 10s sliding |
| Open duration | 30s |
| Half-open probes | 5 consecutive successes |
| Slow-call threshold | 800ms (2× p95 SLO) |

## Fallback (when OPEN)
- Strategy: <cached response / degraded path / 503 + Retry-Later>
- Customer experience: <e.g., "Payments temporarily unavailable, please retry in 30s">

## Retry coordination
- Retry layer SKIPPED when circuit OPEN
- See docs/design/retry-<upstream>.md

## Metrics
- circuit_breaker_state{upstream=<name>}
- circuit_breaker_calls_total{...}
- circuit_breaker_state_transitions_total{...}

## Alerts
- OPEN for >2min → PagerDuty
- >3 transitions / 5min (flapping) → Linear ticket

## Test cases
- [x] N consecutive fails → opens
- [x] OPEN rejects without calling upstream
- [x] After open_duration → HALF-OPEN, probes fire
- [x] M consecutive successes → CLOSED
- [x] 4xx does NOT count as failure
```

## Verification
- One breaker per upstream (not global).
- Threshold values are numeric, not "configure later".
- Fallback strategy named per breaker.
- Retry-breaker order documented.
- Alert on OPEN >2min wired.
- Flap detection alert wired.
