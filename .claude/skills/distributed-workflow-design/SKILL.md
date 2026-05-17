---
name: distributed-workflow-design
description: Long-running workflow design — durable execution, timers/sleeps that survive restarts, human-in-loop steps, signals, child workflows. Picks Temporal / Inngest / Step Functions / DB+cron. Outputs `docs/design/workflow-<project>.md`. Use for workflows that span minutes-to-months (onboarding drips, dunning, KYC review, refund SLA, fulfillment, subscription lifecycle). Reads `/project-classify`; XS+S skip unless multi-day workflow exists.
output_size:
  XS: skip
  S: skip
  M: 3h
  L: 5h
  XL: 10h
---

# /distributed-workflow-design — Long-running Workflow

## Why you'd care

The "send a follow-up email in 24 hours" cron job written naively will fail every time a deploy lands during the window, drop on every process restart, and silently fall behind during incidents — and the 30-day dunning flow built on the same primitive will skip months of customers when the worker queue backs up. Durable execution (Temporal / Inngest / Step Functions) plus the right primitive choice up front is what stops the slow-burn class of "workflow forgot about that customer" bugs that look fine in QA and surface as revenue holes only at scale.

Invoke as `/distributed-workflow-design`. Use when a workflow needs to survive process restarts, vendor outages, and clock-time waits ("send email 24h later", "escalate if no response in 3 days", "renew subscription on day 30").

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS / no >1h workflow → SKIP.
2. Read `docs/design/saga-<project>.md` (workflow may *contain* sagas).
3. Read `docs/design/architecture-<project>.md`.

## Inputs
- List of multi-step processes that wait clock-time or wait on human input.
- Max duration per workflow (1h, 1d, 30d, ongoing).
- Side-effects: emails, charges, status changes, notifications.
- Failure tolerance: at-most-once / at-least-once / exactly-once-effective.

## Process
1. **List candidate workflows**. Common shapes:
   - Onboarding drip (signup → email d0/d1/d3/d7)
   - Trial-to-paid (trial start → reminder d10/d13/d14 → charge)
   - Dunning (failed charge → retry d1/d3/d7/d14 → cancel)
   - KYC review (submit → human approve/reject → notify → unlock)
   - Refund SLA (request → triage 24h → process 48h → notify)
   - Renewal (charge anniversary → invoice → on fail enter dunning)
   - Reservation reminders (book → 24h reminder → same-day SMS → no-show flag)
2. **Pick durability mechanism**:
   - **DB + cron** (default for S/M): `WorkflowRun` table with `next_wake_at`, cron polls every minute. No new infra; works to ~5k active workflows.
   - **Inngest** (M/L web-SaaS): managed durable functions, code-first, generous free tier.
   - **Temporal** (L/XL): self-host or Cloud; full DAG, signals, timers, queries.
   - **AWS Step Functions** (L/XL on AWS): visual workflow + service integrations.
   - Avoid raw `setTimeout` / in-process queues — die on restart.
3. **Workflow code shape**:
   - Pure orchestration calls deterministic-replay activities.
   - All side-effects in activities (not in workflow code) so replay is safe.
   - Sleeps are persistent (`workflow.sleep('24h')`, not `setTimeout`).
4. **Signals + queries**:
   - Signal: external event interrupts workflow (e.g. "user clicked unsubscribe" cancels remaining drip).
   - Query: read workflow state without affecting it (admin "what step is run X on?").
5. **Human-in-loop** steps:
   - Workflow waits for signal `approved` or `rejected`.
   - Timeout: auto-reject or escalate after N days.
   - Admin UI sends the signal.
6. **Versioning**: deployed workflow code change must not break in-flight runs.
   - Temporal: `workflow.GetVersion` patches.
   - Inngest: function id versioning.
   - DB+cron: feature flag on workflow body; freeze old runs to old code.
7. **Observability**:
   - Per-workflow: started, completed, failed, p50/p95 duration.
   - Per-step: success rate, latency, error rate.
   - Backlog metric: workflows past expected wake time by >5 min.

## Output
Write `docs/design/workflow-<project>.md`:

```markdown
# Long-running workflow design — <project>
**Date:** <YYYY-MM-DD>

## Workflows in scope
| Workflow | Duration | Steps | Signals | Pattern |
|---|---|---|---|---|
| onboarding_drip | 7d | 4 | unsubscribe | Inngest |
| trial_to_paid | 14d | 4 | early_upgrade | Inngest |
| dunning | up to 21d | 5 | manual_retry, cancel | Inngest |
| reservation_reminders | up to 24h | 3 | cancel_reservation | DB+cron |
| refund_sla | up to 72h | 4 | manual_approve | DB+cron |

## Tooling decision
- **MVP:** DB+cron (`WorkflowRun` + `WorkflowStep` tables, 1-min cron tick).
- **Phase 2:** migrate email/payment workflows to Inngest when >1k active runs.
- **Defer:** Temporal until L+ scale or non-Node ecosystem.

## Workflow: onboarding_drip
```
on signup:
  await sleep('5m');   send welcome email
  await sleep('24h');  send getting-started
  await sleep('48h');  send case-study; if active → skip
  await sleep('72h');  send personal check-in; if active → skip
  done
signal unsubscribe: cancel all remaining
```

## Workflow: dunning
```
on charge_failed:
  await sleep('1d');   retry charge; if succeed → done
  await sleep('2d');   retry + email
  await sleep('4d');   retry + email + in-app banner
  await sleep('7d');   retry + email "final notice"
  await sleep('7d');   cancel subscription + email
signal manual_retry: jump to retry-charge now
signal cancel: cancel subscription immediately
```

## DB schema (for DB+cron path)
```sql
CREATE TABLE workflow_run (
  id              uuid PRIMARY KEY,
  workflow        text NOT NULL,
  state           text NOT NULL,         -- pending|running|sleeping|done|failed|canceled
  current_step    int NOT NULL,
  next_wake_at    timestamptz,           -- when cron should pick up
  payload         jsonb NOT NULL,
  signals         jsonb DEFAULT '[]',
  created_at      timestamptz DEFAULT now(),
  completed_at    timestamptz
);
CREATE INDEX ON workflow_run (next_wake_at) WHERE state = 'sleeping';
```

## Cron picker (DB+cron)
```ts
// every minute
const due = await db.workflowRun.findMany({
  where: { state: 'sleeping', next_wake_at: { lte: new Date() } },
  take: 50, // batch
});
for (const run of due) await tick(run); // tick advances by one step
```

## Replay/idempotency
- Each activity uses `idempotency_key = <run_id>:<step>:<attempt>`.
- Activity result cached in `WorkflowStep`; replay returns cached result, doesn't re-call vendor.
- Sleeps stored as `next_wake_at` — surviving restart is automatic.

## Signals
| Workflow | Signal | Effect |
|---|---|---|
| onboarding_drip | unsubscribe | cancel remaining sends |
| dunning | manual_retry | jump to retry-charge step |
| dunning | cancel | terminate, set subscription canceled |
| refund_sla | manual_approve | jump to refund-process |

## Versioning
- Workflow `workflow_version` column; cron picker only runs latest version for *new* runs.
- In-flight runs run their pinned version body via feature-flag-gated step dispatch.
- Migrate-in-place only for safe data-only changes; logic changes spawn new version.

## Observability
- Metrics: workflow_started, workflow_completed, workflow_failed, workflow_p95_duration, workflow_backlog (rows where next_wake_at < now - 5min).
- Per-workflow dashboards.
- Alerts: backlog > 100, failure rate > 2%, dunning canceled spike > 3σ.

## Test plan
- Time-travel: fake clock advances to 24h; assert step fires.
- Signal mid-flight: cancel during sleep; assert workflow terminates next tick.
- Vendor outage: activity returns 500; assert retry per saga policy; assert idempotency on success.
- Restart mid-flight: kill cron worker between ticks; second worker picks up cleanly.
```

## Verification
- Workflow inventory listed with duration + pattern choice.
- Durability mechanism justified per workflow (no in-process timers).
- Signals + queries documented per workflow.
- Idempotency + replay path covered.
- Versioning strategy noted.
- Observability + backlog alert defined.
