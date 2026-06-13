# Observability Review — Full Codebase

**Date:** 2026-06-12 | **Scope:** All 134 API routes, all background jobs, all lib modules

## Key Metric

**Only 13 of 134 route handlers (10%) have structured logging.**

## Logger Convention

Project uses **Pino** via `lib/logger.ts` with:
- 40+ redaction paths (phone, OTP, tokens, passwords, bank accounts)
- Level: `LOG_LEVEL` env (default info prod, debug dev)
- Request-id infrastructure exists (`lib/observability/requestId.ts`) but unused in handlers
- Sentry integration deferred (`lib/observability/sentry.ts` → falls back to logger)
- **No distributed tracing** (no OpenTelemetry)
- **No metrics** (no prom-client, statsd, etc.)

## P1 — Critical Gaps

### Payment webhooks — zero handler-level logging
| Route | Issue |
|-------|-------|
| `app/api/payments/momo/webhook/route.ts` | No entry log. If handler throws before `processPaymentWebhook`, no trace webhook arrived. |
| `app/api/payments/card/webhook/route.ts` | Same pattern. |
| `app/api/payments/zalopay/webhook/route.ts` | Same pattern. |

`processWebhook.ts` logs internally (signature, currency mismatch), but route-level entry/exit context missing. A DB timeout during booking lookup produces generic 500 indistinguishable from bad signature.

**Fix:** Add `logger.info({ adapter }, 'payment.webhook.received')` on entry, `logger.error({ err, adapter }, 'payment.webhook.failed')` in catch.

### Payout settlement — no job-level entry/exit
`lib/jobs/processPayouts.ts` — logs skipped accounts and captures exceptions, but:
- No "processPayouts started, N due" entry log
- No "processPayouts completed: N paid, N skipped" summary
- If zero payouts due, job runs completely silent

**Fix:** Add entry/exit summary logs.

### Auto-complete trips — zero logging
`lib/jobs/autoCompleteTrips.ts` — loops through due trips, completes them. No entry log, no summary, no error context.

### Expire holds — zero logging
`lib/jobs/expireHolds.ts` — sweeps expired holds. No summary count logged.

## P2 — Should Fix

### Auth routes — all silent (12 handlers)
| Category | Routes | Issue |
|----------|--------|-------|
| Admin auth | login, logout, refresh, step-up, totp/enroll, totp/verify | Zero logging. Admin login has no IP/timestamp audit trail. |
| Operator auth | login, register, logout, refresh | Zero logging. Rate-limit + lockout logic silent. |
| Account | delete, name, password, phone/init, phone/confirm | Zero logging. Account deletion is audit-critical. |

### Operator routes — all silent (~15 handlers)
Trip creation, depart, complete, bus CRUD, route CRUD, booking queue, check-in, no-show, charter claim — none have handler-level logging.

### Admin finance routes — silent at handler level (6 handlers)
Chargeback, refund-out, payout approve, fee-override, ledger adjustment, confirm-payout-account — write AdminAuditLog to DB but no request-level structured log.

### Error swallowing in client API wrappers
`lib/api/{busesClient,tripsClient,staffClient,routesClient,pickupAreasClient,reportsClient}.ts` — 15+ instances of `.catch(() => null)` on `res.json()`. If server returns 200 with invalid JSON, caller gets `null` with no error.

### Cron routes — partial logging
Only 2 of 10 cron routes log results. The rest (charter-expiry, close-sales, dispatch-notifications, send-reminders, generate-ticket-pdfs, complete-trips) have no handler-level logging.

## P3 — Advisory

### Request-id correlation unused
`lib/observability/requestId.ts` exports `getOrCreateRequestId` + `loggerForRequest` but no handler uses them. Logs lack request-id for correlation.

### No distributed tracing
No OpenTelemetry, no span wrappers on external calls (MoMo API, eSMS API, storage).

### No metrics
No counters, histograms, or gauges. Missing: payment success rate, hold capacity utilization, booking latency, payout processing time.

### Well-logged areas (for reference)
- `lib/jobs/reconcilePayments.ts` — excellent: per-booking outcome logs, degraded-match flag
- `lib/notification/esmsClient.ts` — good: send/reject/error with structured context, PII-safe
- `lib/notification/dispatchNotifications.ts` — good: failed notifications with template/attempt count
- `lib/payment/processWebhook.ts` — good: signature, currency, amount mismatch logging

## Summary

| Category | Coverage | Severity |
|----------|----------|----------|
| Payment webhooks | 0/3 logged | **P1** |
| Payout/reconcile jobs | Partial (internal only, no entry/exit) | **P1** |
| Auto-complete/expire jobs | 0% logged | **P1** |
| Auth routes (all portals) | 0/12 logged | **P2** |
| Operator routes | 0/15+ logged | **P2** |
| Admin finance routes | DB audit only, no request log | **P2** |
| Account routes | 1/5 logged | **P2** |
| Cron routes | 2/10 logged | **P2** |
| Client API wrappers | 15+ silent catches | **P2** |
| Request-id correlation | Infrastructure unused | **P3** |
| Distributed tracing | Absent | **P3** |
| Metrics | Absent | **P3** |

## Recommended Priority

1. **Immediate:** Payment webhook entry/exit logs + payout job entry/exit
2. **Pre-launch:** Auth route logging (audit trail for login/logout/TOTP)
3. **Pre-launch:** Account deletion logging (compliance requirement)
4. **Sprint 1:** All cron job entry/exit summaries
5. **Sprint 2:** Operator route logging (trip lifecycle, booking operations)
6. **Roadmap:** Request-id correlation, OpenTelemetry, metrics
