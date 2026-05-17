# PRD — Bus Booking VN

**Status:** DRAFT
**Date:** 2026-05-17
**Classification:** M (see `docs/classify/bus-booking-vn.md`)
**Idea snapshot:** `docs/inception/idea-bus-booking-vn.md`

---

## Problem Statement

Vietnam intercity bus customers have no reliable way to book a seat online. The market is fragmented across:

- **Phone-only operators** — customers must call during business hours, wait on hold, repeat trip details, and trust verbal confirmation.
- **Aggregators with seat maps** — present visual seat layouts that do not reflect operator reality. Operators routinely reassign seats based on no-shows, group bookings, and family preferences, so the "seat" a customer picks online is a fiction. Customers re-call the operator anyway to confirm pickup.
- **Manual paper manifests** — small/mid operators (5–50 buses) run their fleet on Excel, group chat, and printed lists. They lose revenue to no-shows, missed callbacks, and double-bookings.

The shared root cause: **seat assignment is an operator decision made by phone, but every existing platform pretends it's a customer decision made online**. The mismatch creates duplicate work for customers (book, then call) and forces operators onto tools that don't fit their workflow.

A platform that embraces "no customer seat-pick" — customers reserve trip capacity, operator calls to confirm pickup and assigns seats offline — collapses the duplicate work and gives small operators a workflow-matched SaaS.

---

## Solution

Two-sided platform with three clients:

1. **Customer client (web, mobile-first)**
   - Guest search → guest booking → online payment → SMS confirmation with operator contact phone.
   - Customer enters trip + ticket count + name + phone. **No seat selection.** Operator confirms pickup and assigns seats by callback.
   - Optional registration (phone + OTP) for booking history and faster re-booking. Guest phone auto-attaches to a matching registered account on payment success.

2. **Operator client (web, desktop-first)**
   - Mandatory registration provisioned by platform admin (out-of-app in V1).
   - Fleet, route, trip CRUD. Trip capacity is a single integer (`totalSeats`); no seat-map editor.
   - Booking queue with call-outcome tracking (reached / no-answer / callback + pickup-point). Manifest, manual booking entry, revenue report, T+3 payout view.
   - Operator staff role with scoped access to assigned bus services.

3. **Platform admin (out-of-app V1)**
   - Operator provisioning via internal script. Full admin UI deferred.

Payment in V1: MoMo + ZaloPay + Card (Visa/Master via VN PSP) + Cash-on-pickup. PayPal and Apple Pay deferred to V1.x.

SMS: eSMS.vn brandname-SMS for OTP, booking confirmations, and operator new-booking alerts.

Platform fee: 6% gross, settled T+3 post trip-completion.

---

## User Stories

### Epic 1 — Customer: Search & Discovery

1. As a guest, I want to search trips by origin, destination, date, and ticket count, so that I can find available buses.
   - AC: origin/destination required; date today-or-future; ticket count 1–10; cancelled trips excluded; trips with `availableSeats < ticketCount` excluded.
2. As a guest, I want to see a list of matching trips with operator name, departure time, price, and number of available seats, so that I can compare options.
   - AC: sorted by departure ascending; "No trips found" empty state with nearby-date suggestion.
3. As a guest, I want the search form to persist across navigation, so that I don't re-enter it when going back.
   - AC: Zustand `searchStore` holds origin/destination/date/ticketCount; back-navigation restores last query.

### Epic 2 — Customer: Booking Flow

4. As a guest, I want to click "Book" on a trip and reach the buyer-info page, so that I can start booking without creating an account.
   - AC: no login required; trip data passed via `bookingStore`; direct-URL access without store → redirect to `/search`.
5. As a guest, I want to enter my name and phone number on the buyer-info page, so that the operator can contact me.
   - AC: name 4–100 chars Unicode-diacritics OK; phone `/^(0|\+84)[35789][0-9]{8}$/`; phone pre-filled from `localStorage.busbooking_last_phone`; `POST /holds` fires on Continue; 10-min countdown starts; phone saved to localStorage on success.
6. As a customer mid-booking, I want to see a countdown timer showing hold time remaining, so that I know how long I have before my reservation expires.
   - AC: timer visible on buyer-info + review pages; color warning at T-2min; non-dismissible modal + redirect to `/search` on expiry.
7. As a guest, I want to review my booking summary (trip, ticket count, buyer info, total) before paying, so that I can confirm everything is correct.
   - AC: read-only; total fetched from server (never client-computed); hold countdown visible.
8. As a guest, I want to see a clear sold-out error if my hold request fails because capacity ran out, so that I can pick a different trip.
   - AC: API returns `409 SOLD_OUT { availableSeats }`; search results invalidated; trip shown as unavailable.

### Epic 3 — Customer: Payment

9. As a guest, I want to pick a payment method (MoMo / ZaloPay / Card / Cash-on-pickup), so that I can use what I prefer.
   - AC: `POST /bookings/initiate` accepts `paymentMethod`; returns gateway redirect URL (online methods) or pending-cash status.
10. As a guest, I want to be redirected to MoMo/ZaloPay/Card processor, so that I can pay securely.
    - AC: gateway-specific webhook returns `success/failed/cancelled`; backend verifies signature; booking transitions to `paid_operator_notified` on success.
11. As a guest paying cash-on-pickup, I want to confirm the cash option without redirection, so that I get my booking ref immediately.
    - AC: booking → `pending_cash_payment` status; SMS to customer with ref; SMS to operator's notification phone; reconciled on boarding by staff via manifest action.
12. As a guest, I want to land on a confirmation page after successful payment, so that I know my booking is confirmed.
    - AC: gateway `?status=success` → confirmation page showing booking ref, route, ticket count, buyer info, operator contact phone, SMS confirmation status label.
13. As a guest, I want to see an error state and retry option after a failed payment, so that I can try again if my hold is still valid.
    - AC: gateway `?status=failed` → retry button (online only if hold still active); otherwise prompt to re-search.

### Epic 4 — Customer: Post-Booking

14. As a customer, I want to see the operator's contact phone prominently on the confirmation page, so that I can reach them directly if needed.
    - AC: phone shown above the fold; `tel:` link on mobile; no auth required (bookingId UUID is the access key).
15. As a customer, I want to view all my past and upcoming bookings, so that I can track my trips.
    - AC: `GET /bookings` (auth required); tabs Upcoming / Past; status badge: `awaiting_payment · pending_cash_payment · paid_operator_notified · completed · cancelled · trip_cancelled · no_show · payment_failed_expired`.
16. As a customer, I want to view a booking's full detail including operator phone, so that I can contact them.
    - AC: route, departure, ticket count, buyer info, total, status, operator contact phone.
17. As a customer, I want to download a PDF ticket for a confirmed booking, so that I have proof of purchase.
    - AC: `GET /bookings/:id/ticket` returns PDF with booking ref, passenger name, ticket count, operator phone, total. **No seat numbers** (operator assigns offline).
18. As a guest whose phone matches an existing registered account, I want my booking to auto-attach to that account on payment success, so that I see it in my history when I log in.
    - AC: on `paid_operator_notified` transition, backend matches buyer phone to `customer.phone`; if match, sets `booking.customerId`; guest sees no UI change; account holder sees booking on next login.

### Epic 5 — Customer: Auth & Account (optional registration)

19. As a guest, I want to optionally register with my phone number and a one-time OTP, so that I can create an account securely.
    - AC: SMS OTP sent via eSMS; verify within 5 min; password 8–128 chars ≥1 letter + ≥1 digit; max 3 OTP resends per 15 min.
20. As a registered customer, I want to log in with phone and password, so that I can access my bookings.
    - AC: access token in-memory; refresh token in httpOnly cookie; silent refresh on page load.
21. As a customer, I want to reset my password via OTP if I forget it, so that I can regain access.
    - AC: OTP to registered phone; max 3 resends; new password must differ from old.
22. As a customer, I want to change my password from account settings, so that I can keep my account secure.
    - AC: current + new required; new must differ from current.
23. As a customer, I want to change my registered phone number with OTP verification, so that my account stays accurate.
    - AC: OTP sent to new phone; verified before switch; old phone released.
24. As a customer, I want to edit my display name, so that my bookings show the correct name.
    - AC: 4–100 chars Unicode.
25. As a customer, I want to delete my account, so that my personal data is removed per privacy law.
    - AC: soft-delete; PII anonymized; booking history retained (PDPD 2023 compliance); confirmation modal required; session invalidated immediately.

### Epic 6 — Operator: Auth & Profile (mandatory registration)

26. As an operator admin, I want to log in with phone and password, so that I can access the operator platform.
    - AC: shared auth system with customer; same JWT pattern.
27. As an operator, I want to reset my password via OTP, so that I can recover access.
    - AC: 15-min lockout after 3 failed OTP verifications.
28. As a newly provisioned operator, I want to be forced to change my temporary password on first login, so that my account is secure.
    - AC: `requiresPasswordChange` flag checked after login; cannot proceed until changed.
29. As an operator admin, I want to set a separate contact phone (customer-facing) and notification phone (receives SMS alerts), so that booking alerts don't mix with customer-visible info.
    - AC: both fields required and distinct; contact phone shown on customer confirmation pages; notification phone receives new-booking SMS.

### Epic 7 — Operator: Fleet Management

30. As an operator admin, I want to add a bus with type, capacity (integer total seats), and license plate, so that I can assign it to trips.
    - AC: `busType: coach | sleeper | limousine`; `capacity > 0`; license plate unique per operator.
31. As an operator admin, I want to edit a bus's details, so that I can keep fleet info accurate.
    - AC: cannot reduce capacity below `max(activeHolds + paidBookings)` on any future trip using this bus.
32. As an operator admin, I want to deactivate a bus, so that it's no longer assignable to new trips.
    - AC: existing scheduled trips unaffected; hidden from future trip creation dropdown.
33. As an operator admin, I want to schedule a maintenance period for a bus, so that it can't be assigned to trips during that window.
    - AC: date-range entry; future trips in window flagged; admin must manually reassign flagged trips.

### Epic 8 — Operator: Routes & Trips

34. As an operator admin, I want to create a route with origin, destination, and estimated duration, so that I can schedule trips on it.
    - AC: origin/destination free text; duration in minutes.
35. As an operator admin, I want to deactivate a route, so that no new trips can be created on it without losing history.
36. As an operator admin, I want to add pickup points to a route, so that staff can record confirmed pickup locations when calling customers.
    - AC: name + address + display order per pickup point; used in call-outcome UI and manifest pickup column.
37. As an operator admin, I want to create a trip on a route with a bus, departure time, and price, so that it's bookable by customers.
    - AC: bus must not be in maintenance, not deactivated; trip starts in `scheduled` status; sales open immediately unless explicitly closed. **Trip exposes a single integer `availableSeats` (= bus.capacity − blockedSeats − activeHolds − paidBookings).**
38. As an operator admin, I want to reassign a trip to a different bus, so that I can handle last-minute fleet changes.
    - AC: blocked if `activeHolds + paidBookings > newBus.capacity`.
39. As an operator admin, I want to cancel a trip, so that affected customers are notified and capacity is freed.
    - AC: atomic: trip → `cancelled`; bookings → `trip_cancelled`; holds → `cancelled_trip`; SMS sent to all affected customers with cancellation reason.
40. As an operator admin, I want to open or close ticket sales for a trip, so that I can control when customers can book.
    - AC: closed trip hidden from customer search; existing bookings unaffected; sales auto-close at departure time.
41. As an operator admin, I want to block a fixed number of seats on a trip, so that I can reserve capacity for walk-in / VIP customers without exposing it to online sales.
    - AC: `blockedSeats` integer per trip; cannot block more than current `availableSeats`. **Block is a capacity reservation, not specific seat IDs.**
42. As an operator admin, I want to create a recurring trip template (route, time, days of week, date range), so that individual trip records are generated automatically.
    - AC: each generated trip independent after creation; editing one doesn't affect others.
43. As an operator admin, I want to quickly create a paired return trip from an existing outbound trip, so that I don't re-enter all the details.
    - AC: pre-fills origin↔destination swap, same bus + price; operator enters return departure time; display-only pairing.

### Epic 9 — Operator: Booking Management

44. As an operator admin, I want to receive an in-app notification badge and SMS when a new booking is paid, so that I can follow up quickly.
    - AC: badge count on operator dashboard nav; SMS to operator notification phone with booking ref + buyer phone.
45. As an operator admin, I want to see a queue of new paid bookings sorted by departure, so that I can prioritize contact.
    - AC: filters: bus, service date, route, contact status.
46. As an operator admin, I want to view a booking's full detail (buyer name, phone, ticket count, trip), so that I can prepare for the call.
47. As an operator admin / staff, I want to record the outcome of a customer call (reached / no-answer / callback) and the confirmed pickup point, so that the manifest stays accurate.
    - AC: outcome saved on booking; pickup point updates manifest; free-text pickup note allowed if route has no configured pickup points; dropdown if it does.
48. As an operator admin, I want to create a walk-in or phone-in booking directly, so that offline customers are tracked in the system.
    - AC: no hold, no payment gateway; status → `paid_operator_notified` (or `pending_cash_payment` if cash); SMS confirmation sent to customer; manifest flags as "manual booking".
49. As an operator admin / staff, I want to record an escalation note on an unresolvable booking, so that issues are tracked for follow-up.
    - AC: free-text escalation note; booking flagged in list view.

### Epic 10 — Operator: Operations & Manifest

50. As an operator admin / staff, I want to view the passenger manifest for a service (name, phone, ticket count, pickup point, contact status, payment status), so that I can manage day-of operations.
    - AC: manual refresh; "Last updated" timestamp; **no seat-number column** (operator assigns offline using paper or external tool); cash-on-pickup bookings flagged.
51. As an operator staff, I want to mark individual passengers as picked up on the manifest, so that I track boarding in real time.
    - AC: toggle per passenger; persisted server-side.
52. As an operator staff, I want to mark a cash-on-pickup booking as collected at boarding, so that the manifest reflects payment status accurately.
    - AC: action transitions booking → `paid_operator_notified`; payout calc includes amount.
53. As an operator admin / staff, I want to mark a trip as departed, so that the system reflects the service is underway.
    - AC: trip status → `departed`; no further bookings possible.
54. As an operator admin / staff, I want to mark a trip as completed, so that payout processing can begin.
    - AC: trip status → `completed`; triggers T+3 payout job; auto-complete cron also handles this.
55. As an operator admin, I want to see a list of upcoming departures with assigned bus and booked-ticket count, so that I can spot scheduling issues.
    - AC: sorted by departure; filter by route.

### Epic 11 — Operator: Revenue & Payout

56. As an operator admin, I want to view a revenue report filtered by trip / date range, so that I understand my earnings.
    - AC: excludes `trip_cancelled`, `payment_failed_expired`, `cancelled` bookings; shows gross, platform fee (6%), net payout per trip.
57. As an operator admin, I want to export booking revenue data as CSV, so that I can use it in my own accounting.
    - AC: columns: bookingRef, route, departure, buyerName, buyerPhone, ticketCount, total, paymentMethod, status.
58. As an operator admin, I want to see payout status per trip (`pending / processing / settled / failed`), so that I can track disbursements.
    - AC: settled T+3 post-completion; failed payouts shown with admin-triggered manual retry button.

### Epic 12 — Operator: Staff Management

59. As an operator admin, I want to add a staff member with phone and name, so that they can log in to the operator platform.
    - AC: system provisions account; temporary password sent via SMS; role = "Operator Staff" (no role granularity in V1).
60. As an operator admin, I want to edit or disable a staff member, so that access is revoked when they leave.
    - AC: disabled staff cannot log in; existing session invalidated.
61. As an operator admin, I want to assign a staff member to a specific bus service, so that they can view and manage that service's manifest and bookings.
    - AC: single staff per service in V1.

### Epic 13 — Operator Staff Client

62. As operator staff, I want my dashboard to show only my currently assigned service, so that I see only what's relevant to me.
    - AC: scoped to assigned bus service; shows booked passenger count + pending follow-up count.
63. As operator staff, I want to call customers and record the outcome + confirmed pickup point, so that the manifest is accurate before departure.
    - AC: same flow as story 47, scoped to assigned service only.
64. As operator staff, I want to view the manifest for my assigned service, so that I can manage boarding.
    - AC: same as story 50, scoped to assigned service.
65. As operator staff, I want to mark my assigned service as departed and completed, so that the trip lifecycle is updated.

### Epic 14 — System: Notifications

66. As a customer, I want to receive an SMS with my booking ref and operator phone after successful payment, so that I have my booking details offline.
    - AC: sent immediately on `paid_operator_notified` transition.
67. As a customer, I want to receive an SMS reminder 24 hours before departure, so that I don't miss my bus.
    - AC: cron-driven; skips cancelled / trip-cancelled.
68. As a customer, I want to receive an SMS when my trip is cancelled by the operator, so that I'm notified immediately.
    - AC: sent atomically with trip cancellation; includes cancellation reason.
69. As an operator, I want to receive an SMS to my notification phone when a new booking is paid, so that I know to follow up.
    - AC: sent on `paid_operator_notified` transition; includes buyer name, phone, trip details.

### Epic 15 — Platform Admin

70. As a platform admin, I want to provision a new operator account with a temporary password, so that the operator can onboard.
    - AC: creates operator record + admin user with `requiresPasswordChange = true`; out-of-app (CLI script) in V1; no UI required.

---

## Implementation Decisions

### Stack

- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Zustand for client stores (`searchStore`, `bookingStore`, `holdTimerStore`, `authStore`).
- **Backend:** Next.js Route Handlers + Server Actions. Pure server-only modules for business logic (independently importable, testable without HTTP).
- **DB:** Postgres (Neon or Supabase). Prisma ORM. UUID v7 ids for bookings, holds, trips.
- **Auth:** Custom phone+OTP via eSMS; JWT (HS256) access token in memory, refresh token in httpOnly Secure SameSite=Lax cookie. Silent refresh on app boot.
- **SMS:** eSMS.vn brandname SMS. Abstracted behind `NotificationModule` so a stub adapter is used in dev/test.
- **Payments:** MoMo, ZaloPay, Card-via-VN-PSP (Onepay or NgânLượng — final pick post-PSP onboarding), Cash-on-pickup (no gateway). PayPal + Apple Pay deferred.
- **Jobs:** Cron worker (`@vercel/cron` or a node process) for hold-expiry, trip auto-complete, 24h SMS reminders, payout processing.
- **PDF:** `@react-pdf/renderer` server-side for ticket generation.

### Major modules (server-side, importable in isolation)

- **AuthModule** — phone+OTP register / login / refresh / password change / reset / phone change / account delete. Shared by customer + operator clients. Issues JWTs.
- **OTPModule (deep)** — code gen, hash + store, verify, rate-limit (max 3 sends / 15 min per phone), attempt tracking, expiry (5 min). eSMS adapter injected. Pure logic + thin adapter.
- **NotificationModule (deep)** — typed templates (`bookingConfirmation`, `tripCancelled`, `reminder24h`, `operatorNewBooking`, `staffTempPassword`), eSMS adapter, send-log table for audit, retry policy.
- **SearchModule** — trip query by origin/destination/date/ticketCount; filters out cancelled, closed-sales, in-maintenance bus trips, sold-out (< ticketCount available); sort by departure asc.
- **HoldModule (deep)** — atomic `createHold(tripId, ticketCount)` using SQL `UPDATE ... WHERE availableSeats >= ticketCount RETURNING` for race-free decrement; 10-min TTL; expiry sweeper job; release on payment failure / expiry / cancel.
- **BookingModule** — initiate (creates booking from hold + selected payment method), gateway router, webhook handlers, status state machine (`awaiting_payment → paid_operator_notified | payment_failed_expired | pending_cash_payment`, plus `trip_cancelled / cancelled / completed / no_show`). On `paid_operator_notified`, fires guest-account auto-attach + customer/operator SMS.
- **PaymentModule (deep at adapter layer)** — `PaymentGateway` interface with adapters: `MomoAdapter`, `ZaloPayAdapter`, `CardAdapter`, `CashAdapter`. Each implements `init(booking) → redirectUrl | pendingStatus` + `verifyWebhook(payload, signature) → { status, externalRef }`. Webhook receiver routes to the right adapter by booking metadata.
- **OperatorModule** — fleet (Bus CRUD + maintenance windows), routes (Route CRUD + PickupPoint subcollection), trips (Trip CRUD + open/close sales + block-seats + cancel + reassign-bus + recurring template + paired-return), booking queue + call-outcome, manifest, manual booking entry, staff CRUD + service assignment.
- **PayoutModule (deep)** — pure-function calculator `calcPayout({ grossPaidBookings, platformFeePct: 0.06 }) → { gross, fee, net }`; state machine `pending → processing → settled | failed`; T+3 trigger from completed trips; manual-retry endpoint for failed.
- **AdminModule** — operator provisioning CLI in V1: `pnpm script:provision-operator --legalName --contactPhone --notificationPhone --adminName --adminPhone`. Creates operator + admin user with temp password + `requiresPasswordChange = true`.

### Schema highlights (Prisma)

- `Customer` (optional account): id, phone (unique), passwordHash?, name, createdAt, deletedAt (soft-delete).
- `Operator`: id, legalName, contactPhone, notificationPhone, createdAt.
- `OperatorUser`: id, operatorId, phone (unique within operator), passwordHash, name, role (`admin | staff`), requiresPasswordChange, assignedTripId?, disabledAt?.
- `Bus`: id, operatorId, type, capacity, licensePlate (unique per operator), deactivatedAt?.
- `BusMaintenance`: id, busId, startsAt, endsAt, reason.
- `Route`: id, operatorId, origin, destination, durationMinutes, deactivatedAt?.
- `PickupPoint`: id, routeId, name, address, displayOrder.
- `Trip`: id, operatorId, routeId, busId, departureAt, price, status (`scheduled | departed | completed | cancelled`), salesClosed (bool), blockedSeats (int), cancelledReason?, createdFromTemplateId?.
  - Derived: `availableSeats = bus.capacity − blockedSeats − activeHolds − paidBookings`.
- `RecurringTripTemplate`: id, operatorId, routeId, busId, time, daysOfWeek (bitmask), startDate, endDate, price.
- `Hold`: id, tripId, ticketCount, customerPhone, expiresAt, status (`active | converted | expired | cancelled_trip`).
- `Booking`: id (UUID v7), bookingRef (human-readable, e.g. `BB-2026-A4F2`), tripId, holdId?, customerId? (auto-attached on payment), buyerName, buyerPhone, ticketCount, total, paymentMethod, paymentExternalRef?, status, callOutcome?, confirmedPickupPointId?, pickupNote?, escalationNote?, isManual, pickedUpAt?, createdAt.
- `Payout`: id, tripId, gross, platformFee, net, status, scheduledAt, settledAt?, failureReason?.
- `NotificationLog`: id, channel (`sms`), template, recipient, payload, status, sentAt, externalRef.
- `OtpAttempt`: id, phone, codeHash, purpose, expiresAt, consumedAt?, attempts (int).

### API surface (selected)

- `POST /api/auth/otp/send` — body `{ phone, purpose }`; rate-limited.
- `POST /api/auth/otp/verify` — body `{ phone, code, purpose }` → tempToken.
- `POST /api/auth/register` — body `{ tempToken, password, name }`.
- `POST /api/auth/login` — body `{ phone, password, scope: customer|operator }`.
- `POST /api/auth/refresh` — uses httpOnly cookie.
- `GET /api/trips/search?origin&destination&date&ticketCount`.
- `POST /api/holds` — body `{ tripId, ticketCount, buyerName, buyerPhone }` → `{ holdId, expiresAt }` or `409 SOLD_OUT { availableSeats }`.
- `POST /api/bookings/initiate` — body `{ holdId, paymentMethod }` → online: `{ redirectUrl }`; cash: `{ bookingId, status: 'pending_cash_payment' }`.
- `POST /api/payments/webhook/:gateway` — verifies signature; transitions booking.
- `GET /api/bookings/:id` — guest accessible if matched by id only; auth required for list.
- `GET /api/bookings/:id/ticket` — PDF stream.
- `GET /api/bookings` (auth) — `?tab=upcoming|past`.
- Operator namespace under `/api/op/*`: `buses`, `routes`, `trips`, `trips/:id/cancel`, `trips/:id/sales-toggle`, `trips/:id/block-seats`, `trips/:id/reassign-bus`, `trips/:id/manual-booking`, `bookings/:id/call-outcome`, `bookings/:id/picked-up`, `staff`, `staff/:id/assign-service`, `reports/revenue`, `reports/payouts`.

### Architectural decisions

- **No customer-facing seat selection anywhere.** UI never shows a seat map. Trip capacity exposed as one integer. This shapes hold, booking, manifest, PDF, manual-booking, block-seats, reassign-bus all uniformly.
- **Atomic hold creation** prevents oversell races: single SQL statement combining capacity check + decrement-by-insert using a derived column expression; no application-level read-then-write.
- **Guest auto-attach** runs server-side on the `paid_operator_notified` transition only — never trusts client-supplied customer id.
- **Token strategy:** access token in memory only (never localStorage); refresh in httpOnly cookie; CSRF protection via SameSite=Lax + double-submit token on state-changing requests.
- **eSMS as single point of SMS dispatch** behind an interface lets dev/test use a console-log stub and lets us swap providers without business-logic changes.
- **Payout pure-function core** lets all financial math run in tests without DB.
- **Soft-delete customer for PDPD 2023:** anonymize PII but retain booking history (legal retention for transport records).
- **Operator provisioning out-of-app V1** keeps admin-UI scope cut; CLI documents the contract and lets a UI follow in V1.x without rework.

---

## Testing Decisions

### Principles

- **Test external behavior, not implementation.** Unit tests assert on module return values + DB side-effects (real Postgres in test container), not on internal helpers.
- **Integration tests over the HTTP boundary** for at least one happy path + one failure path per route handler.
- **No mocking the database.** Use a real Postgres in CI (testcontainers or service container). Mocks-of-DB hide migration drift.
- **Mock external boundaries only:** eSMS adapter, payment gateways. These have signature-verify logic that gets its own focused unit tests using vendor-supplied sample payloads.

### Modules with isolated unit tests (V1 must-haves)

1. **OTPModule** — code gen randomness, hash equality, rate limit enforcement (3/15 min), expiry (5 min boundary), max attempts, eSMS stub call counts.
2. **HoldModule** — concurrent-hold race test (spawn N concurrent attempts on a single-seat trip; assert exactly 1 succeeds, rest return `SOLD_OUT`); 10-min TTL expiry; release on conversion; release on cancel.
3. **PaymentModule gateway adapters** — `MomoAdapter.verifyWebhook` with vendor sample payloads (valid + tampered signatures); `ZaloPayAdapter` same; `CardAdapter` same; `CashAdapter.init` returns pending-cash without external call; status-mapping coverage per adapter.
4. **PayoutModule** — pure-function table: gross of various bookings → net; 6% fee precision (round half-even); excludes-cancelled invariant; state-machine transitions including `failed` retry path.

### Integration tests (HTTP-level)

- `POST /api/holds` happy path + `409 SOLD_OUT`.
- `POST /api/bookings/initiate` for each `paymentMethod` returning correct shape.
- `POST /api/payments/webhook/:gateway` end-to-end: receive vendor sample → booking transitions → SMS dispatched (asserted via NotificationLog) → guest auto-attach when phone matches existing customer.
- `POST /api/op/trips/:id/cancel` → all bookings transition to `trip_cancelled`, holds to `cancelled_trip`, SMS log entries created for each.
- `POST /api/auth/otp/send` rate-limit behavior over the wire.

### Prior art

None — greenfield. Test conventions to seed in repo on first iteration:
- `tests/unit/<module>.test.ts` — Vitest, real Postgres via testcontainers.
- `tests/integration/<route>.test.ts` — `next-test-api-route-handler` or Playwright API testing.
- `tests/e2e/*.spec.ts` — Playwright for the booking golden path (search → hold → cash-pay → confirmation → SMS log assertion).

---

## Out of Scope

- **Customer seat selection / seat maps anywhere in product.** Operator-only, offline.
- **Real-time bus tracking / GPS.**
- **Customer-to-customer features:** ratings, reviews, social.
- **Operator-to-operator features:** inter-operator transfers, fleet sharing.
- **Multi-currency / non-VND pricing.**
- **Multi-language UI** beyond Vietnamese + English; deeper i18n deferred.
- **Mobile native apps** (iOS / Android) — web-only V1, PWA-grade mobile web target.
- **PayPal + Apple Pay** payment methods — deferred to V1.x post-launch.
- **Platform admin UI** — operator provisioning is CLI-only in V1.
- **Granular operator roles** beyond `admin` and `staff` (no finance-only, dispatcher-only, etc.).
- **Loyalty program / points / promo codes.**
- **Group/family booking with named passengers per ticket** — V1 ticket count only; one buyer name covers the group.
- **Refund automation** — V1 refunds are handled manually by operator + finance.
- **Webhooks for operators** to push booking events into their own systems — V1 SMS + dashboard only.

---

## Further Notes

- **PDPD 2023 compliance:** PII inventory + lawful-basis mapping required before launch (run `/pii-inventory` and `/gdpr-preflight` — adapt to VN PDPD).
- **PSP onboarding lead time** (Visa/Master via VN PSP) is the single biggest schedule risk for V1 payment scope. If onboarding slips past code-complete, Cards ship in V1.1.
- **eSMS deliverability** to all VN carriers (Viettel / Vinaphone / MobiFone / Vietnamobile) must be verified before launch; OTP failure-to-deliver is a hard blocker on registration + booking confirmation flows.
- **6% platform fee** is a business assumption — not validated yet. Run `/willingness-to-pay-test` or `/take-rate-experiment` with at least 2 pilot operators before fee is contractually committed.
- **Hold duration (10 min)** is an assumption; tune post-launch from data on payment completion time per gateway.
- **Auto-attach on phone match** has a privacy edge case: if a registered customer's phone gets recycled by a carrier and reassigned to a different person, that new person's guest bookings will attach to the wrong account. Mitigation: re-verify phone via OTP on `attached_at` if last login > 6 months. Defer to V1.1.
- **Booking ref format** `BB-YYYY-XXXX` where `XXXX` is base36 random. ~1.7M unique refs per year — collision-checked on insert.

---

## Next steps

1. `/prd-to-issues` — decompose this PRD into individual issue files in `issues/`.
2. `/prioritize` — rank issues by MoSCoW + RICE to define V1 scope cut.
3. `/data-model-design` — formalize the Prisma schema sketched above.
4. `/api-contract` — write OpenAPI / typed contracts for the routes listed.
5. `/threat-model-pre` — surface payment + OTP attack surfaces before the first commit of auth code.
