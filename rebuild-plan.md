# Bus Booking — Rebuild Plan (Product Source of Truth)

> HOW TO USE (Claude): This file is SECTION-INDEXED. Do NOT read the whole file.
> 1. Find your task in the INDEX below. 2. Grep for that section token (e.g. `[S05]`).
> 3. Read ONLY that section. 4. Verify ONLY the code paths in that section's `Verify:` list.
> Read multiple sections only if the task spans them. Full-file / full-repo scan ONLY if the user explicitly asks.
> Stories were authored without reading the codebase — treat as TARGET spec; reconcile against code during Verify.
> Story sections = WHAT (`[Sxx]`, PART I). System sections = HOW + scale (`[SYSxx]`, PART II).
> For build/verify work, read the `[SYSxx]` for the system PLUS the `[Sxx]` it implements (see each SYS `Implements:` line).

## INDEX
| Token | Section | Read when task touches… |
|-------|---------|--------------------------|
| S01 | Actors & Glossary | any — shared vocabulary |
| S02 | Customer — Search | search, filters, results, trip detail |
| S03 | Customer — Buy & Payment (customer side) | hold, checkout, pay, ticket/QR delivery |
| S04 | Customer — Account & Guest Linking | register/login OTP, history, guest backfill |
| S05 | Operator — Onboarding & Approval | operator signup, KYB, approval gate |
| S06 | Operator — Catalog (Routes/Buses/Trips) | routes, buses, trips, Bus 1:N Trip, overlap |
| S07 | Operator — Bookings & Manifest | per-trip manifest, boarding, check-in |
| S08 | Operator — Money (Ledger & Payout) | balance, ledger, payout, statements |
| S09 | Operator — Dashboard (UI) | operator console layout/nav |
| S10 | Admin — Access & Security | admin auth, separate door, 2FA, roles |
| S11 | Admin — Dashboard (UI) | admin console layout/nav |
| S12 | System — Payments Architecture | PSP adapters, canonical event, central collection |
| S13 | System — Money Correctness | ledger invariants, BigInt, idempotency, locks |
| S14 | System — Trust, Notifications, Cross-cutting | OTP, rate-limit, CSRF, SMS/email, timezone |
| S15 | Open Decisions | un-locked choices to confirm before build |
| S16 | Customer — Charter Request (thuê xe hợp đồng) | charter form, submit, status, cancel |
| S17 | Operator — Charter Marketplace | assigned + public-pool claim, accept/decline |
| S18 | Admin — Charter Dispatch | charter queue, assign/publish/reject, reassign |

## SYSTEM INDEX (PART II — design & build)
| Token | System | Implements | Read when task touches… |
|-------|--------|------------|--------------------------|
| SYS00 | Architecture & Scaling Principles | all | any design/scale decision |
| SYS01 | Data Layer (Postgres/Redis/pooler) | all | schema, queries, connections, N+1 |
| SYS02 | Identity & Access (3 realms) | S04,S05,S10 | auth, sessions, RBAC, tenancy |
| SYS03 | Catalog & Inventory | S05,S06 | routes/buses/trips, guards |
| SYS04 | Search & Discovery | S02 | search/filter/sort/facets |
| SYS05 | Booking & Hold (concurrency) | S03,S07 | holds, seat-sell, oversell |
| SYS06 | Payment | S03,S12 | PSP adapters, webhooks, idempotency, recon |
| SYS07 | Ledger & Payout | S08,S13 | balances, ledger, payout |
| SYS08 | Ticketing (QR/PDF/verify) | S03,S07 | QR token, PDF, verify page |
| SYS09 | Notification | S03,S04,S05,S14 | SMS/email queue, retry |
| SYS10 | Jobs & Scheduler | S06,S08,S14 | cron, sweepers, async backbone |
| SYS11 | File / Document Storage | S03,S05 | S3, signed URLs, KYB docs |
| SYS12 | Onboarding / KYB / Approval | S05 | operator vetting workflow |
| SYS13 | Moderation & Audit / Compliance | S10,S11,S14 | audit log, consent, retention |
| SYS14 | API Gateway / Middleware | S14 | rate-limit, CSRF, auth gating |
| SYS15 | Observability | S11 | logging, errors, health, alerts |
| SYS16 | Analytics (business) | S02,S11 | events, GMV, funnels |
| SYS17 | Config & Feature Flags | S11,S12 | flags, rail toggles, PAYMENTS_STUB |
| SYS18 | Frontends (customer/operator/admin) | S02–S11 | UI apps |
| SYS19 | Charter / Contract-Rental | S16,S17,S18 | charter request, dispatch, first-accept claim race |
| SYS20 | Code Organization & Module Boundaries | all | folder layout, module rules, where new code goes |

---

## [S01] Actors & Glossary

**Actors**
- **Customer** — traveler searching + buying tickets.
- **Operator** — bus company selling trips (has a fleet).
- **Admin** — platform staff overseeing the marketplace.
- **Platform/System** — cross-cutting invariants (money, trust, notifications).

**Glossary**
- **Trip** = one departure (a specific bus + route + date/time). Bookable unit.
- **Bus (car)** = physical vehicle. **Bus 1:N Trip** — one bus runs many trips over time.
- **Route** = origin + destination + duration. A trip references a route.
- **Hold** = temporary seat reservation with TTL during checkout.
- **Manifest** = passenger list for ONE trip (always trip-scoped, never bus-aggregate).
- **orderRef** = booking reference; used as the payment correlation key (= VietQR memo for transfers).
- **Canonical payment event** = `{orderRef, providerTxnId, amount, currency, status}` normalized from any PSP. (Idempotency dedups on `providerTxnId` — one pinned name everywhere.)
- **available seats** = `capacity − paidSeats − activeHeldSeats` (NOT raw capacity). The bookable predicate everywhere.
- **Booking model** = count-based (customer buys N tickets / `seatCount`). NO seat selection / seat map — trips expose total + available seat *counts* only. Seat numbers are not assigned.
- **Ledger entry types** = `booking_credit | platform_fee | refund_debit | refund_out | payout_debit | payout_reversal | chargeback | adjustment`.
- **Place** = canonical normalized city/stop entity (feeds route creation + search typeahead; dedupes "Ha Noi/Hanoi/HN").
- **Booking money-state** = `paid` (money truth). Notification delivery is tracked separately in `NotificationLog` — never folded into booking state.

Status: TODO

---

## [S02] Customer — Search

**Stories**
- As traveler, want enter origin, destination, date, ticket count, so I find matching trips.
- As traveler, want typeahead suggest place names, so I pick the right city fast.
- As traveler, want blocked from picking past dates (auto-redirect to today), so I don't search useless dates.
- As traveler, want see trips with operator, departure + arrival time, duration, bus type, price, seats left, so I compare.
- As traveler, want a warning when few seats left, so I act fast.
- As traveler, want filter by operator, bus type, departure window, max duration, price range, so I narrow to fit.
- As traveler, want sort by departure, price, or duration, so the best option shows first.
- As traveler, want next/previous-day jump when no trips, so I find a nearby date.
- As traveler, want a clear empty-state message when zero results, so I'm not confused.
- As traveler, want the search URL to keep my filters on share/refresh, so I can resume or send it.
- As traveler, want a trip detail page (pickup points, operator phone, full info), so I trust before booking.

**Design**
- URL is the single source of truth (share/refresh preserves filters). RSC results page.
- NO "remember last search" persistence (explicitly dropped).
- Past date → redirect to today (Asia/Ho_Chi_Minh).
- Search excludes (in `where`): cancelled, sales-closed, maintenance-overlap, **`available seats` (= capacity − paidSeats − activeHeldSeats) < ticketCount**, and (S14) non-approved operators. NOTE: filter on available seats, never raw capacity.
- Trips show total + available seat COUNTS; customer never picks a specific seat (count-based).
- Typeahead is backed by the canonical **`Place`** entity (S01 glossary / SYS03) — not free-text route columns.
- Filters/sort applied over base result set; facets from unfiltered set.
- **Pagination**: cursor/seek pagination on results (a popular route overflows one response).
- Rate-limit search API by IP.

Verify: `app/page.tsx`, `app/search/page.tsx`, `lib/db/searchTrips.ts`, `lib/validation/search.ts`, `app/trips/[id]`.
Status: TODO
> RESOLVED (#1 available-seats predicate, #13 Place entity, #22 pagination).

---

## [S03] Customer — Buy & Payment (customer side)

**Stories**
- As traveler, want to book without an account (guest checkout), so I buy fast.
- As traveler, want enter buyer **name + phone + email**, so the operator can reach me + I get my ticket.
- As traveler, want seats **held** while I check out, so they aren't stolen mid-flow.
- As traveler, want a **hold countdown**, so I know my time window.
- As traveler, want to review trip + price + buyer info before paying, so I confirm it's correct.
- As traveler, want to pay from **any offered rail** (VietQR/bank transfer, domestic debit, Visa, PayPal, MoMo), so I'm not blocked. **Online only — no cash.**
- As traveler, want payment confirmed the same way regardless of method, so I always get a paid ticket.
- As traveler, want a **booking reference**, so I can track my ticket.
- As traveler, want, after payment, a **ticket QR + scannable link** sent by **SMS + email (PDF)**, so I show proof at boarding.
- As traveler, want the QR/link to open a **read-only verification page** (ref, trip, seats, PAID, txn) without login, so anyone scanning confirms genuine + paid.
- As traveler, want my **ticket/QR to show the bus plate + type + departure**, so I find the right car at the station.
- As traveler, want a clear message on payment fail/pending/expired, so I know to retry or rebook.
- As traveler, I **accept no refund** if I cancel or no-show on an online-paid ticket *(shown + consented at checkout)*.
- As traveler, if the **operator cancels my trip**, want a **refund (default) or optional rebooking**, so I'm not charged for unrendered service. *(S15#2: refund is the locked default.)*

**Design**
- Booking unit = ticketCount (seat COUNT). No seat-map/seat-picker step in the flow.
- Flow: pick trip → POST hold (TTL) → /booking/customer (buyer info) → /booking/review (countdown) → initiate → PSP → webhook confirms.
- Pay-later = customer phones operator directly (OUT of app scope).
- Ticket QR/link = signed read-only token; **the public verification page is the source of truth** for plate/type/departure/status (the emailed PDF is a snapshot — see SYS08; reassign regenerates/invalidates it).
- No-refund applies to **customer-initiated** cancel/no-show only. Money DOES flow back (refund-out, SYS06/SYS07) for: operator-cancel (default refund), oversold-race, and bank-transfer overpayment (refund the difference). Underpayment → booking stays unpaid.
- Notification (SMS + email PDF) is **deferred to a stub day-1** (`NOTIFY_STUB`, parallel to `PAYMENTS_STUB`) — see SYS09.

Verify: `app/booking/**`, `app/api/holds/**`, `app/api/bookings/initiate/**`, `lib/booking/**`, payment routes (see S12).
Status: TODO
> RESOLVED (#3 refund-out + overpayment, #7 op-cancel default=refund → S15#2, #2 verify-page source-of-truth, #23 NOTIFY_STUB).
> RATIFIED 2026-06-01 (S15): cash deletion = phased A-then-B (kill creation paths now; drop enums/cols later migration); add `Booking.buyerEmail` now; split `paid_operator_notified`→`paid` (Phase B).

---

## [S04] Customer — Account & Guest Linking

**Stories**
- As returning customer, want to **register via phone + OTP**, so my account is secure.
- As returning customer, want to **log in via phone + OTP**, so I reach my bookings.
- As logged-in customer, want my **name + phone prefilled** at checkout, so I don't retype.
- As guest, want my **buyer info (name/phone/email) saved with the booking**, so the operator can serve me + I can retrieve it later.
- As returning customer, when I **register/login with the same phone (OTP-verified)**, want my **past guest bookings auto-linked**, so all history is in one place.
- As logged-in customer, want a **bookings list** (upcoming / past) with status, so I track travel.
- As logged-in customer, want **booking detail + re-download ticket** anytime, so I re-access it.
- As locked-out user, want clear **OTP attempt + rate limits**, so abuse is blocked but I understand the wait.

**Design**
- Guest booking: `customerId = NULL` + buyer snapshot (name/phone/email). No Customer row created for guests.
- Phones stored **normalized to E.164** on write.
- Link guest→account **only on OTP-proven phone at register/login** — NEVER blind phone-match, NEVER at payment time (spoofable). Backfill is **idempotent** (claims only `customerId IS NULL` rows matching phone).
- Privacy: guest PII storage needs retention + consent notice (flag for legal).
- **Data-subject erase (VN PDPD 2023)**: on account-deletion request → **anonymize-in-place** booking rows (scrub buyer name/phone/email, retain money/audit + financial totals), hard-delete account credentials/session rows. Erase ≠ delete financial history.
- Account bookings-list status badges read the **`paid`** money-state (+ NotificationLog for delivery), never a combined `paid_operator_notified` flag.

Verify: `app/auth/**`, `app/api/auth/**`, `lib/auth/**`, `lib/booking/attachGuestBookingByPhone.ts`, `app/account/**`.
Status: PARTIAL
> RESOLVED (#27 anonymize-in-place erase, #12 status reads `paid`).
> RATIFIED 2026-06-01 (S15): login = phone + **password** (OTP proves phone at register only); no OTP-every-login.
> VERIFIED 2026-06-05: OTP register/reset/phone-change flows, attempt-cap (5) + lockout-sentinel (3/15min), rate-limit (3/15min), proof-JWT jti replay, guest-link backfill all implemented + tested. Only outstanding item: real eSMS HTTP provider (`lib/notification/esms.ts` is a contract-complete stub) — deferred to go-live. PARTIAL until SMS provider wired.

---

## [S05] Operator — Onboarding & Approval

**Stories**
- As new operator, want to **register + submit business / identity / payout-account docs**, so I can apply to sell.
- As operator, after submitting, want a **confirmation page** (ref number + next steps), so I know it went through.
- As operator, want a **pending email** stating the **review SLA range** + my ref, so I know when to expect a decision.
- As operator, want to **check my application status** anytime (pending / under review / approved / rejected), so I'm not guessing.
- As operator, want a **decision email** both ways (approved → go live / rejected → reason + resubmit), so I know the outcome.
- As pending operator, want to **set up buses, routes, draft trips while waiting**, so I'm ready on approval.
- As operator, want my trips **hidden from customers until approved**, so I never sell before clearance.
- As suspended operator, want listings pulled + a reason, so I know to resolve it.

**Design**
- State machine: `PENDING_REVIEW → UNDER_REVIEW → APPROVED | REJECTED`; `REJECTED → PENDING_REVIEW` (resubmit); `APPROVED ↔ SUSPENDED`. (4 statuses match the story's "pending / under review / approved / rejected".)
- Per-state caps: pending/under-review = login + draft setup, NO sell/search-visibility/payout. Approved = full. Rejected = resubmit (re-enters PENDING_REVIEW). Suspended = read + frozen payout, listings hidden.
- KYB/payout-account-ownership verify method: micro-deposit or name-match against the registered payout account (admin confirms at approval — SYS12).
- Pending email uses **SLA RANGE** ("within 2 business days"), NOT an exact countdown.
- Every state change triggers a notification.
- Approval gate enforced in search query + re-checked at booking (S14).

Verify: operator register routes, operator status field/enum, search exclusion of non-approved operators.
Status: TODO
> RESOLVED (#8 UNDER_REVIEW + resubmit edge; KYB verify method specified).

---

## [S06] Operator — Catalog (Routes / Buses / Trips)

**Stories**
- As operator, want to create/edit **routes** (origin, destination, duration), so trips appear in search.
- As operator, want to manage **buses** (plate, type, capacity), so customers see correct info + I identify the real vehicle.
- As operator, want to create/edit **trips** (route + bus + departure + price), so customers can find + book. *(operator = price authority)*
- As operator, want to assign **one bus to many trips** over time + **preset future trips**, so I run my fleet + publish schedule early.
- As operator, want a **"repeat daily/weekly until date"** option *(fast-follow)*, so I don't hand-create every departure.
- As operator, want to **reassign a different bus** to a trip (breakdown), with capacity + overlap re-checked, so I swap cars safely.
- As operator, want **overlapping trips on the same bus blocked**, so I never double-book a vehicle.
- As operator, want to set **maintenance windows** on a bus, so its trips auto-hide from search.
- As operator, want to **cancel** a trip (flipping bookings to trip_cancelled + triggering **refund-out** to customers, S15#2 default), so customers aren't stranded.
- As operator, want to **close sales / mark departed / mark completed**, so the trip lifecycle is accurate.
- As operator, want **capacity enforced** against `available seats` + a **capacity reduction blocked** below already-sold seats, so I never oversell/orphan a booking.

**Design**
- **Bus 1:N Trip** (one car, many departures). Repeat / change-bus / preset-future all supported by this model.
- Availability everywhere = `capacity − paidSeats − activeHeldSeats` (never raw capacity). "Already-sold" for the capacity-reduction guard = **paid + active-held** seats.
- **Overlap guard**: two non-cancelled trips on the same bus must not overlap window `[departureAt, departureAt + durationMinutes + BUFFER]` with **BUFFER = 60 min** (turnaround). Enforced on create + reassign, inside a transaction with `SELECT … FOR UPDATE` row lock.
- **Reassign** re-validates: new bus not overlapping + capacity ≥ already-sold seats. On reassign → **invalidate + regenerate the ticket PDF** and **notify affected customers** of the new plate (S15#4 default = yes). The public verify page (SYS08) is the live source of truth for the plate.
- **Trip mutation after sales** (S15#6 default): once any seat is **paid**, **price + departureAt are LOCKED**; a material change ⇒ cancel + rebook (refund-out + re-sell). Non-material edits (pickup notes) allowed.
- MVP scheduling = one-off trips; bulk-repeat = fast-follow; full recurrence engine = later (do not build early).
- Status enum writes pair with `<verb>At` timestamp writes (see Mistake Log Issue 014 pattern).

Verify: `app/api/op/buses/**`, `app/api/op/trips/**`, `lib/buses/**`, schema Trip/Bus/Route, status enums.
Status: TODO
> RESOLVED (#1 available-seats, #2 regenerate PDF on reassign, #7 cancel→refund default, overlap BUFFER=60min + sold=paid+held defined, #20 lock price+departure after sale → S15#6).
> RATIFIED 2026-06-01 (S15): enforce price-lock-after-paid-seat now; recurrence engine = **keep + harden** (fix generate-trips cron lock) marked fast-follow-delivered; **delete** paired-return + block-seats (+ `Trip.blockedSeats`).

---

## [S07] Operator — Bookings & Manifest

**Stories**
- As operator, want a **bookings list per trip/date** (filter by service date, VN timezone), so I prep each day.
- As operator, want **booking detail** (buyer name/phone/email, seats, ref, status), so I verify passengers.
- As operator/staff, want to click a bus → its **upcoming trips** → a trip → the **passenger manifest**, so I know who boards which departure.
- As operator, want bus detail to default to the **next/today's departure manifest**, so boarding is one click.
- As operator/staff, want to **scan the ticket QR at boarding** → verify real + paid (amount, txn), so I trust before boarding.
- As operator, want a **checked-in state after scan**, so the same ticket can't be reused.
- As operator, want to mark **no-show**, so the manifest stays accurate.

**Design**
- **Manifest is ALWAYS trip-scoped** (one departure) — never "all passengers on a bus" (different dates would mix).
- Manifest lists passengers by booking with seat COUNT, NO seat numbers (free-seating / seated at boarding by operator).
- Two lenses on same passengers: Fleet view (per-car → trip → manifest) vs Bookings view (per-day cross-fleet).
- Scan/check-in is single-use, enforced by an **atomic conditional update** `UPDATE … SET checkedInAt = now() WHERE id = ? AND checkedInAt IS NULL` (rowcount 0 = already checked in) — handles two staff scanning the same ticket at once.
- Bookings/Trips lists are **paginated** (cursor/seek) — a busy operator overflows one response.

Verify: `lib/booking/listOperatorBookings.ts`, operator bookings routes, ticket-verify endpoint.
Status: TODO
> RESOLVED (#19 atomic check-in, #22 pagination).

---

## [S08] Operator — Money (Ledger & Payout)

**Stories**
- As operator, want a **balance** on the app (pending / available / paid-out), so I see what I've earned + can take.
- As operator, want a **ledger** of every entry (booking credit, platform fee, refund, payout), so I reconcile to the cent.
- As operator, want money **available at trip completion** (no long refund hold — customer refunds don't exist), so I'm paid sooner.
- As operator, I accept **trip cancellation claws back** the related credit (to refund the customer), so the platform isn't left liable.
- As operator, want to **register a payout bank account**, so I receive my share — *I never give the platform read access to my bank; I only receive payouts.*
- As operator, want **payout** of my available balance (auto T+N and/or on-demand — see S15), so I get my money.
- As operator, want a **payout statement** (bookings, gross, fee, net, date paid), so I match it to my bank deposit.

**Design**
- Money states: paid (trip future) → CREDIT net but **PENDING** → trip completes → **+ settlement delay (T+1, S15#5 default)** → **AVAILABLE** → payout → PAID OUT. The settlement delay (not "immediate") leaves a dispute/chargeback buffer.
- Operator-cancel before trip → **refund-out** to customer (SYS06) → reverse/clawback credit (`refund_debit`).
- **Chargeback** (card/PayPal dispute, can land AFTER payout): `chargeback` ledger entry + `payout_reversal` clawback against operator balance; if balance insufficient → platform bad-debt backstop (S15#7 default). Dispute handled in admin Finance (S11).
- Platform fee read from **`FeeConfig`** (global rate + per-operator override, effective-dated, change-audited) at credit time; fee is its own ledger entry (S13).
- Platform only ever **reads its own account** + **sends** to operators (sending needs only account number, no read access).

Verify: ledger model, payout routes, `lib/payouts/**`. (Invariants in S13.)
Status: TODO
> RESOLVED (#6 settlement delay T+1 → S15#5, #4 chargeback/payout_reversal + liability → S15#7, #18 FeeConfig).

---

## [S09] Operator — Dashboard (UI)

**Nav (6 + banner):** `Overview · Fleet · Trips · Bookings · Money · Settings` + Approval banner (while pending).

- **Overview** — read-only: Today box (trips/seats/next departure/departing-soon), Fleet box (vertical list: plate, status ●svc/🔧mnt, next departure), Money box (available/pending + Withdraw), Alerts (failed payout, trip missing bus, approval status).
- **Fleet** (per-car) — fleet list (plate/type/capacity/status/next departure) → bus detail (info + maintenance + reassign) → its upcoming trips → **trip manifest** (defaults to next departure). Add/edit bus, set maintenance.
- **Trips** (per-departure) — list (date filter): route/time/bus-plate/price/sold-total/status. Create trip (overlap+maintenance checked). Bulk repeat (fast-follow). Per-trip: reassign bus, cancel, close-sales, mark-departed, mark-completed, view manifest. **Routes** sub-tab here.
- **Bookings** (per-day cross-fleet) — default today; filter by service date (VN tz)/trip/status; list (buyer/phone/seats/ref/plate/status); detail; scan QR/check-in; mark no-show.
- **Money** — balance (3 numbers) + ledger + payout (withdraw / next auto-payout) + statements.
- **Settings** — profile (company name, contact phone), payout bank account, staff (role-scoped), first-login forced password change.
- **Approval banner** (pending only) — "Under review — SLA. Set up buses + draft trips now; publishing unlocks on approval." Blocks publish/sell; rest usable.

**OUT (keep simple):** charts/BI, separate Routes/Buses/Trips top tabs, in-app chat, dynamic pricing/promos, custom report builder.
**Build order:** Fleet+Trips → Bookings → Money → Settings → Overview.

Verify: `app/op/**` pages.
Status: TODO

---

## [S10] Admin — Access & Security

**Stories**
- As platform, want admin on a **separate, unlinked entry point** with its own credential store, so it's never reachable via the customer/operator login.
- As platform, want admins **invite-only (no self-registration)**, so no one grants themselves access.
- As admin, want **email + password + mandatory 2FA (TOTP)** (NOT SMS-OTP), so high-privilege accounts resist SIM-swap.
- As platform, want **step-up re-auth + audit logging** on money/approval actions, so privileged ops are protected + traceable.
- As platform, want **role tiers (super-admin / finance / support)**, so least-privilege is enforced.

**Design (security-critical — do not compress in code/comments)**
- Separate door: `admin.` subdomain or `/admin`, NOT linked from public site, NOT the `/auth/login` page.
- Admin accounts in a **distinct table/role**, never in customer/operator tables. No public registration path exists.
- Auth: email + password + mandatory TOTP. Optional SSO/SAML. Optional IP allowlist. Short session TTL. Strict rate-limit.
- Step-up re-auth (re-prompt 2FA) for payouts, refunds, fee changes, operator approval.
- Audit-log every privileged action (who/what/when), read-only + exportable.
- **Door posture (S15#8 default)**: Stage 0 = one Next.js app, `/admin` route segment, BUT with a **separate credential store (distinct table), separate cookie scope, strict exact-match middleware allowlist, mandatory TOTP** — weaker than a subdomain, accepted explicitly. Stage 1 = split to a subdomain / separate deployment.
- **First super-admin bootstrap**: seed/break-glass account provisioned out-of-band (migration seed or sealed env credential), never via a public path.
- **Lost-TOTP recovery**: reset by another super-admin; if none, a sealed break-glass procedure. No self-service reset. No operational dead-end.

Verify: admin auth routes, admin role model, middleware guard (Edge-safe JWT claim pattern per Mistake Log Issue 010).
Status: TODO
> RESOLVED (#17 bootstrap + TOTP recovery, #10 door posture → S15#8).

---

## [S11] Admin — Dashboard (UI)

**Nav (7):** `Overview · Approvals · Users · Operators · Finance(step-up) · Moderation · System`.

- **Overview** — action queue (pending approvals, open disputes, failed payouts) + business metrics (total customers/operators, GMV, bookings, revenue) + failure alerts (payment webhook / payout / SMS-email). Infra health (uptime/latency/errors) **links out to Sentry/Datadog — NOT rebuilt here.**
- **Approvals** — review queue of pending operators + submitted docs, verify payout-account ownership, approve / reject (reason) / request-more-info. Audit-logged.
- **Users** — search customers + operators (both kinds = "total users"), user detail, suspend/reinstate.
- **Operators** — all operators + status, operator detail (fleet/trips/volume/balance/payout history), suspend/reinstate, per-operator fee override.
- **Finance** (step-up auth) — payout oversight (queue/approve/retry), ledger view (any operator) + manual adjustments (immutable entry, reason required), **refund-out execution** (operator-cancel/oversold/overpay) + **chargeback/dispute flow** (`chargeback` + `payout_reversal`, liability per S15#7), **FeeConfig** (global rate + per-operator override, effective-dated, change-audited).
- **Moderation** — disable bad trips/routes, flagged content/reports.
- **System** — feature flags + payment-rail toggles (incl. `PAYMENTS_STUB`), admin accounts (invite/revoke/roles — super-admin only), audit log (read-only, exportable).

**OUT:** custom BI/charts, in-app comms, editing operator catalog for them (moderate = disable, don't edit), admin self-registration.

Verify: `app/admin/**` (or wherever admin lives).
Status: TODO

---

## [S12] System — Payments Architecture

**Stories**
- As platform, want all customer payments collected into the **platform account**, so confirmation needs read access to only one account — never operators' banks.
- As platform, want **one aggregator/PSP** covering all VN banks' cards + QR + wallets, so I don't integrate banks one by one.
- As platform, want a **per-provider adapter** mapping each provider's webhook → one **canonical event** `{orderRef, providerTxnId, amount, currency, status}`, so booking logic stays provider-agnostic.
- As platform, want payment **matched by orderRef + amount/currency verified server-side**, so short/wrong payments are rejected.
- As platform, want webhook handling **idempotent (dedup by providerTxnId)**, so duplicate webhooks never double-confirm.
- As platform, want truth from the **server-side webhook, never the client redirect**, so success can't be faked.

**Design**
- **Central collection (Model A)**: money → platform account; platform pays out operators (S08). Forced by "no read access to operator banks."
- Customers pay from any VN bank/card/wallet, but funds land in ONE platform account → watch only that account. Bank-transfer confirmation via reconciliation service (SePay/Casso/PayOS) webhook; card/wallet via PSP webhook.
- **orderRef** (= bookingRef) attached to each charge as provider metadata (= VietQR memo for transfers); webhook echoes it back → match. Memo has a **fixed format + length constraint**. Because banks truncate/strip/edit memos, define a **degraded match** = `amount + receiving-account + time-window` when memo is missing/garbled (owned by the recon sweeper, SYS06).
- Pay start creates `Payment(orderRef, amount, currency, provider, status=pending)` BEFORE charge.
- Webhooks per provider (own signature/HMAC), each adapter emits canonical event → shared core: match by orderRef, verify amount≥stored + currency, idempotent dedup by **providerTxnId**, transition booking → paid → notify + ticket QR.
- **Monotonic transitions**: the payment/booking state machine **rejects backward transitions** (paid ✗→ pending). Out-of-order or replayed webhooks that would regress state are ignored.
- **App Store / Google Play IAP EXCLUDED** — physical service; Apple forbids IAP for real-world goods + takes 15–30%.
- Webhooks are CSRF-exempt, HMAC/signature-verified.
- VND-only ledger day-1 (S15#3): foreign cards/PayPal charge in VND, no FX.

Verify: `lib/payment/**`, `app/api/payments/**`, webhook handlers.
Status: TODO
> RESOLVED (#11 providerTxnId pinned, #14 memo constraint + degraded match, #15 monotonic transitions, #21 VND-only).

---

## [S13] System — Money Correctness

**Design (invariants)**
- **Append-only double-entry ledger** per operator; never a mutable balance column. Balance = SUM(entries) (derived or materialized + reconciled).
- **Immutability enforced at the DB level**: revoke UPDATE/DELETE on the ledger table for the app role (or a BEFORE UPDATE/DELETE trigger that raises) — append-only is enforced, not a convention.
- Entry refs its cause (`bookingId?`/`payoutId?`) + `sourceEventId` for idempotency. Types: `booking_credit | platform_fee | refund_debit | refund_out | payout_debit | payout_reversal | chargeback | adjustment`. Fee = its own entry (not baked into credit).
- **refund-out execution** (money leaving back to customer) = PSP-refund call + a `refund_out` entry, with its own idempotency key (distinct from the inbound payment). Triggers: operator-cancel, oversold-race, overpayment-difference.
- **chargeback** (bank dispute, possibly post-payout) = `chargeback` entry + `payout_reversal` clawback; liability = operator, platform bad-debt backstop (S15#7).
- Money = integer minor units (VND) + **BigInt** math. ES2017 target → use `BigInt()` constructor, NOT `n` literal suffix (parser error). Any `Math.round(int * fractional)` in money code = bug. **Single-currency (VND) assumption** holds while S15#3 = VND-only; multi-currency would need per-currency columns + FX (deferred).
- Platform fee rate read from **`FeeConfig`** (global + per-operator override, effective-dated, change-audited) — not a hard-coded constant.
- Withdrawals: inside `$transaction` with `SELECT … FOR UPDATE` on operator balance/gating row, re-check available ≥ amount → no double-withdraw race. Idempotent.
- Min-withdraw threshold + payout state machine: `requested → processing → paid | failed`.
- `refund_debit`/`refund_out` fire for operator-cancel/no-service/oversold/overpay — customer-initiated cancels debit no one (no-refund policy).
- Money becomes AVAILABLE at trip completion **+ settlement delay (T+1, S15#5)**; PENDING before (clawback/dispute window).

Verify: ledger model, payout transaction code, `lib/payouts/**`.
Status: TODO
> RESOLVED (#24 DB-enforced immutability, #3 refund_out, #4 chargeback/payout_reversal, #18 FeeConfig, #21 single-currency flagged → S15#3, #6 settlement delay).
> RATIFIED 2026-06-01 (S15): settlement = **T+1 now** (constant `THREE_DAYS_MS`→`ONE_DAY_MS`), config-ify with ledger; operator-cancel **refund-out = fast-follow** with the ledger/recon subsystem.

---

## [S14] System — Trust, Notifications & Cross-cutting

**Design**
- **Approval gate**: only APPROVED operators' trips in search AND re-checked at booking-initiate (defense in depth).
- **Identity**: OTP-verified customers; KYB-vetted operators; admin separate hardened auth (S10).
- **Tenant isolation**: operator console scoped to own data only; staff role-scoped; no cross-operator leakage.
- **Notifications**: SMS confirm + email PDF (+ ticket QR/link). **Async/queued with retry**, logged in `NotificationLog`. Any cron/sweeper predicate (e.g. T+N payout) = **top-level indexed column** (`scheduledFor`) with `@@index([template, scheduledFor])`, NEVER a JSON-payload key.
- **Edge security**: rate-limit + CSRF (double-submit `bb_csrf`) on **all non-safe `/api/*` (customer + operator + admin)**; webhooks exempt (HMAC). Client helper + e2e CSRF prime must ship same commit as any new gate (matches Mistake Log Issue 007).
- **Timezone**: store UTC; business/service date = Asia/Ho_Chi_Minh. Test date derivation must match the filter's timezone (offset math or `Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Ho_Chi_Minh'})`).

Verify: middleware/`proxy.ts`, `lib/notifications/**`, NotificationLog model, rate-limit + CSRF helpers.
Status: PARTIAL
> RESOLVED (#9 CSRF on all non-safe /api/* except HMAC webhooks).
> VERIFIED 2026-06-05: OTP-verified identity, CSRF double-submit on all non-safe `/api/*` (HMAC webhooks exempt), rate-limiting, NotificationLog with top-level `scheduledFor` index all implemented + tested. Outstanding: real eSMS/email delivery provider (stubbed) — deferred to go-live. PARTIAL until providers wired.

---

## [S15] Open Decisions (post-review: each carries a LOCKED DEFAULT — confirm or override)

Each item now has a recommended default baked into the affected sections. "confirm" = user should ratify or override before building that area; the spec is internally consistent against these defaults so work isn't blocked.

1. **Payout cadence** → DEFAULT **both** (auto T+N + on-demand withdrawal above a min threshold). (S08/S13) — confirm.
2. **Operator-cancel remedy** → DEFAULT **refund-out** (rebooking optional convenience). (S03/S06/S08) — confirm.
3. **Launch rails + currency** → DEFAULT **VND-only** day-1 (foreign cards/PayPal charge in VND, no FX; multi-currency deferred). Rails day-1 still to pick (e.g. VietQR + MoMo + card). (S12/S13) — confirm.
4. **Bus reassignment notification** → DEFAULT **yes — notify affected customers + regenerate/invalidate ticket PDF**. (S06/SYS08/S14) — confirm.
5. **Available-balance timing** → DEFAULT **trip completion + T+1 settlement delay** (dispute/chargeback buffer; not immediate). (S08/S13) — confirm.
6. **Trip mutation after sales** (NEW) → DEFAULT **lock price + departureAt once any seat is paid**; material change ⇒ cancel+rebook; non-material edits allowed. (S06) — confirm.
7. **Chargeback liability** (NEW) → DEFAULT **operator bears** (`payout_reversal` clawback); platform bad-debt backstop only if operator balance insufficient. (S08/S13/S11) — confirm.
8. **Admin deployment posture** (NEW) → DEFAULT **Stage 0 one-app `/admin` segment** (separate credential store + cookie scope + strict middleware + TOTP); **Stage 1 subdomain/separate deploy**. (S10/SYS18) — confirm.
9. **Charter payment model** (NEW) → DEFAULT **lead-gen / operator-direct** (price negotiated operator↔customer offline; optional platform referral fee invoiced later). Alt: platform-collected deposit + ledger + fee. (S16/SYS19) — confirm.
10. **Charter quote flow** (NEW) → DEFAULT **operator quotes/finalizes with customer AFTER accepting** (off-platform MVP). (S16/S17/SYS19) — confirm.

**Confirmed (NOT open):** booking is **count-based — no seat selection**. Seat-map = future REMODEL only (SYS05).

### RATIFIED 2026-06-01 (narrow grill against `rebuild-mismatches.md`)

`rebuild-plan.md` confirmed as the **authoritative target** (online-only); deployed cash/call-to-confirm
model is **legacy to delete**. The 10 code-vs-spec conflicts the audit surfaced are now decided:

1. **Cash / call-to-confirm deletion** → **PHASED A-then-B.** Phase A (now): kill creation paths —
   remove `cash` from customer initiate route + `ReviewClient` default; delete `initiateCashBooking`,
   `createCashBookingFromHold`, `createManualBooking`, and the 4 operator-workflow routes
   (cash-collected / call-outcome / picked-up / escalation). Phase B (follow-up, reviewed migration
   after checking for live `pending_cash_payment` rows): drop `PaymentMethod='cash'`,
   `BookingStatus='pending_cash_payment'`, `ContactStatus`, `pickedUpAt`/`escalationNote`/`escalatedAt`
   columns + clean read-side branches. (S03/S07 — supersedes S15 silence on sequencing.)
2. **Settlement delay** → **T+1 now (constant `THREE_DAYS_MS`→`ONE_DAY_MS`)**; promote to a real
   FeeConfig-style platform setting when the ledger lands. Ratifies S15#5.
3. **Operator-cancel refund-out** → **FAST-FOLLOW with the ledger/payment-recon subsystem** (needs the
   PSP refund rail + `refund_out` ledger entry). Cancel still flips bookings to `trip_cancelled` today.
   Ratifies S15#2 outcome, defers timing.
4. **Lock price after first paid seat** → **ENFORCE NOW** (block price PATCH once any seat paid).
   Ratifies S15#6; bundles with the P1 fixes.
5. **Recurrence engine** (`RecurringTripTemplate` + cron) → **KEEP + HARDEN** (fix the `generate-trips`
   cron advisory-lock race, SYS10). Already built/tested; deleting then rebuilding for the planned
   fast-follow is waste. Mark S06 recurrence as **fast-follow-delivered**, not "do not build early".
6. **paired-return + block-seats** → **DELETE BOTH** (no spec story; block-seats contradicts
   count-based). Remove routes/libs + `Trip.blockedSeats` column (Phase B migration). (S06)
7. **Login auth** → **RATIFY PASSWORD** (phone + password; OTP proves phone at register only). Update
   S04 — no OTP-every-login. Lower SMS cost / friction.
8. **buyerEmail** → **ADD NOW** (`Booking.buyerEmail` column + form field). Unblocks SYS08 email-PDF,
   avoids a second Booking migration. Email *delivery* stays a later issue. (S03)
9. **Charter payment** → **LEAD-GEN / operator-direct** (off-platform quote after accept; no charter
   payment rail). Ratifies S15#9/#10.
10. **Booking money-state** → **SPLIT** `paid_operator_notified` → `paid` (notification fact stays in
    `NotificationLog`). Bundle with the Phase B enum migration. (S01/#12)

Status: **RATIFIED 2026-06-01.** Items 1–10 above decided this session. Original LOCKED DEFAULTS stand
except where a ratified item overrides/refines them (see #2/#3/#4/#9 mapping to S15#5/#2/#6/#9-10).

---

## [S16] Customer — Charter Request (Dịch vụ thuê xe hợp đồng)

**Stories**
- As traveler, want to request a **charter car** for a short tourism/visiting trip, so I get a private vehicle for my itinerary.
- As traveler, want to fill a **request form** (pickup, destination(s), date(s)/duration, passenger count, vehicle type, budget, contact name/phone/email, notes), so operators understand my needs.
- As traveler, want to submit **without an account (guest allowed)** but provide contact info, so I can request fast.
- As traveler, want a **confirmation** (ref + what happens next), so I know it was received.
- As traveler, want to be **notified when an operator is matched/accepts** (with operator contact), so I can finalize details.
- As traveler, want **status visibility** (submitted → under review → matched → confirmed), so I'm not in the dark.
- As traveler, want to **cancel before an operator accepts**, so I'm not committed if plans change.

**Design**
- `CharterRequest` entity (SYS19); **guest-allowed** (contact snapshot), optional `customerId` if logged in.
- Pickup/destinations reference the canonical **`Place`** entity (SYS03).
- **Payment = lead-gen default** (S15#9): price negotiated operator↔customer; NOT the fixed-price online rail. Charter is a contract-matching service.
- Notifications via SYS09 (`NOTIFY_STUB` day-1); rate-limited + spam-guarded.

Verify: charter request route/form, `components/home/ContractCarRental.tsx`, CharterRequest model.
Status: TODO

---

## [S17] Operator — Charter Marketplace

**Stories**
- As operator, want a **Charter tab** showing requests **assigned to me** by admin, so I can review + accept.
- As operator, want a **public pool** of open charter requests, so I can claim ones I can serve.
- As operator, want **first-accept-wins** on public requests, so there's no double-assignment dispute.
- As operator, want to **accept/decline** a directly-assigned request, so admin can reassign if I decline.
- As operator, want an **accepted-contracts list** with customer contact + details, so I fulfill the trip.
- As operator, want **notified** on assignment / new public request / win/loss, so I act fast.

**Design**
- Only **APPROVED** operators see/claim charter (trust gate, S14).
- Public claim = **atomic conditional update** (`WHERE status='published' AND assigneeOperatorId IS NULL` → set assignee + status='accepted'); losers get **409 already-claimed**.
- Direct-assignment decline → request returns to admin (ADMIN_REVIEW).

Verify: operator charter routes, claim handler, operator console Charter tab (`app/op/**`).
Status: TODO

---

## [S18] Admin — Charter Dispatch

**Stories**
- As admin, want a **queue** of incoming charter requests, so I triage them.
- As admin, want to **assign a request directly to a chosen operator**, so trusted operators get specific jobs.
- As admin, want to **publish a request to the public pool** (first-accept-wins), so it gets filled fast.
- As admin, want to **reject** spam/invalid requests (reason), so the pool stays clean.
- As admin, want to **see status + reassign** when an assigned operator declines or a published request expires, so nothing stalls.
- As admin, want **notified** of new charter requests, so I dispatch promptly.

**Design**
- Per-request choice: `ASSIGN_DIRECT(operatorId) | PUBLISH | REJECT`.
- Published-but-unclaimed → **EXPIRE** after a window → back to admin (ADMIN_REVIEW).
- Every dispatch action audit-logged (SYS13).

Verify: admin charter queue (`app/admin/**`), dispatch routes.
Status: TODO

---
---

# PART II — SYSTEM DESIGN

> Each `[SYSNN]` is one system: Purpose · Scale target (NOW→LATER→REMODEL-IF) · Painful tradeoffs · Decisions (Q→A) · Design · Build plan (Stage 0/1/2, additive) · Verify · Status.
> Cross-cutting law: **never block a user request on slow external work** — return fast (pending), confirm later via webhook/job.
> Capacity reality: 200 bookings/day ≈ 8/hr; 100 operators ≈ 0.3/s avg. Throughput is NOT the constraint — correctness, tenancy, and clean seams are.

---

## [SYS00] Architecture & Scaling Principles
Implements: all
Purpose: Pick the shape of the whole system so it serves today's tiny scale yet expands to 100+ operators without a rewrite.

Scale target:
- NOW (1 op, ~200/day): single modular monolith on serverless, 1 Postgres, 1 Redis, DB-backed job table + cron. Plenty.
- LATER (10–100+ op): additive only — swap job table→queue, add read replica, add worker process. Same codebase.
- REMODEL IF: a single module becomes a proven hotspot (sustained CPU/latency) → extract THAT module to a service. Not before.

Painful tradeoffs / failure modes:
- Over-engineering now (microservices/Kafka) burns months for load that never comes.
- Under-engineering the **one-way doors** (tenancy, money, idempotency) = security holes + money loss that need a rewrite to fix.

Decisions (Q → A):
- Q: Monolith or microservices? A: **Modular monolith** with clean `lib/<domain>` seams. Services later only if a hotspot proves it.
- Q: What MUST be right from day 1 (expensive to retrofit)? A: ONE-WAY DOORS → (1) multi-tenancy: `operatorId` on every operator-owned row + every query tenant-scoped; (2) double-entry ledger + integer minor-units + BigInt; (3) idempotency keys (payment/webhook/payout); (4) `SELECT … FOR UPDATE` on contended writes (seats, balances); (5) stateless app servers (state in JWT/Redis/DB); (6) payment adapter abstraction; (7) async job boundary for all slow external work; (8) clean module boundaries; (9) migrations + indexes + FKs; (10) structured logging + request id.
- Q: What to DEFER? A: microservices, Kafka/event-sourcing/CQRS, DB sharding, read replicas, custom autoscaling, heavy caching tiers, dedicated worker fleets.
- Q: How are folders organized? A: see **[SYS20]** — domain modules in `lib/`, route-realms in `app/`, shared UI in `components/`; cross-module imports via barrel only.

Design: Layered — Foundation (data, IAM, config, money, time) → Domain core (catalog, search, booking, payment, ledger, ticketing) → Communication (notification) → Trust/governance (onboarding, moderation, audit) → Platform infra (jobs, storage, observability, analytics) → Experience (3 frontends). Each layer depends only downward.

Build plan:
- Stage 0: modular monolith + the 10 one-way-doors + DB job table + cron.
- Stage 1: job table→BullMQ/SQS + worker; read replica; PgBouncer; CDN; Sentry dashboards.
- Stage 2: partition hot tables; extract proven hotspots to services; dedicated search index/cache if measured.

Verify: overall repo module layout (`lib/<domain>` separation), tenancy scoping helpers, presence of pooler config.
Status: TODO

---

## [SYS01] Data Layer (Postgres / Redis / pooler)
Implements: all
Purpose: Durable source of truth + fast ephemeral state, without N+1 or connection meltdown.

Scale target:
- NOW: 1 Postgres + 1 Redis + connection pooler. Handles years of this volume.
- LATER: read replica for reports/search reads; slow-query logging.
- REMODEL IF: write throughput or table size hurts → partition `Booking`/`LedgerEntry`/`NotificationLog` by time/operator.

Painful tradeoffs / failure modes:
- **N+1**: 80 trips → 161 queries ("billions not 80"). Lethal.
- **Connection exhaustion**: serverless × many instances > PG's ~100 cap → melt under spike.
- Long transactions hold locks → block others.

Decisions (Q → A):
- Q: Avoid N+1? A: eager-load relations in ONE query (Prisma `include`/`select`) or batch; ban queries inside loops (lint/review rule); list DTO joins once.
- Q: Connection limit under serverless? A: **PgBouncer / Prisma Accelerate from day 1**; app → pooler, never raw PG.
- Q: ID type? A: CUID/UUID — no central sequence bottleneck, sortable.
- Q: Read scaling? A: replica at Stage 1, not now.

Design: PG = relational truth (ACID for money/seats). Redis = rate-limit counters, idempotency SETNX keys, OTP/jti store, hold-countdown UX TTL, hot-route cache. **Redis does NOT lock seats or money** — all seat/balance contention uses PG `SELECT … FOR UPDATE` (single locking scheme, no divergence). Migrations versioned; non-partial indexes declared in BOTH schema.prisma and SQL.

Build plan: Stage 0 PG+Redis+pooler+migration discipline. Stage 1 replica + slow-query log. Stage 2 partition hot tables.

Verify: `prisma/schema.prisma`, `lib/db/**`, pooler/datasource config, any `for (… of …)` containing a query.
Status: TODO
> RESOLVED (#25 Redis scoped to counters/idempotency/cache; PG FOR UPDATE is the only seat/money lock).

---

## [SYS02] Identity & Access (3 realms)
Implements: S04, S05, S10
Purpose: Authenticate + authorize three distinct populations with isolation and least privilege.

Scale target:
- NOW: JWT + Redis/DB sessions; trivial volume.
- LATER: session/device management; operator SSO if enterprise.
- REMODEL IF: external IdP mandated → add SSO/SAML adapter (auth already abstracted).

Painful tradeoffs / failure modes:
- In-process session state → can't scale horizontally.
- SIM-swap on admin (high privilege) if SMS-OTP used.
- Cross-tenant leakage if queries forget operator scope.

Decisions (Q → A):
- Q: Session storage? A: **stateless** — short-TTL access JWT + rotating HttpOnly refresh cookie (DB-hashed, reuse-detection). No server memory.
- Q: Same login for all? A: No — customer (phone+OTP), operator (console + staff + tenant), **admin separate hardened door (email+pw+TOTP, invite-only)** — see S10.
- Q: Prevent cross-tenant reads? A: a tenant-scope query helper that always injects `operatorId`; never hand-write unscoped operator queries.

Design: realms = {customer, operator, admin}; RBAC roles per realm; access-JWT carries minimal claims; gates encode state in JWT claim for Edge middleware (no DB read in middleware).

Build plan: Stage 0 three realms + stateless sessions + tenant helper. Stage 1 device/session mgmt. Stage 2 SSO.

Verify: `lib/auth/**`, `app/api/auth/**`, middleware/`proxy.ts`, tenant-scope helper.
Status: TODO

---

## [SYS03] Catalog & Inventory
Implements: S05, S06
Purpose: Operator-owned routes/buses/trips with correctness guards; the supply customers search.

Scale target:
- NOW: CRUD + guards; tiny data.
- LATER: pagination/filtering on large fleets; bulk trip creation.
- REMODEL IF: full recurrence scheduling demanded → add a recurrence engine (MVP = one-off + bulk-repeat).

Painful tradeoffs / failure modes:
- N+1 on list views; missing tenant scope.
- Bus double-booked (two overlapping trips) → physical impossibility sold.
- Capacity reduced below already-sold seats → orphaned bookings (TOCTOU race).
- `<verb>At` timestamp written without matching status enum → silent AC break.

Decisions (Q → A):
- Q: Bus↔Trip cardinality? A: **Bus 1:N Trip** (one car, many departures). Repeat/reassign/preset all follow from this.
- Q: Prevent double-book + bad capacity edits? A: inside `$transaction` + `SELECT … FOR UPDATE` on the bus/trip row: overlap check (duration + buffer) + capacity ≥ sold check; reassign re-runs both.
- Q: Who sets price? A: operator (price authority) — `// I7-exempt` on operator-side price input.

Design: **Place(id, canonicalName, aliases)** — normalized city/stop entity; Route references `originPlaceId`/`destPlaceId` (NOT free text), and search typeahead reads Place — kills "Ha Noi/Hanoi/HN" fragmentation (#13). Route(originPlaceId,destPlaceId,duration); Bus(plate,type,capacity); Trip(route,bus,operatorId,departureAt,price,status,salesClosed); MaintenanceWindow(bus,start,end). Lifecycle: scheduled→departed→completed; →cancelled. Every `<verb>At` write pairs with a sibling `status:` write. Overlap BUFFER = 60 min; "sold" = paid + active-held.

Build plan: Stage 0 Place + CRUD + overlap/oversell/capacity guards + maintenance auto-hide. Stage 1 bulk-repeat + pagination. Stage 2 recurrence engine.

Verify: `app/api/op/buses/**`, `app/api/op/trips/**`, `lib/buses/**`, schema Place/Trip/Bus/Route, status enums.
Status: TODO
> RESOLVED (#13 Place entity).

---

## [SYS04] Search & Discovery
Implements: S02
Purpose: Fast, correct trip search/filter/sort for customers.

Scale target:
- NOW: indexed SQL, single DB. Sub-100ms easily.
- LATER: read replica for search reads; Redis cache for hot routes (short TTL).
- REMODEL IF: SQL search strains at large trip volume → dedicated search index (Elastic/Meilisearch).

Painful tradeoffs / failure modes:
- N+1 on result lists.
- Per-row availability recompute (holds+paid) = expensive.
- Slow filters/sorts as data grows.

Decisions (Q → A):
- Q: Fast search? A: single joined query; indexes on `(originPlaceId,destPlaceId,departureAt,status)`; availability computed **set-based**, not per-row loops.
- Q: SQL or search engine? A: **SQL is plenty** at this scale; add an index engine only if measured to strain.
- Q: Exclusions? A: cancelled / sales-closed / maintenance-overlap / **`available seats` (capacity − paidSeats − activeHeldSeats) < ticketCount** / **non-approved operators** — all in the `where`. Never raw capacity.

Design: RSC results page, URL = source of truth; facets from unfiltered base set; filters/sort over base set; **cursor pagination**; rate-limited API.

Build plan: Stage 0 indexed SQL + facets + pagination. Stage 1 replica + Redis hot-route cache. Stage 2 dedicated index.

Verify: `app/search/page.tsx`, `lib/db/searchTrips.ts`, search indexes in schema.
Status: TODO
> RESOLVED (#1 available-seats predicate, #22 pagination).

---

## [SYS05] Booking & Hold (concurrency)
Implements: S03, S07
Purpose: Reserve seats safely under concurrent buyers; never oversell; manage booking lifecycle.

Scale target:
- NOW: DB holds + row locks; trivial contention.
- LATER: same design holds; sweeper frequency tuned.
- REMODEL IF: seat-map (pick-your-seat) added → per-seat locking instead of count.

Painful tradeoffs / failure modes:
- **Two buyers, last seat, same instant → oversell** (the classic race).
- Abandoned holds leak inventory.
- Hold expires while PSP still confirming → paid-but-no-seat.

Decisions (Q → A):
- Q: 2 concurrent buyers for last seat? A: seat-sell in `$transaction` + `SELECT … FOR UPDATE` on trip row → serialize; second sees `available seats` = 0, clean reject.
- Q: Inventory accounting? A: `available = capacity − Σ paid − Σ active-held`. On sell, the Hold transitions **`active → consumed` atomically inside the same FOR UPDATE txn** as the paid Booking insert — held seats convert to paid, never double-counted; if the txn aborts, the hold stays active (no oversell).
- Q: Hold in Redis or DB? A: **DB Hold row** (durable, transactional with the sell) + `expiresAt`; Redis only for UX countdown.
- Q: Abandoned holds? A: `expiresAt` + sweeper job releases; also treat expired as free at read time.
- Q: Hold lapses mid-payment? A: hold TTL > max PSP confirm window (~15 min) + re-validate/extend at initiate; on webhook-paid honor seat if still free; **refund-out** (SYS06) if genuinely gone (rare).
- Q: Inventory DoS? A: **per-IP + per-customer concurrent-hold cap** so one actor can't hold a whole trip for the TTL.
- Q: Out-of-order/replayed webhooks? A: booking state machine is **monotonic** — backward transitions (paid→pending) rejected.

- Inventory + holds are COUNT-based (seatCount); no per-seat identity. Seat-map/seat-selection is explicitly OUT (deferred — see REMODEL IF).

Design: Hold(tripId,seatCount,expiresAt,status[active|consumed|expired]); Booking money-state machine `awaiting_payment → paid → completed | payment_failed_expired | trip_cancelled` (notification delivery tracked in NotificationLog, NOT in this enum); ref generator.

Build plan: Stage 0 DB holds + atomic FOR-UPDATE sell-consume + expiry sweeper + hold cap. Stage 1 TTL tuned from real PSP latency. Stage 2 seat-map locking if added.

Verify: `app/api/holds/**`, `lib/booking/**`, `app/api/bookings/initiate/**`, hold sweeper job.
Status: TODO
> RESOLVED (#5 atomic hold-consume, #16 hold cap, #15 monotonic transitions, #12 `paid` not `paid_operator_notified`).

---

## [SYS06] Payment
Implements: S03, S12
Purpose: Collect money centrally across many rails; confirm reliably without blocking the user.

Scale target:
- NOW: stub gateway (`PAYMENTS_STUB`) → 1 real provider. Adapter ready for more.
- LATER: add rails via adapters; status via SSE; no core change.
- REMODEL IF: payment volume becomes a hotspot → extract payment module to its own worker/service (boundary already clean).

Painful tradeoffs / failure modes (your examples):
- **Sec vs minutes**: user done in 3s, bank confirms in 2 min — can't make user wait.
- **2 pay requests at once** (double-submit / retries).
- **Chatty round-trips** (server↔PSP↔bank↔S3) = latency + failure surface.
- Webhook arrives before/after redirect, twice, or never.

Decisions (Q → A):
- Q: Handle sec-vs-minutes? A: **async, never block** — initiate → `Payment(pending)` → return PSP redirect/QR instantly; user sees "waiting"; truth via webhook; UI polls/SSE. No request holds open for the bank.
- Q: Double pay / double webhook? A: idempotency — one pending per `orderRef`; webhook dedup by `providerTxnId`; replay = no-op.
- Q: Webhook before user returns / never? A: webhook is **single source of truth**, independent of redirect; if never → **reconciliation sweeper** polls PSP for stuck pendings + expires them.
- Q: Check cloud before server / round-trips? A: **one call out (start), one webhook in.** No S3 in payment hot path; PDF/ticket generated async AFTER paid (SYS08).
- Q: Trust client "success"? A: never — only verified webhook marks paid.
- Q: Many providers? A: adapter per provider → canonical event `{orderRef,providerTxnId,amount,currency,status}`.

Failure-mode table: late→pending then flips · never→recon sweeper expires · twice→dedup no-op · double-click→one pending · short amount→reject · PSP down→retry, stays awaiting_payment.

Design: central collection into platform account; match by orderRef + verify amount/currency; canonical event uses **`providerTxnId`** (dedup key); **monotonic transitions** (reject paid→pending); webhooks HMAC-verified + CSRF-exempt; App Store/Play IAP excluded. **Refund-OUT rail**: a PSP-refund call + `refund_out` ledger entry (own idempotency key) for operator-cancel / oversold-race / overpayment-difference — money CAN leave even though customer-initiated refunds are policy-barred. Memo degraded-match (amount+account+time-window) in the recon sweeper. See SYS07 for money entries.

Build plan: Stage 0 one provider + pending/webhook/idempotency/recon-sweeper + refund-out path. Stage 1 multi-rail adapters + SSE status. Stage 2 extract to worker.

Verify: `lib/payment/**`, `app/api/payments/**`, webhook handlers, recon sweeper job, refund-out handler.
Status: TODO
> RESOLVED (#3 refund-out rail, #15 monotonic transitions, #11 providerTxnId, #14 degraded match).

---

## [SYS07] Ledger & Payout
Implements: S08, S13
Purpose: Track each operator's money exactly and pay it out safely.

Scale target:
- NOW: ledger + manual/auto payout; tiny volume.
- LATER: batch payouts; reconciliation reports.
- REMODEL IF: ledger table huge → partition by operator/time (append-only makes this safe).

Painful tradeoffs / failure modes:
- **Double-payout** (withdraw clicked twice).
- **Balance drift** if stored as a mutable number.
- **Float rounding** on fee math.
- Clawback after operator cancels a partly-settled trip.

Decisions (Q → A):
- Q: Store balance as a column? A: No — **append-only double-entry ledger**; balance = SUM(entries).
- Q: Double withdraw? A: `$transaction` + `FOR UPDATE` on balance gate + re-check available ≥ amount + idempotent payout key.
- Q: Fee precision? A: **BigInt, integer VND minor units** (ES2017 → `BigInt()` ctor, no `n` suffix). Never float.
- Q: When withdrawable? A: PENDING until trip completes, then **+ T+1 settlement delay (S15#5)** → AVAILABLE. The short delay is the dispute/chargeback buffer (clawback window for operator-cancel + late bank disputes), NOT a customer-refund hold.

Design: LedgerEntry(operatorId, bookingId?, payoutId?, type[booking_credit|platform_fee|refund_debit|refund_out|payout_debit|payout_reversal|chargeback|adjustment], amount signed, sourceEventId idempotency). Fee = own entry, rate from **`FeeConfig`** (global + per-operator override, effective-dated, change-audited — S13). Payout state machine requested→processing→paid|failed + min-withdraw threshold. `refund_debit`/`refund_out` fire for operator-cancel / oversold-race / overpayment-difference (NOT customer-initiated). `chargeback` + `payout_reversal` handle post-payout bank disputes — liability = operator, platform bad-debt backstop (S15#7).

Build plan: Stage 0 ledger + entry types + payout state machine + locks. Stage 1 on-demand withdrawal UI + statements. Stage 2 batch payouts + recon.

Verify: ledger model, `lib/payouts/**`, payout routes.
Status: TODO
> RESOLVED (synced to S08/S13: full 8-type entry list, refund_out rail + chargeback/payout_reversal, FeeConfig source, T+1 settlement delay).

---

## [SYS08] Ticketing (QR / PDF / verify)
Implements: S03, S07
Purpose: Deliver a verifiable, paid-proof ticket after payment; verify it at boarding.

Scale target:
- NOW: async PDF→S3, signed-URL delivery.
- LATER: CDN in front of S3; regenerate-on-demand cache.
- REMODEL IF: very high volume → dedicated render workers.

Painful tradeoffs / failure modes (your "S3 back-and-forth"):
- PDF render is slow + CPU-heavy → must NOT be in the request path.
- Byte-proxying through the server (server→S3→server→client) = chatty + fragile.

Decisions (Q → A):
- Q: Generate PDF inline on pay? A: No — on webhook-paid enqueue a job → worker renders **once** → upload to S3 **once** → store key → email links it.
- Q: Serve ticket how? A: **signed S3/CDN URL**; client fetches directly, server only mints the URL.
- Q: QR contents? A: a **signed token (JWT)** → public read-only verification page looks up booking; QR holds no secret, needs no DB call to generate.
- Q: Check cloud before server? A: generate-once-store-once; reads from CDN/S3 signed URL; minimal hops.

Design: **the public verify page is the SOURCE OF TRUTH** for plate/type/departure/status (reads live booking+trip); the emailed PDF is a point-in-time snapshot. On **bus reassign** (S06) → **invalidate + regenerate the PDF** and notify the customer (S15#4) so the snapshot can't go stale against the live car. Verify page = ref/trip/seats/PAID/providerTxnId; check-in single-use (atomic, S07).

Build plan: Stage 0 signed-token QR + public verify (live) + async PDF→S3 + signed-URL delivery + regenerate-on-reassign. Stage 1 CDN. Stage 2 render-cache/workers.

Verify: ticket-generation job, QR/token lib, verify route, `app/api/bookings/[id]/ticket`.
Status: TODO
> RESOLVED (#2 verify-page source-of-truth + regenerate PDF on reassign).

---

## [SYS09] Notification
Implements: S03, S04, S05, S14
Purpose: Send OTP/confirmations/decisions via SMS + email without blocking core flows.

Scale target:
- NOW: NotificationLog + cron dispatcher + retry.
- LATER: cron→real queue (BullMQ/SQS) + worker; per-channel providers + templating.
- REMODEL IF: very high volume → dedicated notification service.

Painful tradeoffs / failure modes:
- SMS/email provider slow or down → must not block payment/booking.
- Retries → duplicate messages.
- Scheduled sends need a queryable predicate.

Decisions (Q → A):
- Q: Send inline on payment? A: No — enqueue `NotificationLog` row; worker/cron dispatches + retries; payment txn never waits on the provider.
- Q: Dedup on retry? A: idempotent per (bookingId, template); status guarded; safe re-run.
- Q: Scheduled work query? A: `scheduledFor` **top-level indexed column** + `@@index([template, scheduledFor])`, never JSON payload.

Design: channels {sms, email}; templates; ticket PDF/QR via SYS08; async always. **Provider is stubbed day-1** (`NOTIFY_STUB`, parallel to `PAYMENTS_STUB` — eSMS/email deferred per project memory); readers must not assume live delivery. **Decoupled from booking state**: a delivery failure updates only `NotificationLog`, never the booking `paid` state (#12) — a notification outage cannot corrupt money truth.

Build plan: Stage 0 NotificationLog + cron + retry + NOTIFY_STUB. Stage 1 queue + worker + real provider. Stage 2 provider abstraction + templating service.

Verify: `lib/notifications/**`, NotificationLog model, dispatcher job.
Status: TODO
> RESOLVED (#23 NOTIFY_STUB flag, #12 delivery decoupled from booking state).

---

## [SYS10] Jobs & Scheduler
Implements: S06, S08, S14
Purpose: The async backbone — run all slow/deferred/scheduled work off the request path.

Scale target:
- NOW: DB job table + cron.
- LATER: BullMQ/SQS + dedicated worker process (same `Job` interface).
- REMODEL IF: job volume/latency demands → workers per job type.

Painful tradeoffs / failure modes:
- Cron double-fires; job crashes mid-way; "exactly once" is a trap.
- Serverless cron has a **minimum cadence** (host-dependent, often ≥1 min) — sub-minute sweeps aren't free; and a **slow run can overlap the next tick**.

Decisions (Q → A):
- Q: Exactly-once? A: don't chase it — **at-least-once + idempotent**; each job keyed; re-run = no-op.
- Q: Backing store now? A: DB job table + cron → swap to queue later behind the same abstraction.
- Q: Cron cadence + overlap? A: pick cadence within host minimums; guard against overlap with a **run-lock** (advisory lock / `SELECT … FOR UPDATE SKIP LOCKED` / a `cronRun` sentinel row) so a slow sweep doesn't double-run against the next tick.

Design: `Job` abstraction. Jobs: hold-expiry, payment-reconciliation, notification-dispatch, payout T+N sweep, recurring-trip generation, PDF render.

Build plan: Stage 0 `Job` + DB table + cron + run-lock. Stage 1 queue + worker. Stage 2 per-type workers.

Verify: `app/api/cron/**`, job abstraction, each sweeper.
Status: TODO
> RESOLVED (#26 cron cadence + run-overlap lock).

---

## [SYS11] File / Document Storage
Implements: S03, S05
Purpose: Store KYB docs + generated ticket PDFs securely, served without proxying bytes.

Scale target:
- NOW: S3 private bucket + signed URLs.
- LATER: CDN + lifecycle/retention rules.
- REMODEL IF: residency/compliance demands → region-pinned buckets.

Painful tradeoffs / failure modes:
- Uploading/serving through the app server = slow + chatty.
- PII docs need access control + abuse protection.

Decisions (Q → A):
- Q: Upload path? A: **direct client→S3 signed upload** (not through server); DB stores the key.
- Q: Read path? A: signed-URL via CDN; server mints URL only.
- Q: Validation? A: size/type checks + optional AV-scan job; access audit-logged.

Design: private bucket; signed PUT/GET; keys in DB; retention policy (SYS13).

Build plan: Stage 0 direct signed upload + review queue. Stage 1 AV scan + retention. Stage 2 residency pinning.

Verify: storage client lib, upload/download routes, KYB doc model.
Status: TODO

---

## [SYS12] Onboarding / KYB / Approval
Implements: S05
Purpose: Vet operators before they can sell; manage their lifecycle state.

Scale target:
- NOW: manual review queue, low volume.
- LATER: bulk review tools; partial automation of checks.
- REMODEL IF: high applicant volume → automated KYB provider integration.

Painful tradeoffs / failure modes:
- Unvetted operator sells fake trips → chargebacks + liability.
- Silent rejection → support load.

Decisions (Q → A):
- Q: Gate where? A: state machine `PENDING_REVIEW → UNDER_REVIEW → APPROVED | REJECTED`; `REJECTED → PENDING_REVIEW` (resubmit); `APPROVED ↔ SUSPENDED` (matches S05); enforced in **search query AND booking-initiate**.
- Q: Pending UX? A: confirmation page (ref) + pending email with **SLA range** (not exact clock) + status page + decision email both ways; can draft buses/trips while pending.

Design: registration + doc submit (SYS11); payout-account ownership verified at approval via **micro-deposit or name-match** against the registered payout account (S05); every state change notifies.

Build plan: Stage 0 register + queue + state machine + gate. Stage 1 bulk tools. Stage 2 automated KYB.

Verify: operator register routes, operator status enum, approval routes, search/booking gate.
Status: TODO
> RESOLVED (synced to S05: 4-state machine + REJECTED→resubmit edge; KYB micro-deposit/name-match verify method).

---

## [SYS13] Moderation & Audit / Compliance
Implements: S10, S11, S14
Purpose: Traceability of privileged actions + content control + legal posture.

Scale target:
- NOW: append-only audit log + consent capture.
- LATER: export tooling; retention automation.
- REMODEL IF: formal compliance regime (e.g. audit certification) → tamper-evident logging.

Painful tradeoffs / failure modes:
- Missing audit trail on money/approval = undefendable disputes.
- PII retention without policy = legal exposure.

Decisions (Q → A):
- Q: What to audit? A: every admin privileged action (who/what/when), read-only + exportable.
- Q: Consent? A: capture no-refund + PII-storage consent at the relevant step.
- Q: Moderation? A: disable (not edit) bad trips/routes.
- Q: Append-only enforcement? A: at the **DB level** — revoke UPDATE/DELETE on AuditLog + LedgerEntry for the app role (or trigger guard); not a convention.
- Q: Data-subject erase (VN PDPD 2023)? A: **anonymize-in-place** — scrub PII on booking/guest rows, retain money/audit/financial totals; hard-delete account credentials/sessions. Reconciles erase vs money-retention.

Design: AuditLog append-only (DB-enforced); consent records; retention policy on guest PII + KYB docs; anonymization routine; chargeback/dispute records feed Finance (S11).

Build plan: Stage 0 audit log + consent + DB-enforced immutability. Stage 1 export + retention/anonymize jobs. Stage 2 tamper-evident.

Verify: audit log model + write sites, consent capture points, retention/anonymize job.
Status: TODO
> RESOLVED (#24 DB-enforced immutability, #27 anonymize-in-place erase).

---

## [SYS14] API Gateway / Middleware
Implements: S14
Purpose: One cross-cutting request gate — rate-limit, CSRF, auth, routing — Edge-safe.

Scale target:
- NOW: middleware + Redis rate-limit.
- LATER: per-route quotas; WAF in front.
- REMODEL IF: abuse/DDoS → edge WAF + bot protection.

Painful tradeoffs / failure modes:
- Adding a gate breaks every existing non-safe caller if helpers don't ship same commit.
- DB read in Edge middleware = not allowed.

Decisions (Q → A):
- Q: Gate scope? A: rate-limit + CSRF double-submit (`bb_csrf`) on **all non-safe `/api/*` (customer + operator + admin)**; webhooks HMAC + CSRF-exempt. (Matches Mistake Log Issue 007 — not customer-only.)
- Q: Edge auth without DB? A: encode gate state in JWT claim; verify via `jose` (Edge-safe); exact-match allowlist Sets (not prefix).
- Q: Rollout safety? A: ship client `readCsrfToken()` + e2e `primeCsrf()` helpers in the SAME commit as the gate; grep all non-safe `/api/*` callers first.

Design: middleware/`proxy.ts`; Redis limiter; CSRF helpers; HMAC verify for webhooks.

Build plan: Stage 0 rate-limit + CSRF + auth gate. Stage 1 per-route quotas. Stage 2 WAF.

Verify: `proxy.ts`/middleware, `lib/auth/csrfClient.ts`, rate-limit lib, webhook HMAC.
Status: TODO

---

## [SYS15] Observability
Implements: S11
Purpose: Know when things break, fast — without building an APM.

Scale target:
- NOW: logs + Sentry + health endpoint.
- LATER: dashboards + alerts.
- REMODEL IF: distributed services → tracing.

Painful tradeoffs / failure modes:
- Hand-built health pages = reinventing observability badly.
- No request id = blind in incidents.

Decisions (Q → A):
- Q: Build or buy? A: **buy** — Sentry (errors), Vercel/Datadog (traffic/latency), structured logs + request id, `/api/health`.
- Q: Business vs infra metrics? A: business → admin console (SYS16); infra → external tools.

Design: structured logger with redaction list (incl. otpProof, tokens); request-id propagation; alerts on payment/payout/notification failures.

Build plan: Stage 0 logs + Sentry + health. Stage 1 dashboards + alerts. Stage 2 tracing.

Verify: logger lib + redaction list, `/api/health`, Sentry init.
Status: TODO

---

## [SYS16] Analytics (business)
Implements: S02, S11
Purpose: Business metrics + funnels for the admin overview.

Scale target:
- NOW: fire-and-forget events → DB; simple aggregates.
- LATER: warehouse/BI export.
- REMODEL IF: heavy analytics → separate analytics pipeline.

Painful tradeoffs / failure modes:
- Analytics writes blocking user flows; vanity metrics.

Decisions (Q → A):
- Q: Capture how? A: fire-and-forget events (search_performed, booking funnel, GMV); never block the request.
- Q: Where shown? A: admin console business metrics (NOT infra).

Design: event emit helper; aggregate queries (off replica later).

Build plan: Stage 0 key events + admin aggregates. Stage 1 warehouse export. Stage 2 pipeline.

Verify: analytics emit helper, admin metrics queries.
Status: TODO

---

## [SYS17] Config & Feature Flags
Implements: S11, S12
Purpose: Toggle behavior + rails without redeploys; kill-switches.

Scale target:
- NOW: env + DB-backed flags; `PAYMENTS_STUB`.
- LATER: per-operator/percentage rollout.
- REMODEL IF: many flags → flag service (LaunchDarkly etc).

Painful tradeoffs / failure modes:
- Hard-coded behavior that needs a deploy to change in an incident.

Decisions (Q → A):
- Q: What's flag-controlled? A: payment-rail toggles, `PAYMENTS_STUB`, `NOTIFY_STUB`, feature gates, kill-switches.
- Q: Who controls? A: admin System tab (super-admin), audit-logged.
- Note: **FeeConfig** (platform fee rate, per-operator override) is NOT a flag — it's an effective-dated, audited data model (S13/S11), read at credit time.

Design: flag store (env + DB); admin UI; read helper cached.

Build plan: Stage 0 env + DB flags + admin toggle. Stage 1 rollout %/targeting. Stage 2 flag service.

Verify: config/flags lib, admin System tab, `PAYMENTS_STUB` usage.
Status: TODO

---

## [SYS18] Frontends (customer / operator / admin)
Implements: S02–S11
Purpose: Three UIs over the same core, each scoped to its realm.

Scale target:
- NOW: Next.js App Router; RSC for search; serverless.
- LATER: CDN, code-split, image optimization.
- REMODEL IF: native mobile demanded → API already clean for a mobile client.

Painful tradeoffs / failure modes:
- Stateful client assumptions break on reload/scale.
- N+1 / waterfalls in RSC data fetching.

Decisions (Q → A):
- Q: Search state? A: URL = source of truth (share/refresh, RSC).
- Q: Three apps or one? A: **Stage 0** = one Next.js app, route-segmented (`/`, `/op`, `/admin`); admin compensates for the shared deployment with a **separate credential store + separate cookie scope + strict exact-match middleware + mandatory TOTP** (S10) — the weaker-than-subdomain posture is accepted explicitly (S15#8). **Stage 1** = split admin to a subdomain / separate deployment.
- Q: Data fetching? A: in-process lib calls from RSC/route handlers (no self-fetch); eager-load to avoid waterfalls.

Design: customer web (S02–S04), operator console (S09 layout), admin console (S11 layout); stateless; design tokens shared.

Build plan: Stage 0 three consoles MVP (admin same-app, isolated cookie/creds). Stage 1 perf (CDN/split/images) + admin subdomain split. Stage 2 native client if needed.

Verify: `app/**` route segments, `app/op/**`, `app/admin/**`.
Status: TODO
> RESOLVED (#10 Stage-0 one-app posture accepted explicitly → S15#8; Stage-1 subdomain split).

---

## [SYS19] Charter / Contract-Rental
Implements: S16, S17, S18
Purpose: A request→dispatch→claim marketplace for bespoke charter trips, separate from fixed-price scheduled trips.

Scale target:
- NOW: manual admin dispatch, low volume.
- LATER: operator capability/region tags + operator suggestions.
- REMODEL IF: high volume → auto-matching engine.

Painful tradeoffs / failure modes:
- **Double-claim race** on the public pool (two operators accept the same request).
- **Assigned operator sits on it** (no response) → request stalls.
- Charter pricing is **bespoke** → cannot reuse the fixed-price booking flow.
- Guest **spam**.

Decisions (Q → A):
- Q: Claim concurrency? A: **atomic conditional update / `SELECT … FOR UPDATE`** on the request row — first commit wins, others get 409 already-claimed.
- Q: Payment? A: **lead-gen / operator-direct default** (S15#9) — negotiated price, optional platform referral fee invoiced later. NOT the online fixed-price rail (charter price is bespoke).
- Q: Pricing/quote? A: customer states budget + needs; **operator quotes/finalizes with the customer after accepting** (off-platform MVP, S15#10).
- Q: Stale assignment? A: direct assignment has an **accept-by timeout (default 24h)** → auto-return to admin; published has a **claim-by expiry (default 48h)** → EXPIRE → admin.
- Q: Spam? A: rate-limit + required contact + admin reject.

Design: `CharterRequest(id, ref, customerId?, contactName/Phone/Email, originPlaceId, destinations, startDate, endDate|durationDays, passengers, vehicleType, budget, notes, status, assigneeOperatorId?, publishedAt?, claimByAt?, createdAt)`. State machine: `SUBMITTED → ADMIN_REVIEW → {ASSIGNED_DIRECT(op) | PUBLISHED | REJECTED}`; `ASSIGNED_DIRECT → ACCEPTED | DECLINED→ADMIN_REVIEW | (timeout)→ADMIN_REVIEW`; `PUBLISHED → ACCEPTED(claim) | EXPIRED→ADMIN_REVIEW`; `ACCEPTED → COMPLETED | CANCELLED`. Reuse: Place (SYS03), Notification (SYS09), Jobs expiry sweeper (SYS10), Audit (SYS13), operator-approval gate (S14). Count-based seating N/A (private vehicle).

Build plan: Stage 0 form + admin dispatch (assign/publish/reject) + atomic claim + status + notifications + expiry sweeper. Stage 1 capability/region tags + operator suggestions. Stage 2 matching engine + optional in-platform payment/quote.

Verify: `components/home/ContractCarRental.tsx`, charter request/dispatch/claim routes, CharterRequest model, expiry sweeper.
Status: TODO

---

## [SYS20] Code Organization & Module Boundaries
Implements: all
Purpose: One consistent place-for-everything rule so the monolith stays navigable and each domain can later lift out to a service.

The three axes (each angle gets the layout that fits it):
- **`app/` = by ROUTING REALM + segment** (Next.js App Router forces this). THIN — no business logic; route handlers/RSC call `lib/<domain>` in-process (Mistake Log: never self-fetch).
- **`lib/` = by DOMAIN MODULE (vertical slice)** — NOT by technical layer. New feature = new folder, not edits scattered across `services/`+`models/`+`controllers/`. This is the scale axis + the future service boundary.
- **`components/` = by FEATURE + shared UI** (presentational, dumb).
- Rejected: pure by-layer (`controllers/ services/ models/`) — every feature change touches 3 dirs, doesn't scale. Pure by-feature across the whole repo — fights Next routing + shared-UI reuse.

Target tree (mapped to S/SYS tokens):
```
app/                          # Next.js App Router — THIN
  (customer)/                 # customer realm (S02–S04, S16)
    page.tsx · search/ · trips/[id]/ · booking/{customer,review}/ · account/bookings/ · charter/ · auth/
  op/                         # operator console (S09): overview fleet trips bookings money settings charter
  admin/                      # admin realm (S11), isolated cookie/creds (S10): approvals users operators finance moderation system charter
  api/                        # route handlers — THIN, call lib in-process
    trips/ holds/ bookings/ payments/ auth/ op/ admin/ charter/ cron/ health/
  layout.tsx · globals.css
lib/                          # BUSINESS LOGIC — one folder per domain (vertical slice)
  core/                       # cross-cutting primitives (imported by domains; imports NO domain)
    db/ (prisma client, pooler, tenant-scope helper) · money/ · time/ · id/ · result/ · errors/ · logger/ · config/ (flags, *_STUB) · jobs/ (SYS10) · http/ (rate-limit, csrf, webhook-hmac)
  auth/ (SYS02) · catalog/ (SYS03: routes,buses,trips,places,maintenance,overlap) · search/ (SYS04)
  booking/ (SYS05: holds,lifecycle,ref,manifest,guest-attach) · payment/ (SYS06) + payment/adapters/{momo,vietqr,card,paypal,stub}
  ledger/ (SYS07/SYS13: entries,balance,payout,feeConfig,chargeback) · ticketing/ (SYS08) · notification/ (SYS09)
  storage/ (SYS11) · onboarding/ (SYS12) · charter/ (SYS19) · audit/ (SYS13) · analytics/ (SYS16)
components/                   # shared UI: ui/ (design system) · home/ (incl ContractCarRental) · search/ booking/ op/ admin/ charter/
prisma/ (schema,migrations,seed) · e2e/ (playwright) · docs/ (design+qa) · worker/ (Stage 1 entrypoint, reuses lib/)
```

Per-module convention (every `lib/<domain>/`):
```
index.ts        # PUBLIC API barrel — the ONLY surface other modules import
<action>.ts     # use-cases (e.g. initiateBooking.ts, claimCharter.ts)
<domain>Repo.ts # all DB access for this domain (tenant-scoped where operator-owned)
types.ts        # DTOs / interfaces
errors.ts       # tagged error union
__tests__/      # unit + int tests colocated
```

Boundary rules (enforce the seams):
1. `app/` and `components/` contain NO business logic; `app/` calls `lib/<domain>` in-process.
2. `lib/<domain>` MUST NOT import `app/` or `components/`.
3. Cross-domain imports go through the other domain's `index.ts` barrel ONLY — never reach into its internals. (This barrel IS the future service boundary.)
4. `lib/core` is imported by domains; it imports NO domain. Direction: `app → lib/<domain> → lib/core`. No cycles.
5. Every operator-owned repo query goes through the `lib/core/db` tenant-scope helper (multi-tenancy one-way-door).
6. Tests colocated (`__tests__`) for unit/int; cross-flow e2e in top-level `e2e/`.

Scale evolution (additive — folders don't churn):
- Stage 0: this tree, single deploy.
- Stage 1: add `worker/` entrypoint importing the same `lib/<domain>` job handlers (queue worker) — no logic moves.
- Stage 2: a proven-hotspot domain folder lifts to its own deploy/service almost mechanically, because every caller already went through its `index.ts` barrel.

Current → target reconciliation (incremental, NOT big-bang):
- `lib/buses` → fold into `lib/catalog`; `lib/payouts` → `lib/ledger`; `lib/db` → `lib/core/db`.
- `lib/validation` → per-domain `types.ts`/schemas or `lib/core`; `lib/stores` → client-only (keep); `lib/api` → assess (client helpers vs `lib/core/http`).
- Keep folders that already match; migrate the rest module-by-module.

Verify: actual `app/` route segments + `lib/` domain folders + `components/`; per-module `index.ts` barrels; tenant-scope helper in `lib/core/db`; an import-boundary lint rule (eslint `no-restricted-imports` / dependency-cruiser) enforcing rules 1–4.
Status: TODO

---
---

## [REVIEW] Senior Engineering Review — 2026-06-01
> Review of the spec as written. Tags cite the section. P1 = correctness/money/security
> defect; P2 = contradiction or unresolved coupling; P3 = missing consideration / smell.
> Stories are TARGET; several items below are spec defects that will become code defects if copied verbatim.

### DISPOSITION (resolved into the spec 2026-06-01 — kept below as audit trail)
| # | Disposition |
|---|-------------|
| 1 | ✅ RESOLVED — available-seats predicate in S02/S06/SYS04/SYS05 (`capacity − paid − held`). |
| 2 | ✅ RESOLVED — verify page = source of truth; regenerate PDF on reassign (S03/S06/SYS08). |
| 3 | ✅ RESOLVED — refund-OUT rail added (SYS06/SYS07/S13); overpay→refund-difference. |
| 4 | ✅ RESOLVED — `chargeback`+`payout_reversal` types + dispute flow (S13/S08/S11); liability → S15#7. |
| 5 | ✅ RESOLVED — atomic hold-consume-on-sell in FOR UPDATE txn (SYS05/S03). |
| 6 | ✅ RESOLVED → S15#5 — settlement delay T+1 (S08/S13). |
| 7 | ✅ RESOLVED → S15#2 — operator-cancel default = refund (S03/S06). |
| 8 | ✅ RESOLVED — UNDER_REVIEW state + REJECTED→resubmit edge (S05/SYS12). |
| 9 | ✅ RESOLVED — CSRF on all non-safe /api/* except HMAC webhooks (S14/SYS14). |
| 10 | ✅ RESOLVED → S15#8 — Stage-0 one-app /admin posture accepted; Stage-1 subdomain (S10/SYS18). |
| 11 | ✅ RESOLVED — `providerTxnId` pinned everywhere (S01/S12/SYS06). |
| 12 | ✅ RESOLVED — booking money-state = `paid`; delivery in NotificationLog (S01/S04/S07/SYS05/SYS09). |
| 13 | ✅ RESOLVED — canonical `Place` entity (S01/S02/SYS03). |
| 14 | ✅ RESOLVED — memo format constraint + degraded match (S12/SYS06). |
| 15 | ✅ RESOLVED — monotonic transitions, reject backward (SYS05/SYS06). |
| 16 | ✅ RESOLVED — per-IP/per-customer concurrent-hold cap (SYS05/S03). |
| 17 | ✅ RESOLVED — first super-admin seed/break-glass + TOTP recovery (S10). |
| 18 | ✅ RESOLVED — `FeeConfig` model (S13/S11/SYS17). |
| 19 | ✅ RESOLVED — atomic conditional check-in update (S07). |
| 20 | ✅ RESOLVED → S15#6 — lock price+departure once sold (S06). |
| 21 | ✅ RESOLVED → S15#3 — VND-only day-1; multi-currency deferred (S13/SYS06). |
| 22 | ✅ RESOLVED — cursor pagination (S02/S09/SYS04). |
| 23 | ✅ RESOLVED — `NOTIFY_STUB` flag (S03/SYS09/SYS17). |
| 24 | ✅ RESOLVED — DB-enforced ledger/audit immutability (S13/SYS13). |
| 25 | ✅ RESOLVED — Redis scoped to counters/idempotency/cache; PG FOR UPDATE = only seat/money lock (SYS01). |
| 26 | ✅ RESOLVED — cron cadence + run-overlap lock (SYS10). |
| 27 | ✅ RESOLVED — anonymize-in-place erase (S04/SYS13). |

### P1 — Correctness defects (will ship as bugs if implemented literally)
1. **[S02 / SYS04] Availability exclusion is wrong.** Both say search excludes `capacity < ticketCount`.
   Capacity = bus seat count (static). The real predicate is **available = capacity − paidSeats − activeHeldSeats**;
   a full bus with `capacity ≥ ticketCount` would still wrongly show as bookable. Fix the predicate everywhere
   it appears (S02 Design, SYS04 Decisions, S06 "capacity enforced").
2. **[SYS08 / S06] Generate-once PDF vs mutable plate = stale ticket.** SYS08 renders the PDF once on
   webhook-paid and emails it; S06 reassign "Customer ticket reflects current bus plate." A reassign AFTER the
   PDF is issued leaves a wrong plate on the customer's PDF. Resolve: declare the **public verify page the source
   of truth** for plate/type/departure, and **regenerate (or invalidate) the PDF on reassign**. Today the spec
   silently contradicts itself.
3. **[S03 / SYS06] No refund OUT-rail is designed anywhere.** "No customer refunds" is a *policy*, but the
   system still MUST move money back for: operator-cancel (S08 clawback → customer refund), oversold-race
   ("refund if genuinely gone" SYS05), and overpayment (SYS06 "amount ≥ stored" accepts overpay). There is no
   PSP-refund / bank-send-back mechanism, no ledger `refund-out` execution, no idempotency on it. This is a
   whole missing subsystem, not a detail.
4. **[S08 / S13] Chargebacks / disputes unmodeled.** Cards + PayPal allow bank-side disputes AFTER payout.
   `refund_debit` is scoped to operator-cancel only. A chargeback on already-paid-out money has no ledger entry
   type, no operator clawback path, no liability owner. Add a `chargeback` (and likely `payout_reversal`) entry
   type and a dispute flow, or explicitly accept the loss in writing.
5. **[SYS05 / S03] Hold→Booking seat accounting can double-count or oversell.** Spec never states that the
   Hold is **consumed/released atomically** when the Booking is created. If inventory = Σ(active holds) + Σ(paid)
   and a paid booking keeps its hold row alive, the seat is counted twice; if the hold is released before the paid
   row commits, a concurrent buyer oversells. Specify the atomic hold-consume-on-sell inside the FOR UPDATE txn.

### P2 — Contradictions & unresolved couplings
6. **[S08 vs S15#5] "Available at trip completion" is asserted as decided in S08 but listed OPEN in S15#5**
   (immediate vs T+N settlement). Pick one; don't hard-state it in S08 while S15 says un-locked.
7. **[S03/S06 vs S15#2] Operator-cancel remedy (refund vs rebook) is committed in stories (S03 "refund or
   rebooking", S06 "triggers refund/rebook") but OPEN in S15#2.** Same defect: story commits a choice S15 says
   is un-locked.
8. **[S05] Operator state machine is missing two edges the stories require.** Story lists status values
   "pending / **under review** / approved / rejected" (4) and "resubmit" after rejection, but the machine is only
   `PENDING_REVIEW → APPROVED|REJECTED; APPROVED↔SUSPENDED`. Missing: an `UNDER_REVIEW` state and the
   `REJECTED → PENDING_REVIEW` (resubmit) edge.
9. **[S14 vs Mistake Log I7] CSRF scope too narrow.** S14 gates CSRF on "non-safe **customer** `/api/*`".
   Operator and admin console mutations are equally CSRF-targets; the actual codebase (Mistake Log Issue 007)
   applied it to `/api/*` broadly. Widen the spec to all non-safe `/api/*` except HMAC webhooks.
10. **[S10 vs SYS18] "Separate hardened door" vs "one app, `/admin` route segment."** S10 demands an unlinked
    entry point with its own credential store (subdomain-grade isolation); SYS18 puts admin as a route segment in
    the same Next.js app sharing one middleware. Either accept the weaker posture explicitly (and compensate with
    strict middleware + separate cookie scope) or commit to a separate deployment/subdomain.
11. **[S01 vs SYS06] Canonical-event field name drift.** S01/S12 call it `txnId`; SYS06 uses `providerTxnId`.
    Idempotency dedups on this field — pin ONE name.
12. **[SYS05 / S01] Booking status `paid_operator_notified` conflates payment with notification.** If the SMS/
    email send fails, the booking is still paid — but the enum couples the two. Split: `status=paid` as money
    truth, notification delivery tracked separately (NotificationLog). Otherwise a notification outage corrupts
    booking state.

### P3 — Missing considerations
13. **No canonical City/Place entity.** Route(origin,dest) is free text (SYS03), yet S02 promises typeahead.
    "Ha Noi" vs "Hanoi" vs "HN" fragments search + facets. Add a normalized place/city table feeding both route
    creation and typeahead.
14. **orderRef = bank-transfer memo is fragile.** Banks truncate/strip memos; customers edit them; a reused memo
    collides. Spec leans on memo-match (S01/S12) without a fallback-match (amount+time+account window) or a
    memo-format/length constraint. Define the degraded-match path explicitly (recon sweeper exists but matching
    rules don't).
15. **Webhook out-of-order / backward transitions ungated.** pending→paid→refund can arrive reordered or
    replayed. SYS06 dedups by txnId but never states the booking/payment state machine **rejects backward
    transitions** (e.g. paid must not revert to pending). Add the monotonic-transition rule.
16. **Inventory DoS via holds.** Hold TTL must exceed the ~15-min PSP window (SYS05), but there's no per-IP /
    per-customer cap on concurrent holds — one actor can hold every seat on a trip for 15 min. Add a hold cap.
17. **First super-admin bootstrap + TOTP recovery undefined.** Admin is invite-only with no self-registration
    (S10) — so how does the FIRST admin exist (seed/break-glass), and how is a lost-TOTP admin recovered? Both
    are operational dead-ends as written.
18. **Platform-fee config has no data model.** S11 promises global fee + per-operator override; S13 makes fee its
    own ledger entry — but no `FeeConfig`/override table is specified. Where the rate is read from (and its audit
    trail on change) is undefined.
19. **Check-in double-scan concurrency.** S07 "single-use" check-in needs an atomic conditional update
    (`UPDATE … WHERE checkedInAt IS NULL`) / row lock; two staff scanning the same ticket simultaneously is the
    realistic race. Not stated.
20. **Trip mutation after sales.** Can an operator edit departure time / price once seats are sold? Affects
    issued tickets + already-collected money. Stories cover create/cancel/close/depart/complete but not edit-with-
    bookings. Decide and state.
21. **Multi-currency / FX unaddressed while international rails promised.** S03 offers Visa + PayPal (cross-
    border); canonical event carries `currency`; S15#3 leaves VND-only vs multi-currency open. If non-VND is ever
    accepted, FX, rounding, and per-currency ledger columns are needed — flag the BigInt money invariants (S13)
    assume single-currency minor units.
22. **Pagination absent.** Search results (S02) and operator Trips/Bookings lists (S09) specify filter+sort but
    no pagination — a popular route or a busy operator overflows a single response.
23. **Notification provider stubbed but not flagged.** Per project memory, eSMS/email is deferred and the site
    runs on a stub. SYS09 / S03 describe real SMS+email PDF delivery without noting the day-1 stub — readers will
    assume live delivery. Add a `PAYMENTS_STUB`-equivalent note for notifications.
24. **Ledger immutability not enforced at DB level.** S13 says "append-only / never mutable balance" but no
    mechanism (revoke UPDATE/DELETE, or trigger) is specified — append-only is a convention until the DB enforces it.
25. **Redis "distributed locks" (SYS01) vs PG `FOR UPDATE` (SYS05/SYS07).** Two lock systems named; seat/money
    contention is handled by PG row locks. State what Redis locks are actually for (or drop them) to avoid a
    second, divergent locking scheme.
26. **Serverless cron granularity.** SYS10 hold-expiry sweeper implies ~1-min cadence; Vercel/host cron minimums
    and overlap-prevention (a slow run overlapping the next tick) aren't addressed.
27. **Data-subject erase (VN PDPD 2023).** Guest PII retention is "flagged for legal" (S04/SYS13) but no
    erase/export mechanism is specified, while bookings must be retained for money/audit — the tension needs a
    designed answer (anonymize-in-place vs delete).

### What the plan gets RIGHT (so it isn't lost)
- One-way-doors framing (SYS00) is the correct spine: tenancy, BigInt double-entry ledger, idempotency, FOR
  UPDATE, stateless, payment-adapter, async boundary.
- Webhook = single source of truth, never client redirect (S12/SYS06) — correct.
- OTP-proven phone for guest-link, never blind phone-match / never at payment (S04) — correct and security-aware.
- Manifest always trip-scoped (S07); UTC-store / VN-business-date (S14); generate-once-store-once ticketing
  intent (SYS08) — all sound.
- Scale honesty ("throughput is not the constraint; correctness/tenancy/seams are") is the right posture.
