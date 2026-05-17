---
name: saga-orchestrator-design
description: Distributed transaction saga design — multi-service workflows with compensating actions, orchestrator vs choreography, idempotency, replay safety. Outputs `docs/design/saga-<project>.md`. Use when crossing service/DB/vendor boundaries with a write that must "all happen or all undo" — e.g. order+payment+inventory+ship, signup+stripe+resend+welcome-pack, transfer+ledger+notify. Reads `/project-classify`; skip XS+S unless multi-service.
output_size:
  XS: skip
  S: skip
  M: 3h
  L: 6h
  XL: 12h
---

# /saga-orchestrator-design — Distributed Transaction Saga

Invoke as `/saga-orchestrator-design`. Required when a single user action triggers writes across ≥2 systems that can't share a DB transaction (microservice DBs, external vendors, message broker side-effects).

## Why you'd care

A multi-service write without a saga is a half-applied transaction waiting to inform a customer they paid but never got the order. The compensating-action design is what makes the workflow safe to replay.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS / single-service S → SKIP. (Monolithic Postgres tx covers you.)
2. Read `docs/design/architecture-<project>.md` for service+vendor map.
3. Read `docs/design/idempotency-key-design-<project>.md` (saga depends on it).

## Inputs
- List of workflows that touch ≥2 services or vendors.
- Per-step: forward action, compensating action, side-effect type (DB / vendor call / message / email).
- SLA on user-visible completion (sync, async-with-poll, async-eventual).

## Process
1. **Decide orchestrator vs choreography** per workflow:
   - **Orchestrator** (recommended default): central state machine drives steps. Easier to reason about, easier to debug, single retry/timeout policy. Examples: Temporal, AWS Step Functions, Inngest, application-owned `SagaRun` table.
   - **Choreography** (event-bus): each service reacts to events. Lower coupling but harder to observe; only pick when teams are independent and workflows are simple.
2. **List steps with compensations**. For each forward step write the inverse:
   - charge card → refund card
   - reserve inventory → release reservation
   - send confirmation email → send cancellation email (idempotency: do nothing if forward never fired)
   - mint NFT → burn NFT (or accept as lost; cost decision)
3. **Classify side-effect type per step**:
   - **Reversible** (DB row, internal): compensation is exact inverse.
   - **Compensatable** (charge, inventory): compensation is an offsetting forward action.
   - **Pivot** (after this step, no rollback — only forward retry): e.g. physical shipment dispatched. Saga must succeed past pivot or escalate to human.
   - **Retriable-only** (email): no real compensation; design for at-least-once with idempotent recipient handling.
4. **Idempotency keys**:
   - Saga run id = primary key (UUIDv7 / ULID).
   - Per-step idempotency key = `<saga_run_id>:<step_name>:<attempt>`.
   - Persist before vendor call; on retry, vendor sees same key → returns same result.
5. **Persistence**: `SagaRun(id, workflow, state, current_step, payload, created_at, completed_at)` + `SagaStep(run_id, step, status, attempt, idempotency_key, request, response, error, ts)`.
6. **Retry + timeout policy**:
   - Exponential backoff 1s → 2s → 4s → 8s → 16s, max 5 attempts on transient errors.
   - Non-retryable errors (4xx auth, validation) → fail-fast → compensate prior steps.
   - Per-step timeout = vendor SLA × 2.
   - Saga timeout = sum(step timeouts) × 1.5.
7. **Replay safety**: any worker can pick up a stuck saga. State + idempotency key make replay safe. Test with chaos: kill worker mid-step.
8. **Observability**: trace per saga run, span per step. Alert on saga p95 latency, stuck-saga count (>SLA in non-terminal state), compensation rate (>1% = upstream broken).

## Output
Write `docs/design/saga-<project>.md`:

```markdown
# Saga design — <project>
**Date:** <YYYY-MM-DD>

## Workflows in scope
| Workflow | Trigger | Services touched | SLA | Pattern |
|---|---|---|---|---|
| place_order | POST /api/checkout | stripe + inventory-svc + order-db + email | sync 3s | orchestrator |
| cancel_order | POST /api/orders/:id/cancel | stripe + inventory-svc + order-db + email | sync 5s | orchestrator |
| signup_flow | POST /api/signup | auth + stripe + resend + crm | async 30s | orchestrator |

## Workflow: place_order
| # | Step | Forward | Compensation | Side-effect | Idempotency key |
|---|---|---|---|---|---|
| 1 | reserve_inventory | POST inventory/reserve | POST inventory/release | DB+remote | run:1 |
| 2 | charge_card | stripe.paymentIntents.create | stripe.refunds.create | vendor | run:2 |
| 3 | create_order | INSERT Order pending | UPDATE Order canceled | DB | run:3 |
| 4 | confirm_order | UPDATE Order confirmed | UPDATE Order canceled | DB | run:4 |
| 5 | send_email | Resend send | Resend send(cancel) | vendor | run:5 (PIVOT — past here no rollback) |

## State machine
`pending → reserving → charging → creating → confirming → emailing → done`
`* → failed → compensating(reverse) → failed_compensated`

## Compensation rules
- Step 5 pivot — if email send transient-fails, retry forever (in-band), never compensate.
- Step 2 charge — refund within 90 days only; past 90 days escalate to human.
- Step 1 reserve — release after 15 min if no confirm.

## Persistence
```sql
CREATE TABLE saga_run (
  id            uuid PRIMARY KEY,
  workflow      text NOT NULL,
  state         text NOT NULL,
  current_step  int NOT NULL,
  payload       jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);
CREATE TABLE saga_step (
  run_id          uuid REFERENCES saga_run(id),
  step            text NOT NULL,
  attempt         int NOT NULL,
  status          text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  request         jsonb,
  response        jsonb,
  error           text,
  ts              timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, step, attempt)
);
```

## Retry policy
- Transient (5xx, network, 429): exp backoff 1-2-4-8-16s, max 5.
- Non-retryable (4xx auth/validation): fail-fast.
- Vendor-specific timeouts: Stripe 30s, Resend 10s, Twilio 8s.

## Stuck-saga policy
- Saga in non-terminal state >SLA × 1.5 → page on-call.
- Manual replay button in admin: re-pick-up-from-current-step.

## Tooling decision
- **MVP:** application-owned table + cron worker (no new infra).
- **At 10k sagas/day:** consider Temporal / Inngest.
- Avoid choreography (no Kafka) — single team, sync-feeling UX.

## Observability
- Trace: saga.run_id, saga.workflow, saga.step.
- Metrics: saga_p95_latency, saga_stuck_count, saga_compensation_rate, saga_pivot_failures.
- Alerts: stuck >SLA, compensation rate >1%/hr, pivot failure (page immediately).

## Test plan
- Unit: each step idempotent under double-call.
- Integration: kill worker mid-step → second worker resumes, no double-charge.
- Chaos: vendor returns 500 for first 3 attempts → step succeeds on 4th.
- Compensation: induce failure at step N, assert steps 1..N-1 compensated in reverse.
```

## Verification
- Every multi-service workflow listed with steps + compensations.
- Pivot steps explicitly marked.
- Idempotency key scheme written down.
- Retry+timeout policy per-step + per-saga.
- Persistence schema in source control.
- Stuck-saga detection + replay path documented.
