# Hold System (Section 3, Issue 002) — Behavior Expectations

Comprehensive listing of all user actions, expected behaviors, test coverage, outputs, and logging for the Hold System.

---

## A. User-Facing Actions & Expected Behavior

### A1. Search Results → Book Button Click

| # | Action | Expected Behavior |
|---|--------|-------------------|
| 1 | User on `/search` sees trip cards | Each card shows "Dat ve" button + seat-count badge |
| 2 | Seat badge when `availableSeats <= 5` | Badge variant = `pending` (warning color), text "Chi con N cho" |
| 3 | Seat badge when `availableSeats > 5` | Normal variant, text "Con N cho" |
| 4 | Availability includes active holds | Server computes: `bus.capacity - SUM(active_holds) - SUM(paid/completed bookings)` |
| 5 | Trips with `available < ticketCount` | Excluded from search results entirely (server-side filter) |
| 6 | Click "Dat ve" | Zustand `bookingStore.setTrip(tripId, ticketCount)` called; navigates to `/booking/customer` |
| 7 | No API call on book click | Hold is NOT created here — only trip selection captured |

### A2. Customer Form (`/booking/customer`)

| # | Action | Expected Behavior |
|---|--------|-------------------|
| 1 | Navigate to `/booking/customer` without tripId in store | Redirect to `/search` (layout guard) |
| 2 | Form fields rendered | Name (min 4 chars), Phone (VN mobile), Email (required), Pickup (station/custom radio) |
| 3 | Phone pre-fill (returning user) | Pre-populated from `localStorage['busbooking_last_phone']` or account phone |
| 4 | Name pre-fill (logged-in user) | Pre-populated from account display name |
| 5 | Select "Don tan noi" (custom pickup) | Text input appears, min 5 chars required |
| 6 | Submit with invalid fields | Client-side Zod validation, per-field error messages inline |
| 7 | Submit with valid fields | Button shows "Dang xu ly...", disabled; calls `POST /api/holds` |
| 8 | Hold created successfully | Phone saved to localStorage; store updated with holdId/expiresAt/buyerInfo; timer starts; navigate to `/booking/review?holdId=...` |
| 9 | Trip sold out (409) | Red alert: "Chuyen xe nay da het cho. Vui long chon chuyen khac." + `router.refresh()` to reload availability |
| 10 | Rate limited (429) | Red alert: "Qua nhieu yeu cau. Vui long thu lai sau N giay." |
| 11 | Hold cap exceeded (429 HOLD_CAP_EXCEEDED) | Same rate-limit message shown (client maps all 429 → TOO_MANY_REQUESTS; no separate UI for cap) |
| 12 | Custom pickup invalid (422) | Inline field error: "Diem don khong hop le. Vui long chon lai." |
| 13 | Generic error (500/other) | Red alert: "Co loi xay ra. Vui long thu lai." |
| 14 | Network failure | Red alert with code `NETWORK_ERROR` |

### A3. Review Page (`/booking/review?holdId=...`)

| # | Action | Expected Behavior |
|---|--------|-------------------|
| 1 | Server-side load | Reads `bb_hold` cookie, verifies HMAC, checks holdId matches query param; calls `getHoldDetails()` in-process |
| 2 | Cookie missing/invalid/mismatch | Server redirect to `/search` |
| 3 | Hold not found in DB | Server redirect to `/search` |
| 4 | Page renders successfully | Shows route, departure, seats, price breakdown, pickup summary, payment method selector, consent checkboxes, HoldTimer countdown |
| 5 | `totalVND` displayed | Server-computed: `trip.price * ticketCount` (never client-supplied) |
| 6 | `Cache-Control: no-store` | Always set on hold detail responses |
| 7 | `robots: { index: false, follow: false }` | Page never indexed by search engines |
| 8 | HoldTimer countdown | Shows `MM:SS con lai`; ticks every 1 second (wall-clock anchored) |
| 9 | Timer <= 2 minutes remaining | Text turns red (`text-destructive`) |
| 10 | Timer reaches 0 | HoldTimer disappears; HoldExpiryModal opens |
| 11 | HoldExpiryModal shown | Full-screen, non-dismissible. Title: "Cho giu da het han". One button: "Tim chuyen xe moi" |
| 12 | HoldExpiryModal side effect | `bookingStore.clearBooking()` called — wipes all booking state |
| 13 | Click "Tim chuyen xe moi" | `router.replace('/search')` — no escape, no backdrop close, no Esc key |
| 14 | Payment method selection | Radio pills: MoMo, ZaloPay, The (card); bank_transfer also available |
| 15 | Consent checkboxes | Both noRefund + piiStorage must be checked to enable payment button |
| 16 | Click "Xac nhan thanh toan" (consents given) | POST `/api/bookings/initiate` with holdId, paymentMethod, consents |
| 17 | Payment initiation success | `window.location.href = data.payUrl` (gateway redirect) |
| 18 | Error: HOLD_EXPIRED | Red alert: "Het thoi gian giu cho. Vui long dat lai." |
| 19 | Error: TRIP_DEPARTED | Red alert: "Chuyen da khoi hanh. Vui long chon chuyen khac." |
| 20 | Error: NOT_FOUND | Red alert: "Khong tim thay giu cho. Vui long dat lai." |
| 21 | Error: FORBIDDEN | Red alert: "Phien giu cho khong hop le. Vui long dat lai." |
| 22 | Error: GATEWAY_ERROR | Red alert: "Cong thanh toan gap loi. Vui long thu lai." |
| 23 | Error: UNAVAILABLE | Red alert: "He thong tam thoi ban. Vui long thu lai." |
| 24 | Error: OPERATOR_NOT_BOOKABLE (409) | Operator suspended/rejected since hold created |
| 25 | Consent version mismatch (422) | `consent_required` error |

### A4. Booking Layout Guard

| # | Condition | Expected Behavior |
|---|-----------|-------------------|
| 1 | No `tripId` in Zustand store | Redirect to `/search` |
| 2 | Exception: post-payment pages | `/booking/confirmation`, `/booking/result`, `/booking/bank-transfer` bypass guard |

---

## B. API Endpoints — Request/Response Contracts

### B1. `POST /api/holds` — Create Hold

**Auth:** None (anonymous). CSRF enforced (X-CSRF-Token header must match bb_csrf cookie).

**Rate limit:** 60 req/min/IP (Edge + in-route). Per-phone: max 5 concurrent active holds.

**Request body:**
```
{
  tripId:       string (CUID),
  ticketCount:  int 1-10,
  buyerName:    string 4-100 chars (Unicode letters/spaces/'.-),
  buyerPhone:   string (VN mobile: (0|+84)[35789][0-9]{8}),
  buyerEmail:   string (valid email, <=254 chars, normalized lowercase),
  pickupKind?:  'station' | 'custom' (default: 'station'),
  pickupDetail?: string <=300 chars (required + >=5 chars when pickupKind='custom')
}
```

**Responses:**

| Status | Body | Cookie Side Effect |
|--------|------|--------------------|
| 200 | `{ holdId, expiresAt }` | Sets `bb_hold=<holdId>.<expiresAtISO>.<hmac>; HttpOnly; SameSite=Lax; Max-Age=720` |
| 400 | `{ error: 'INVALID' }` | — |
| 403 | `{ error: 'csrf_invalid' }` | — |
| 409 | `{ error: 'SOLD_OUT' }` | — |
| 422 | `{ error: 'pickup_custom_detail_required' }` | — |
| 429 | `{ error: 'TOO_MANY_REQUESTS' }` + `Retry-After` header | — |
| 429 | `{ error: 'HOLD_CAP_EXCEEDED' }` (no Retry-After) | — |
| 500 | `{ error: 'INTERNAL_SERVER_ERROR' }` (scrubbed) | — |

### B2. `GET /api/holds/[id]` — Get Hold Details

**Auth:** `bb_hold` HMAC cookie. Cookie holdId must match path `[id]`.

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ tripId, ticketCount, expiresAt, unitPriceVND, totalVND, routeOrigin, routeDestination, departureAt, operatorLegalName, pickupKind, pickupDetail }` |
| 401 | `{ error: 'UNAUTHORIZED' }` |
| 404 | `{ error: 'NOT_FOUND' }` |
| 500 | scrubbed |

Headers: `Cache-Control: no-store` on 200.

### B3. `POST /api/bookings/initiate` — Consume Hold → Booking

**Auth:** `bb_hold` cookie (HMAC verified, holdId must match body). Optional customer JWT. CSRF enforced.

**Request body:**
```
{
  holdId:        string,
  paymentMethod: 'momo' | 'zalopay' | 'card' | 'vnpay' | 'bank_transfer',
  consents: {
    noRefund:    true,
    piiStorage:  true,
    version:     string (must match CONSENT_VERSION)
  }
}
```

**Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 200 | `{ bookingId, payUrl }` | Hold consumed, booking created, gateway URL returned |
| 400 | `{ error: 'INVALID' }` | Schema failure |
| 403 | `{ error: 'FORBIDDEN' }` | Cookie missing or holdId mismatch |
| 403 | `{ error: 'csrf_invalid' }` | CSRF failure |
| 404 | `{ error: 'NOT_FOUND' }` | Hold not found |
| 409 | `{ error: 'HOLD_EXPIRED' }` | TTL elapsed |
| 409 | `{ error: 'TRIP_DEPARTED' }` | Trip already departed |
| 409 | `{ error: 'OPERATOR_NOT_BOOKABLE' }` | Operator suspended/rejected |
| 422 | `{ error: 'consent_required' }` | Consent checkboxes or version wrong |
| 429 | `{ error: 'TOO_MANY_REQUESTS' }` | Rate limit |
| 502 | `{ error: 'GATEWAY_ERROR' }` | Payment gateway failed (hold reverted to active) |
| 503 | `{ error: 'UNAVAILABLE' }` | Booking ref collision |

### B4. `GET /api/cron/sweep-holds` — Expire Stale Holds

**Auth:** `Authorization: Bearer <CRON_SECRET>`.

**Modes (controlled by `HOLD_SWEEPER_MODE` env):**

| Mode | Behavior | Response |
|------|----------|----------|
| `count` (default) | Read-only count, no mutation | `{ mode: 'count', expiredCount: N }` |
| `update` | Batch UPDATE up to 500 rows via advisory lock + FOR UPDATE SKIP LOCKED | `{ mode: 'update', expiredCount: N, status: 'success' }` |

| Status | Condition |
|--------|-----------|
| 200 | Success |
| 401 | Missing/wrong CRON_SECRET or CRON_SECRET unset |

---

## C. State Machine & Data Model

### C1. HoldStatus Transitions

```
                          ┌─ consumed     (booking initiated successfully)
active ─────────────────►─┤
  │                       ├─ expired      (sweep cron: expiresAt < NOW())
  │                       └─ cancelled_trip (operator cancels trip)
  │
  │  (gateway failure)
consumed ────────────────► active   (compensating rollback)
```

All transitions from `active` are one-way terminal (except the compensating rollback on gateway failure).

### C2. Hold Model Fields

| Field | Type | Notes |
|-------|------|-------|
| id | String (CUID) | PK |
| tripId | String | FK → Trip |
| ticketCount | Int | 1-10 |
| customerPhone | String | VN mobile |
| customerName | String | 4-100 chars |
| customerEmail | String? | Nullable (Issue 042) |
| expiresAt | DateTime | now + 10 min |
| status | HoldStatus | Default: active |
| createdAt | DateTime | Auto |
| pickupKind | PickupKind | Default: station |
| pickupDetail | String? | Required when custom |
| customPickupRequested | Boolean | Default: false |
| trip | Relation | → Trip |
| booking | Relation? | → Booking (1:1) |

**Indices:** `@@index([tripId, status, expiresAt])` (capacity queries), `@@index([expiresAt])` (sweeper)

### C3. Config Constants

| Name | Value | Location |
|------|-------|----------|
| HOLD_TTL_MINUTES | 10 | `lib/core/db/holdRepo.ts` |
| PSP_WINDOW_MINUTES | 20 | `lib/core/db/holdRepo.ts` |
| COOKIE_MAX_AGE | 720s (12 min) | `lib/security/holdCookie.ts` |
| CONCURRENT_HOLD_CAP | 5 | `lib/core/db/holdErrors.ts` |
| ticketCount max | 10 | `lib/core/validation/hold.ts` |
| Sweep batch size | 500 | `lib/jobs/expireHolds.ts` |
| UI warning threshold | 2 min | `lib/state/holdTimerStore.ts` |
| Rate limit | 60 req/min/IP | `proxy.ts` + route |

### C4. Concurrency Control

| Mechanism | Purpose |
|-----------|---------|
| `pg_advisory_xact_lock(hashtext('hold-phone:' + phone))` | Serialize all holds from same phone (cap enforcement) |
| `pg_advisory_xact_lock(hashtext('hold:' + tripId))` | Serialize concurrent holds on same trip |
| Lock ordering: phone → trip | Deadlock prevention |
| Conditional INSERT (capacity subquery) | Atomic capacity check + reservation |
| `INSERT ... ON CONFLICT ("holdId") DO NOTHING` | Idempotent hold→booking conversion |
| `SELECT ... FOR UPDATE OF t` | Trip row locked during booking creation |
| `pg_try_advisory_xact_lock('hold-expiry')` + `FOR UPDATE SKIP LOCKED` | Safe concurrent sweep cron |

### C5. Cookie: `bb_hold`

| Property | Value |
|----------|-------|
| Format | `<holdId>.<expiresAtISO>.<base64url(HMAC-SHA256)>` |
| HMAC key | `HOLD_SECRET` env var (>= 64 hex chars / 32 bytes) |
| Verification | `crypto.timingSafeEqual` (constant-time) |
| Flags | HttpOnly, SameSite=Lax, Max-Age=720, Secure in prod |
| Set by | `POST /api/holds` on 200 |
| Read by | `GET /api/holds/[id]`, `POST /api/bookings/initiate`, review page server component |
| Cleared | Natural browser expiry (no explicit invalidation) |

---

## D. Logging & Observability

### D1. Logger Calls

| Location | Level | Message | Context Fields |
|----------|-------|---------|----------------|
| `POST /api/holds` | info | `'Hold created'` | `{ holdId, tripId, ticketCount }` |
| `POST /api/holds` | info | `'Hold creation failed: sold out or trip unavailable'` | `{ tripId, ticketCount }` |
| `POST /api/holds` | warn | `'Hold cap exceeded for phone'` | `{ tripId }` (phone NOT logged — PII) |
| `sweep-holds` | info | `'sweep-holds: count mode'` | `{ mode, expiredCount }` |
| `sweep-holds` | info | `'sweep-holds: update mode'` | `{ mode, rowsAffected, status }` |
| `initiateOnlineBooking` | warn | `'online.gateway.createPayment.failed — compensating'` | `{ bookingRef, method, error }` |
| `initiateOnlineBooking` | error | `'online.compensating.transaction.failed'` | `{ err, bookingRef, method }` |
| `withErrorHandler` | error | `'Unhandled handler error'` | `{ err: { message, name } }` |
| ratelimit | warn | `'ratelimit.denied'` | `{ identifier, retryAfter }` |
| ratelimit | error | various Redis connection errors | `{ err, identifier }` |
| analytics track | warn | `'funnel track failed (ignored)'` | `{ err, step }` |

### D2. PII Redaction (Pino redact list)

Fields auto-redacted to `[REDACTED]`:
- `customerPhone`, `customerName`, `customerEmail`
- `buyerPhone`, `buyerName`, `buyerEmail`
- `bb_hold`, `HOLD_SECRET`
- `pickupDetail`, `customPickup`
- `req.headers.cookie` (covers bb_hold in HTTP logs)

### D3. Analytics Events

| Event | Step | Table | Fields |
|-------|------|-------|--------|
| Hold created | `hold_created` | FunnelEvent | `{ sessionId, tripId, context: { holdId, ticketCount } }` |

Part of 4-step funnel: `search_performed → hold_created → payment_initiated → booking_paid`

Fire-and-forget. Skipped if no `bb_sid` session cookie.

### D4. Job Logging

| Job | Table | Fields |
|-----|-------|--------|
| `hold-expiry` (sweep) | JobRunLog | `{ jobName, startedAt, endedAt, status, rowsAffected }` |

Status values: `success`, `skipped_locked`, `failed`

### D5. NotificationLog

**None created during hold phase.** Notifications deferred until IPN confirms payment.

### D6. Request Tracing

`x-request-id` header propagated by `proxy.ts`. `loggerForRequest(rid)` child-logger available but NOT wired into hold route handlers (uses root logger).

---

## E. Test Coverage Inventory

### E1. Unit Tests

| File | Framework | Test Count | What It Covers |
|------|-----------|------------|----------------|
| `lib/security/__tests__/holdCookie.test.ts` | Vitest | 14 | Cookie build/verify/extract, HMAC tamper detection, missing secret, cross-secret forgery |
| `lib/state/__tests__/holdTimerStore.test.ts` | Vitest | 8 | Timer start/stop/tick, warning threshold, expiry detection, fake timers |
| `lib/api/__tests__/holdsClient.test.ts` | Vitest | 6 | Client fetch wrapper: 200/409/429/400 mapping, network error, request shape |
| `lib/core/validation/__tests__/hold.test.ts` | Vitest | ~25 | Zod schema: tripId CUID, ticketCount 1-10, buyerName Unicode/length, buyerPhone VN prefixes, buyerEmail required/format/normalize |
| `components/__tests__/HoldTimer.test.tsx` | Vitest+RTL | 5 | Render nothing when expired, countdown format, warning class, sub-minute format |
| `app/api/holds/__tests__/route.test.ts` | Vitest | 12 | POST route: success, invalid email/body/phone, sold out, hold cap, rate limit, Set-Cookie header, no PII leak in 409 |
| `app/api/holds/[id]/__tests__/route.test.ts` | Vitest | 6 | GET route: success, 401 no cookie, 401 cookie mismatch, 404 not found, totalVND server-computed, Cache-Control |
| `app/api/cron/sweep-holds/__tests__/route.test.ts` | Vitest | 6 | Count/update modes, auth (missing/wrong/correct CRON_SECRET), default mode |
| `app/api/bookings/__tests__/initiate.route.test.ts` | Vitest | 5+ | Cookie ownership (403), hold_expired (409), hold_not_found (404) |

### E2. Integration Tests (live DB)

| File | Framework | Test Count | What It Covers |
|------|-----------|------------|----------------|
| `lib/core/db/__tests__/holdRepo.int.test.ts` | Vitest int | 4 | Hold creation, nonexistent trip, capacity exceeded, **20x concurrent race (exactly 1 succeeds)** |
| `lib/core/db/__tests__/holdCap.int.test.ts` | Vitest int | 3 | Single hold OK, CAP+1 concurrent holds → CAP succeed + 1 throws, cross-phone independence |
| `lib/core/db/__tests__/holdRepo.pspWindow.int.test.ts` | Vitest int | 3 | awaiting_payment within PSP window blocks hold, beyond window allows hold, paid booking always blocks |
| `lib/jobs/__tests__/cronJobs.int.test.ts` (AC1 section) | Vitest int | 2 | Expired hold flipped, not-yet-expired hold untouched |
| `lib/booking/__tests__/bookingRepo.int.test.ts` | Vitest int | 10+ | Hold→booking: success, custom pickup carry-through, customerId optional, idempotent re-attempt, expired hold, consumed hold, 10x concurrent conversion (exactly 1 ok), capacity correctness, concurrent sell lock |
| `lib/catalog/__tests__/capacityGuard.int.test.ts` | Vitest int | 4 | Occupancy aggregation with holds + bookings, capacity reduction guard |

### E3. E2E Tests (Playwright)

| File | Test | What It Covers |
|------|------|----------------|
| `e2e/hold-flow.spec.ts` | `'complete booking flow: search → customer → review → timer'` | Full UI flow through search → form → review, asserts VND total visible, HoldTimer countdown format |
| `e2e/hold-flow.spec.ts` | `'phone is pre-filled on second visit'` | localStorage phone persistence |
| `e2e/hold-flow.spec.ts` | `'hold expiry modal redirects to /search'` | Stub-level (no real expiry simulation) |
| `e2e/hold-flow.spec.ts` | `'20 concurrent POST /api/holds for capacity-1 trip'` | HTTP-layer race: 20 concurrent POSTs → exactly 1 success, rest 409 |

### E4. Coverage Gaps

| # | Gap | Severity | Notes |
|---|-----|----------|-------|
| 1 | `getHoldDetails()` — zero direct tests | Medium | Used by review page + GET /api/holds/[id]; unit test mocks around it |
| 2 | `HoldExpiryModal` — zero component tests | Medium | E2E expiry test is a stub with no real timer simulation |
| 3 | Timer warning→expired→modal transition (browser) | Medium | Unit tests cover store + component separately, never the composition |
| 4 | `HOLD_SWEEPER_MODE` unknown value behavior | Low | Not tested, likely defaults to count |
| 5 | Rate limit key assertion | Low | Unit test mocks rate limiter but never asserts what key (IP) is passed |
| 6 | HOLD_CAP_EXCEEDED vs TOO_MANY_REQUESTS UI distinction | Low | Client maps both to same message; no test verifies this is intentional |
| 7 | `bb_hold` cookie not explicitly cleared after booking | Low | DS-003 says "cleared" but implementation relies on Max-Age natural expiry |

---

## F. End-to-End Scenarios (Full Verification Checklist)

### F1. Happy Path

| Step | User Action | System Behavior | Verify |
|------|-------------|-----------------|--------|
| 1 | Search "Ha Noi → Sai Gon", select date | Search results with availability badges | Seat counts reflect active holds |
| 2 | Click "Dat ve" on trip card | Navigate to `/booking/customer` | tripId in Zustand store |
| 3 | Fill name, phone, email | Client-side validation passes | No API call yet |
| 4 | Click submit | `POST /api/holds` fires with CSRF header | 200 response, `bb_hold` cookie set |
| 5 | Navigate to review page | Server verifies cookie, loads hold details | Price, route, departure shown correctly |
| 6 | Timer counting down | `MM:SS con lai` visible, ticking every second | Wall-clock anchored |
| 7 | Select payment method, check both consents | "Xac nhan thanh toan" button enabled | Both checkboxes required |
| 8 | Click confirm payment | `POST /api/bookings/initiate` | Hold status → consumed, booking created |
| 9 | Redirect to payment gateway | `window.location.href = payUrl` | Booking in `awaiting_payment` |

### F2. Sold Out Race

| Step | User Action | System Behavior | Verify |
|------|-------------|-----------------|--------|
| 1 | 20 users simultaneously submit holds for 1-seat trip | Advisory locks serialize; exactly 1 gets 200 | 19 get 409 SOLD_OUT |
| 2 | Losing users see error | Red alert "het cho" | `router.refresh()` updates availability |

### F3. Hold Expiry

| Step | Event | System Behavior | Verify |
|------|-------|-----------------|--------|
| 1 | User waits 8+ minutes on review | Timer shows red text (warning at <=2 min) | `text-destructive` class |
| 2 | Timer reaches 0 | HoldExpiryModal appears, non-dismissible | No Esc, no backdrop close |
| 3 | Store cleared | `bookingStore.clearBooking()` called | All booking state wiped |
| 4 | Click "Tim chuyen xe moi" | `router.replace('/search')` | Seats released for others |
| 5 | Cron runs (every minute) | Sweeps expired holds: status → expired | JobRunLog row written |

### F4. Concurrent Hold Cap (5 per phone)

| Step | Event | System Behavior | Verify |
|------|-------|-----------------|--------|
| 1 | Same phone creates 5 holds on different trips | All succeed | 5 active holds in DB |
| 2 | 6th hold attempt | 429 HOLD_CAP_EXCEEDED | HoldCapExceededError thrown |
| 3 | UI shows rate-limit message | Same as TOO_MANY_REQUESTS | No separate cap message |
| 4 | Different phone creates hold | Succeeds independently | Cap is per-phone, not global |

### F5. Gateway Failure → Compensating Rollback

| Step | Event | System Behavior | Verify |
|------|-------|-----------------|--------|
| 1 | User confirms payment | Hold consumed, booking created | Status: awaiting_payment |
| 2 | Gateway returns error | Compensating tx: delete booking, revert hold to active | Hold status back to active |
| 3 | User sees GATEWAY_ERROR | Red alert "Cong thanh toan gap loi" | Can retry |
| 4 | Logger records | warn: `'online.gateway.createPayment.failed — compensating'` | bookingRef, method, error logged |

### F6. Trip Cancelled by Operator

| Step | Event | System Behavior | Verify |
|------|-------|-----------------|--------|
| 1 | Operator cancels trip with active holds | `tx.hold.updateMany({ status: 'cancelled_trip' })` | All active holds on trip cancelled |
| 2 | Users on review page | Hold no longer valid for booking initiation | HOLD_EXPIRED or similar error |

### F7. CSRF Protection

| Step | Event | System Behavior | Verify |
|------|-------|-----------------|--------|
| 1 | First GET request | `bb_csrf` cookie set (non-HttpOnly) | Available to JavaScript |
| 2 | POST /api/holds without X-CSRF-Token | 403 `{ error: 'csrf_invalid' }` | Blocked at proxy layer |
| 3 | POST /api/holds with correct X-CSRF-Token | Request proceeds to handler | `readCsrfToken()` reads cookie |

### F8. PSP Window Protection

| Step | Event | System Behavior | Verify |
|------|-------|-----------------|--------|
| 1 | Hold consumed → booking in awaiting_payment | Booking created < 20 min ago | Blocks new holds on same trip |
| 2 | awaiting_payment booking older than 20 min | PSP_WINDOW_MINUTES exceeded | New holds allowed |
| 3 | Paid booking of any age | Always blocks capacity | Regardless of creation time |

---

## G. Environment Variables Required

| Var | Required | Purpose |
|-----|----------|---------|
| `HOLD_SECRET` | Yes (boot) | >= 64 hex chars; HMAC signing for bb_hold cookie |
| `CRON_SECRET` | Yes (cron) | Authenticates Vercel Cron → sweep-holds |
| `HOLD_SWEEPER_MODE` | No | `'count'` (default) or `'update'` |
| `REDIS_PROVIDER` | No | Rate limiter backend (InMemory in dev) |

---

## H. File Locations Reference

| Component | Path |
|-----------|------|
| POST /api/holds handler | `app/api/holds/route.ts` |
| GET /api/holds/[id] handler | `app/api/holds/[id]/route.ts` |
| POST /api/bookings/initiate | `app/api/bookings/initiate/route.ts` |
| Sweep-holds cron | `app/api/cron/sweep-holds/route.ts` |
| Customer form page | `app/(customer)/booking/customer/page.tsx` + `CustomerForm.tsx` |
| Review page (server) | `app/(customer)/booking/review/page.tsx` |
| Review page (client) | `app/(customer)/booking/review/ReviewClient.tsx` |
| Booking layout guard | `app/(customer)/booking/layout.tsx` |
| BookButton | `components/search/BookButton.tsx` |
| HoldTimer | `components/HoldTimer.tsx` |
| HoldExpiryModal | `components/HoldExpiryModal.tsx` |
| holdRepo (atomic create) | `lib/core/db/holdRepo.ts` |
| holdErrors (cap) | `lib/core/db/holdErrors.ts` |
| getHoldDetails (DB read) | `lib/booking/getHoldDetails.ts` |
| holdCookie (HMAC) | `lib/security/holdCookie.ts` |
| hold validation (Zod) | `lib/core/validation/hold.ts` |
| holdsClient (fetch wrapper) | `lib/api/holdsClient.ts` |
| expireHolds (job core) | `lib/jobs/expireHolds.ts` |
| bookingStore (Zustand) | `lib/state/bookingStore.ts` |
| holdTimerStore (Zustand) | `lib/state/holdTimerStore.ts` |
| CSRF client | `lib/auth/csrfClient.ts` |
| Proxy middleware | `proxy.ts` |
| Cron schedule | `vercel.json` |
