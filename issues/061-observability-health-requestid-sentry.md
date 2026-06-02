---
depends-on: []
type: FEATURE
wave: 2
spec: [SYS15]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS15]

## What to build

Observability basics — **buy, don't build**: `/api/health`, request-id propagation, Sentry.
Today the structured logger + redaction exist (`lib/logger.ts`) but there is no health
endpoint, no request id, no Sentry.

- `/api/health` route — liveness + a cheap DB/Redis ping; returns 200/503. No auth, no-store.
- **Request-id propagation**: generate/accept `x-request-id` in `proxy.ts`, thread it into the
  logger context so every log line for a request is correlatable. (Middleware-safe; no DB.)
- **Sentry** init (errors) — server + client; wire to the existing logger; ensure the
  redaction list (otpProof, tokens, phone/PII) also applies to Sentry breadcrumbs/events so
  PII isn't shipped to a third party.
- Alert hooks on payment/payout/notification failures (point Sentry at those error paths) —
  dashboards/alerting config is Stage-1, just emit the events cleanly here.

## Acceptance criteria

- [ ] `/api/health` returns liveness + dependency ping; no auth; no-store.
- [ ] `x-request-id` generated/accepted in middleware + present in log lines for a request.
- [ ] Sentry initialized (server + client); errors reported.
- [ ] PII/secret redaction applies to Sentry events (no token/phone/otpProof leakage).
- [ ] Payment/payout/notification failures surface as Sentry events.

## Blocked by

- none

## User stories addressed

- [SYS15] logs + Sentry + health endpoint + request id (buy observability, don't rebuild).
