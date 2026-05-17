---
name: rate-limit-design
description: Token-bucket per tenant/IP/route + 429 contract so one client can't blow the budget for everyone else. Outputs to `docs/design/rate-limit-<surface>.md`. Reads `/project-classify` to skip XS. Use when user says "rate limit", "throttle", "429", "token bucket", "API quota", "/rate-limit-design", or before exposing any public API.
output_size:
  XS: skip
  S: 1h
  M: 4h
  L: 4h
  XL: 4h
---

# /rate-limit-design — Rate Limit Contract

Invoke as `/rate-limit-design`. No rate limits = one curl loop kills you. Define identity, algorithm, tiers, and the 429 contract before launch — not during incident.

## Why you'd care

One greedy client without a rate limit means everyone else's requests queue, time out, or 5xx. The token-bucket isn't optional once you have more than one tenant — it's the fairness contract that keeps the API alive.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. List public surfaces (REST/GraphQL routes, webhook ingress, signup).
3. Storage available: Redis (recommended) or in-memory with sticky routing.

## Inputs
- Surface(s) to protect
- Identity dimensions (anon IP / signed-in user / api-key / tenant)
- Pricing tiers if SaaS
- Burst tolerance per surface

## Process

1. **Identity dimensions** — pick the right key, not the lazy one:

   | Dimension | Pros | Cons | Use case |
   |---|---|---|---|
   | IP | works for anon | shared NATs, CGNAT, mobile carriers | DDoS first line; signup spam |
   | User ID (signed-in) | per-account fairness | bypass by creating accounts | core API |
   | API key | per-integration fairness | requires key plumbing | dev API |
   | Tenant ID (org) | per-customer fairness | one user can starve org | B2B SaaS |
   | Composite (tenant+user+route) | granular | many keys, memory cost | high-cardinality APIs |

   Stack them: anon → IP-limit; signed-in → user-limit AND tenant-limit (tighter wins).

2. **Algorithm pick**:

   | Algorithm | Burst | Smoothness | Memory | Use case |
   |---|---|---|---|---|
   | Token bucket | YES (up to bucket size) | smooth refill | 2 floats / key | API requests (default) |
   | Leaky bucket | NO | constant output rate | 2 floats / key | queue smoothing |
   | Sliding window log | exact | exact | O(N) per key | low-volume, audit-required |
   | Sliding window counter | approx | smooth | 2 ints / key | high-volume |
   | Fixed window | NO | jagged at boundaries | 1 int / key | crude / cheap |

   Default: **token bucket** for APIs (allows reasonable burst), **sliding window counter** for hot paths.

3. **Per-tier table** — concrete numbers, not "configurable":

   | Tier | Per-user rate | Per-tenant rate | Burst | 429 after |
   |---|---:|---:|---:|---|
   | Anonymous (IP) | 30 / min | — | 10 | 30 |
   | Free signed-in | 60 / min | 600 / min | 20 | 60 |
   | Paid (Pro) | 600 / min | 6,000 / min | 100 | 600 |
   | Enterprise | custom | custom (contract) | custom | — |
   | Internal service-to-service | 10,000 / min | — | 500 | hard fail |

   Per-route overrides for expensive endpoints (e.g., `/search` at 1/5 of general).

4. **429 response contract** — what the client gets:
   ```http
   HTTP/1.1 429 Too Many Requests
   Retry-After: 30
   X-RateLimit-Limit: 60
   X-RateLimit-Remaining: 0
   X-RateLimit-Reset: 1730000000
   X-RateLimit-Resource: user:42|route:POST /v1/things
   Content-Type: application/json

   {"error":"rate_limited","message":"60/min exceeded","retry_after_s":30}
   ```
   - `Retry-After` in seconds OR HTTP-date — pick one and document
   - `X-RateLimit-*` on every response (not just 429), so clients can self-throttle
   - JSON body: error code stable, message human-readable

5. **Storage** — Redis token-bucket via Lua (atomic):
   ```lua
   -- KEYS[1]=bucket, ARGV[1]=now, ARGV[2]=rate, ARGV[3]=capacity
   local tokens = tonumber(redis.call('HGET', KEYS[1], 'tokens')) or ARGV[3]
   local last   = tonumber(redis.call('HGET', KEYS[1], 'ts')) or ARGV[1]
   local elapsed = ARGV[1] - last
   tokens = math.min(ARGV[3], tokens + elapsed * ARGV[2])
   if tokens < 1 then return 0 end
   redis.call('HSET', KEYS[1], 'tokens', tokens - 1, 'ts', ARGV[1])
   redis.call('EXPIRE', KEYS[1], 600)
   return 1
   ```
   Lua makes the read-decide-write atomic. Plain `INCR + EXPIRE` is fine only for fixed-window.

6. **Soft warnings + hard limits**:
   - 80% of budget → response header `X-RateLimit-Warning: 80%` (no body change)
   - 100% → 429
   - 5× hard limit in 1m → temp ban 1h
   - 50× hard limit in 1h → permanent ban (review queue)

7. **Bypass + exceptions** — explicit allow-list:
   - Internal service-to-service: bearer token bypasses public limits but has its own
   - Status-page polling: dedicated endpoint, 10× rate
   - Webhook receivers (you owning the receiving side): higher inbound limit per source
   - Health checks (`/health`): never rate-limited

8. **Observability**:
   - `rate_limit_decisions_total{outcome=allow|warn|deny,tier,route}`
   - `rate_limit_hit_ratio` per tier
   - Alert: deny-ratio > 5% sustained → SLA issue or attack
   - Per-key top-N dashboard (which keys hammer you)

9. **Anti-patterns**:
   - Rate-limit by IP only when you have signed-in users — punishes shared offices
   - No headers on success responses — clients can't self-throttle
   - Fixed window without burst tolerance — legitimate clients hit limit at minute boundary
   - Different limits across replicas (in-memory, no shared store) — sticky-routing fragile
   - "We'll add rate limiting later" — that's how you DDoS yourself

## Output

Write `docs/design/rate-limit-<surface>.md`:

```markdown
# Rate Limit — <surface>
**Date:** <YYYY-MM-DD> | **Owner:** <team>

## Identity stack
| Dimension | Used? | Note |
|---|:--:|---|
| IP | YES | anon only |
| User ID | YES | signed-in |
| Tenant | YES | B2B fairness |
| API key | YES (dev API) | |

## Tier table
| Tier | Per-user | Per-tenant | Burst |
|---|---:|---:|---:|
| Anonymous | 30/min | — | 10 |
| Free | 60/min | 600/min | 20 |
| Pro | 600/min | 6000/min | 100 |
| Enterprise | per contract | per contract | per contract |

## Algorithm
- Token bucket via Redis Lua
- Refill: continuous (tokens += elapsed × rate)
- Capacity: burst column above

## 429 contract
- Headers: Retry-After, X-RateLimit-Limit/Remaining/Reset/Resource
- Body: `{error:"rate_limited", retry_after_s:N}`

## Soft warnings
- 80% → X-RateLimit-Warning header
- 5× over in 1m → 1h temp ban
- 50× over in 1h → permanent ban (review)

## Bypass
- Internal service auth
- /health
- Status polling endpoint (dedicated)

## Observability
- rate_limit_decisions_total
- Alert: deny-ratio >5% sustained

## Per-route overrides
| Route | Override | Reason |
|---|---|---|
| POST /v1/search | 1/5 of tier | expensive |
| POST /v1/upload | 5/min any tier | bandwidth |
```

## Verification
- Every public route has a tier assignment.
- 429 includes Retry-After AND X-RateLimit-* headers.
- Headers on every response, not just 429.
- Storage is atomic (Lua / DB row lock / dedicated rate-limit service).
- Soft warning + hard limit + ban escalation defined.
- Internal services have a separate budget.
