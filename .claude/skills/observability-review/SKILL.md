---
name: observability-review
description: Observability review of an open PR. Enforces that new mutations, endpoints, and background jobs emit at least one of structured log on entry/exit, trace span, or metric (counter/histogram). Flags new error paths swallowed without log, new external calls without trace span, console.log used in place of structured logger. Read-only — writes `docs/qa/obs-pr<PR#>-YYYYMMDD.md`. Use when you want an observability gate on a PR before merge — the trio does not cover this.
output_size:
  XS: 5m
  S: 10m
  M: 10m
  L: 15m
  XL: 20m
---

# /observability-review — Logs + Traces + Metrics Audit on a PR

## Why you'd care

The trio catches correctness, arch, and PR shape — not whether the new code is observable in production. `/code-review` Cat 3 flags a swallowed catch but does not require the catch include a *structured* log line. `/architect-review` does not flag a new POST handler that ships with zero `logger.info` / span / counter. `/pr-review` does not flag a new outbound `fetch(` that has no span wrapper. The result: a new mutation merges, an incident fires two weeks later, oncall finds the code path emits nothing — no log, no span, no metric. This skill scans the diff for those gaps.

Invoke as `/observability-review <PR#>`. PR# required.

---

## Pre-flight

1. `gh auth status` — required. Stop with install/login hint if missing.
2. `gh pr view <PR#> --json number,title,headRefName,baseRefName,headRefOid,isDraft,state,url,reviewDecision,author,additions,deletions,changedFiles` — capture PR shape. Pin `headRefOid`.
3. If `state != "OPEN"` → stop, report "PR closed/merged."
4. `gh pr diff <PR#>` — full patch.
5. Detect project logger / tracer / metrics conventions by reading one sibling file in `app/api/**` or `lib/jobs/**`: capture imports for `logger`, `pino`, `winston`, `bunyan`, `tracer`, `@opentelemetry`, `prom-client`, `metrics`, project-specific helpers. Record the canonical pattern in the report so findings reference what the project actually uses.

### Auto-skip

If every changed path matches `*.md|docs/**|*.txt|CHANGELOG*|LICENSE*|*.lock|.env.example|.github/**|*.yml|*.yaml|*.test.ts|*.test.tsx|*.spec.ts|__tests__/**|tests/**` → emit:

```
OBSERVABILITY REVIEW — PR #<PR#>
────────────────────────────────
Skipped — doc-only, config-only, or test-only PR (no production code in diff).
```

…and stop.

---

## Detection scope

Only audit added (`+`) code in:

- `app/api/**`, `pages/api/**`, `src/routes/**`, `server/routes/**`, `controllers/**` — HTTP handlers.
- `lib/jobs/**`, `workers/**`, `jobs/**`, `queue/**` — background jobs / queue workers.
- `app/**/actions.ts`, `app/**/server-actions.ts`, files containing `'use server'` — Next.js server actions.
- New cron registrations (`@Cron(`, `cron.schedule(`, `vercel.json` crons block).

Files outside this scope are skipped (UI components, tests, types, generated code).

---

## Categories

### Cat 1 — Mutation without log

For each new POST / PUT / DELETE / PATCH handler (heuristic: exported `POST` / `PUT` / `DELETE` / `PATCH` function in App-Router file, or `router.post(` / `router.put(` etc. in Express-style file):

- If handler body contains zero calls matching the project's structured-logger pattern (`logger.` / `log.info` / `log.error` / `pino(` / `tracer.startSpan` / `span.` / `metrics.` / `counter.inc`) → **P1**.
- If handler body uses `console.log(` / `console.error(` / `console.warn(` instead of the structured logger (project pattern detected in pre-flight) → **P1** (console is not production telemetry).
- If handler has a log on entry but none on the error path (no log inside any `catch` block) → **P2**.

Recommended fix in the report: emit `logger.info({ actor, action, target }, '…')` on entry and `logger.error({ err }, '…')` on caught error.

### Cat 2 — External call without span

For each new outbound call in scope files:

- `fetch(` to a non-relative URL (string literal starts with `http`, or variable name matches `*Url|*Endpoint|*ApiKey*`).
- `axios.` / `axios(` call.
- SDK call patterns (`stripe.`, `s3.`, `ses.`, `sns.`, `twilio.`, `sendgrid.`, `openai.`, `anthropic.`).

If the call is NOT inside a span wrapper (no surrounding `tracer.startSpan(` / `withSpan(` / `@WithSpan` / `context.with(` / project-specific `traced(` helper within 10 lines above) → **P2**.

### Cat 3 — Error swallowed

For each new `catch (` block in scope:

- If block body is empty, only contains a comment, or only contains `console.*` → **P1**.
- If block re-throws but emits no log first → **P2**.
- If block returns an error response (`Response.json({ error: ... })`, `res.status(500)`) but emits no log first → **P2**.

This category is stricter than `/code-review` Cat 3: requires the *structured* logger, not `console`.

### Cat 4 — Metric gaps

For each new handler / job in scope, detect if the project has a metrics convention (pre-flight grep for `metrics.inc(`, `counter.inc(`, `histogram.observe(`, `prom.register`, `@Counter(`, `statsd.`).

- If the project uses metrics elsewhere AND the new handler / job emits none → **P3**.
- If the new handler / job emits one log but no success/failure counter on a hot path (route matches `payment|order|checkout|booking|reservation|signup|login`) → **P3**.

---

## Severity

- **P1** — new mutation handler with zero observability; `console.*` used instead of structured logger; fully-swallowed catch.
- **P2** — external call without span; catch that rethrows or returns 500 without log; entry log but no error-path log.
- **P3** — missing metric on a hot path where metrics convention already exists in the codebase.

---

## Output Format

Write to `docs/qa/obs-pr<PR#>-YYYYMMDD.md`:

```
OBSERVABILITY REVIEW — PR #<PR#> "<title>"
──────────────────────────────────────────
PR:        <URL>
Base/Head: <baseRefName> ← <headRefName> @ <headRefOid[:8]>
Decision:  <reviewDecision>
Size:      +<additions> / -<deletions> across <changedFiles> files
Generated: <ISO timestamp>

Project conventions detected:
  logger:  <pattern> (e.g. `logger.info(...)` from `lib/logger.ts`)
  tracer:  <pattern> (e.g. `tracer.startSpan(...)` from `@opentelemetry/api`)
  metrics: <pattern or "none detected">

Findings: <N>  (P1: <a> · P2: <b> · P3: <c>)

P1 — BLOCKING:
  app/api/orders/cancel.ts:14  🔇 P1: New POST handler emits no logger / span / metric.
    Fix: add `logger.info({ orderId, actor }, 'order.cancel.start')` on entry and `logger.error({ err, orderId }, 'order.cancel.failed')` in catch.

  app/api/admin/users/role.ts:38  🔇 P1: Catch block uses `console.error` — project uses `logger.error`.
    Fix: replace `console.error(e)` with `logger.error({ err: e, userId }, 'role.update.failed')`.

P2 — SHOULD FIX:
  lib/jobs/send-receipt.ts:22  📡 P2: New `fetch('https://api.stripe.com/...')` outside any span wrapper.
    Fix: wrap in `tracer.startActiveSpan('stripe.charge', async (span) => { ... span.end() })`.

  app/api/orders/cancel.ts:31  ⚠️  P2: Catch returns 500 but logs nothing.
    Fix: add `logger.error({ err, orderId }, 'order.cancel.failed')` before the return.

P3 — ADVISORY:
  app/api/checkout/route.ts:48  📊 P3: Project has `metrics.inc('checkout.success')` elsewhere — this new path doesn't increment.
    Consider adding `metrics.inc('checkout.success')` on the success branch and `metrics.inc('checkout.failure')` in the catch.

RECOMMENDED NEXT:
  - Address P1 before merge.
  - If reviewer already requested changes: /pr-feedback-route <PR#>

SUMMARY: <a> P1 · <b> P2 · <c> P3 · pinned to <headRefOid[:8]>
```

Empty case:

```
OBSERVABILITY REVIEW — PR #<PR#>
────────────────────────────────
No observability findings.
(All new handlers emit logs / spans / metrics per project convention.)
```

---

## Boundaries

- Read-only. Does NOT comment on PR, does NOT modify code, does NOT execute the diff.
- Enforces *presence* of telemetry, not *quality* of log message text.
- Does NOT verify dashboard / alert wiring (out of scope; assumes ops layer consumes the structured output).
- Does NOT cover correctness or arch — see `/code-review`, `/architect-review`.
- Does NOT cover crypto / authz — see `/security-review-deep`.
- Does NOT cover perf / cost — see `/perf-review`.

## Auto-chain

- **No auto-chain out.**
- **Triggered by**: `/pr-inbox` (always-on companion row); `/route` when user says "observability gaps" / "logs traces metrics" / "is this instrumented" with a PR#.
- **Cross-links**: `/pr-feedback-route <PR#>` for the post-CHANGES_REQUESTED loop.

## Integration

- **Produces**: `docs/qa/obs-pr<PR#>-YYYYMMDD.md` (idempotent same-day overwrite).
- **Consumes**: `gh pr view --json` + `gh pr diff <PR#>` + one sibling file for convention detection.
- **Re-run**: idempotent. Re-run after each push.
