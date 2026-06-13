---
depends-on: [094-go-live-real-payment-keys, 114-db-connection-pooling, 115-complete-env-var-validation, 116-rate-limit-upstash-requirement, 117-backup-restore-runbook, 118-external-monitoring-alerting]
type: DOCS
wave: 9
spec: [S12, SYS09]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S12] / [SYS09] — operational readiness gap
identified by grill-me self-assessment. Companion to Issue 094 (go-live gate).

## What to build

Issue 094 defines WHAT must be true before go-live. This issue documents HOW to execute the
transition — the exact deploy sequence, env var changes, smoke tests, and rollback procedure.

### Deliverables

**`docs/ops/go-live-runbook.md`** covering:

#### Pre-flight checklist
- [ ] All 22 BLOCKERs from launch-checklist resolved
- [ ] DPAs signed with MoMo, eSMS, Upstash, Vercel (B-17)
- [ ] `tempPasswordPlain` column dropped (B-01 / Issue 113)
- [ ] TOTP bypass removed (B-21)
- [ ] Real email provider wired (B-18)
- [ ] Real refund API wired (B-22)
- [ ] Backup taken (Issue 117)
- [ ] External monitoring live (Issue 118)

#### Env var transition table
| Var | Dev value | Production value | Notes |
|-----|-----------|-----------------|-------|
| `PAYMENTS_STUB` | `true` | `false` | Enables real MoMo/ZaloPay |
| `NOTIFY_STUB` | `true` | `false` | Enables real eSMS |
| `ESMS_SANDBOX` | `true` | `false` | Real SMS delivery |
| `MOMO_PARTNER_CODE` | sandbox default | real merchant code | |
| `MOMO_ACCESS_KEY` | sandbox default | real key | |
| `MOMO_SECRET_KEY` | sandbox default | real key | NEVER log |
| `CRON_SECRET` | (any) | 32+ char random | |
| `JWT_SECRET` | (any) | 64+ char random | |
| `SENTRY_DSN` | (unset) | real DSN | |
| `UPSTASH_REDIS_REST_URL` | (unset) | real URL | Required in prod |
| `UPSTASH_REDIS_REST_TOKEN` | (unset) | real token | Required in prod |

#### Deploy sequence
1. Set all production env vars in Vercel dashboard
2. Deploy from `master` (or release branch)
3. Verify startup: check Vercel function logs for Zod validation pass
4. Run smoke tests: health check, search, hold→book flow, operator login
5. Send test MoMo payment → verify webhook → verify booking confirmed
6. Send test eSMS → verify SMS delivery
7. Monitor Sentry + uptime for 1 hour

#### Rollback procedure
1. Set `PAYMENTS_STUB=true`, `NOTIFY_STUB=true` in Vercel dashboard
2. Redeploy (or use Vercel instant rollback)
3. **Warning**: in-flight MoMo IPNs will fail signature verification (stub secret ≠ real secret).
   These bookings will be picked up by `reconcile-payments` cron on next tick — manual review
   needed for any `awaiting_payment` rows created in the real-payment window.
4. Notify operators of temporary service interruption

## Acceptance criteria

- [ ] `docs/ops/go-live-runbook.md` exists with all 4 sections.
- [ ] Env var transition table is complete and accurate.
- [ ] Rollback procedure addresses in-flight IPN handling.
- [ ] Pre-flight checklist cross-references all BLOCKER issue numbers.

## Blocked by

- Issue 094 (defines go-live requirements)
- Issues 114-118 (infrastructure prerequisites)

## Files

- New: `docs/ops/go-live-runbook.md`

## Severity

LAUNCH — no documented deploy sequence risks misconfiguration during the highest-stakes deploy.
