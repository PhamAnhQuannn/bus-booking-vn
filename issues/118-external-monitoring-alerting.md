---
depends-on: [061-observability-health-requestid-sentry]
type: FEATURE
wave: 0.5
spec: []
---

## Parent PRD

`issues/prd.md` — operational readiness gap identified by grill-me self-assessment.
Merges scope with launch-checklist PL-24 (wire Sentry DSN).

## What to build

Zero external monitoring exists. `instrumentation.ts` is empty (seam only).
`lib/observability/sentry.ts` has full abstraction but `@sentry/nextjs` is not installed.
No uptime monitor, no 500-rate alerting, no cron-failure alerting.

In production, if `process-payouts` fails silently for 24 hours, operators don't get paid
and nobody knows. If all API routes 500, nobody is alerted.

### Deliverables

1. **Uptime monitoring** — configure UptimeRobot or BetterStack:
   - Health check endpoint: `GET /api/health` (returns 200 if DB reachable)
   - Check interval: 5 min
   - Alert channels: email + (optionally) Slack/Telegram
2. **Error tracking** — wire Sentry:
   - Install `@sentry/nextjs`
   - Initialize in `instrumentation.ts` when `SENTRY_DSN` is set
   - `beforeSend` PII scrubbing (reuse existing `lib/observability/sentry.ts` logic)
   - Alert on error rate spike (>10 errors/5min)
3. **Cron failure alerting** — add error logging to all 11 cron handlers:
   - On job failure: `logger.error({ jobName, err }, 'cron.failed')` (L-20 covers entry/exit)
   - Sentry captures the error → alert fires
4. **`docs/ops/monitoring.md`** — runbook listing all configured monitors and alert channels

## Acceptance criteria

- [ ] `/api/health` endpoint exists and returns 200 when DB is reachable.
- [ ] `@sentry/nextjs` installed and initialized in `instrumentation.ts`.
- [ ] SENTRY_DSN in env schema (optional — fallback to pino logger when unset).
- [ ] External uptime monitor configured and documented.
- [ ] All 11 cron handlers have error-level logging on failure.
- [ ] `docs/ops/monitoring.md` exists.

## Blocked by

- Issue 061 (observability seam) — already DONE

## Files

- `instrumentation.ts`
- `package.json` (add `@sentry/nextjs`)
- New: `app/api/health/route.ts`
- New: `docs/ops/monitoring.md`
- `lib/config/env.ts` (SENTRY_DSN already optional — no change needed)
- All 11 `app/api/cron/*/route.ts` (error logging)

## Severity

LAUNCH — zero production alerting means outages and financial failures go undetected.
