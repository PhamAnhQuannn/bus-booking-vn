# Domain Model (DDD Analysis)

> Research date: 2026-06-17. Multi-agent synthesis (4 Sonnet researchers + 1 Opus synthesizer).

## Bounded Contexts

```
CORE PLATFORM
+---------------------------------------------------------------------+
|                                                                     |
|  [SEARCH & DISCOVERY] ---> [BOOKING & HOLD] ---> [PAYMENT &        |
|   (read projection         (seat reservation      RECONCILIATION]   |
|    across tenants)           + booking lifecycle)  (PSP-agnostic    |
|         |                        |                  ACL boundary)   |
|         v                        v                      |           |
|  [PLACE]                   [TICKETING]             [LEDGER &        |
|   (canonical global         (QR token,              PAYOUT]         |
|    location registry)        PDF, boarding)         (double-entry,  |
|                                                      immutable)     |
+---------------------------------------------------------------------+
         |                         |                      |
         v                         v                      v
+------------------+  +----------------+  +--------------------------+
| FLEET CATALOG    |  | IDENTITY &     |  | OPERATOR ONBOARDING      |
| (Route/Bus/Trip/ |  | ACCESS         |  | (KYB, approval,          |
|  Template/       |  | (3 isolated    |  |  payout account,         |
|  PickupArea)     |  |  auth realms)  |  |  tax classification)     |
+------------------+  +----------------+  +--------------------------+
         |
         v
+------------------+  +----------------+  +--------------------------+
| MANIFEST &       |  | NOTIFICATION   |  | CHARTER / LEAD-GEN       |
| BOARDING         |  | (async queue,  |  | (state machine,          |
| (check-in,       |  |  SMS + email)  |  |  first-accept dispatch,  |
|  no-show,        |  |                |  |  NO payment rail)        |
|  contact status) |  |                |  |                          |
+------------------+  +----------------+  +--------------------------+
```

## Core vs Supporting vs Generic Classification

### Core Domain (build in-house, competitive advantage, never outsource)

| Context | Justification |
|---|---|
| Search & Discovery | Diacritic-insensitive Vietnamese place search; computed availability (never stored); facet-vs-pagination design; maintenance window overlap filtering. Customer acquisition funnel. |
| Booking & Hold | TTL-based seat reservation with SELECT FOR UPDATE serialization; atomic multi-seat holds; monotonic state machine; guest-first with retroactive linking. Money-safety layer. |
| Payment & Reconciliation | PaymentGateway ACL normalizes MoMo/VNPay/VietQR into CanonicalPaymentEvent. Adapter isolation means PSP changes touch one file. HMAC verification, amount guard, oversell-race refund. |
| Ticketing | Zero-PII QR token (HS256, deterministic, no exp); single-use atomic check-in; public verify page. Last-mile trust mechanism replacing paper tickets. |
| Charter/Contract Matching | Lead-gen state machine with concurrent claim race resolution. Uncontested vertical -- no competitor has this. |

### Supporting Domain (build in-house but not differentiating)

| Context | Justification |
|---|---|
| Identity & Access (3 realms) | Three isolated auth systems (Customer OTP, Operator password, Admin password+TOTP) with separate signing secrets, session tables, JWT claims. Important for security but not a market differentiator. |
| Operator Onboarding & KYB | Application flow, document upload via signed URLs, approval state machine, payout account verification. Necessary for supply-side quality but standard marketplace infrastructure. |
| Fleet Catalog | Route/Bus/Trip/RecurringTemplate management. Tenant-scoped (operatorId in every WHERE). Standard CRUD with capacity invariants. |
| Manifest & Boarding | Per-trip passenger list with check-in/no-show tracking, custom pickup contact status. Operational tooling for operators. |
| Ledger & Payout | Double-entry append-only ledger (DB trigger enforced); BigInt VND arithmetic; FeeConfig effective-dated; T+1/T+3 payout scheduling. Critical for money correctness but not customer-facing. |
| Notification | Queue-based (NotificationLog rows), cron dispatch, retry/backoff, template pre-rendering. Standard async delivery infrastructure. |

### Generic Domain (buy/use off-the-shelf)

| Capability | Provider | Notes |
|---|---|---|
| Email delivery | Resend | Thin wrapper in `lib/notification/email.ts` |
| SMS delivery | eSMS | Vietnam-specific A2P provider; `esmsClient.ts` |
| File storage | S3-compatible | Signed URLs only; DB stores key, never bytes |
| Observability | Sentry | `captureException` wrapper |
| E-invoicing | MISA meInvoice | Vietnam Circular 78/2021 mandate |
| Rate limiting | Redis (ioredis) | `ratelimit.limit(ip)` returning `{allowed, remaining, retryAfter}` |
| Feature flags | Postgres FeatureFlag table | env-override then cached DB row then caller default |

## Aggregate Roots with Key Invariants

**1. Trip** (Fleet Catalog aggregate root)
- I1: `availableSeats = capacity - held - booked` (NEVER raw capacity, computed at query time)
- I8: Hold creation serializes on Trip via `SELECT FOR UPDATE`
- I10: Maintenance window check is window-overlap, not "is active right now"
- I19: `departedAt`/`completedAt` always written with corresponding status in same UPDATE

**2. Booking** (Booking & Hold aggregate root)
- I5: Monotonic state machine -- `legalPredecessors(target)` guards every UPDATE; no regression
- I6: `totalVnd = trip.price x hold.ticketCount` -- never from client-provided price
- I20: Single-use check-in via conditional WHERE (`SET checkedInAt = NOW() WHERE checkedInAt IS NULL`)
- Contains: `PaymentEvent[]`, `ConsentRecord[]`, `NotificationLog[]`, `LedgerEntry[]`, `EInvoice[]`

**3. Operator** (Tenant boundary aggregate root)
- I11: Every mutating query includes `operatorId = <from JWT>` in WHERE (defense in depth)
- I17: Status transitions only via `transitionOperatorStatus` with row lock
- PayoutAccount verification resets on ANY field edit

**4. LedgerEntry** (Ledger aggregate root -- truly immutable)
- I2: DB trigger raises on UPDATE or DELETE -- application code cannot circumvent
- I3: All currency math in BigInt; fee rates stored as ppm integers (60000 = 6%)
- I4: `sourceEventId` unique -- duplicate appends are no-ops (P2002 catch)

**5. CharterRequest** (Charter aggregate root)
- I18: Transitions only via `transitionCharterRequest` with `SELECT FOR UPDATE`
- Concurrent claim race: two operators racing PUBLISHED->ACCEPTED -- exactly one wins
- No payment rail -- explicitly lead-gen only

**6. Hold** (managed entity within Booking aggregate)
- Cannot be consumed after `expiresAt`
- Status: `active -> consumed | expired | cancelled_trip`
- `customPickupRequested` always in sync with `pickupKind === 'custom'` (SQL CHECK)

**7. Place** (global, not tenant-scoped)
- Canonical name + aliases + slug; slug globally unique
- Drives search typeahead and route creation
- No operator FK -- shared across all tenants

## Critical Cross-Context Domain Events

| Event | From Context | To Context(s) | Coupling Style |
|---|---|---|---|
| PaymentConfirmed | Payment | Ledger (2 entries: booking_credit + platform_fee), Notification (2 rows: customer + operator), Ticketing (PDF schedule) | Synchronous within same DB tx for Ledger + Notification; async `after()` for PDF |
| TripCancelled | Fleet Catalog | Booking (fan-out: paid -> trip_cancelled for all bookings), Ledger (refund_debit + refund_out per booking), Notification (customer refund SMS) | Same tx for hold cancel + booking transition; notification enqueue |
| OversoldRefundTriggered | Payment (capacity gone at webhook time) | Booking (-> refunded), Ledger (refund_out) | Async post-commit via `after()` |
| TripCompleted | Fleet Catalog | Ledger (T+3 payout job via `NotificationLog.scheduledFor`) | Async via cron predicate column |
| OperatorApproved/Suspended | Onboarding | Fleet Catalog (visibility gate via `isBookable()`) | Booking-time re-check |
| CharterAccepted | Charter | Notification (customer match SMS + email) | Post-commit enqueue |

## Context Map -- Integration Patterns

| Upstream | Downstream | Pattern |
|---|---|---|
| External PSP (MoMo/VNPay) | Payment & Reconciliation | **Anti-Corruption Layer** (`PaymentGateway` interface). Native result codes never cross adapter boundary. Most important architectural boundary. |
| Fleet Catalog | Search & Discovery | **Customer-Supplier**: Search is a read projection. No write coupling. |
| Fleet Catalog | Booking & Hold | **Customer-Supplier**: Hold FK to Trip; Booking FK to Trip. Shared Prisma types. |
| Booking & Hold | Payment | **Customer-Supplier**: PaymentEvent FK to Booking; webhook drives BookingStatus. Same Prisma schema. |
| Payment | Ledger & Payout | **Customer-Supplier**: Webhook appends ledger entries atomically with paid transition. Same transaction. |
| Notification | eSMS / Resend | **Conformist**: Thin wrapper clients (`esmsClient`, `email.ts`). Provider change touches one file. |
| MISA E-Invoice | Booking | **Downstream Conformist**: Booking data formatted to MISA invoice format via `misaClient.ts`. |
| Identity & Access | All write operations | **Infrastructure**: Edge-runtime JWT verify in middleware. Three isolated realms with separate secrets. |

## Never-Couple Boundaries

- **Customer Auth / Operator Auth / Admin Auth** -- three separate table hierarchies, signing secrets, session stores
- **Charter / Payment** -- charter is lead-gen only; if paid charter rail ever needed, it is a separate bounded context
- **LedgerEntry / any domain that might update it** -- INSERT-only, DB trigger enforced
- **Operator-owned resources / cross-operator reads** -- only Search & Discovery reads across tenants
