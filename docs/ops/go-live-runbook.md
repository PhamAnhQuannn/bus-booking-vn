# Go-Live Runbook — lenxevn.com (Phase 1)

**Status:** ACTIVE. Companion to `docs/qa/gl-006-phase1-launch-scope` (WHAT ships) — this is HOW to run the
transition. Rollback lives in `docs/ops/runbooks/rollback.md`; backup/DR in `docs/ops/backup-restore.md` +
`neon-pitr-setup.md`; secret rotation in `docs/ops/secrets-rotation.md`. Link, don't duplicate.

**Phase 1 scope reminder:** bank transfer (VietQR / SePay webhook) + cash only. NO customer auth (proxy 410
gate). SMS (eSMS) is STUBBED for launch (brandname deferred). MoMo / ZaloPay / VNPay are DEFERRED — ignore any
older runbook draft that lists them as go-live steps.

**Infra:** Vercel (project `bus-booking-vn`, region sin1) + Neon Postgres (PgBouncer pooler) + Upstash Redis +
Cloudflare R2. Deploys are git-push-to-`master` → Vercel auto-build.

---

## 1. Pre-flight checklist
Run before announcing launch. Tick each against live prod, not memory.

- [ ] **Env vars present** in Vercel Production — `vercel env ls production` shows all `env.ts` superRefine
      required names (JWT_*/REFRESH_TOKEN_SECRET/TOTP_ENCRYPTION_KEY/BANK_ENCRYPTION_KEY/CRON_SECRET/
      TICKET_SECRET/DATABASE_URL/DIRECT_URL/HOLD_SECRET) + the flags in §2.
- [ ] **Boot clean** — latest Production deploy is ● Ready; function logs show no Zod env validation throw.
- [ ] **DB** — `prisma migrate deploy` applied (no pending migration); `DATABASE_POOL_MAX` UNSET in prod so
      the code default (2) applies (outbox crons need ≥2 — see `lib/core/db/poolConfig.ts`).
- [ ] **Backup taken** — on-demand dump per `docs/ops/backup-routine.md`; Neon PITR window confirmed
      (`neon-pitr-setup.md`).
- [ ] **Observability live** — Sentry receiving events (`SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` set, CSP
      allows `*.sentry.io`); high-priority alert → email on. External uptime monitor on `GET /api/health`
      (Issue 118 — set up separately).
- [ ] **Payments** — `PAYMENTS_STUB=false`; `SEPAY_API_KEY` + `VIETQR_*` set; SePay webhook URL registered
      in the SePay dashboard pointing at `/api/payments/bank_transfer/webhook`.
- [ ] **Storage** — `STORAGE_STUB=false`; R2 creds set; a `generate-ticket-pdfs` run has written a
      `StoredObject` row (confirms putObject→R2 live).
- [ ] **Catalog** — real operator(s) onboarded, fake seed catalog purged.
- [ ] **Secrets rotated** — no repo-default secret live in prod (`STUB_PAYMENT_SECRET` etc. — see
      `secrets-rotation.md`).

## 2. Env transition table (stub → real)
Only the flags that flip for launch. Values are set in the Vercel dashboard (Production scope); a change
takes effect on the **next deploy** — `NEXT_PUBLIC_*` are build-time and require a **rebuild**, not a restart.

| Var | Dev / stub | Production | Notes |
|-----|-----------|-----------|-------|
| `PAYMENTS_STUB` | `true` | `false` | Enables the real SePay/VietQR path |
| `STORAGE_STUB` | `true` | `false` | Enables Cloudflare R2 (ticket PDFs, KYB docs) |
| `NOTIFY_STUB` | `true` | `true` (Phase 1) | SMS stays stubbed — eSMS brandname deferred |
| `EMAIL_PROVIDER` | `stub` | `resend` | Real email (booking/ticket) via Resend |
| `REDIS_PROVIDER` | `memory` | `upstash` | Distributed rate-limit backend (required in prod) |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | unset | real DSN | Error monitoring; rebuild to bake the client DSN |
| `DATABASE_POOL_MAX` | (CI sets 5) | UNSET → default 2 | Do NOT set to 1 (outbox crons deadlock) |
| `VNPAY_ENABLED` | `false` | `false` | Deferred Phase 2 |

Never log or paste secret VALUES. Read a value only via a scoped `vercel env pull` → read → shred (HG-D).

## 3. Deploy sequence
1. Ensure all Production env vars (§2) are set in Vercel.
2. Merge the release commit to `master` → Vercel auto-builds. (For a pure env change with no code, trigger a
   redeploy so the new env is picked up.)
3. Wait for ● Ready; open function logs — confirm **no Zod env validation error** at boot.
4. Smoke (read-only): `GET /api/health` 200; homepage + a trip search 200; security headers present
   (`content-security-policy` includes `*.sentry.io`). Optionally `pnpm smoke:prod` (read-only profile).
5. Payments live-path check: from the SePay dashboard send a small real/test transfer against a VietQR memo
   → confirm the webhook returns its success ack and the booking flips to `paid` (or that
   `reconcile-payments` picks it up).
6. Storage check: after a paid booking, confirm the `generate-ticket-pdfs` cron produced a `StoredObject`
   `ticket_pdf` row and the ticket route serves the PDF.
7. Watch for **1 hour**: Sentry Issues (no new High errors) + `JobRunLog` (all crons `success`/
   `skipped_locked`, zero `failed`, no cadence gaps). `JobRunLog` is the authoritative cron surface —
   `vercel logs` live-tail is sampled and can miss failures.

## 4. Post-deploy verification (the observation surfaces)
- **Crons:** query `JobRunLog` (last ~30 min) grouped by `jobName, status`. Expect every job
  `success`/`skipped_locked`, **zero `failed`**, and row counts matching cron cadence (no silent gaps — a
  cold-start failure can leave NO row because the failure path also needs a connection). Reach the prod DB
  read-only via the pg16 container: `docker exec -e BBVN_PROD_DATABASE_URL … psql "$BBVN_PROD_DATABASE_URL"`
  (URL from your vault, never on argv/chat — same pattern as `backup-ondemand.sh`).
- **Errors:** Sentry Issues, `environment:production`. High-priority → email alert.
- **Uptime:** external monitor on `GET /api/health`.

## 5. Rollback
See `docs/ops/runbooks/rollback.md` (primary: Vercel "Promote previous deployment", < 5 min, no rebuild).
Triggers: `/api/health` non-200 for 2 min; 5xx > 5% in first 10 min; a money-path cron `JobRunLog.failed`
attributable to the deploy; data-integrity alarm. Migrations are FORWARD-ONLY (ADR-017) — promote-previous
restores CODE only; fix a bad schema with a forward migration, never hand-edit a committed one.

Flag-only revert (disable the real payment/storage path without a code rollback): set `PAYMENTS_STUB=true`
(and/or `STORAGE_STUB=true`) in Vercel → redeploy. Caveat: in-flight SePay webhooks then fail signature
verification (stub secret ≠ real) and are left for `reconcile-payments` — manual review.

## 6. Known operational notes
- **Cron DB transactions** (PR #417/#418/#419): client-level `maxWait`/`timeout` (15s) absorb Neon
  cold-start; pool default is **2** because outbox crons (`notify-dispatch`, `ticket-pdf`) open an inner
  transaction under `withAdvisoryLock` and self-deadlock at pool=1. Do not revert these.
- **Data restore** (corruption only, not a bad deploy): Neon PITR per `backup-restore.md`, RTO ~1h.
- **Break-glass admin access:** `docs/ops/admin-break-glass.md`.
- **Breach handling:** `docs/ops/runbooks/breach-notification.md`.
