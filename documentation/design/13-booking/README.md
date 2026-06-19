> ← [Previous](../12-search/) | [Index](../README.md) | [Next →](../14-ticketing/)

## 13. Booking & Hold Flow

### 13.1 Why Holds Exist

Between "I want this trip" and "I've paid", time passes (entering buyer info, choosing payment method, completing payment). Without holds, someone else could buy the seats while you're filling in the form.

A **hold** temporarily reserves seats for a specific buyer. It has a TTL (Time-To-Live — a countdown timer) after which the seats are automatically released.

### 13.2 The Full Booking Flow

```
1. Customer picks a trip (2 seats)
   │
2. POST /api/holds → creates Hold(tripId, seatCount=2, expiresAt=now+15min, status=active)
   │                  Available seats: capacity - paid - held (including this new hold)
   │                  Returns: holdId + expiresAt
   │
3. Customer enters buyer info (name, phone, email)
   │
4. /booking/review page shows: trip details + price + buyer info + countdown timer
   │                           Timer reads from Redis (UX) but truth is DB Hold.expiresAt
   │
5. Customer clicks "Pay" → POST /api/bookings/initiate
   │  Server: verify hold still active + extend if needed → create Payment(pending) → return PSP URL
   │
6. Customer redirected to PSP (MoMo/VNPay/etc.)
   │
7. Customer completes payment in PSP
   │
8. PSP sends webhook → POST /api/payments/momo/webhook
   │  Server (inside one transaction):
   │    - Verify HMAC signature
   │    - Match by orderRef, verify amount
   │    - Idempotency check (providerTxnId)
   │    - SELECT ... FOR UPDATE on Trip row
   │    - Create Booking(status=paid, seatCount=2)
   │    - Transition Hold(status=active → consumed)  ← same transaction!
   │    - Create LedgerEntry(booking_credit) + LedgerEntry(platform_fee)
   │    - COMMIT
   │
9. Enqueue async: send SMS confirmation + generate PDF ticket + send email
   │
10. Customer sees "Booking confirmed! Ref: BB-2026-a3x7-k9m2"
```

### 13.3 Hold TTL vs Payment Timing

The hold must outlast the payment process. If the hold expires while the customer is mid-payment, the seats get released and sold to someone else — then the first customer's payment confirms for seats that no longer exist.

| Duration | Event |
|----------|-------|
| 0:00 | Hold created (15-minute TTL) |
| 2:00 | Customer enters buyer info |
| 4:00 | Customer clicks "Pay" → hold validated + extended if < 5 min remaining |
| 4:30 | Redirected to MoMo |
| 5:00 | Customer authorizes in MoMo |
| 6:00 | MoMo webhook arrives → booking created, hold consumed |

**Safety net**: If the hold genuinely expires before payment confirms → on webhook-paid, check if seats are still free. If yes → honor the booking. If no (someone else booked) → **refund-out** to the customer (rare but possible).

### 13.4 Inventory DoS Protection

**The attack**: A malicious actor creates holds on every seat of a popular trip, waits 15 minutes (hold expires), repeats. The trip appears "fully booked" to real customers even though no one is paying.

**Defense**: Per-IP and per-customer concurrent hold cap. One IP address can hold seats on at most N trips simultaneously. Exceeding the cap → 429 Too Many Requests.

### 13.5 Hold Expiry Sweeper

A background job (cron, every 1-2 minutes) finds all holds where `expiresAt < NOW() AND status = active` and transitions them to `status = expired`. This releases the seats for other buyers.

The sweeper is idempotent — running it twice has no effect on already-expired holds. And at read time, expired holds are also treated as free (belt AND suspenders).

### 13.5b Booking Status State Machine

**Booking status** (enum `BookingStatus` — `prisma/schema.prisma`):

```
  awaiting_payment ──┬──→ paid_operator_notified ──→ completed
                     │
  pending_cash_payment ──→ paid_operator_notified ──→ completed
                     │
                     ├──→ cancelled (customer-initiated)
                     ├──→ trip_cancelled (trip-level cascade)
                     ├──→ no_show (operator marks at departure)
                     └──→ payment_failed_expired (payment timeout / PSP failure)
```

| Status | Meaning | Terminal? |
|--------|---------|-----------|
| `awaiting_payment` | Hold converted, redirected to PSP | No |
| `pending_cash_payment` | Cash booking, awaiting boarding-day collection | No |
| `paid_operator_notified` | Payment confirmed, operator notified via SMS/email | No |
| `completed` | Trip completed, payout scheduled | Yes |
| `cancelled` | Customer cancelled before departure | Yes |
| `trip_cancelled` | Operator cancelled the entire trip — cascaded to all bookings | Yes |
| `no_show` | Passenger did not board (operator marks on manifest) | Yes |
| `payment_failed_expired` | PSP payment failed or hold expired without payment | Yes |

#### `bb_hold` Cookie Security

The booking initiate route verifies that the `bb_hold` cookie value matches the `holdId` in the request body — else `403 Forbidden`. This prevents a user from initiating a booking against someone else's hold.

#### Initiate Error Code Map

| Error | HTTP | When |
|-------|------|------|
| `hold_not_found` | 404 | Hold ID doesn't exist |
| `hold_expired` | 409 | Hold TTL elapsed |
| `trip_departed` | 409 | Trip already departed |
| `ref_collision` | 503 | Booking ref generation collision (retry) |
| `gateway_error` | 502 | PSP returned an error |
| `cookie_mismatch` | 403 | `bb_hold` cookie ≠ request `holdId` |
| `rate_limit` | 429 | Per-IP rate limit exceeded; `retryAfter` in body |

#### MoMo Payment Polling

After redirect to MoMo, the result page uses `<meta httpEquiv="refresh">` every 5 seconds to poll for payment status. Poll count is tracked via `?r=` URL counter, capped at 24 iterations (~2 minutes). After 24 polls, the auto-refresh stops and a manual "Tải lại" (reload) link is shown.

### 13.6 Trip Lifecycle State Machine

**Trip status** (enum `TripStatus` — `prisma/schema.prisma`):

```
  scheduled ──┬──→ departed ──→ completed
              │
              └──→ cancelled
```

| Transition | Trigger | Guard | Side effects |
|-----------|---------|-------|-------------|
| scheduled → departed | `markDeparted()` or operator UI | `departureAt` check | Sets `departedAt`, `salesClosed=true`; no new holds/bookings |
| departed → completed | `markCompleted()` or `autoCompleteTrips` cron | Must be `departed` | Sets `completedAt`; creates Payout row with `scheduledAt = completedAt + 1 day` (T+1) |
| scheduled/departed → cancelled | `cancelTrip()` | Not already cancelled | Cascades: bookings → `trip_cancelled` (refund issued), holds → `cancelled_trip`; idempotent (second cancel returns `{ alreadyCancelled: true }`) |

Note: `salesClosed` is a boolean independent of status — an operator can close sales on a scheduled trip without departing it.

### 13.7 Operator Approval State Machine

**Operator status** (source: `lib/onboarding/operatorStatus.ts` → `LEGAL_OPERATOR_TRANSITIONS`):

```
  PENDING_REVIEW ──→ UNDER_REVIEW ──┬──→ APPROVED ←──→ SUSPENDED
                                    │
                                    └──→ REJECTED ──→ PENDING_REVIEW
                                                       (resubmit)
```

| Transition | Who | Side effect |
|-----------|-----|------------|
| PENDING_REVIEW → UNDER_REVIEW | Admin | — |
| UNDER_REVIEW → APPROVED | Admin (step-up) | Clears `disabledAt`; creates operator login credentials |
| UNDER_REVIEW → REJECTED | Admin | Sets `rejectionReason`; operator can resubmit |
| REJECTED → PENDING_REVIEW | Operator | Resubmit with updated application |
| APPROVED → SUSPENDED | Admin | Sets `disabledAt`; trips hidden from search |
| SUSPENDED → APPROVED | Admin | Clears `disabledAt`; trips re-visible |

Each transition enqueues SMS + email notifications via `NotificationLog`.

### 13.8 Charter Request State Machine

**Charter status** (source: `lib/charter/charterStatus.ts` → `LEGAL_CHARTER_TRANSITIONS`):

```
  SUBMITTED ──→ ADMIN_REVIEW ──┬──→ ASSIGNED_DIRECT ──┬──→ ACCEPTED ──→ COMPLETED
              ↑                │                       │
              │                │                       └──→ DECLINED ──┐
              │                │                                       │
              │                ├──→ PUBLISHED ──┬──→ ACCEPTED          │
              │                │                │                      │
              │                │                └──→ EXPIRED ──────────┤
              │                │                                       │
              │                └──→ REJECTED                           │
              │                                                        │
              └────────────── (re-route from DECLINED / EXPIRED) ──────┘
```

**Customer-cancellable states**: `SUBMITTED`, `ADMIN_REVIEW`, `ASSIGNED_DIRECT`, `PUBLISHED` (defined in `CUSTOMER_CANCELLABLE_STATUSES`). Once an operator accepts, the customer can no longer cancel.

**Key guard**: `PUBLISHED → ACCEPTED` uses an atomic SQL UPDATE:
```sql
UPDATE "CharterRequest"
SET status = 'ACCEPTED', "assigneeOperatorId" = ?
WHERE id = ? AND status = 'PUBLISHED' AND "assigneeOperatorId" IS NULL;
```
If 0 rows affected → someone else claimed first → 409.

**Terminal states**: `REJECTED`, `COMPLETED`, `CANCELLED` — no further transitions.

### 13.9 Pickup Points & Stop Management

Where do passengers board? This question seems simple — "at the bus station" — but Vietnam's inter-city bus market has multiple boarding patterns: formal stations (bến xe), door-to-door pickup points, and customer-requested locations. This subsystem manages all three.

#### Three Pickup Kinds

| Kind | Vietnamese | Example | Who defines it |
|------|-----------|---------|----------------|
| `station` | Bến xe | Bến xe Miền Đông, TP. HCM | Operator (managed pickup area) |
| `point` | Đón tận nơi | 123 Nguyễn Huệ, Q.1 | Operator (managed pickup area) |
| `custom` | Ghi rõ | "Tôi ở khách sạn Rex, xin đón trước cổng" | Customer (free-text request) |

**Station** is the default — a fixed bus station where the operator has a departure slot. **Point** is a door-to-door service (common on premium routes — the bus stops at a known location to pick up pre-booked passengers). **Custom** is the escape hatch for edge cases where the customer needs to specify an exact location.

#### Data Model

```
Operator
  └── OperatorPickupArea (reusable library)
        ├── id, kind (station | point)
        ├── name ("Bến xe Miền Đông")
        ├── address ("292 Đinh Bộ Lĩnh, Q. Bình Thạnh")
        └── displayOrder (for consistent ordering in dropdowns)
              │
              ▼
Trip
  └── TripPickupArea (per-trip snapshot)
        ├── tripId FK → Trip
        └── pickupAreaId FK → OperatorPickupArea
              │
              ▼
Hold / Booking
  ├── pickupKind: "station" | "point" | "custom"
  ├── pickupAreaId: FK → TripPickupArea (null if custom)
  └── customPickupRequest: text (null unless kind = custom)
```

Additional data model fields not shown in the diagram above:
- `OperatorPickupArea.kind` uses the `PickupPlaceKind` enum (`station` | `point`), snapshotted to `TripPickupArea` and `TemplatePickupArea`.
- `Hold`/`Booking` carries `customPickupRequested: Boolean @default(false)` — the manifest filter index. Indexed as `@@index([tripId, customPickupRequested])` to support efficient manifest queries ("show me all bookings on this trip that need custom pickup contact").
- **Province filter constraint**: There is no automatic province matching because `Route.origin` is free text (no GSO administrative code). Province filter must be manual operator selection, not auto-derived.

**Why a snapshot?** `TripPickupArea` copies the enabled pickup areas at trip-creation time. If the operator later adds/removes areas from their library, existing trips keep their original set — no retroactive changes to published trips.

#### Customer Flow

During hold creation (Section 13.2 step 2), the customer sees a 3-way picker:

1. **Bến xe** (bus station) → dropdown of the trip's enabled station-type areas
2. **Đón tận nơi** (door-to-door) → dropdown of the trip's enabled point-type areas
3. **Ghi rõ** (specify custom) → reveals a required free-text input (minimum 5 characters)

The selection is stored on the Hold and carried to the Booking when payment confirms.

#### Operator Impact — Manifest & Notifications

- **Standard pickups** (station/point): Appear on the boarding manifest (Section 14) with the managed area name and address. No special handling needed.
- **Custom requests**: Flagged on the manifest with a warning marker ("⚠ Cần liên hệ" — needs contact). The operator also receives an `operatorCustomPickupRequest` notification (SMS/email) with the booking ref, requested location, and traveler contact phone — so they can coordinate before departure.

#### Why Structured Over Free Text?

The tempting shortcut is "just let the customer type whatever they want." That fails at scale:

| Problem with all-free-text | How structured areas solve it |
|---------------------------|------------------------------|
| Inconsistent manifest formatting | Managed areas → consistent names displayed |
| Operator must read and parse every message | Only custom requests need reading; station/point are pre-resolved |
| No analytics | "Which stations are most popular?" answerable from structured data |
| No future map integration | Structured areas can carry lat/lng coordinates later |
| Same location typed differently by different customers | One canonical area, many bookings reference it |

Custom is the **escape hatch** — it exists for genuine edge cases (hotel pickup, special access needs), not as the primary flow.

Full subsystem design was consolidated into this section from the former `docs/design/pickup-points-v2.md`.
