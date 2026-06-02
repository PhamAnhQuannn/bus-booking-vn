# Rebuild Mismatches — Implementation vs `rebuild-plan.md`

> Read-only audit of the actual codebase against the section-indexed product source of truth
> (`rebuild-plan.md`). Generated 2026-06-01 on branch `feat/ota-redesign`.
> **Re-audited 2026-06-01** against successive spec deltas: (a) Charter — S16/S17/S18 + SYS19 +
> S15 #9/#10 (charter/contact UI previously flagged EXTRA-DELETE is reclassified, see PART III);
> (b) SYS20 Code Organization & Module Boundaries. Blocks for all new tokens added below.
> **Re-audited 2026-06-01 (3)** against the uncommitted `feat/ota-redesign` working tree: **3 prior
> findings are now FIXED** — (1) search raw-capacity default P1 (`SEARCH_USE_BLOCKED_SEATS` flag
> removed, availability always set-based), (2) trip-create overlap guard (now tx + `FOR UPDATE` +
> new `lib/trips/busOverlap.ts`), (3) reassign overlap (now 60-min window, not `departureAt`
> equality). New `issues/030`,`031` noted. Everything else re-verified unchanged.
> **No code was changed by this audit** — this file only records findings.
>
> Finding types: `MISSING` (spec requires, code absent) · `WRONG` (built but contradicts spec) ·
> `EXTRA-DELETE` (code exists that spec says shouldn't) · `RECREATE` (so divergent it must be rebuilt) ·
> `PARTIAL` (started, incomplete) · `OK` (matches).
> Findings cite `file:line` (or "absent") + the spec line violated.

---

## TOP-LEVEL VERDICT

The codebase has **pivoted to a different business model than the spec describes** and is **missing
three whole subsystems** that the spec treats as one-way doors. The biggest gaps:

1. **Admin realm does not exist.** No `app/admin/**`, no admin auth/door, no admin user table, no
   TOTP, no admin console (7-tab nav). Only CLI service fns in `lib/admin/**` + an `AdminAuditLog`
   table. → S10, S11, SYS13, SYS18 essentially 0% built.
2. **No double-entry ledger.** Money is tracked as mutable per-trip `Payout` rows. No `LedgerEntry`
   model, none of the 8 entry types, no DB-enforced immutability, no `FeeConfig` (fee hard-coded 6%),
   no operator balance (pending/available/paid-out), no withdraw flow. → S08, S13, SYS07 ~10% built.
3. **The fixed-price flow was built as a phone/cash "call-to-confirm" model, not online-only
   self-serve ticketing.** Cash is the *default* checkout method; there are cash-collected /
   call-outcome / picked-up / escalation / manual-booking operator flows. Spec S03 says **"Online
   only — no cash; pay-later is OUT of app scope."** → these stay EXTRA-DELETE / RECREATE.
   *(Re-audit note: the homepage charter showcase + `/lien-he-dat-xe` contact form are NO LONGER a
   business-model error — the new S16/S17/S18 + SYS19 Charter spec makes a request→dispatch→claim
   charter marketplace in-scope. Those fragments are now PARTIAL toward S16, not deletions — PART III.)*
4. **No operator onboarding/approval.** `Operator` has only `disabledAt`, not the 4-state machine;
   operators are admin-CLI-created and instantly live; **no approval gate in search or booking-initiate**.
   → S05, SYS12 ~0% built.
5. **No `Place` entity.** Routes are free-text `origin`/`destination`; typeahead UNIONs raw route
   columns — the exact "Ha Noi/Hanoi/HN" fragmentation the spec forbids. → #13 unresolved.
6. ~~**Search ships raw-capacity availability by default** (the known P1).~~ **FIXED on
   `feat/ota-redesign`** — `SEARCH_USE_BLOCKED_SEATS` flag removed; `lib/db/searchTrips.ts:11-14`
   now ALWAYS computes `capacity − blocked − held − booked` (set-based). The headline P1 no longer
   ships. *(Approval-gate exclusion + Place typeahead + cursor pagination still missing — S02.)*
7. **No server-side payment amount/currency verification** — an underpaid IPN with success code is
   accepted as paid. Canonical event leaks MoMo field names; no `currency` field. No payment-recon
   sweeper. No refund-out rail. No QR ticket / no S3 / PDF rendered synchronously in the request path.
8. **Booking money-state is `paid_operator_notified`** — the exact combined paid+notified flag the
   spec explicitly forbids (#12).

What's genuinely solid: tenancy `operatorId` columns + per-realm stateless JWT/refresh sessions with
reuse-detection, hold concurrency via PG advisory lock, monotonic webhook transitions via WHERE-guards,
BigInt fee math, cron run-locks + JobRunLog, structured logger w/ redaction, anonymize-in-place erase,
VN-timezone handling, CSRF on all non-safe `/api/*`, orange brand. **Newly solid (feat/ota-redesign):**
set-based search availability (no flag); bus double-book guard on BOTH create + reassign via
`lib/trips/busOverlap.ts` (window-vs-window, 60-min buffer, inside tx + `SELECT … FOR UPDATE`);
underpaid-success-IPN rejection (`processWebhook.ts:143`); ownership-only guest-attach (issue-031).

---

## INDEX (coverage = all 18 story + 21 system sections — incl. Charter S16/S17/S18 + SYS19, SYS20 layout)

| Token | Section | Verdict | Headline gap |
|-------|---------|---------|--------------|
| S01 | Actors & Glossary | ⚠️ WRONG/MISSING | `paid_operator_notified` flag; no Place; no ledger types; canonical-event drift |
| S02 | Customer — Search | ⚠️ WRONG | ~~raw-capacity default~~ (FIXED); no Place typeahead; no pagination; no approval filter |
| S03 | Customer — Buy & Payment | ❌ WRONG/EXTRA | cash default + cash branch; no no-refund consent; no buyerEmail; no refund-out |
| S04 | Account & Guest Linking | 🟡 PARTIAL | login is password not OTP; phone not E.164-on-write; prefill fragile |
| S05 | Operator Onboarding/Approval | ❌ MISSING | no registration, no 4-state machine, no approval gate, no KYB |
| S06 | Operator Catalog | ⚠️ WRONG/PARTIAL | overlap guard NOW enforced (create+reassign, window+60m); reassign still skips PDF-regen/notify; price not locked after sale; recurrence over-built |
| S07 | Bookings & Manifest | ⚠️ MISSING/EXTRA | no QR scan/check-in/no-show; cash/call/pickup/escalation extras |
| S08 | Operator Money | ❌ MISSING | no ledger, no balance, no withdraw, no bank account |
| S09 | Operator Dashboard UI | ⚠️ WRONG | 12 flat tabs not 6+banner; no Money page; no approval banner; orphan charts |
| S10 | Admin Access & Security | ❌ MISSING | no admin auth/table/TOTP/roles at all |
| S11 | Admin Dashboard UI | ❌ MISSING | entire 7-tab admin console absent |
| S12 | Payments Architecture | ⚠️ WRONG/MISSING | no amount verify; field drift; no recon sweeper; no refund-out |
| S13 | Money Correctness | ❌ MISSING | no double-entry ledger / immutability / FeeConfig; T+3 not T+1 |
| S14 | Trust & Cross-cutting | 🟡 PARTIAL | no approval gate; no edge rate-limit; no NOTIFY_STUB; no email PDF |
| S15 | Open Decisions | ℹ️ N/A | ratification list (now +#9/#10 charter) — see note |
| S16 | Customer — Charter Request | ❌ MISSING | only a no-backend contact form; no model/route/status |
| S17 | Operator — Charter Marketplace | ❌ MISSING | no Charter tab, no claim, no pool |
| S18 | Admin — Charter Dispatch | ❌ MISSING | no admin queue/assign/publish/reject |
| SYS00 | Architecture Principles | 🟡 PARTIAL | no tenant-scope helper; ledger door unbuilt |
| SYS01 | Data Layer | 🟡 PARTIAL | plain pg.Pool not PgBouncer/Accelerate; no Place; Redis scope thin |
| SYS02 | Identity & Access | ✅ MOSTLY-OK | no central tenant helper; admin realm absent |
| SYS03 | Catalog & Inventory | ⚠️ WRONG | no Place; overlap guard NOW correct on create+reassign (window+60m, tx+lock) |
| SYS04 | Search & Discovery | ⚠️ WRONG | ~~raw-capacity default~~ (FIXED — always set-based); no cursor pagination; no approval exclusion |
| SYS05 | Booking & Hold | ⚠️ WRONG/PARTIAL | no FOR UPDATE on trip at sell; no hold cap; `converted` not `consumed` |
| SYS06 | Payment | ⚠️ WRONG/MISSING | no amount verify; field drift; no recon sweeper; no refund-out |
| SYS07 | Ledger & Payout | ❌ MISSING | no ledger; payout-state names diverge; T+3 not T+1 |
| SYS08 | Ticketing | ⚠️ PARTIAL/MISSING | no QR; PDF synchronous in request path; no S3; no regenerate-on-reassign |
| SYS09 | Notification | 🟡 PARTIAL | no dispatcher worker/retry; no email; no NOTIFY_STUB flag |
| SYS10 | Jobs & Scheduler | ✅ MOSTLY-OK | generate-trips not run-locked; no payment-recon job; PDF not a job |
| SYS11 | File / Document Storage | ❌ MISSING | no S3 client, no KYB doc model at all |
| SYS12 | Onboarding / KYB / Approval | ❌ MISSING | whole subsystem absent |
| SYS13 | Moderation & Audit / Compliance | ⚠️ WRONG/MISSING | audit not DB-immutable; no consent; erase partial |
| SYS14 | API Gateway / Middleware | 🟡 PARTIAL | CSRF OK; no edge rate-limit; admin surface absent |
| SYS15 | Observability | ⚠️ MISSING | no /api/health; no request-id; no Sentry |
| SYS16 | Analytics | 🟡 PARTIAL | events wired; no GMV; no admin consumer |
| SYS17 | Config & Feature Flags | ⚠️ MISSING | only PAYMENTS_STUB env; no DB flags; no NOTIFY_STUB; no admin toggle |
| SYS18 | Frontends | 🟡 PARTIAL | customer+operator OK; admin segment absent |
| SYS19 | Charter / Contract-Rental | ❌ MISSING | no CharterRequest model, state machine, claim, sweeper |
| SYS20 | Code Organization & Boundaries | 🟡 PARTIAL | clean import direction; no index barrels / lib/core / boundary lint; domains unconsolidated |

Legend: ✅ mostly matches · 🟡 partial · ⚠️ significant defects · ❌ largely/entirely missing.

---
---

# PART I — STORY SECTIONS

## [S01] Actors & Glossary
- [WRONG] prisma/schema.prisma:172 — "Booking money-state = `paid`… never folded into booking state" — `BookingStatus` enum hard-codes `paid_operator_notified`, the exact combined paid+notified flag forbidden. Notification fact folded into money-state instead of `NotificationLog`.
- [MISSING] absent — "Ledger entry types = `booking_credit | platform_fee | refund_debit | refund_out | payout_debit | payout_reversal | chargeback | adjustment`" — no `LedgerEntry` model; none of the 8 strings exist in source (only in docs). Payouts compute net directly with no double-entry rows.
- [MISSING] absent — "Place = canonical normalized city/stop entity… dedupes Ha Noi/Hanoi/HN" — no `Place` model. lib/db/getSearchablePlaces.ts:11-18 does `SELECT origin … UNION SELECT destination FROM "Route"` — free-text route columns, the precise anti-pattern.
- [PARTIAL] lib/payment/gateway.ts:34-47 — "Canonical event `{orderRef, providerTxnId, amount, currency, status}` … one pinned name everywhere" — `ParsedIpn` carries MoMo-shaped fields (`orderId`, `transId`, `resultCode`…), no `currency`/`status`. Idempotency dedups on `PaymentEvent @@unique([adapter, externalRef])` not a pinned `providerTxnId`.
- [OK] prisma/schema.prisma:34,63,81,111,153 — Trip/Bus/Route/PickupPoint/Hold models exist; Bus→Trip is 1:N via `busId`. Matches glossary.
- [OK] lib/db/holdRepo.ts:65-93 — "available seats = capacity − paidSeats − activeHeldSeats" — canonical hold path computes it correctly; never raw capacity.
- [OK] no seat-map/seat-picker anywhere; manifest+booking DTO assert `not.toHaveProperty('seatNumber')`. Count-based confirmed.

## [S02] Customer — Search
- [OK] lib/db/searchTrips.ts:11-14,157 — "filter on available seats, never raw capacity" — **FIXED on `feat/ota-redesign`**: the `SEARCH_USE_BLOCKED_SEATS` flag was **removed**; availability is now ALWAYS computed set-based (`capacity − blockedSeats − Σ active-held − Σ paid/pending`). The known P1 no longer ships. *(Header comment lines 11-14 document the removal.)*
- [MISSING] lib/db/searchTrips.ts:72-90 — "Approval gate enforced in search query / exclude non-approved operators" — no operator-approval filter at all; `Operator` has no status enum; even `disabledAt` is not checked. Non-approved/disabled operators' trips are fully searchable.
- [MISSING] no `model Place` / lib/db/getSearchablePlaces.ts:11-19 — "Typeahead backed by canonical Place entity, not free-text route columns" — typeahead UNIONs raw `Route.origin/destination` strings; no `originPlaceId`/`destPlaceId`.
- [MISSING] app/search/page.tsx:349-364 / lib/search/applyTripFilters.ts:6 — "cursor/seek pagination on results" — none; `findMany` with no `take`/`cursor`; filters in-memory over the full base set.
- [PARTIAL] app/search/page.tsx:349-356 vs app/api/trips/search/route.ts:48-62 — "Rate-limit search API by IP" — limiter only on the JSON API route; the primary `/search` RSC calls `searchTrips()` in-process with **no rate-limit**.
- [OK] app/search/page.tsx:343-347 — past-date → redirect to today via `Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'})`. Correct.
- [OK] app/search/page.tsx:314-347 — URL = source of truth; `force-dynamic`; no "remember last search". Correct.
- [OK] lib/db/searchTrips.ts:77-86 — excludes cancelled/sales-closed/maintenance-overlap via window-vs-window OR. Correct.
- [OK] app/search/page.tsx:96-138 — few-seats `lowSeats <= 5` badge; count-based UI; empty-state + ±1-day jump; facets from unfiltered base (applyTripFilters.ts:52-90). Correct.

## [S03] Customer — Buy & Payment
- [EXTRA-DELETE] app/api/bookings/initiate/route.ts:33,81-106 — "ONLINE ONLY — NO CASH" — `paymentMethod` enum includes `'cash'`; `initiateCashBooking` branch wired into the customer initiate route.
- [EXTRA-DELETE] app/booking/review/ReviewClient.tsx:58-65 — cash is the **default** (`useState('cash')`) and first radio ("Tiền mặt"). Must remove; default an online rail.
- [EXTRA-DELETE] lib/booking/initiateBooking.ts:1-288 — `initiateCashBooking` orchestrator (creates `pending_cash_payment` + `bookingPendingCash` SMS). Out-of-scope cash flow.
- [EXTRA-DELETE] lib/db/bookingRepo.ts:96-194 — `createCashBookingFromHold` inserts `'cash'::PaymentMethod` + `'pending_cash_payment'`.
- [WRONG] app/booking/customer/CustomerForm.tsx:29-52 + prisma/schema.prisma:212-213 — "enter buyer name + phone + **email**" + guest snapshot (name/phone/email) — form collects only name+phone; Booking has **no `buyerEmail` column**. Blocks the SYS08 email-PDF delivery too.
- [MISSING] app/booking/review/ReviewClient.tsx (absent) — "I accept no refund … shown + consented at checkout" — no no-refund consent text/checkbox in the checkout UI.
- [MISSING] lib (absent) — "operator cancels my trip → refund (default)" — no `refund_out` rail / refund logic anywhere.
- [OK] app/booking/customer/CustomerForm.tsx:103-124 + app/api/holds/route.ts:60-68 — pick trip → POST hold → /booking/customer flow order matches.
- [OK] ReviewClient.tsx:69-78 — hold countdown (`startTimer` + `HoldExpiryModal`) + review summary present.
- [OK] lib/booking/bookingRef.ts — booking reference stamped at insert.
- [PARTIAL] lib/booking/initiateOnlineBooking.ts — online rails momo|zalopay|card dispatch + return payUrl; VietQR/Visa/PayPal rails from the story not built (acceptable for day-1 single-provider stub target).

## [S04] Customer — Account & Guest Linking
- [WRONG] app/api/auth/login/route.ts:90-103 + app/auth/login/page.tsx:46-52 — "log in via phone + **OTP**" — login is **phone + password only**; no OTP-on-login path. `verifyOtp` is wired only to register.
- [PARTIAL] app/api/auth/register/route.ts:54-78 — "register via phone + OTP" — register is OTP-proven but **password-based** (stores `passwordHash`); OTP proves phone at signup only. Reasonable, but diverges from literal "phone + OTP".
- [WRONG] lib/db/bookingRepo.ts:99,127 + lib/validation/hold.ts:19 — "phones normalized to **E.164 on write**" — `Booking.buyerPhone` stored RAW as typed; attach/backfill normalize at compare-time instead (must generate `rawPhoneVariants`). (`Customer.phone` IS E.164.)
- [PARTIAL] lib/auth/otp.ts:14 vs lib/account/customerOtp.ts:6-15 — "OTP attempt limits + lockout" — register OTP caps at 5 attempts but has **no timed lockout**; the 3-fail/15-min lockout sentinel exists only in account flows (change-phone, forgot-password), not register/login.
- [PARTIAL] CustomerForm.tsx:65-72 — issue-030 prefill — prefill source is a module-level in-memory var; lost on hard reload (no rehydrate from refresh cookie). Works only within a SPA session.
- [PARTIAL] lib/account/anonymizeCustomer.ts:48-58 — "hard-delete credentials/sessions" — sessions are soft-revoked (`revokedAt`), `passwordHash` not cleared; only the `Customer` row is scrubbed, not `Booking` buyer-snapshot PII.
- [OK] lib/booking/attachGuestBookingByPhone.ts:18-25 — guest→account link only on OTP-proven phone / signed-in customerId; never at payment time; backfill idempotent (`customerId: null` guard). Correct. **Hardened on `feat/ota-redesign` (issue-031):** `attachGuestBookingByPhone` is no longer called from ANY payment transition (processWebhook / recordCashCollected / createManualBooking); ownership is the only attach mechanism — `getCustomerOptional(req)` threads `customerId` through initiate→create and stamps it at INSERT. Spoof vector closed.
- [PARTIAL] issues/030-booking-prefill-logged-in.md (new) — checkout prefill-from-auth-store issue is **specced but NOT yet implemented** on this branch; CustomerForm still seeds from a module-level var + localStorage (see PARTIAL above). Tracked, unbuilt.
- [OK] lib/booking/listCustomerBookings.ts:96-138 + app/account/bookings — cursor-paginated upcoming/past list + detail + ticket re-download, scoped to customerId. Correct.
- [OK] app/api/account/delete/route.ts:17 + anonymizeCustomer.ts:44-65 — anonymize-in-place erase: phone→NULL, displayName→'Deleted user', sessions revoked, bookings retained. Idempotent. Correct (subject to the PARTIAL above).

## [S05] Operator — Onboarding & Approval  — **largely MISSING**
- [MISSING] absent — "register + submit business/identity/payout-account docs" — no self-serve operator registration route/page. Operators are created only by CLI `lib/admin/createOperator.ts:45`.
- [MISSING] absent — confirmation page (ref + next steps); pending email w/ SLA range; status-check page; decision email both ways — none exist; no application/ref concept in code or schema.
- [WRONG] prisma/schema.prisma:10-26 — 4-state machine `PENDING_REVIEW → UNDER_REVIEW → APPROVED|REJECTED; REJECTED→PENDING_REVIEW; APPROVED↔SUSPENDED` — `Operator` has **no status enum**; only `disabledAt` (binary). All 5 transition edges absent.
- [MISSING] absent — per-state caps (pending = draft-only, no sell/visibility/payout) — nothing distinguishes pending from approved; any created operator is instantly fully live.
- [MISSING] lib/db/searchTrips.ts:72-90 + app/api/bookings/initiate/route.ts:36-137 — "trips hidden until approved; approval re-checked at booking-initiate" — neither path filters/re-checks operator approval (or even `disabledAt`). Defense-in-depth gate absent at both layers.
- [MISSING] absent — KYB payout-account ownership verify (micro-deposit/name-match); every-state-change notification — none implemented.
- [PARTIAL] app/op/(console)/** — operators CAN create buses/routes/trips, but unconditionally (no pending cap, no approval banner).

## [S06] Operator — Catalog (Routes/Buses/Trips)
- [WRONG] prisma/schema.prisma:63-66 — "Route references originPlaceId/destPlaceId (NOT free text)" — Route stores free-text `origin`/`destination`; no Place reference.
- [MISSING] absent — "Place(id, canonicalName, aliases)" — no Place model.
- [OK] lib/trips/createTrip.ts:56-95 — "Overlap guard … window [departure, departure+duration+60min] … on create … tx + FOR UPDATE" — **FIXED on `feat/ota-redesign`**: create now runs in `prisma.$transaction` with `SELECT … FOR UPDATE` on the Bus row (lines 65-70) and calls `busHasOverlappingTrip` (new `lib/trips/busOverlap.ts`, window-vs-window, `TRIP_OVERLAP_BUFFER_MINUTES=60`) before `trip.create`. Double-book on create now blocked.
- [OK] lib/trips/reassignBus.ts:94-99 — reassign overlap **FIXED**: now calls the same `busHasOverlappingTrip` (60-min window via `tripWindowEnd`, `excludeTripId`), not exact `departureAt` equality; overlapping-but-not-equal trips are now rejected. (tx + FOR UPDATE lock + capacity re-check already present.)
- [PARTIAL] lib/trips/reassignBus.ts:101-117 — "reassign → invalidate+regenerate ticket PDF + notify customers of new plate" — updates `busId` but does NOT regenerate PDF and does NOT notify. Half the AC missing.
- [WRONG] app/api/op/trips/[id]/route.ts:60-66 + lib/validation/trip.ts:28-40 — "price + departureAt LOCKED once any seat paid" — trip PATCH applies `price` updates unconditionally; only guard is `status !== 'cancelled'`. A paid trip's price can be silently mutated. (departureAt isn't in the PATCH schema, so not editable — but the price lock is absent.)
- [PARTIAL] lib/trips/cancelTrip.ts:88-179 — "cancel → flips bookings to trip_cancelled + refund-out" — flips status + cancels holds + enqueues notifications, but triggers **NO refund-out**. Refund half absent.
- [OK] app/api/op/buses/[id]/route.ts:86-142 + lib/buses/capacityGuard.ts — capacity-reduction blocked below sold (paid+held), inside `$transaction` + FOR UPDATE. Correct.
- [OK] lib/db/searchTrips.ts:80-84 — maintenance windows auto-hide from search. Correct.
- [OK] lib/trips/markDeparted.ts:82-103 + completeTripCore.ts — close-sales/depart/complete pair `<verb>At` with status enum, in tx+lock. Correct.
- [OK] app/api/op/trips/route.ts:53 — operator = price authority, `// I7-exempt` present.
- [EXTRA-DELETE] app/api/op/trips/[id]/paired-return/** + lib/trips/pairedReturn.ts — not in S06 spec (auto reverse-route linked trip creation). Flag.
- [EXTRA-DELETE] app/api/op/trips/[id]/block-seats/** + lib/trips/blockSeats.ts + `Trip.blockedSeats` — operator manual seat-blocking; no story. Flag.
- [RECREATE] app/api/op/trip-templates/** + lib/trips/generateFromTemplate.ts + `RecurringTripTemplate`/`RecurringGenerationLog` — spec: "full recurrence engine = later (do not build early); MVP = one-off, bulk-repeat = fast-follow." A full recurrence template + cron engine exceeds the explicit boundary.

## [S07] Operator — Bookings & Manifest
- [MISSING] absent — "scan ticket QR at boarding → verify real + paid (amount, txn)" — no operator-side QR-scan/verify endpoint. Only the customer PDF-download route exists; it emits no QR/scan token.
- [MISSING] absent (no `checkedInAt` column; no `UPDATE … WHERE checkedInAt IS NULL`) — "checked-in single-use via atomic conditional update" — entirely unimplemented. Closest is `markPickedUp` (manual, no atomic-reuse guard).
- [MISSING] absent — "mark no-show" — `no_show` enum value exists (schema:176) but no operator action ever writes it; only used as a read filter.
- [EXTRA-DELETE] app/api/op/bookings/[id]/cash-collected/** → lib/booking/recordCashCollected.ts — cash-collection boarding step; spec boarding is QR-scan.
- [EXTRA-DELETE] app/api/op/bookings/[id]/call-outcome/** → recordCallOutcome.ts + `ContactStatus` enum — call-center workflow (`reached`/`no_answer`/`callback`); no S07 story.
- [EXTRA-DELETE] app/api/op/bookings/[id]/picked-up/** → markPickedUp.ts + `pickedUpAt` — manual pickup marker substituting for scan check-in.
- [EXTRA-DELETE] app/api/op/bookings/[id]/escalation/** → recordEscalation.ts + `escalationNote`/`escalatedAt` — no S07 story.
- [OK] lib/booking/listOperatorBookings.ts:64 — per-trip/date list, VN-tz `+07:00` window filter; cursor pagination (id-seek, take limit+1, stable orderBy). Correct.
- [OK] lib/manifest/getManifest.ts:44 — manifest strictly trip-scoped by single `tripId` after operator check; rows carry `ticketCount`, no seat numbers. Correct.

## [S08] Operator — Money (Ledger & Payout)  — **largely MISSING**
- [MISSING] absent — "ledger of every entry" — no `LedgerEntry` model; only `Payout` (one row/trip with gross/platformFee/net columns).
- [WRONG] prisma/schema.prisma:423-442 — "balance (pending/available/paid-out) = SUM(entries)" — no operator balance, no 3-state; only per-trip payout rows.
- [MISSING] absent — "register a payout bank account; withdraw available balance (auto T+N and/or on-demand)" — no bank-account model; no withdraw route; payout is auto-only (T+3 cron).
- [PARTIAL] lib/trips/completeTripCore.ts:79-87 — "cancellation claws back the related credit" — cancel refuses payout for cancelled trips but no `refund_debit` reversal entry.
- [OK] app/api/op/reports/payouts/** + lib/payouts/getPayoutReport.ts — payout statement (gross/fee/net/status/scheduledAt/settledAt) exists.

## [S09] Operator — Dashboard (UI)
- [WRONG] components/op/navConfig.ts:45-138 — "Nav = 6 + banner: Overview·Fleet·Trips·Bookings·Money·Settings" — actual nav is a **flat 12-item list** (dashboard, bookings, activity, reports-overview, upcoming, buses, routes, trips, trip-templates, reports-revenue, staff, profile), not the 6-group structure.
- [EXTRA-DELETE] navConfig.ts:63-70 — top-level `activity` tab; alerts belong inside Overview's Alerts box.
- [EXTRA-DELETE] navConfig.ts:79-85 — top-level `upcoming` tab; should be reached via Fleet→bus detail.
- [WRONG] navConfig.ts:93-99 — "Routes sub-tab under Trips" — `routes` is top-level (violates explicit OUT "separate Routes top tabs").
- [EXTRA-DELETE] navConfig.ts:108-114 — top-level `trip-templates` tab; not in 6-tab spec.
- [EXTRA-DELETE] navConfig.ts:71-78,115-122 — top-level `reports-overview` + `reports-revenue` BI tabs; OUT ("charts/BI, custom report builder").
- [MISSING] absent — "Approval banner (pending only)" — none in layout or any page.
- [MISSING] absent — "Money — balance (3 numbers) + ledger + payout (withdraw/next auto-payout) + statements" — no `/op/money` route; closest is read-only `reports/payouts` (no balance/withdraw/ledger/statements).
- [MISSING] app/op/(console)/profile/OpProfileClient.tsx — "Settings — payout bank account" — profile edits contact info + password only; no bank-account surface.
- [PARTIAL] app/op/(console)/dashboard/page.tsx:38-124 — "Overview 4-box (Today/Fleet/Money/Alerts)" — has Today headline + trip strip + inbox; no Fleet box, no Money box w/ Withdraw, no dedicated Alerts box.
- [WRONG] app/op/(console)/bookings/DashboardClient.tsx:63 — "Bookings default today" — default `serviceDate` is `''` (all bookings), not today's VN-tz date.
- [PARTIAL] app/op/(console)/manifest/[tripId]/page.tsx — "manifest defaults to next departure" — keyed strictly by tripId; no bus-level auto-select-next-departure entry.
- [EXTRA-DELETE] components/charts/RevenueLineChart.tsx, BookingStatusDonut.tsx, ChartTheme.tsx — OUT (charts/BI); orphaned (imported by no app page). Dead code.
- [OK] navConfig.ts:124-130 — staff tab `adminOnly: true`, hidden for staff role. Correct.
- [OK] app/op/first-login + layout.tsx:36 — first-login forced password change gate. Correct.
- [OK] buses/[id]/page.tsx + trips/page.tsx + trips/new — fleet→bus-detail→trips→manifest path and trip create/list/cancel exist.

## [S10] Admin — Access & Security  — **entirely MISSING**
- [MISSING] absent — separate unlinked admin entry point + own credential store — no admin auth route/page/middleware; `proxy.ts` has zero admin references; `app/admin/**` does not exist.
- [MISSING] absent — admin accounts in a distinct table/role — no `AdminUser`/`Admin` model (only `AdminAuditLog`). `lib/admin/**` provisions Operators, not admins.
- [MISSING] absent — invite-only; email+password+mandatory TOTP; step-up re-auth; role tiers (super-admin/finance/support); first super-admin bootstrap; lost-TOTP recovery — none exist; no TOTP code anywhere.
- [PARTIAL] lib/audit/adminAuditLog.ts:25-30 — "audit-log every privileged action" — a who/what/when row IS written for the 2 CLI write actions (create-operator, disable-operator) with phone redaction. Only this exists; CLI-internal, no auth/role/UI, not exportable.

## [S11] Admin — Dashboard (UI)  — **entirely MISSING**
- [MISSING] absent — "Nav (7): Overview·Approvals·Users·Operators·Finance·Moderation·System" — `app/admin/**` does not exist; no admin UI pages of any kind.
- [MISSING] absent — Overview action-queue + metrics; Approvals queue; Users search + suspend; Operators list + fee override; Finance (payout oversight, ledger view, refund-out, chargeback, FeeConfig); Moderation; System (flags/rail toggles, admin accounts, audit export) — all absent. Only CLI `listOperators`/`disableOperator` exist; no `FeeConfig`/ledger models.

## [S12] System — Payments Architecture
- [WRONG] lib/payment/gateway.ts:34-47 — "per-provider adapter → canonical `{orderRef, providerTxnId, amount, currency, status}`; pin providerTxnId everywhere" — `ParsedIpn` uses MoMo-native names (`orderId`, `transId`, `resultCode:number`), **no `currency` field**. The exact S01 drift; MoMo's shape leaks into the "provider-agnostic" core.
- [WRONG] lib/payment/processWebhook.ts:131-138 — dedup key persisted as `PaymentEvent.externalRef`, never normalized to `providerTxnId`.
- [MISSING] processWebhook.ts:85-149 — "verify amount ≥ stored + currency server-side; reject short/wrong payments" — IPN `amount` parsed but **never compared** to `booking.totalVnd` (fetched line 97, unused); currency never checked. **A short/underpaid IPN with resultCode 0 transitions the booking to paid — money-loss gap.**
- [WRONG] no Payment model (only PaymentEvent) — "`Payment(orderRef,amount,currency,provider,status=pending)` created BEFORE charge" — pending lives on `Booking.status=awaiting_payment` (created before charge — satisfied in spirit), but no dedicated Payment row; PaymentEvent rows are created only at webhook time (after charge).
- [MISSING] absent — "memo fixed format + length; degraded match (amount+account+time-window) in recon sweeper" — no memo constraint, no degraded match, **no payment-recon sweeper** (sweep-holds is hold-expiry only). Stuck `awaiting_payment` never auto-expired.
- [PARTIAL] processWebhook.ts:143-149 — "monotonic transitions reject backward" — forward updates guarded by `WHERE status='awaiting_payment'`, so a replayed pending can't regress a paid booking — effective, but incidental (no explicit state-machine layer).
- [OK] lib/payment/select.ts:23-35 — central collection (Model A): one platform PSP config; confirmation reads only Booking+PaymentEvent; no operator-bank read.
- [OK] processWebhook.ts:131-139,231-241 + schema:265 — idempotent dedup via `@@unique([adapter, externalRef])` + P2002→200 no-op. (Naming drift aside, dedup works.)
- [OK] momo/webhook/route.ts:26-40 — truth from HMAC-verified webhook; redirect is display-only.
- [OK] proxy.ts:37-41 + momo.ts:85-103 — webhooks CSRF-exempt (exact-match Set) + HMAC-SHA256 `timingSafeEqual` before DB writes.
- [OK] VND-only — all amounts integer VND; no FX. (No defensive currency assertion, though — see amount-verify gap.)
- [PARTIAL] card/zalopay webhook routes exist but resolve to `getStubAdapter`; momo uses real sandbox unless `PAYMENTS_STUB`. Matches memory (real PSP deferred); structured for drop-in swap.

## [S13] System — Money Correctness  — **largely MISSING**
- [MISSING] absent — "append-only double-entry ledger; never a mutable balance column; 8 entry types" — no ledger model, no entry-type enum. Money tracked as mutable `Payout` rows — the exact anti-pattern.
- [MISSING] absent — "immutability enforced at DB level (REVOKE UPDATE/DELETE or trigger)" — no REVOKE/trigger in any migration; `Payout` rows freely `UPDATE`d (processPayouts, retryPayout).
- [MISSING] absent — "fee = own entry; rate from `FeeConfig` (global+override, effective-dated, change-audited)" — no FeeConfig; fee hard-coded `DEFAULT_PLATFORM_FEE_PCT = 0.06` in calcPayout.ts:10, stored as a baked-in `Payout.platformFee` column.
- [MISSING] absent — "withdrawals: $transaction + FOR UPDATE on balance + re-check available ≥ amount + idempotent key; min-withdraw threshold" — no withdrawal path exists at all.
- [WRONG] prisma/schema.prisma:416-421 — "payout state machine requested→processing→paid|failed" — `PayoutStatus` is `pending|processing|settled|failed` (no `requested`; `paid`→`settled`); creation-time pending → cron, not request-driven.
- [WRONG] completeTripCore.ts:28,89 — "AVAILABLE at completion + T+1 settlement delay" — hard-coded `THREE_DAYS_MS` (**T+3**, not T+1); no PENDING→AVAILABLE→PAID-OUT 3-state.
- [MISSING] absent — refund_debit/refund_out/chargeback/payout_reversal/bad-debt — none exist.
- [OK] lib/payouts/calcPayout.ts:58-88 — BigInt minor-unit fee math, `BigInt()` ctor, no `n` suffix, no `Math.round(int*fractional)` on money. Correct.

## [S14] System — Trust, Notifications & Cross-cutting
- [MISSING] prisma/schema.prisma:10 + lib/db/searchTrips.ts + lib/booking/initiateBooking.ts — "approval gate: only APPROVED operators in search AND re-checked at booking-initiate" — no operator status field; neither path filters/re-checks approval.
- [PARTIAL] lib/notifications/esms.ts:111 + initiateBooking.ts:252-280 — "SMS confirm + email PDF; async/queued with retry" — SMS dispatched in-process via `after()` (post-response) with **no queue and no retry** (a failed send writes `status:'failed'` and is never retried). **Email + PDF-by-email entirely absent** (no code ever sets channel=email).
- [PARTIAL] lib/booking/ticketPdf.tsx — real PDF exists + downloadable on-demand, but not emailed and contains **NO QR code**.
- [MISSING] absent — "NOTIFY_STUB flag (parallel to PAYMENTS_STUB)" — exists nowhere; SMS stub is hardcoded by `NODE_ENV`, not a config flag.
- [WRONG] proxy.ts (whole file) — "rate-limit + CSRF on all non-safe `/api/*`" — middleware enforces CSRF but applies **NO rate-limiting**; limiter is invoked per-route in only ~5 handlers. No edge rate-limit.
- [OK] proxy.ts:107-161 — CSRF double-submit `bb_csrf` on all non-safe `/api/*` (incl. `/api/op/*`); 3 payment webhooks exact-match exempt; pre-auth routes prefix-exempt. Correct.
- [OK] proxy.ts:55-104 — Edge JWT verify via `jose.jwtVerify`, reads `requiresPasswordChange` claim no-DB; `OP_AUTH_FREE_PATHS` exact-match Set. Correct.
- [OK] lib/auth/requireOperatorAuth.ts:79-124 — tenant isolation: operatorId + role + assignedTripId in ctx; adminOnly→403; staffTripScope→404 no leak. Correct.
- [OK] schema:269-285 — NotificationLog `scheduledFor` top-level column + `@@index([template, scheduledFor])`; predicate not in JSON. Correct.
- [OK] UTC storage; business date Asia/Ho_Chi_Minh (ticketPdf.tsx:29, listOperatorBookings). Correct.

## [S15] Open Decisions
- ℹ️ N/A — S15 is a ratification list of locked defaults, not a build target. Note: several defaults the
  spec assumes are **contradicted by what's built** — e.g. #5 settlement delay default T+1 vs code T+3
  (see S13); #2 operator-cancel=refund vs code has no refund-out (S03/S06); #6 lock-price-after-sale
  not enforced (S06). These are tracked under their owning sections above.
- ℹ️ NEW #9/#10 (charter) — #9 charter payment = lead-gen/operator-direct default; #10 operator quotes
  off-platform after accepting. Code has **no charter payment/quote path at all** (charter unbuilt), so
  the lead-gen default is trivially un-violated but also un-started. Tracked under S16/SYS19.

## [S16] Customer — Charter Request  — **largely MISSING**
- [MISSING] absent — `CharterRequest` entity (SYS19); guest-allowed contact snapshot + optional customerId — no `CharterRequest` model in prisma/schema.prisma (no charter refs at all).
- [MISSING] absent — charter request route + confirmation (ref + next steps) + status visibility (submitted→under review→matched→confirmed) + cancel-before-accept — no charter route/handler under `app/**` or `lib/**`.
- [MISSING] absent — "notified when an operator is matched/accepts" + "pickup/destinations reference canonical Place" — no notification wiring, no Place entity (Place itself is also unbuilt, see SYS03).
- [PARTIAL] components/contact/ContactBookingForm.tsx:20-113 (rendered by app/lien-he-dat-xe/page.tsx) — the S16 request **form front-end exists and matches the spec field list** (name/phone/email/destination/departureDate/days/people/vehicle/notes; today-VN min date). BUT it is explicitly a **client-side placeholder** — `handleSubmit` (line 27-31) just sets a success state; the file header (lines 3-8) says "no backend/notification wired yet. TODO: POST to an inquiry API". No model, no ref, no status, no state machine. This is ~the only charter code; ~5% of S16.
- [PARTIAL] components/home/ContractCarRental.tsx (rendered app/page.tsx:105) — marketing showcase + "Liên hệ thuê xe" CTA into the request form — a legitimate S16 entry point, but purely presentational (no data path).

## [S17] Operator — Charter Marketplace  — **entirely MISSING**
- [MISSING] absent — operator "Charter tab" (requests assigned to me) — no charter nav item in components/op/navConfig.ts, no `app/op/(console)/charter` page.
- [MISSING] absent — public pool of open requests + **first-accept-wins atomic claim** (`WHERE status='published' AND assigneeOperatorId IS NULL` → set assignee + 409 to losers) — no claim handler, no charter route under `app/api/op/**`.
- [MISSING] absent — accept/decline direct-assignment (decline → ADMIN_REVIEW) + accepted-contracts list + assignment/win/loss notifications — none.
- [MISSING] absent — "only APPROVED operators see/claim charter (trust gate, S14)" — moot: neither charter nor operator-approval status exists.

## [S18] Admin — Charter Dispatch  — **entirely MISSING**
- [MISSING] absent — admin charter queue + per-request `ASSIGN_DIRECT(op) | PUBLISH | REJECT(reason)` + status/reassign + new-request notifications — no `app/admin/**` at all (admin realm absent, see S10/S11), so no charter dispatch UI/route.
- [MISSING] absent — published-but-unclaimed → EXPIRE after window → ADMIN_REVIEW; every dispatch action audit-logged (SYS13) — no expiry sweeper, no charter audit events.

---
---

# PART II — SYSTEM SECTIONS

## [SYS00] Architecture & Scaling Principles
- [MISSING] absent — one-way door #1: "a tenant-scope query helper that always injects operatorId; never hand-write unscoped operator queries" — no such helper; every operator query hand-writes `where:{operatorId}` (listOperatorBuses.ts:27, listOperatorBookings.ts:89, getManifest.ts:50, +16 more). Isolation relies on author discipline.
- [MISSING] absent — one-way door #2: "double-entry ledger + integer minor-units + BigInt" — ledger half entirely unbuilt (BigInt exists for payout math only).
- [PARTIAL] lib/db/client.ts:16 — one-way door (pooler): "PgBouncer/Accelerate from day 1; never raw PG" — uses `new Pool({connectionString})` straight to `DATABASE_URL`; no pooler/Accelerate config; "never raw PG" not guaranteed by code.
- [PARTIAL] schema PaymentEvent:265 — one-way door #3 (idempotency) — webhook idempotency via `@@unique([adapter, externalRef])` not the pinned `providerTxnId`; payout idempotency is not a dedicated key.
- [OK] schema:36,67,115,359,426,451 — operatorId on every operator-owned row (Bus/Route/Trip/OperatorUser/Payout/RecurringTripTemplate) + FK + `@@index`. Column-level tenancy door present.
- [OK] lib/ layout — clean `lib/<domain>` seams (auth/booking/buses/routes/trips/payouts/payment/manifest/…). Modular monolith. Correct.
- [OK] lib/payment/gateway.ts:53 — `PaymentGateway` adapter interface (door #6). Present.
- [OK] lib/db/holdRepo.ts:48 — PG `pg_advisory_xact_lock`/FOR UPDATE on contended writes (door #4); single locking scheme, no Redis seat lock.

## [SYS01] Data Layer
- [PARTIAL] lib/db/client.ts:16-21 — "PgBouncer/Accelerate from day 1" — only in-process `pg.Pool`; no PgBouncer DSN/Accelerate URL/pool cap. Does not solve serverless connection exhaustion.
- [WRONG] schema:63-79 — "Route references originPlaceId/destPlaceId" — free-text `origin`/`destination`; `@@index([origin,destination])` indexes raw strings; #13 fragmentation fix unimplemented.
- [PARTIAL] lib/ratelimit/index.ts:71-129 — "Redis for rate-limit + idempotency SETNX + OTP/jti + hold-countdown TTL + hot-route cache" — Redis (Upstash) used ONLY for rate-limit (when configured, else in-memory). OTP in PG, idempotency in PG, hold-countdown client-side zustand, no hot-route cache. Divergent but arguably fine at scale.
- [OK] schema — IDs CUID (most) / Uuid (Booking, PaymentEvent); no central sequence.
- [OK] lib/db/searchTrips.ts:59-145 — no N+1: one route-id query + findMany + set-based GROUP BY aggregates.
- [OK] schema:144-148,165-166,244-251 — Trip/Hold/Booking composite indexes present.
- [OK] OTP/hold/seat state in PG; FOR UPDATE only seat/money lock; no Redis seat/money lock.

## [SYS02] Identity & Access  — **mostly OK**
- [OK] lib/auth/session.ts:109-138 + jwt.ts:42-50 — stateless: access JWT HS256 TTL 900s; refresh token SHA-256-hashed in `Session.refreshTokenHash`; `bb_rt` HttpOnly/SameSite=lax.
- [OK] session.ts:45-103 — rotating refresh + reuse-detection: revoked-token reuse revokes the whole `tokenFamily`. Mirror in operatorSession.ts.
- [OK] jwt.ts:57-124 + requireCustomerAuth/requireOperatorAuth — 3 realms; cross-realm rejection both directions (verifyAccess rejects operator scope; verifyOperatorAccess rejects non-operator). Admin realm out of scope (absent).
- [OK] jwt.ts:88-90 — gate state (`requiresPasswordChange`, operatorId, role) encoded in JWT claim for Edge middleware, no DB read.
- [PARTIAL] absent — "tenant-scope query helper that always injects operatorId" — no dedicated helper module; operatorId extracted in requireOperatorAuth and passed manually per-route. Scoping by convention, not central injector.

## [SYS03] Catalog & Inventory
- [MISSING] absent — "Place(id, canonicalName, aliases); Route references place FKs" — Place entity not implemented (Status line `> RESOLVED (#13)` is contradicted by code).
- [WRONG] schema:63-79 — Route has free-text origin/destination + durationMinutes; no place FKs.
- [OK] createTrip.ts:56-95 + reassignBus.ts:94-99 — "double-book prevention: $transaction + FOR UPDATE + overlap (duration+buffer); reassign re-runs both" — **FIXED on `feat/ota-redesign`**: BOTH paths now run inside `$transaction` with `SELECT … FOR UPDATE` (Bus row on create, Trip+Route on reassign) and call the shared `busHasOverlappingTrip` (`lib/trips/busOverlap.ts`) window-vs-window check (buffer 60 min). The core anti-double-book guard is now correctly implemented on both paths.
- [OK] buses/[id]/route.ts:86-142 — capacity ≥ sold (paid+held) check, locked, per future trip. Correct.
- [OK] markDeparted/completeTripCore/cancelTrip — lifecycle transitions pair `<verb>At` + status. Correct.
- [OK] busOverlap.ts:19,31-48 defines the 60-min BUFFER + window-vs-window predicate, NOW wired into both create + reassign (supersedes the standalone `lib/buses/windowsOverlap.ts`, which remains the pure-predicate precedent).

## [SYS04] Search & Discovery
- [OK] lib/db/searchTrips.ts:11-14,157 — "availability set-based, never raw capacity" — **FIXED on `feat/ota-redesign`**: the `SEARCH_USE_BLOCKED_SEATS` flag was removed; the set-based predicate (`capacity − blocked − held − booked`) is now the ONLY path. No dormant raw-capacity branch remains.
- [WRONG] searchTrips.ts:142-147 — booking-sum status filter keys on `pending_cash_payment`/`paid_operator_notified` — spec mandates `paid` money-state, "never a combined `paid_operator_notified`". Naming drift.
- [MISSING] searchTrips.ts — non-approved-operator exclusion absent (no Operator status field).
- [MISSING] app/search/page.tsx — cursor pagination absent.
- [PARTIAL] schema:144-145 — spec wants index on `(originPlaceId,destPlaceId,departureAt,status)`; place-id columns don't exist; route match runs through a leading-wildcard `unaccent ILIKE` (searchTrips.ts:59-66) that **cannot use** the `(origin,destination)` btree — seq scan on Route.
- [OK] app/api/trips/search/route.ts:17,73 — `runtime='nodejs'`, IP rate-limit 429+Retry-After, no-store. (RSC path unprotected — see S02.)
- [OK] app/trips/[id]/page.tsx — trip detail w/ pickup points + operator `tel:` phone; getTripDetails uses set-based availability unconditionally (inconsistent with searchTrips' flag-gated path).

## [SYS05] Booking & Hold (concurrency)
- [WRONG] lib/db/bookingRepo.ts:211-299 (createOnlineBookingFromHold) — "on sell, hold→consumed atomically inside the same FOR UPDATE txn; never double-counted" — sell uses `ON CONFLICT (holdId)` + WHERE-EXISTS eligibility, with **no `SELECT … FOR UPDATE` on the Trip row and no available-capacity re-check at sell time**. Capacity validated only at hold creation; oversell-serialisation guard not implemented as specified (relies on create-time advisory lock + hold accounting).
- [WRONG] bookingRepo.ts:166-170,272 + schema:166 — "hold active→**consumed**" — sell sets hold status to `'converted'`; enum has no `consumed`. Functionally equivalent, diverges from named state.
- [WRONG] schema:169-178 + processWebhook.ts:145 — money-state success status is literally `paid_operator_notified` — the forbidden combined flag. Enum also carries cash-only `pending_cash_payment`/`no_show`/`cancelled` not in spec's machine.
- [MISSING] app/api/holds/route.ts — "per-IP + per-customer concurrent-hold cap" — only a per-IP request rate-limit; no cap on simultaneous active holds. Inventory-DoS guard absent.
- [WRONG] holdRepo.ts:48-93 — hold *creation* serialises via `pg_advisory_xact_lock`, not `SELECT … FOR UPDATE` on trip row (acceptable for create; the sell-side gap is the real issue above).
- [OK] processWebhook.ts:143-149 — monotonic: success/failure updates guarded `WHERE status='awaiting_payment'`. Correct.
- [OK] app/api/cron/sweep-holds + lib/jobs/expireHolds.ts — hold-expiry sweeper present.

## [SYS06] Payment
(See [S12] — same surface; key defects repeated.)
- [WRONG] gateway.ts:34-47 — canonical-event field drift: native MoMo names, missing `currency`, `resultCode` not `status`. Provider-agnostic goal undercut.
- [MISSING] processWebhook.ts — "short amount → reject" — underpayment not rejected; resultCode 0 alone confirms.
- [MISSING] absent — reconciliation sweeper for stuck pendings; memo degraded-match — unimplemented.
- [MISSING] absent — refund-OUT rail (PSP-refund call + refund_out entry, own idempotency key) — unimplemented in the payment layer.
- [OK] initiateOnlineBooking.ts:114-171 — async never-block: pending → return payUrl instantly → webhook truth.
- [OK] processWebhook.ts:252-281 — SMS deferred via `after()`; no S3/PDF in webhook hot path.
- [OK] app/dev/stub-pay/actions.ts:24-69 — PAYMENTS_STUB reuses the real webhook handler with a signed stub IPN. Correct.

## [SYS07] Ledger & Payout  — **largely MISSING**
- [MISSING] absent — `LedgerEntry(operatorId, bookingId?, payoutId?, type[8], amount signed, sourceEventId)` — Stage 0 unimplemented; jumped straight to per-trip `Payout` aggregate.
- [MISSING] absent — FeeConfig — fee hard-coded 6% + baked into `Payout.platformFee`.
- [WRONG] schema:416-421 — payout state names diverge (`pending|processing|settled|failed` vs spec `requested→processing→paid|failed`); no min-withdraw threshold; no on-demand withdrawal.
- [MISSING] absent — refund_debit/refund_out/chargeback/payout_reversal/bad-debt — none.
- [OK] lib/jobs/processPayouts.ts:33-41 — `FOR UPDATE SKIP LOCKED` on due Payout rows inside job txn; completeTripCore idempotent on Payout creation. Prevents double-settle/create. (Guards the auto-payout path, not a withdraw, which doesn't exist.)
- [OK] calcPayout.ts:58-88 — BigInt VND minor-unit fee math. Correct.

## [SYS08] Ticketing (QR/PDF/verify)
- [PARTIAL] lib/booking/ticketPdf.tsx + app/api/bookings/[id]/ticket/route.ts:46-55 — "on webhook-paid enqueue job → render once → upload S3 once → store key → serve signed URL" — PDF rendered **synchronously inside the GET request** via `renderToBuffer` + streamed through the server. No job, no S3, no signed URL, no generate-once. Violates "PDF must not be in the request path" + "no byte-proxying".
- [MISSING] absent (no qrcode lib/code) — "QR = signed token (JWT) → public read-only verify page" — no QR generation anywhere; PDF prints no QR.
- [PARTIAL] app/booking/confirmation/[token]/page.tsx:104-164 — "public verify page = source of truth (live read) for plate/type/departure/status" — confirmation page IS a live in-process read showing plate/departure/status/operator (source-of-truth + no-self-fetch). But it's the post-purchase confirmation keyed by a 192-bit `confirmationToken`, not a signed-JWT boarding-verify page; shows no `providerTxnId`, no single-use check-in.
- [MISSING] absent — "on bus reassign → invalidate+regenerate PDF + notify customer" — no regenerate-on-reassign hook (PDF is on-demand so there's no snapshot to invalidate, but the notify+regenerate path is unbuilt).
- [OK] ticket/route.ts:24-44 — ownership-scoped (customerId+id, 404) + status-gated (409). Correct.

## [SYS09] Notification
- [PARTIAL] lib/db/notificationLogRepo.ts:24 — "enqueue row; worker/cron dispatches + retries" — rows enqueued (status pending), dispatch outside booking/payment txn (good, decoupled per #12), but **no worker/cron picks up pending/failed rows**; dispatch is fire-once in `afterFn`. Async-job-with-retry half missing.
- [MISSING] absent — NOTIFY_STUB flag — stubbing implicit/hardcoded, not config-driven.
- [PARTIAL] notificationLogRepo.ts — "idempotent per (bookingId, template)" — no unique constraint on `(bookingId, template)`, no dispatcher re-run; idempotency structurally unenforced (moot until a dispatcher exists).
- [OK] initiateBooking.ts:260-280 + processWebhook.ts:262 — delivery failure writes only `NotificationLog.status='failed'`; never touches booking paid state. Correct (#12).
- [OK] schema:284 — `scheduledFor` top-level + `@@index([template, scheduledFor])`. Correct.

## [SYS10] Jobs & Scheduler  — **mostly OK**
- [OK] lib/jobs/withAdvisoryLock.ts:28-43 — run-lock via `pg_try_advisory_xact_lock(hashtext(jobName))`; non-acquiring run returns `skipped_locked`. Xact-scoped. Used by 5/6 crons.
- [OK] lib/jobs/runJob.ts:20-49 + schema:288-299 — at-least-once + idempotent; one JobRunLog per run, written outside the lock tx.
- [OK] expireHolds (sweep-holds), sendReminders (T-24h), processPayouts (T+N), autoCloseSales, autoCompleteTrips — present + run-locked.
- [WRONG] app/api/cron/generate-trips/route.ts:29 — recurring-trip generation does NOT run under `runJob`/advisory lock; calls `generateTripsFromTemplates()` directly; no JobRunLog. Two ticks can race (mitigated by per-row idempotency only). Inconsistent with the other 5 crons.
- [MISSING] absent — payment-reconciliation job — no reconcil* anywhere; stuck `awaiting_payment` never reconciled.
- [PARTIAL] ticketPdf.tsx — PDF render is synchronous on-demand, not a job; regenerate-on-reassign job path unbuilt.

## [SYS11] File / Document Storage  — **entirely MISSING**
- [MISSING] absent (no lib/storage, no @aws-sdk/S3Client/getSignedUrl) — "S3 private bucket + signed URLs for KYB docs + ticket PDFs; direct client→S3 upload; keys in DB" — no storage client of any kind.
- [MISSING] absent (no KybDocument/Document model) — "private bucket; signed PUT/GET; KYB doc model" — no document/key schema.

## [SYS12] Onboarding / KYB / Approval  — **entirely MISSING**
- [MISSING] absent — registration + doc submit; 4-state machine enforced in search AND booking-initiate; approval/review-queue routes; payout-account ownership verify (micro-deposit/name-match); state-change notifications — entire Stage 0 unimplemented. Closest is a binary admin `disabledAt` flag that the customer-facing search/booking paths don't even read.

## [SYS13] Moderation & Audit / Compliance
- [WRONG] schema:501-511 + migrations/20260520000000_issue_020_admin_audit_log/migration.sql — "AuditLog append-only enforced at DB level (REVOKE UPDATE/DELETE or trigger)" — `AdminAuditLog` is a plain table; migration has NO REVOKE/trigger. Immutability is convention-only.
- [MISSING] absent — LedgerEntry DB-enforced immutability — no ledger table exists at all.
- [MISSING] absent — consent capture (no-refund + PII-storage) — none anywhere (issues/001 explicitly says "not shipped").
- [MISSING] absent — retention policy on guest PII + KYB docs — no retention job.
- [PARTIAL] lib/account/anonymizeCustomer.ts:44-63 — anonymize-in-place erase exists for the Customer row (phone nulled, renamed, sessions revoked, idempotent) but does NOT scrub `Booking`/guest snapshot PII (buyerPhone/buyerName retained by design) and doesn't purge credentials beyond session revoke.
- [OK] disableOperator/createOperator — moderate-don't-edit posture honored (disable sets disabledAt+salesClosed, never edits catalog). (CLI/operator-level only; no admin-facing trip/route moderation.)

## [SYS14] API Gateway / Middleware
- [WRONG] proxy.ts — "rate-limit + CSRF on all non-safe `/api/*`" — CSRF enforced; **no edge rate-limit** (limiter only in ~5 route handlers).
- [WRONG] proxy.ts:43-48 — admin CSRF — no `/admin` or `/api/admin/*` surface exists; admin realm vacuously unsatisfied.
- [OK] proxy.ts:107-161 — CSRF double-submit on all non-safe `/api/*` incl. `/api/op/*`; 3 webhooks exact-match exempt; pre-auth routes prefix-exempt.
- [OK] proxy.ts:55-104 — Edge `jose.jwtVerify`, no-DB claim read, exact-match allowlist Set.

## [SYS15] Observability
- [OK] lib/logger.ts:39-90 — Pino structured logger; redaction incl. `otpProof`, accessToken, refreshToken, `*.passwordHash`, phone/PII. Comprehensive.
- [MISSING] proxy.ts — request-id propagation absent (no `x-request-id`).
- [MISSING] absent — `/api/health` endpoint.
- [MISSING] absent — Sentry not installed/initialized.

## [SYS16] Analytics (business)
- [OK] lib/analytics/track.ts:52-67 — fire-and-forget, swallows errors, gated on `bb_sid`. Non-blocking.
- [OK] schema:520-531 — `FunnelEvent(sessionId, step, tripId, bookingId, context)` + `@@index([step,createdAt])`; steps search_performed|hold_created|payment_initiated|booking_paid.
- [PARTIAL] track callers — search_performed + booking_paid wired; **no GMV metric/event**; `lib/analytics/getFunnel.ts` exists but **no admin console consumer** (admin absent).

## [SYS17] Config & Feature Flags
- [PARTIAL] lib/config/env.ts:91-104 — `PAYMENTS_STUB` env flag implemented (zod-validated). Env-flag half present.
- [MISSING] env.ts — NOTIFY_STUB absent (only in docs).
- [MISSING] absent — DB-backed flag store / cached read helper / kill-switches — only static env vars.
- [MISSING] absent (no app/admin) — admin System tab flag-toggle UI.

## [SYS18] Frontends (customer/operator/admin)
- [OK] app/page.tsx + app/op/** — one Next.js app, route-segmented (`/`, `/op` with `(console)` group).
- [OK] app/search/page.tsx (RSC) — search RSC calls `searchTrips` in-process; confirmation/result pages call lib in-process (Mistake-Log compliant, no self-fetch).
- [MISSING] absent — `/admin` segment + separate admin cookie/creds/TOTP (Stage 0) — third realm/frontend entirely unbuilt. (`AdminAuditLog` + `lib/admin/` CLI exist, but no admin frontend.)

## [SYS19] Charter / Contract-Rental  — **entirely MISSING**
- [MISSING] absent — `CharterRequest(id, ref, customerId?, contact*, originPlaceId, destinations, dates, passengers, vehicleType, budget, notes, status, assigneeOperatorId?, publishedAt?, claimByAt?)` — no model in prisma/schema.prisma.
- [MISSING] absent — state machine `SUBMITTED → ADMIN_REVIEW → {ASSIGNED_DIRECT|PUBLISHED|REJECTED}; ASSIGNED_DIRECT→ACCEPTED|DECLINED→ADMIN_REVIEW|(timeout); PUBLISHED→ACCEPTED(claim)|EXPIRED; ACCEPTED→COMPLETED|CANCELLED` — none.
- [MISSING] absent — atomic claim (`SELECT … FOR UPDATE` / conditional update, first-commit-wins, 409 to losers) — no claim handler.
- [MISSING] absent — request/dispatch/claim routes (customer + operator + admin); notifications; expiry sweeper (accept-by 24h direct, claim-by 48h published → ADMIN_REVIEW) — none. No charter cron in `app/api/cron/**`; `lib/jobs/**` has no charter expiry job.
- [MISSING] absent — reuse hooks (Place, operator-approval gate) — both unbuilt anyway (SYS03, S05).
- [PARTIAL] components/contact/ContactBookingForm.tsx + components/home/ContractCarRental.tsx — the ONLY charter code: a presentational request form + showcase with no backend (see S16). Stage 0 ("form + admin dispatch + atomic claim + status + notifications + expiry sweeper") is ~5% done — form front-end only.

## [SYS20] Code Organization & Module Boundaries  — **PARTIAL (clean direction, no enforcement/consolidation)**
- [OK] boundary rule 2 — "lib/<domain> MUST NOT import app/ or components/" — **0 violations** (grep `from '@/app'`/`'@/components'` in lib = none). Direction `app → lib → …` holds.
- [OK] boundary rule 1 — "app/ thin, calls lib in-process, never self-fetch" — confirmed (RSC/handlers call lib in-process; no self-fetch, per Mistake Log).
- [OK] per-module file convention — domains use `<action>.ts` + `<domain>Repo.ts` (bookingRepo, holdRepo) + colocated `__tests__/` + `errors.ts` in several. Matches the per-module shape (minus the barrel below).
- [MISSING] rule 3 — "cross-domain imports go through the other domain's `index.ts` barrel ONLY" — **only 1 of ~28 lib folders has an index.ts** (`lib/ratelimit/index.ts`). Every cross-domain import reaches into internals directly; the future service boundary doesn't exist.
- [MISSING] rule 4 + target tree — "`lib/core/` cross-cutting primitives (db, money, time, id, result, errors, logger, config, jobs, http)" — **no `lib/core`**; primitives scattered: `lib/db`, `lib/jobs`, `lib/config`, `lib/ratelimit`, `lib/logger.ts`, money math inlined in `lib/payouts/calcPayout.ts`. No single core layer.
- [MISSING] rule 5 + Verify — "every operator-owned repo query goes through the `lib/core/db` tenant-scope helper" — **no tenant-scope helper anywhere** (re-flag of SYS00/SYS02); `operatorId` hand-injected per query.
- [MISSING] Verify — "an import-boundary lint rule (eslint `no-restricted-imports` / dependency-cruiser) enforcing rules 1–4" — **none** (no dependency-cruiser config, no `no-restricted-imports` in eslint/package.json). Seams are unenforced convention.
- [WRONG] target `lib/` domain consolidation — current tree is NOT consolidated by domain:
  - `lib/catalog` absent — split across `lib/buses` + `lib/routes` + `lib/trips` + `lib/pickupPoints` (+ overlap in `lib/buses/windowsOverlap.ts`). Spec folds all into `lib/catalog`.
  - `lib/ledger` absent — it's `lib/payouts` (no feeConfig/chargeback). Spec: `lib/ledger`.
  - `lib/ticketing` absent — ticket PDF lives in `lib/booking/ticketPdf.tsx`. Spec: `lib/ticketing`.
  - `lib/notification` (singular, spec) vs actual `lib/notifications` (plural) — naming drift.
  - `lib/manifest` is a separate folder — spec folds manifest into `lib/booking`.
  - `lib/charter`, `lib/storage`, `lib/onboarding` absent (SYS19/SYS11/SYS12 unbuilt).
  - Off-target folders to reconcile per the spec's own map: `lib/db`→`lib/core/db`, `lib/payouts`→`lib/ledger`, `lib/buses`→`lib/catalog`, `lib/validation`→per-domain types/core, `lib/api`→assess. (`lib/stores` client-only = keep.) These are the spec's planned migrations, so PARTIAL/pre-migration, not hard errors.
- [MISSING] target `lib/payment/adapters/{momo,vietqr,card,paypal,stub}` subdir — adapters are flat in `lib/payment/` (`momo.ts`, `stub.ts`, `select.ts`); no `adapters/` subdir; vietqr/paypal adapters absent.
- [WRONG] target `app/` realm layout — **no `app/(customer)` route group** (customer pages at app root: search/trips/booking/account/auth); **no `app/admin/` segment** (admin realm absent); `app/charter`, `app/op/.../charter`, `app/api/{charter,admin,health}` all absent.
- [OK] `worker/` — spec lists it as Stage-1-only (additive); absence at Stage 0 is expected, not a gap.

---
---

# PART III — CUSTOMER UI · FIXED-PRICE EXTRAS TO DELETE · CHARTER FRAGMENTS

The fixed-price flow was built around a **phone/cash "call-to-confirm" model**, not the spec's
online-only self-serve ticketing — that's the divergence to undo (below). **Charter is now in-scope**
(S16/S17/S18 + SYS19), so the charter/contact UI is a head-start to wire up, NOT delete — see the
final subsection. (Charts/BI orphans remain delete-worthy per S09 OUT.)

### Customer UI
- [WRONG] app/booking/review/ReviewClient.tsx:58-72 — "Online only — no cash; pay-later is OUT of app scope" — checkout offers `cash`/"Tiền mặt" AND defaults to it. Remove cash; default an online rail.
- [MISSING] app/booking/** — "I accept no refund (shown + consented at checkout)" — no consent text/checkbox (only app/terms mentions it).
- [WRONG] components/booking/BookingSummaryRail.tsx:72 — trust line "Nhà xe gọi xác nhận giờ đón & chỗ ngồi qua SMS sau khi đặt" (operator phones to confirm pickup & **seat**) — implies call-to-confirm + seat assignment, contradicting online ticketing + count-based (no seat selection).
- [WRONG] app/page.tsx:71 — hero subcopy "Tìm chuyến, đặt vé, **nhà xe gọi xác nhận**" frames product as phone-confirmation, not instant online pay + QR.
- [OK] app/search/page.tsx:97-136 — few-seats badge, count-based, no seat picker. Correct.
- [OK] components/booking/BookingSteps.tsx + HoldTimer — 3-step flow + hold countdown. Correct.
- [OK] app/globals.css:79 — `--primary: oklch(0.646 0.222 41.116)` ≈ orange (hue ~41). Matches brand memory.
- [OK] components/home/RouteDirectory.tsx + app/routes/** — SEO route directory deep-linking into `/search`. Supports online model.

### Extras to delete (contradict online-ticket scope)
- [EXTRA-DELETE] components/charts/{RevenueLineChart,BookingStatusDonut,ChartTheme}.tsx — S09 OUT (charts/BI); orphaned (no app page imports them). Dead code.

### Charter fragments — NOW IN-SCOPE (wire up toward S16/S17/S18/SYS19, do NOT delete)
> ⚠️ Reclassified from EXTRA-DELETE after the Charter spec was added. These are presentational-only and
> need a `CharterRequest` model + request/dispatch/claim routes + state machine + notifications behind them.
- [PARTIAL→S16] components/contact/ContactBookingForm.tsx (rendered by app/lien-he-dat-xe/page.tsx) — S16 request form front-end; matches the spec field list; **no backend** (client-side success placeholder). Wire to a charter-request POST + `CharterRequest` model.
- [PARTIAL→S16] components/home/ContractCarRental.tsx (app/page.tsx:105) + app/lien-he-dat-xe/page.tsx — legitimate S16 entry point/landing; keep, connect to the real flow.
- [PARTIAL→S16] components/home/IntroBanner.tsx:42-62 (app/page.tsx:108) + components/layout/SiteHeader.tsx:14-18 + SiteFooter.tsx:13-17 — charter CTA/nav links; valid once S16 is built (no longer "links to a to-be-deleted page").

### Operator-side extras (cash/phone workflow — contradict online-only; still DELETE)
- [EXTRA-DELETE] lib/booking/recordCashCollected.ts + app/api/op/bookings/[id]/cash-collected/** — cash collection.
- [EXTRA-DELETE] lib/booking/createManualBooking.ts + app/api/op/trips/[id]/manual-booking/** — operator manual booking.
- [EXTRA-DELETE] lib/booking/recordCallOutcome.ts + app/api/op/bookings/[id]/call-outcome/** + `ContactStatus` enum — call-center outcome workflow.
- [EXTRA-DELETE] lib/booking/markPickedUp.ts + app/api/op/bookings/[id]/picked-up/** + `pickedUpAt` — manual pickup marker (substitute for QR check-in).
- [EXTRA-DELETE] lib/booking/recordEscalation.ts + app/api/op/bookings/[id]/escalation/** + `escalationNote`/`escalatedAt` — escalation notes.
- [EXTRA-DELETE] schema `PaymentMethod`='cash' + `BookingStatus`='pending_cash_payment' + cash branches in initiateBooking.ts/bookingRepo.ts.

---

## NOTES ON METHOD & COVERAGE
- Every token S01–S18 and SYS00–SYS20 has a block above (S15 = N/A ratification list; S16/S17/S18 +
  SYS19 = Charter; SYS20 = Code Organization & Module Boundaries — added in the 2026-06-01 re-audits).
- Dirs reviewed: `app/**` (pages + `app/api/**`), `lib/**`, `components/**`, `prisma/schema.prisma` +
  migrations, plus `e2e/**` spot-checks (manifest/booking-queue specs).
- **2026-06-01 working-tree re-audit (3):** rescanned the uncommitted `feat/ota-redesign` diff
  (modified lib/UI files + new `lib/trips/busOverlap.ts`, `issues/030`, `issues/031`). 3 findings
  drifted to FIXED (search P1 / create-overlap / reassign-overlap — see deltas above); all other
  tokens re-verified UNCHANGED — every absent subsystem (admin, ledger/FeeConfig, charter, Place,
  S3, QR, payment-recon cron, observability, NOTIFY_STUB, lib/core/barrels) is still absent.
- **Coverage gaps now tracked as issues 095–100** (previously NO issue existed): 095 payment-recon
  sweeper, 096 edge rate-limit, 097 customer-search cursor pagination, 098 concurrent-hold cap,
  099 db-pooler (deferrable), 100 hold-lapse refund. 094 (go-live) now depends-on 095 + 100.
- Findings cite real `file:line` or "absent"; OK lines included so the report shows coverage, not only defects.
- Read-only audit — no source file was modified; this report is the only new file.
