# Bus Booking — Issue Execution Order (Source of Truth for Sequencing)

> Companion to `rebuild-plan.md` (WHAT to build) and `rebuild-mismatches.md` (code-vs-spec gaps).
> This file is the **ORDER**: what to build first, what waits, and the hard rule that **real
> external-service keys are the very last step**.
>
> **Ordering law** = `wave` ascending, then `depends-on` within a wave. Source of truth is each
> issue's frontmatter (`wave`, `depends-on`); this doc renders that into a readable sequence.
> `/autopilot` follows the same frontmatter, so this doc and autopilot agree by construction.
>
> **Legend:** ✅ DONE · 🔒 security / fraud / money-integrity / privacy · ⏭ stub-now-real-later.
>
> **THE RULE:** Everything runs on `PAYMENTS_STUB` + `NOTIFY_STUB` until **Wave 8.5** (security &
> fraud sign-off) passes. **No real payment/SMS/PSP key is wired before Wave 9 (issue 094)**, and
> 094 is hard-blocked by the Wave 8.5 gate (101). Build → test → harden → audit → THEN real money.

---

## Phase DONE — Foundational build (001–021) ✅

Search → hold → booking → payments (stub/sandbox) → customer auth/account → operator
console/fleet/trips/manifest → manual booking → revenue/payout → staff → cron → admin CLI.

- 001 bootstrap-trip-search ✅ · 002 hold-buyer-info-countdown ✅ · 003 cash-booking-confirmation ✅
- 004 momo-gateway ✅ · 005 zalopay-gateway ✅⏭ · 006 card-gateway-vn-psp ✅⏭ *(005/006 stub adapters — real keys deferred to 094)*
- 007 customer-otp-auth ✅🔒 · 008 customer-account-mgmt ✅ · 009 customer-bookings-history-pdf ✅
- 010 operator-auth-force-pwd-change ✅ · 011 operator-fleet ✅ · 012 operator-routes-pickup-points ✅
- 013 operator-trips ✅ · 014 operator-booking-queue-manifest ✅ · 015 operator-manual-booking ✅
- 016 operator-revenue-csv-payout ✅ · 017 operator-staff-mgmt ✅ · 018 operator-staff-client ✅
- 019 cron-jobs ✅ · 020 platform-admin-cli ✅ · 021 fix-auth-open-redirect ✅🔒

## Phase A — Housekeeping fixes (022–031, wave-less) — run early / parallel, low risk

- 022 fix-resend-otp-test · 023 fix-auth-client-session-coupling · 024 fix-api-op-activity-test
- 025 fix-dashboard-prisma-direct · 026 fix-staff-rsc-role-gate 🔒 · 027 fix-getactivityfeed-test
- 028 fix-statuslabels-type-reversal · 029 establish-adr-practice · 030 booking-prefill-logged-in
- 031 attach-hardening-authed-booking 🔒 ✅

## Wave 0 — Money-integrity P1 🔒

- 032 fix-payment-amount-verify ✅🔒 · 033 canonical-event-providertxnid-currency 🔒
- 034 monotonic-transition-guard 🔒 · 035 lock-price-after-paid-seat 🔒
- 036 oversell-for-update-at-sell 🔒 · 037 settlement-delay-t1

## Wave 0.5 — Scaffold + cleanup + edge hardening

- **038 scaffold-lib-core-tenant-helper-lint** *(keystone — blocks 044/047/054/059/060/091)*
- 039 delete-cash-creation-paths-phase-a · 040 delete-paired-return-block-seats · 041 remove-orphan-charts
- 042 add-booking-buyer-email · 043 harden-generate-trips-cron-lock
- 096 edge-rate-limit-middleware 🔒 · 098 concurrent-hold-cap 🔒

## Wave 1 — Core domains (Place · approval · ledger · admin-auth)

- 044 place-entity *(→038)*
- 045 operator-approval-state-machine → 046 approval-gate-search-booking 🔒
- 047 ledger-entry-model-immutability 🔒 *(→038)* → 048 feeconfig-model → 049 wire-booking-credit-platform-fee → 050 balance-payout-state-machine *(+037)*
- 051 refund-out-rail 🔒 · 052 chargeback-payout-reversal 🔒 · 053 on-demand-withdraw *(all →050)*
- 054 admin-auth-core 🔒 *(→038)* → 055 admin-totp-step-up 🔒 → 056 admin-middleware-segment 🔒 · 057 admin-bootstrap-totp-recovery 🔒
- 097 customer-search-cursor-pagination · 100 hold-lapse-refund 🔒 *(→051,036)*

## Wave 2 — Platform infra

- 058 notification-dispatcher-stub *(→043)* · 059 storage-s3-client *(→038)* · 060 db-feature-flag-store *(→038)*
- 061 observability-health-requestid-sentry · 095 payment-recon-sweeper 🔒 *(→034,058)*

## Wave 3 — Admin console + audit

- 062 admin-audit-immutability 🔒 · 063 analytics-admin-consumer
- 064 admin-overview · 065 admin-approvals · 066 admin-users · 067 admin-operators-fee-override
- 068 admin-finance-stepup 🔒 · 069 admin-moderation · 070 admin-system *(all admin UI →056)*

## Wave 4 — Ticketing / QR

- 071 qr-signed-token 🔒 → 072 public-boarding-verify-page · 073 atomic-checkin-scan-noshow 🔒
- 074 async-pdf-s3 *(→071,059,058,042)* → 075 regenerate-pdf-on-reassign

## Wave 5 — Operator onboarding / KYB

- 076 operator-registration → 077 kyb-doc-submit → 078 payout-account-ownership-verify 🔒
- 079 operator-status-page-decision-emails · 080 operator-console-restructure

## Wave 6 — Charter marketplace

- 081 charter-request-model → 082 charter-customer-flow · 083 charter-operator-assigned → 084 charter-public-pool-claim
- 085 charter-admin-dispatch → 086 charter-expiry-sweeper

## Wave 7 — Phase-B cleanup + compliance

- 087 split-paid-operator-notified 🔒 → 088 phase-b-drop-cash-enums-columns
- 089 checkout-consent-capture 🔒 · 090 retention-policy-job 🔒

## Wave 8 — Code organization

- 091 folder-consolidation → 092 domain-barrels-boundary-lint · 093 customer-route-group
- 099 db-pooler *(deferrable — optional at current scale)*

## Wave 8.5 — 🔒 SECURITY & FRAUD GATE

- **101 pre-go-live-security-fraud-gate** — depends on EVERY 🔒 issue above. Runs threat-model /
  security-review-deep / pen-test / fraud-scenario verification on the fully-stubbed product;
  produces `docs/qa/pre-go-live-security-signoff.md` with GO/NO-GO. **Zero open P1 → proceed.**

## Wave 9 — GO-LIVE (real money) ⏭→real

- **094 go-live-real-payment-keys** — depends-on 101 (+ 032,033,034,051,052,058,074,068,080,095,100).
  Wire **real** MoMo/ZaloPay/card + eSMS keys, real-money E2E per rail, recon sweeper clears stuck
  pendings, `/prod-smoke`. **This is the final step. Nothing real ships before the Wave 8.5 gate.**

---

## Critical-path summary

`038` (scaffold) unblocks the most. The longest money chain is
`047→048→049→050→051→100` and `050→053`; the admin chain is `054→055→056→{064–070}`. Charters
(wave 6) and code-org (wave 8) are independent tails. The terminal funnel is **everything 🔒 → 101
gate → 094 real keys**. Real external credentials never precede the gate.
