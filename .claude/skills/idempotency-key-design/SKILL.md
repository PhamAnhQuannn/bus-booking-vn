---
name: idempotency-key-design
description: Idempotency-key contract for unsafe HTTP methods (POST/PUT/DELETE) so retries don't double-charge / double-create. Stripe-style. Outputs design + storage schema to `docs/design/idempotency-<service>.md`. Reads `/project-classify` to skip XS. Use when user says "idempotency", "idempotency key", "double-charge", "retry safety", "/idempotency-key-design", or before any payment/order/email API.
output_size:
  XS: skip
  S: 1h
  M: 4h
  L: 4h
  XL: 4h
---

# /idempotency-key-design — Idempotency Contract

## Why you'd care

Without an idempotency contract on unsafe methods, a single network retry can double-charge a customer or create duplicate orders — and you find out from a support ticket, not a metric. The key + storage schema is the cheap insurance.

Invoke as `/idempotency-key-design`. Network retries are inevitable. Without idempotency, every retry is a new resource — duplicate charge, duplicate email, duplicate order. Solve once per side-effect surface.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. List unsafe endpoints (POST/PUT/PATCH/DELETE that mutate persistent state).
3. Have storage available: Redis (recommended) or Postgres.

## Inputs
- Endpoints to protect
- Retry sources (mobile client / webhook receiver / queue consumer)
- Retention need (24h / 7d / 30d / forever)
- Acceptable false-collision rate

## Process

1. **Pick keying surface** — which client provides the key:

   | Surface | Header / param | Source of randomness |
   |---|---|---|
   | Mobile/web client | `Idempotency-Key: <uuid v4>` | Client-generated per request, retried unchanged |
   | Webhook receiver | `Idempotency-Key: <provider-event-id>` | Upstream provider's event ID |
   | Queue consumer | message ID from broker | Broker-assigned |

2. **Contract**:
   - Same key + same method + same path + same body hash → return cached response
   - Same key + different body → 422 Unprocessable Entity (client bug)
   - Same key + concurrent in-flight → 409 Conflict OR block-until-first-completes
   - Missing key on protected endpoint → 400 Bad Request

3. **Storage schema** (Redis example):
   ```
   KEY: idem:{tenant}:{endpoint}:{idempotency-key}
   VALUE: {
     status: "in-flight" | "completed",
     request_hash: <sha256 of body>,
     response_status: <http code>,
     response_body: <bytes>,
     completed_at: <ts>
   }
   TTL: <retention window>
   ```

4. **Locking** — prevent thundering herd of duplicates:
   - Acquire key with `SET NX EX <timeout>` (or row lock if Postgres)
   - First request: process, write completed result
   - Second request mid-flight: see in-flight, either wait or return 409

5. **Replay window**:
   - 24h: payments (Stripe convention)
   - 7d: order creation
   - 30d: low-frequency admin ops
   - Forever: only with strong dedup elsewhere

6. **Body-hash check** — same key, different body = bug:
   - Compute `sha256(canonical_json(body))` at first request
   - On subsequent same-key request, compare; mismatch → 422

7. **What NOT to idempotent**:
   - Pure reads (GET) — already idempotent
   - True append-only logs where dup events are expected (use dedup at consumer)
   - Operations where "do exactly once" is unsolvable (use compensating tx instead)

8. **Test cases** — required:
   - Identical retry within window → same response, no side-effect duplicate
   - Identical retry after window → new resource (acceptable)
   - Same key + different body → 422
   - Concurrent identical → one wins, other waits or 409
   - Server crash mid-process → on retry, complete or restart

## Output

Write `docs/design/idempotency-<service>.md`:

```markdown
# Idempotency Design — <service>
**Date:** <YYYY-MM-DD> | **Owner:** <team>

## Protected endpoints
| Endpoint | Method | Key source | Retention |
|---|---|---|---|
| /v1/charges | POST | `Idempotency-Key` header | 24h |
| /v1/orders | POST | `Idempotency-Key` header | 7d |
| /webhooks/stripe | POST | Stripe event ID | 30d |

## Contract
- Header: `Idempotency-Key: <uuid v4>` required
- Same key + same body → cached response
- Same key + different body → 422
- Concurrent → 409 Conflict or wait

## Storage
- Redis namespace: `idem:{tenant}:{endpoint}:{key}`
- TTL: per-endpoint table above
- Schema: `{status, request_hash, response_status, response_body, completed_at}`

## Locking
- `SET NX EX <30s>` on first request
- Subsequent: 409 if in-flight, return cached if completed

## Client guidance
- Generate UUID v4 client-side, persist until success or final-failure
- Retry with same key for: network timeout, 5xx, 429
- Do NOT reuse key across different logical operations

## Test cases
- [x] Identical retry → idempotent
- [x] Different body, same key → 422
- [x] Concurrent → one wins
- [x] Replay after TTL → new resource

## Anti-patterns
- Server-generated key — client can't retry
- No TTL — storage grows forever
- No body-hash check — silent dup on client bug
```

## Verification
- Every unsafe endpoint listed has key source + TTL.
- Body-hash check explicit.
- Concurrent-request behavior named.
- Client retry guidance written.
- Test cases enumerated (not "we'll test").
