---
name: retry-backoff-policy
description: Exponential backoff + jitter + retry budget per upstream dependency so transient failures don't become correlated retry storms. Outputs to `docs/design/retry-<upstream>.md`. Reads `/project-classify` to skip XS. Use when user says "retry policy", "exponential backoff", "jitter", "retry budget", "/retry-backoff-policy", or before integrating any flaky upstream.
output_size:
  XS: skip
  S: 1h
  M: 4h
  L: 4h
  XL: 4h
---

# /retry-backoff-policy — Retry & Backoff Contract

Invoke as `/retry-backoff-policy`. Naive retries turn a 1-second blip into a 5-minute outage. Exponential + jitter + a budget keeps the herd off the upstream's neck.

## Why you'd care

Retries without jitter turn one upstream blip into a synchronized stampede that takes down the upstream entirely. Exponential backoff plus a retry budget is the difference between resilience and a self-inflicted DDoS.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. List every upstream the service calls (DB, cache, payment, search, mail, internal RPC).
3. Idempotency contract decided per upstream (see `/idempotency-key-design`).

## Inputs
- Upstream name + transport (HTTP, gRPC, queue, DB)
- Idempotency status (safe to retry? mutation?)
- Latency SLO of caller (how many retries fit in the budget)
- Base delay, max delay, jitter type
- Retry budget (% of upstream traffic spent on retries)

## Process

1. **Retry-vs-no-retry decision** — per error class:

   | Class | Retry? | Why |
   |---|:--:|---|
   | Network timeout, connect refused | YES | transient, idempotency-protected |
   | HTTP 5xx (500/502/503/504) | YES | server-side transient |
   | HTTP 429 | YES, honor `Retry-After` | rate-limited |
   | HTTP 408 | YES | request timeout, retryable |
   | HTTP 4xx (400/401/403/404/422) | NO | client bug, retry won't fix |
   | gRPC UNAVAILABLE, DEADLINE_EXCEEDED | YES | transient |
   | gRPC INVALID_ARGUMENT, PERMISSION_DENIED | NO | non-retryable |
   | Non-idempotent + no idempotency-key | NO | risks dup side-effects |

2. **Backoff formula** — full-jitter (AWS Architecture Blog pattern):
   ```
   delay = random_between(0, min(cap, base * 2 ** attempt))
   ```
   Full-jitter beats exponential-with-fixed-multiplier — decorrelates retries across N clients hitting the same upstream.

3. **Per-tier policy table** — pick by caller class:

   | Caller class | Max retries | Base delay | Cap | Total worst-case |
   |---|---:|---:|---:|---:|
   | Sync user-facing (HTTP request handler) | 2 | 200ms | 2s | <5s budget |
   | Sync internal RPC | 3 | 100ms | 1s | <3s |
   | Async job (queue consumer) | 5 | 1s | 60s | <5min |
   | Batch / cron | 8 | 5s | 5min | <30min |
   | Webhook delivery (outbound) | 10 | 30s | 1h | 24h with capped attempts |

4. **Retry budget** — token bucket per upstream, cap retries at 10% of base traffic:
   - Measure: `retry_count / total_request_count` over rolling 1m
   - When budget exceeded → drop further retries (return original failure)
   - Prevents retry storm during partial outage
   - Emit `retry_budget_exhausted` metric

5. **Circuit-breaker handoff** — don't retry inside an open circuit:
   - Retry layer checks circuit state first
   - Open → fail fast, no retry attempt
   - Half-open probe is the de-facto retry; don't double-stack
   - See `/circuit-breaker-config`

6. **Honor explicit signals** — when upstream tells you when to retry:
   - `Retry-After: <seconds>` or `Retry-After: <HTTP-date>` → wait at least that long
   - gRPC trailer `retry-pushback-ms` → same
   - Cap honor at `max_delay` so a malicious/bug upstream can't park you forever

7. **Observability** — required metrics per upstream:
   - `upstream_request_total{outcome=success|retry|fail}`
   - `upstream_retry_attempts` histogram (how many tries before success or final fail)
   - `upstream_retry_budget_used` ratio
   - Log per retry: `attempt=N, delay=Xms, reason=<class>`

8. **Anti-patterns** — name explicitly so they fail review:
   - Fixed-delay retries (1s, 1s, 1s) — every client retries in lockstep, hammers upstream
   - Exponential without jitter — same lockstep at longer intervals
   - Infinite retries (no max attempts) — blocks caller indefinitely
   - Retrying non-idempotent POSTs without idempotency-key — duplicates
   - Retrying on 4xx — wastes budget, never succeeds

## Output

Write `docs/design/retry-<upstream>.md`:

```markdown
# Retry Policy — <upstream>
**Date:** <YYYY-MM-DD> | **Owner:** <team>

## Upstream
- Name: <e.g., Stripe API>
- Transport: <HTTPS/gRPC>
- Idempotency: <header-supported / message-id / N/A>
- SLO of caller: <p95 < 800ms; budget 5 retries × 200ms = 1s>

## Retry classes
| Error | Retry? | Notes |
|---|:--:|---|
| Network timeout | YES | |
| 5xx | YES | |
| 429 | YES | honor Retry-After |
| 4xx | NO | |
| Non-idempotent w/o key | NO | |

## Backoff
- Formula: `delay = rand(0, min(cap, base * 2^attempt))`
- Base: <200ms> | Cap: <2s> | Max attempts: <2>
- Worst-case total: <~4.2s>

## Retry budget
- Cap: 10% of base traffic over 1m window
- Action on exhaustion: fail fast, emit metric

## Circuit-breaker handoff
- Skip retry if circuit OPEN
- See docs/design/circuit-breaker-<upstream>.md

## Observability
- Metrics: upstream_request_total, upstream_retry_attempts, upstream_retry_budget_used
- Log fields: attempt, delay_ms, reason

## Anti-patterns avoided
- [x] No fixed-delay retries
- [x] Jitter enabled
- [x] Max attempts set
- [x] 4xx not retried
```

## Verification
- Per-error retry decision is named, not implied.
- Backoff includes jitter (random, not fixed).
- Max attempts AND cap delay both set.
- Retry budget defined with concrete threshold.
- Honors `Retry-After` if upstream sends it.
- Metrics + logs spec'd before code lands.
