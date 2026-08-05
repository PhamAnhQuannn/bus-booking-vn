# Prod Env Verify — 2026-08-04 (Phase 0 / C2)

Read-only verification of Vercel production env + code invariants. No secret VALUES stored here.
Method: `vercel link` → `vercel env ls production` (names) + one scoped `vercel env pull` for the
`PAYMENTS_STUB` flag (read → shredded same step per HG-D/E5).

## Vercel project
- Team `phamanhquannns-projects` · project `bus-booking-vn` · Node 24.x · prod domain **lenxevn.com**.
- Deployments last 5h all ● Ready (Production + Preview) — the 7 PR merges earlier today.

## P0.2 — Production env var names present
All 32 expected names present. Required-in-prod (env.ts superRefine) — 10/10 present:
`JWT_SECRET, JWT_OPERATOR_SECRET, JWT_ADMIN_SECRET, REFRESH_TOKEN_SECRET, TOTP_ENCRYPTION_KEY,
BANK_ENCRYPTION_KEY, CRON_SECRET, TICKET_SECRET, DATABASE_URL, DIRECT_URL` — all ✅.
Also present: HOLD_SECRET, SEPAY_API_KEY, VIETQR_* (5), UPSTASH_* (2), REDIS_PROVIDER, STORAGE_STUB(_SECRET),
STUB_PAYMENT_SECRET, EMAIL_PROVIDER/FROM, RESEND_API_KEY, NOTIFY_STUB, EINVOICE_ENABLED, VNPAY_ENABLED,
HOLD_SWEEPER_MODE, NEXT_PUBLIC_SITE_URL.

## P0.3 — Prod vs Preview parity
Preview scope has its OWN `DATABASE_URL` + `CRON_SECRET` entries (separate encrypted values per scope).
Value-level isolation NOT confirmed (would require comparing secret values). **N/A for this work** — smoke
target decided = LOCAL (E4), so preview isolation is not relied upon.

## P0.4 — Flag values (read then shredded)
- `PAYMENTS_STUB="false"` ✅ — real payment path live (SePay/VietQR), not stub.
- `REDIS_PROVIDER="upstash"` ✅ — real distributed rate-limit backend (not per-instance memory).
- 🟡 `STORAGE_STUB="true"` — object storage runs the local stub URL-signer in PROD; real S3/R2 not active.
  Acceptable if no live file-upload/PDF-proof feature is in Phase-1 use; flag for Phase-2 (real S3 adapter exists in code, just not enabled).

## P0.5 — Security headers
`grep -c "key: '" next.config.ts` → **6** ✅ (6 OWASP headers configured).

## P0.6 — Cron contract drift
`grep -rn "job:\|durationMs:" app/api/cron/` → **0**. Shipped code contract (`lib/jobs/runJob.ts` result +
`JobRunLog` row) = `{status, rowsAffected}`. HTTP responses are per-route and NOT a uniform envelope
(e.g. `sweep-holds` returns `{mode, expiredCount, status}`). Spec DS-006 §2.3 + GL-005 claim
`{job, status, rowsAffected, durationMs}` — **stale**. Decision E2 = fix spec to the persisted
`{status, rowsAffected}` contract + note HTTP responses are route-specific (task #10).

## P0.7 — Ledger immutability trigger
Present in `prisma/migrations/20260602020000_ledger_entry/migration.sql`: function `ledger_entry_immutable`
+ triggers `ledger_entry_no_update` + `ledger_entry_no_delete` (all 3 names present). ✅

## P0.8 — PayoutAccount AES
`lib/security/bankCrypto.ts` uses `createCipheriv` (AES-256-GCM) ✅. Coverage: 8 `*.int.test.ts` exercise
payout/ledger flows that read the encrypted `PayoutAccount.accountNumber` from a real DB
(processPayouts, retryPayout, chargeback, withdrawal). NOT a coverage gap (detailer's "0 int-test" was wrong);
a dedicated bankCrypto DB round-trip test is optional, non-blocking.

## Gate (P0.10)
**P1 RED FLAGS: 0** — BANK_ENCRYPTION_KEY present + PAYMENTS_STUB=false. Phase 0 PASS.
Advisory 🟡: STORAGE_STUB=true in prod (Phase-2 concern). Cron-spec drift → task #10 (doc-only fix).
