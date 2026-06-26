# BBVN Work Inventory — Product Scope

**Project:** Bus Booking Vietnam (BBVN)
**Period:** 2026-05-17 → 2026-06-25 (39 days)
**Total commits:** 305+
**Total PRs merged:** 27+
**Rebuild issues completed:** 67/70

---

<!-- PART 1: PRODUCT FOUNDATION -->

## 1. Bootstrap & Infrastructure (2026-05-17)

| # | What | Commits |
|---|------|---------|
| 1 | Next.js 16 + TypeScript + Tailwind v4 scaffold | `7890da3` |
| 2 | Security baseline — gitleaks, prettier, husky pre-commit | `a90ff9d` |
| 3 | Runtime deps + shadcn/ui init | `02aedea` |
| 4 | Vitest + Playwright test configs | `d6b07cf` |
| 5 | Prisma schema — Operator, Bus, Route, Trip + indices | `c0330ab` |
| 6 | Docker compose dev (pg:5432, shadow:5434, redis:6379) | `6abaa9d` |
| 7 | Init migration + pg_trgm + unaccent + GIN index | `8aec560` |
| 8 | Prisma client singleton | `2152eb9` |
| 9 | Seed data — 2 operators, 5 buses, 3 routes, 10 trips | `2ea6be3` |
| 10 | Rate limiter, Pino logger, withErrorHandler | `4426bc0`..`dee3fa0` |
| 11 | GitHub Actions CI workflow | `5e74902` |
| 12 | Fresh-boot smoke test script | `5c20625` |

## 2. Core Search (Issue 001)

| # | What | Commits |
|---|------|---------|
| 1 | Zod search params schema + Prisma select whitelist | `e1dbcb2`..`dee3fa0` |
| 2 | GET /api/trips/search route handler | `28bd705` |
| 3 | Integration tests for search | `bf39b7b` |
| 4 | Zustand searchStore + localStorage persistence | `f6d0655` |
| 5 | SearchForm + SearchFormWrapper + search RSC page | `c50eda1` |
| 6 | Playwright e2e search spec | `18e2b47` |
| 7 | Maintenance-window overlap fix | `fc5953c` |
| 8 | PII placeholder masking in seed | `459099b` |

## 3. Hold System (Issue 002)

| # | What | Commits |
|---|------|---------|
| 1 | Hold model + migration | `10d2581` |
| 2 | Config, logger, validation, state, holdRepo, holdsClient | `b5520db` |
| 3 | HMAC-signed bb_hold cookie | `338158c` |
| 4 | Active holds → availability + BookButton | `d82af24` |
| 5 | Race-safe POST /api/holds + GET /api/holds/[id] | `e997d32` |
| 6 | Customer booking form + review page + HoldTimer/HoldExpiryModal | `72739ac` |
| 7 | Sweep-holds cron | `a464bf8` |
| 8 | E2E hold flow + 20x concurrent race spec | `cecd245` |

## 4. Booking Orchestration (Issue 003)

> Originally built as the cash booking flow. The cash payment method was later removed (see Section 25, Issue 088), but the booking orchestration layer — initiateBooking, bookingRef, capacity guard, confirmation page — remains as the foundation for all payment methods.

| # | What | Commits |
|---|------|---------|
| 1 | Booking + NotificationLog migration | `be60139` |
| 2 | bookingRef + confirmationToken generators, eSMS stub | `8639453` |
| 3 | Race-safe cash booking repo + capacity-correctness | `8b914c2` |
| 4 | initiateBooking orchestrator | `26aaf7f` |
| 5 | POST /api/bookings/initiate cash path | `f7632b5` |
| 6 | Confirmation page + review submit wiring | `0e6e241` |
| 7 | E2E cash booking happy path | `2956778` |

## 5. Bank Transfer Payment (PR #148)

> P0 launch payment method. Uses SePay webhook receiver + VietQR code display. MoMo and VNPay adapters exist in the codebase but are deferred to post-launch (see Deferred Features).

| # | What | Commit |
|---|------|--------|
| 1 | SePay/VietQR bank transfer adapter (lib/payment/adapters/bankTransfer.ts) | `010c3d5` |
| 2 | QR code display page + BankTransferClient poller | `010c3d5` |
| 3 | Status polling endpoint (GET /api/bookings/status) | `010c3d5` |
| 4 | SePay IPN webhook receiver (POST /api/payments/bank_transfer/webhook) | `010c3d5` |
| 5 | Env config (SEPAY_API_KEY, VIETQR_* vars) + Zod validation | `010c3d5` |
| 6 | Payment method enum extended across all touch points | `010c3d5` |
| 7 | CSRF exemption for webhook | `010c3d5` |

## 6. Customer Auth (Issue 007)

| # | What | Commits |
|---|------|---------|
| 1 | Customer + OtpAttempt + Session models | `c18741a` |
| 2 | Logger PII redact + eSMS otpCode template + Upstash ratelimit | `7d8325d` |
| 3 | Customer OTP+JWT auth (send/verify/register/login/logout/refresh) | `e97a5ba` |
| 4 | CSRF double-submit middleware + X-CSRF-Token threading | `aeb56b8` |
| 5 | E2E auth OTP roundtrip + primeCsrf helper | `4a6cd08` |
| 6 | jose dep + auth env keys + test:all script | `a292227` |

## 7. Operator Auth (Issue 010)

| # | What | Commits |
|---|------|---------|
| 1 | OperatorUser schema + OtpAttempt scope + indices | `b82cfb2` |
| 2 | Logger redaction + op-scoped ratelimit keys | `ca2852c` |
| 3 | Operator JWT with requiresPasswordChange claim | `9d3b1fa` |
| 4 | Operator auth routes — password change/reset/logout/refresh | `f8786e2` |
| 5 | /op/login, /op/first-login, /op/profile pages | `a322b7a` |
| 6 | /op/* Edge middleware gate — JWT claim redirect | `f763045` |
| 7 | E2E operator first-login, forgot-password, profile | `a52aa65` |

---

<!-- PART 2: OPERATOR PLATFORM -->

## 8. Operator Fleet Management (Issue 011)

| # | What | Commits |
|---|------|---------|
| 1 | Bus + BusMaintenance schema + composite plate uniqueness | `ae6767a` |
| 2 | Bus validation schemas + select rename | `6812264` |
| 3 | operatorId JWT claim Edge-to-handler | `eed111c` |
| 4 | Consume Bus.licensePlate rename | `86f21be` |
| 5 | Operator fleet management (CRUD + capacity guard + TOCTOU lock) | `91c94a6` |
| 6 | E2E operator fleet spec | `91c94a6` |

## 9. Operator Routes (Issue 012)

| # | What | Commits |
|---|------|---------|
| 1 | Route operator scoping + PickupPoint model | `5a98c8b` |
| 2 | Operator route + pickup point lib | `99d5b93` |
| 3 | Operator route + pickup point endpoints | `b9cc28e` |
| 4 | /op/routes + pickup points UI | `65cffb6` |
| 5 | Unit + e2e tests | `8aefeb3` |

## 10. Trip Lifecycle (Issue 013)

| # | What | Commits |
|---|------|---------|
| 1 | Trip lifecycle schema + recurring templates | `e05b70b` |
| 2 | Trip validation schemas + DTO + client | `c49a42b` |
| 3 | Trip lifecycle service layer + unit tests | `4bdceec` |
| 4 | /api/op/trips lifecycle routes (CRUD + cancel + depart + complete) | `d10a967` |
| 5 | /api/op/trip-templates CRUD | `93de53c` |
| 6 | /api/cron/generate-trips recurring generator | `7861871` |
| 7 | Trip list + detail pages | `7c3ae6d` |
| 8 | Recurring template management page | `062f876` |
| 9 | E2E operator trips + cron recurring | `4526809` |

## 11. Operator Booking Queue (Issues 014-015)

| # | What | Commits |
|---|------|---------|
| 1 | Booking contact/pickup, trip lifecycle, notificationLog.scheduledFor | `bc7fd07` |
| 2 | Operator depart/complete lifecycle + upcoming list | `dc46e40` |
| 3 | Operator booking queue + call-outcome/cash/escalation | `98e0bfa` |
| 4 | Manual walk-in/phone-in booking with advisory-lock | `eb220d4` |
| 5 | Boarding manifest with manual + cash flags | `bc37035` |
| 6 | Dashboard, manifest, upcoming pages | `446a4e1` |
| 7 | E2E operator booking queue + manual booking | `9f56f6f` |

## 12. Revenue & Payouts (Issue 016)

| # | What | Commits |
|---|------|---------|
| 1 | Payout model + operator role for revenue | `6cf981b` |
| 2 | Operator role claim in JWT | `0cd8b51` |
| 3 | BigInt calcPayout, revenue/payout reports, CSV builders | `2f0bfb1` |
| 4 | Revenue/payout report + CSV + retry routes | `54d8284` |
| 5 | Revenue + payouts report pages + e2e | `fe31100` |

## 13. Staff Management (Issues 017-018)

| # | What | Commits |
|---|------|---------|
| 1 | OperatorUser.assignedTripId + NotificationLog.bookingId nullable | `d93277d` |
| 2 | Staff provision/rename/disable/assign-service | `d07c0bf` |
| 3 | Staff-scope guard + staff dashboard loader | `d114b87` |
| 4 | Staff single-trip dashboard + e2e | `33cee29` |

## 14. Background Jobs (Issue 019)

| # | What | Commits |
|---|------|---------|
| 1 | JobRunLog table + Booking.reminderSentAt | `bf5c76c` |
| 2 | completeTripCore extraction, Payout row on completion | `7a38546` |
| 3 | settlePayout stub with forced-fail injection | `94a68a0` |
| 4 | Advisory-locked job runner + 5 idempotent cron cores + int tests | `53be8f2` |
| 5 | CRON_SECRET-guarded routes for 5 background jobs | `c1997cf` |

---

<!-- PART 3: PLATFORM ADMINISTRATION -->

## 15. Platform Admin CLI (Issue 020)

| # | What | Commits |
|---|------|---------|
| 1 | AdminAuditLog table + drop OperatorUser_phones_differ check | `c81422e` |
| 2 | operatorAdminTempPassword SMS template | `bfcd13f` |
| 3 | Platform-admin CLI — operator provisioning, disable, password reset, list | `26261dc` |

## 16. Customer Account (Issues 005, 008)

| # | What | Commits |
|---|------|---------|
| 1 | Booking.buyerPhone index for guest auto-attach | `4a0ad6f` |
| 2 | attachGuestBookingByPhone primitive | `13a01f2` |
| 3 | requireCustomerAuth HOF + register-time guest backfill | `693a8ce` |
| 4 | Customer history/detail + PDF ticket + guest attach | `b9a1539` |
| 5 | Bookings history + detail pages with PDF download | `26812b4` |
| 6 | Nullable Customer.phone + soft-delete (deletedAt/anonymizedAt) | `2158a25` |
| 7 | Forgot/reset-password OTP flow + otpProof JWT purposes | `3fb807e` |
| 8 | Account settings UI + change-password/phone/name + soft-delete | `6886328` |
| 9 | Exclude soft-deleted customers on guest-booking attach | `508a666` |

> Item from original Phase 15: "MoMo payment confirm guest booking attach (`48ed72a`)" — deferred with MoMo payment. Will be re-wired for bank transfer when needed.

---

<!-- PART 4: REBUILD & HARDENING -->

## 17. Rebuild Wave 0 — Payment Hardening (Issues 032-037)

| # | What | Commits |
|---|------|---------|
| 1 | Issue 032: Amount verify | `8089cb0` |
| 2 | Issue 033: Canonical payment event | `7edc0b2`+`d262e89` |
| 3 | Issue 034: Monotonic transition guard | `2cabe2c` |
| 4 | Issue 035: (hardening) | `26de4ad` |
| 5 | Issue 036: FOR-UPDATE concurrent sell guard | `071992b` |
| 6 | Issue 037: (hardening) | `07a0d83` |

## 18. Rebuild Wave 0.5 — Scaffold & Cleanup (Issues 038-043)

| # | What | Commits |
|---|------|---------|
| 1 | Issue 038: lib/core scaffold + tenant-scope door + boundary lint | `1e639ab` |
| 2 | Issue 039: Delete cash/manual creation paths Phase A | `c3fbaf5` |
| 3 | Issue 040: Delete paired-return + block-seats | `7985936` |
| 4 | Issue 041: Remove orphan charts + recharts dep | `1af808d` |
| 5 | Issue 042: Hold.customerEmail + Booking.buyerEmail | `508bc2b`+`f12939c` |
| 6 | Issue 043: Generate-trips cron under runJob + advisory lock | `eeeb77b` |

## 19. Rebuild Wave 1 — Foundation (Issues 044-057)

| # | What | Commits |
|---|------|---------|
| 1 | Issue 044: Place entity + Route FKs + backfill | `44fed07`+`42fbc3c` |
| 2 | Issue 045: OperatorStatus 5-state machine + capability helper | `2392102`+`43a6e0a` |
| 3 | Issue 046: Approval gate — APPROVED-only search/trip-detail + initiate re-check | `9e488da` |
| 4 | Issue 047: Append-only LedgerEntry 8-type + immutability trigger + BigInt repo | `f58ce58`+`f039873` |
| 5 | Issue 048: FeeConfig effective-dated ppm + getEffectiveFeeRate | `774f0a4`+`10aafa1` |
| 6 | Issue 049: Wire booking_credit + platform_fee at booking-paid, half-even, idempotent | `aafa6c2` |
| 7 | Issue 050: PayoutStatus rename + balance SUM 3-state + payout_debit | `72d6f5f`+`d0d5d74` |
| 8 | Issue 051: Refund-out rail — refund_out + refund_debit | `2192598` |
| 9 | Issue 052: recordChargeback + payout_reversal + bad-debt backstop | `df8b1ab` |
| 10 | Issue 053: On-demand requestWithdrawal FOR-UPDATE + Payout.tripId nullable | `b468c94`+`b92ae95` |
| 11 | Issue 054: Admin auth core — AdminUser/AdminSession/AdminRole, JWT, cookies, routes | `1ab1425`+`e494a1d` |
| 12 | Issue 055: Admin TOTP RFC6238 — enroll/confirm/verify/step-up + lockout | `2bd0a31` |
| 13 | Issue 056: /admin segment + proxy.ts Layer-1.5 Edge guard | `403731c` |
| 14 | Issue 057: bootstrapSuperAdmin + inviteAdmin + resetAdminTotp + break-glass CLI | `f135c30` |

## 20. Rebuild Wave 2 — Enablers (Issues 058-061)

| # | What | Commits |
|---|------|---------|
| 1 | Issue 058: Notification dispatcher cron SKIP-LOCKED + backoff, NOTIFY_STUB | `6c76163`+`c573d35` |
| 2 | Issue 059: lib/storage signed PUT/GET HMAC stub, StoredObject, STORAGE_STUB | `29e2674`+`7b36eee` |
| 3 | Issue 060: FeatureFlag store + getFlag env-override→cachedDB→default | `234060d`+`806bdcb` |
| 4 | Issue 061: /api/health DB-ping, x-request-id, Sentry abstraction | `49e9b52` |

## 21. Rebuild Wave 3 — Admin UI (Issues 062-070)

| # | What | Commits |
|---|------|---------|
| 1 | Issue 062: AdminAuditLog immutability trigger | — |
| 2 | Issue 063: getAdminMetrics GMV/revenue/funnel | — |
| 3 | Issue 064: Admin console shell 7-tab nav + Overview + requireAdminPage | — |
| 4 | Issue 065: Approvals — extended 045 transition w/ actor + audit | — |
| 5 | Issue 066: Users — Customer.suspendedAt + suspend/reinstate + searchUsers cursor | — |
| 6 | Issue 067: Operators — detail/balance + suspend + per-operator fee-override | — |
| 7 | Issue 068: Finance — payout queue/refund-out/chargeback/adjustment/global-fee | — |
| 8 | Issue 069: Moderation — Trip/Route.moderatedAt + ContentReport + search exclusion | — |
| 9 | Issue 070: System — flag toggles + admin invite/revoke/role + audit CSV export | — |

## 22. Rebuild Wave 4 — Ticketing (Issues 071-075)

| # | What | Commits |
|---|------|---------|
| 1 | Issue 071: lib/ticketing signed-token + pure-JS QR encoder | — |
| 2 | Issue 072: Public /verify/[token] live source-of-truth page | — |
| 3 | Issue 073: Booking.checkedInAt/noShowAt + atomic single-use check-in + no-show | — |
| 4 | Issue 074: Async PDF generate-once cron → QR-in-PDF + signed-URL ticket route | — |
| 5 | Issue 075: Reassign invalidates + regenerates PDF + new-plate notify | — |

## 23. Rebuild Wave 5 — KYB Onboarding (Issues 076-080)

| # | What | Commits |
|---|------|---------|
| 1 | Issue 076: Operator.applicationRef + self-serve registerOperator + pending pages | — |
| 2 | Issue 077: KybDocument + signed-PUT upload + admin doc-view | — |
| 3 | Issue 078: PayoutAccount + name-match verify + edit-resets-verify | — |
| 4 | Issue 079: Operator status page + decision emails + self-resubmit | — |
| 5 | Issue 080: Console 6-nav + approval banner + /op/money + bank-account settings | — |

## 24. Rebuild Wave 6 — Charter (Issues 081-087)

| # | What | Commits |
|---|------|---------|
| 1 | Issues 081-087: Charter booking flow (full wave) | — |

## 25. Rebuild Wave 7 — Cash Payment Removal (Issue 088)

> Removed the cash payment method entirely. The booking orchestration layer (Section 4) was preserved; only PaymentMethod 'cash', BookingStatus 'pending_cash_payment', cashCollectedAt column, and cash-flag UI across ~40 files were dropped.

| # | What | Commits |
|---|------|---------|
| 1 | Issue 088: Drop cash residue — PaymentMethod 'cash', BookingStatus 'pending_cash_payment', cashCollectedAt, cashFlag UI (~40 files) | — |

## 26. Rebuild Wave 8 — Code Organization (Issues 091-093)

| # | What | Commits |
|---|------|---------|
| 1 | Issue 091: Folder consolidation — 7 moves, ~450 import sites | — |
| 2 | Issue 092: Domain barrels — 22→31 barrels, rule inversions fixed | — |
| 3 | Issue 092b: Barrel enforcement sweep — ~968 reach-in→barrel conversions, boundaries + no-cycle @ error, tenant-scope wired | 14 commits |
| 4 | Issue 093: Customer route-group — `app/(customer)` move, URLs unchanged | `b9ab47f` |

## 27. Rebuild Wave 9 — Hardening (Issues 089-090, 095-100)

| # | What | Commits |
|---|------|---------|
| 1 | Issue 089: Consent | — |
| 2 | Issue 090: Retention | — |
| 3 | Issue 095: Payment reconciliation sweeper | — |
| 4 | Issue 096: Edge rate-limit | — |
| 5 | Issue 097: Cursor pagination | — |
| 6 | Issue 098: Concurrent-hold cap | — |
| 7 | Issue 100: Hold-lapse refund | — |

---

<!-- PART 5: UI/UX & REDESIGN -->

## 28. UI/UX Design System + OTA Redesign

| # | What | Commits |
|---|------|---------|
| 1 | Design specs — a11y, wireframe, flow, form, typography, motion | `103a1c7`..`7c39ac6` |
| 2 | 12 base-ui primitives + operator status-label map | `d0e74bc` |
| 3 | Operator console sidebar shell via (console) route group | `45bddda` |
| 4 | Normalize operator console onto design system | `f7fb7e0`..`6e8d31b` |
| 5 | Customer surfaces — semantic status tokens | `6f1bafb` |
| 6 | PAYMENTS_STUB + local stub gateway (dev infrastructure — all PSPs route through stub in dev/staging) | `1f74c0c`..`8660c99` |
| 7 | Global error/not-found boundaries + root metadata | `5cdb973` |
| 8 | Orange brand primary (Tailwind orange-600) + landing wordmark | `7b0cb1f` |
| 9 | Brand visual pass — Be Vietnam Pro font, warm tokens, app shell + logo | `fb9256e` |
| 10 | Design-system foundation — elevation, pill primary, radius 12 | `cf87247` |
| 11 | Search results polish — hover cards, operator monogram, segmented date bar | `82e0ecf` |
| 12 | Home hero — floating search card, popular-route chips, trust cards | `649d7c5` |
| 13 | Booking funnel — step indicator, payment-method cards | `fc85886` |
| 14 | Branded operator sidebar — BBVN logo + per-item icons | `ad6af67` |
| 15 | Place suggestions combobox (origin/destination) | `7fc0c35`..`eec2bc2` |
| 16 | Filter + sort rail (PTN-03), browse-all-routes, trip detail pages | `93123e7` |
| 17 | Payment-flow polish — stub-pay primitives + booking container rhythm | `fecb2af` |
| 18 | Operator KPI dashboard + conversion-funnel instrumentation | `5d8780d` |
| 19 | Dense trip grid + variety seed (3 operators, coach/sleeper/limousine, 9 routes) | `3ffbba2` |
| 20 | Sticky order-summary rail on review (PTN-07) | `2b1a41f` |
| 21 | Richer trip card — depart→arrive, duration, bus-type + seats-left badges (PTN-04) | `d91bec3` |
| 22 | E-ticket (prominent ref + add-to-calendar) + manage-booking (PTN-06) | `4d530ca` |
| 23 | Breadcrumbs (PTN-13) | `5ad47c2` |

## 29. Auth Redesign (PR #2)

| # | What | Commits |
|---|------|---------|
| 1 | Split-panel auth shell + hide site chrome on /auth | `f37bf2a` |
| 2 | Customer + operator auth pages redesign | `9a3d39e` |
| 3 | Open-redirect guard on returnTo | `c827c3b` |

## 30. Operator Console Redesign (PR #4)

| # | What | Commits |
|---|------|---------|
| 1 | Analytics landing, shared composers, charts, palette, activity feed | `6e58f54` |

## 31. OTA Redesign + Rebuild Mega-PRs (#6, #7)

| # | What | Commits |
|---|------|---------|
| 1 | PR #6: OTA redesign + payment/booking correctness fixes + rebuild backlog | `ff11fdc` |
| 2 | PR #7: Rebuild backlog + OTA polish + pay/profile/OTP fixes | `1754d8f` |

## 32. Operator Onboarding + SMS/Auth + SEO (PR #9)

| # | What | Commits |
|---|------|---------|
| 1 | Operator onboarding, SMS/auth, SEO/infra | `513fb41` |

---

<!-- PART 6: LAUNCH PREPARATION -->

## 33. Admin Enhancements (PRs #13, #15, #16)

| # | What | Commits |
|---|------|---------|
| 1 | Vietnamese localization for admin console | `72b7394` |
| 2 | Link operator names + show full phone on approvals | `b0d28fb` |
| 3 | Show temp password + unmasked phone on operator detail | `1acef9f` |

## 34. Security Hardening (PRs #17, #19, #65)

| # | What | Commits |
|---|------|---------|
| 1 | Pre-go-live BLOCKER hardening (B-02 through B-21) | `06512b7` |
| 2 | Automated data leak scanning suite | `2077894` |
| 3 | Go-live blocker hardening (#45 #46 #47 #30 #27) | `f2f2d58` |

## 35. Infrastructure & Scale (PRs #89, #90, #91)

| # | What | Commits |
|---|------|---------|
| 1 | Vercel sin1 pin + Prisma directUrl PgBouncer config | `d2197a7` |
| 2 | Tax withholding + e-invoice schema | `d5a8d4c` |
| 3 | MISA e-invoice + Resend email + Docker + ioredis | `1da66ae` |

## 36. Documentation Library

| # | What | Commits |
|---|------|---------|
| 1 | Architecture Decision Records (ADR-001 through ADR-020) | multiple |
| 2 | Business docs — competitors, domain model, market research, personas, regulatory | multiple |
| 3 | Design Specifications (DS-001 through DS-017) | multiple |
| 4 | Feature Implementation guides (FI-001 through FI-015) | multiple |
| 5 | Frontend Design docs (FD-001 through FD-030) | multiple |
| 6 | Go-Live checklists (GL-001 through GL-005) | multiple |
| 7 | Hardening audits (HD-001 through HD-012) | multiple |
| 8 | Scaffolding & Infrastructure docs (SI-001 through SI-006) | multiple |

## 37. Go-Live Prep (PRs #94-#116)

| # | What | PR |
|---|------|-----|
| 1 | Replace hardcoded admin seed password with genTempPassword() | #94 |
| 2 | OWASP HTTP security headers via next.config.ts | #95 |
| 3 | TOTP replay protection via Redis SETNX | #96 |
| 4 | Complete Zod boot validation for missing env vars | #97 |
| 5 | AES-256-GCM encryption for PayoutAccount.accountNumber | #98 |
| 6 | Secrets rotation runbook | #99 |
| 7 | pnpm audit CI stage + Dependabot | #100 |
| 8 | Greppable invariants G1-G6 audit (KG-14) | #109 |
| 9 | Production privacy policy + terms of service | #110 |
| 10 | Ledger trigger production verification script | #111 |
| 11 | Phase 1 manual refund ops runbook | #112 |
| 12 | Cash-at-boarding operator booking flow | #113 |
| 13 | Align smoke crawl scripts with seed data + login form | #114 |
| 14 | Staging compose, nginx config, cron sidecar | #115 |
| 15 | Go-live preparation docs, status audit, working track | #116 |

## 38. Security Scrub + Deps (PRs #117-#125)

| # | What | PR |
|---|------|-----|
| 1 | Scrub PII + harden defaults before public visibility | #124 |
| 2 | Remove pickup area system, simplify to station/custom toggle | #125 |
| 3 | 8 dependency bumps (Next.js, shadcn, React, pg, Tailwind, etc.) | #117-#123 |

## 39. Search Mobile Filters (PR #149)

| # | What | PR |
|---|------|-----|
| 1 | Snapshot/restore mobile filter state on sheet dismiss | #149 |

---

<!-- PART 7: DEFERRED & REMOVED -->

## Deferred Features

> Code exists in the codebase behind `PAYMENTS_STUB` but is NOT shipping at launch. Will be enabled when real merchant credentials are obtained.

### MoMo Payment (Issue 004)

| # | What | Commits |
|---|------|---------|
| 1 | PaymentEvent table + Booking MoMo columns | `40746e1` |
| 2 | MoMo sandbox env vars + Zod schema | `41eb92e` |
| 3 | bookingRepo helpers + eSMS MoMo templates | `40df80e` |
| 4 | MoMo adapter + gateway interface | `1886849` |
| 5 | initiateMomoBooking — booking-first + compensating cancel | `bdbabfa` |
| 6 | POST /api/payments/momo/webhook — HMAC verify + IPN dedup | `1a72996` |
| 7 | MoMo path on /api/bookings/initiate | `b0fe18f` |
| 8 | /booking/result/[token] — payment outcome page | `82be007` |
| 9 | E2E MoMo booking spec (sandbox-gated) | `3938ed7` |
| 10 | MoMo payment confirm guest booking attach | `48ed72a` |

### VNPay Payment (PR #92)

| # | What | Commits |
|---|------|---------|
| 1 | VNPay payment gateway adapter | `ef78a93` |

## Removed Features

### Pickup Areas/Points (PRs #10, #11, #14 → removed in PR #125)

> Built across issues 103-113. Fully removed in PR #125 and replaced by simpler station/custom toggle.

| # | What | Commits |
|---|------|---------|
| 1 | Pickup areas v1 (issues 103-108) | `7f04b9c` |
| 2 | Pickup points v2 (issues 109-112) | `74893fb` |
| 3 | Route-scoped pickup areas + trip display polish (issue 113) | `925c689` |

### Cash Payment Method (Issues 039, 088)

> The cash payment method (PaymentMethod 'cash', BookingStatus 'pending_cash_payment', cashCollectedAt, cashFlag UI) was built as part of the original booking flow and progressively removed in Issues 039 and 088. The booking orchestration layer remains (Section 4). Note: Cash-at-boarding (operator walk-in flow, Section 37 item 12) is a separate feature and is retained.

---

## QA Artifacts Produced

| Type | Count |
|------|-------|
| Code reviews | PRs #98, #115, #116, #124, #125, #148, #149, #150 |
| PR reviews | PRs #98, #115, #116, #124, #125, #148, #149, #150 |
| Architect reviews | PRs #125, #148 |
| Backcompat reviews | PRs #125, #148 |
| Performance reviews | PRs #125, #148 |
| Traveler smoke tests | 2026-06-22 |
| Operator smoke tests | 2026-06-22 |
| Cross-persona tests | 2026-06-22 |

---

## Remaining Work

| Item | Status |
|------|--------|
| Issue 094: Go-live flip (real PSP keys, PAYMENTS_STUB off) | HALTED — waiting on real keys |
| Issue 099: DB connection pooler | Deferrable |
| Issue 101: Pre-go-live security/fraud gate | Not started |
| ~12 pre-existing integration test failures | Separate fix needed |

---

## Stats

- **305+ commits** over 39 days
- **27+ PRs merged**
- **67/70 rebuild issues completed**
- **~1242 tests** (unit + integration)
- **7-series documentation library** (ADR, DS, FD, FI, SI, GL, HD)
- **1 active payment gateway** (SePay/VietQR bank transfer) + **2 deferred** (MoMo, VNPay)
- **3 auth realms** (Customer OTP, Operator password+OTP, Admin TOTP)
- **8-type append-only ledger** with immutability trigger
- **5 background cron jobs** with advisory-lock runner
- **Full operator console** (fleet, routes, trips, bookings, manifests, revenue, payouts, staff)
- **Full admin console** (approvals, users, operators, finance, moderation, system)
- **E-ticket system** with QR + PDF + signed verification
- **KYB onboarding** with document upload + payout account verification
