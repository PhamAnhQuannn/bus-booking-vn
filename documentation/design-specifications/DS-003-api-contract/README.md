# DS-003 -- API Contract

## 1. Overview

This document is the authoritative API contract reference for the BusBooking platform -- a multi-tenant Vietnam bus booking marketplace. The API layer is built on Next.js App Router (route handlers at `app/api/**/route.ts`), with Zod validation at every boundary, JWT-based authentication across three independent realms (Customer, Operator, Admin), and PostgreSQL 16+ via Prisma ORM. All monetary values in API responses are VND integers with no decimal component. The API is same-origin (Next.js serves both frontend and API), cookie-based auth with CSRF double-submit protection.

**Source ADRs.** This document synthesizes decisions from ADR-001 (Stack), ADR-002 (NFR Targets), ADR-003 (Auth), ADR-004 (Multi-Tenancy), ADR-005 (Payment), ADR-006 (Pricing/Currency), ADR-008 (Security), ADR-009 (Concurrency/Seat-Holding), ADR-010 (Booking Lifecycle), ADR-011 (Search/Availability), ADR-012 (Background Jobs), ADR-013 (Notifications), ADR-014 (E-Invoice), ADR-015 (Error Contract), ADR-016 (Module Boundaries), ADR-019 (State Machines), ADR-020 (Deployment). Cross-reference 01-data-model-design for entity schemas, 02-migration-strategy for schema evolution rules.

---

## 2. API Surface Architecture

### 2.1 Route Namespaces

| Namespace | Scope | Auth Method | Tenant Scoping |
|-----------|-------|-------------|----------------|
| `/api/auth/**` | Customer auth | Public (rate-limited) | None |
| `/api/trips/search` | Customer search | Public | None (cross-operator) |
| `/api/holds` | Customer holds | Public (rate-limited) | None (cross-operator) |
| `/api/bookings/**` | Customer bookings | Customer JWT or public | None (cross-operator) |
| `/api/charters` | Customer charter requests | Customer JWT (optional for guest) | None |
| `/api/complaints` | Customer complaints | Customer JWT (optional for anonymous) | None |
| `/api/data-requests` | DSAR portal | Customer JWT | None |
| `/api/vouchers/validate` | Voucher validation | Public | None |
| `/api/payments/*/webhook` | PSP webhooks | HMAC signature | None (from booking) |
| `/api/op/auth/**` | Operator auth | Public (rate-limited) | None |
| `/api/op/**` | Operator console | Operator JWT | `operatorId` from JWT claim |
| `/api/admin/auth/**` | Admin auth | Public (rate-limited) | None |
| `/api/admin/**` | Platform admin | Admin JWT | Explicit `operatorId` in path/query |
| `/api/cron/**` | Background jobs | Cron secret header | System (no tenant) |
| `/api/health` | Health check | Public | None |

### 2.2 Edge vs Origin Split

The middleware layer (`proxy.ts`) runs at Edge Runtime (Vercel Edge or Next.js middleware). API route handlers run at Origin (Node.js).

| Runs at Edge (stateless, no DB) | Runs at Origin (Node.js, Prisma) |
|----------------------------------|----------------------------------|
| JWT verification via `jose.jwtVerify` | `SELECT FOR UPDATE`, `$transaction` blocks |
| CSRF double-submit validation | Ledger writes, state machine transitions |
| `requiresPasswordChange` claim redirect | Payment webhook DB writes |
| IP-based rate limiting | Capacity guard (advisory locks) |
| Public route whitelist bypass | Zod validation + service layer calls |

### 2.3 Middleware Auth Chain

Request processing order in `proxy.ts`:

1. Static file bypass (no auth)
2. Public route whitelist check
3. Token extraction from HttpOnly cookie (`bb_access` / `bb_op_access` / `bb_admin_access`)
4. `jose.jwtVerify` (Edge-safe, zero DB hit)
5. `requiresPasswordChange` claim check -- redirect to `/op/first-login` when `true`
6. CSRF double-submit check (non-safe methods on `/api/*`)
7. Pass to route handler for route-level auth guards

---

## 3. Authentication & Authorization

### 3.1 Three Auth Realms

Each realm has independent token secrets, cookie namespaces, and session tables. Tokens from one realm are invalid in another.

| Realm | Login Method | Access JWT TTL | Refresh Token TTL | Cookie Prefix |
|-------|-------------|----------------|-------------------|---------------|
| Customer | Phone OTP (passwordless) | 15 min | 7 days | `bb_` |
| Operator | Username + password (+ OTP step-up) | 15 min | 7 days | `bb_op_` |
| Admin | Email + password + TOTP MFA | 15 min | 24 hours | `bb_admin_` |

### 3.2 Access Token (JWT)

| Property | Value |
|----------|-------|
| Algorithm | HS256 |
| TTL | 15 minutes (`ACCESS_TTL_SECONDS=900`) |
| Storage | HttpOnly cookie |
| Verification | Edge middleware via `jose.jwtVerify` (no DB hit) |

**Claims:**

```json
{
  "sub": "<userId>",
  "role": "<role>",
  "operatorId": "<operatorId>",
  "requiresPasswordChange": false,
  "iat": 1234567890,
  "exp": 1234568790
}
```

- `operatorId` present only in operator realm tokens
- `requiresPasswordChange` present only in operator realm tokens
- `role` values: customer realm omits role; operator realm `admin | staff`; admin realm `SUPER_ADMIN | FINANCE | SUPPORT`

### 3.3 Refresh Token

| Property | Value |
|----------|-------|
| Format | Random opaque string |
| Storage | SHA-256 hash in `Session` / `OperatorSession` / `AdminSession` table |
| Cookie | HttpOnly, path-scoped to `/api/auth/refresh` (or realm equivalent) |
| Rotation | Token family rotation with reuse detection |
| Reuse detection | Consumed refresh token reuse revokes entire token family |

### 3.4 OTP Proof JWT

Cross-route state transfer from `/api/auth/otp/verify` to `/api/auth/register` or `/api/auth/login`.

| Property | Value |
|----------|-------|
| Algorithm | HS256 |
| TTL | 5 minutes |
| Claims | `{ phone, jti, purpose: 'register' \| 'login' }` |
| Single-use | `jti` consumed via Redis SETNX |
| Transport | Response body of verify, request body of register/login |
| Redaction | Must be in logger redact list |

### 3.5 Cookie Settings

```
HttpOnly: true
Secure: true (production)
SameSite: Lax
Path: /api (access tokens), /api/<realm>/auth/refresh (refresh tokens)
```

### 3.6 Auth Guard Functions

Route handlers use these guards to extract authenticated context:

| Guard | Returns | Used By |
|-------|---------|---------|
| `requireCustomerAuth(request)` | `{ customerId }` | `/api/bookings/**`, `/api/complaints`, etc. |
| `requireOperatorAuth(request)` | `{ operatorId, operatorUserId, role }` | `/api/op/**` |
| `requireAdminAuth(request)` | `{ adminUserId, role }` | `/api/admin/**` |

### 3.7 RBAC

**Operator roles:**

| Role | Capabilities |
|------|-------------|
| `admin` | Full CRUD on operator resources, staff management, settings, payouts |
| `staff` | Assigned trip manifest, check-in, contact status updates |

**Admin roles:**

| Role | Capabilities |
|------|-------------|
| `SUPER_ADMIN` | Full platform access, user management, system configuration |
| `FINANCE` | Payout approval, ledger queries, fee configuration, tax reports |
| `SUPPORT` | Complaint handling, data requests, content moderation, customer operations |

---

## 4. Request/Response Conventions

### 4.1 Content Type

All API responses use `Content-Type: application/json`.

### 4.2 Success Response

Success responses return the entity directly or wrapped in a data envelope depending on context:

```json
// Single entity
{ "id": "...", "status": "scheduled", "departureAt": "..." }

// List (non-paginated)
[{ "id": "..." }, { "id": "..." }]

// Paginated list (cursor-based)
{ "items": [...], "nextCursor": "<opaqueString>" }
```

### 4.3 Pagination

All list endpoints use cursor-based pagination (ADR-015 D5):

| Parameter | Type | Notes |
|-----------|------|-------|
| `cursor` | string (query) | Opaque cursor from previous response. Omit for first page |
| `limit` | int (query) | Page size. Default varies by endpoint |

Response includes `nextCursor` (null when no more pages).

### 4.4 Error Response Shape

All errors follow the canonical envelope (ADR-015 D1):

```json
{
  "error": {
    "code": "SEAT_UNAVAILABLE",
    "message": "Not enough seats available for the requested ticket count",
    "details": {}
  }
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `code` | string | Yes | Machine-readable, SCREAMING_SNAKE_CASE. Clients switch on this |
| `message` | string | Yes | Human-readable, UI-displayable. May change without notice |
| `details` | object | No | Structured metadata (e.g., `{ "availableSeats": 12, "requested": 15 }`) |

No stack traces in production responses. Error responses never leak PII.

### 4.5 Validation Error Shape (400)

Zod validation failures return field-level errors:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "fieldErrors": [
        { "path": "phone", "message": "Invalid Vietnamese phone format" },
        { "path": "ticketCount", "message": "Must be at least 1" }
      ]
    }
  }
}
```

### 4.6 Idempotent Operation Response

Idempotent re-calls (e.g., cancel an already-cancelled trip) return HTTP 200 with a discriminator field -- never a thrown error (ADR-015 D3, ADR-019):

```json
{
  "trip": { "id": "...", "status": "cancelled" },
  "alreadyCancelled": true,
  "cancelledBookings": 0
}
```

### 4.7 Security Headers

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-Request-Id` | `<uuid>` (per-request, for log correlation and support) |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` (production only) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

### 4.8 DTO Conventions

- `select` whitelist = exactly the UI contract fields. Filter-only columns (`salesClosed`, internal `status` flags) are excluded from client-facing responses (Issue 001 lesson)
- DTO type unions must include all reachable states (e.g., `TripDto.status: 'scheduled' | 'departed' | 'cancelled' | 'completed'`)
- Every non-relational scalar from the Prisma model must appear in the DTO in sequence (Issue 013 lesson)
- Phone numbers masked to last 4 in non-owner responses (e.g., operator sees `****1234`)
- `PayoutAccount.accountNumber` always masked to last 4 in ALL API responses

---

## 5. HTTP Status Code Contract

### 5.1 Status Code Conventions

| Code | Usage | Rule |
|------|-------|------|
| 200 | Success. Idempotent re-calls return same shape | Also used for discriminated "already done" results |
| 201 | Resource created (Hold, Booking, Trip, Bus, Route, etc.) | |
| 400 | Malformed request body / query params (Zod validation failure) | Invalid data never reaches business logic |
| 401 | Missing, invalid, or expired auth token | `AUTH_REQUIRED`, `TOKEN_EXPIRED`, `TOKEN_INVALID`, `SESSION_REVOKED` |
| 403 | Valid auth but insufficient role/scope | `INSUFFICIENT_ROLE`, `ACCOUNT_SUSPENDED`, `ACCOUNT_LOCKED` |
| 404 | Resource not found or requestor lacks tenant scope | Same 404 for "doesn't exist" and "not your tenant" (no information leak) |
| 409 | Conflict: concurrent modification, maintenance overlap, bus overlap | Error would resolve by retrying later or resolving conflict |
| 422 | Business rule violation: capacity exceeded, invalid state transition | Error is inherent to request data regardless of timing |
| 429 | Rate limit exceeded | Must include `Retry-After` header |
| 500 | Unexpected server error | Logged with request ID and stack trace (server-side only) |

### 5.2 Error Code Taxonomy

**Auth errors (401/403):**

| Code | Status | Trigger |
|------|--------|---------|
| `AUTH_REQUIRED` | 401 | No session cookie or token |
| `TOKEN_EXPIRED` | 401 | JWT `exp` in the past |
| `TOKEN_INVALID` | 401 | JWT verification failure |
| `SESSION_REVOKED` | 401 | Refresh token reuse detected |
| `INSUFFICIENT_ROLE` | 403 | Valid auth but wrong role for endpoint |
| `ACCOUNT_SUSPENDED` | 403 | Customer or operator account suspended |
| `ACCOUNT_LOCKED` | 403 | OTP lockout (3 failed verifications, 15-min window) |

**Business errors (409/422):**

| Code | Status | Trigger |
|------|--------|---------|
| `SEAT_UNAVAILABLE` | 422 | Capacity guard failure (hold creation or payment confirmation) |
| `HOLD_EXPIRED` | 422 | Hold `expiresAt` passed |
| `HOLD_ALREADY_CONSUMED` | 422 | Hold already used for booking |
| `HOLD_LIMIT_EXCEEDED` | 422 | Per-phone hold cap exceeded |
| `INVALID_STATE_TRANSITION` | 422 | State machine rejects transition |
| `TRIP_CANCELLED` | 422 | Operation attempted on cancelled trip |
| `SALES_CLOSED` | 422 | Trip has `salesClosed = true` |
| `PLATE_IN_USE` | 422 | Duplicate license plate within operator |
| `CAPACITY_REDUCTION_BLOCKED` | 422 | Active bookings exceed proposed new capacity |
| `FUTURE_TRIPS_ASSIGNED` | 422 | Bus deactivation blocked by scheduled trips |
| `MAINTENANCE_OVERLAP` | 409 | Trip overlaps bus maintenance window |
| `BUS_OVERLAP` | 409 | Bus already assigned to overlapping trip (in `reassignBus`) |
| `BUS_OVERLAP_WITH_OUTBOUND` | 422 | Bus overlaps with outbound trip (in `pairedReturn`; SPEC CONFLICT with 409 in `reassignBus`) |
| `DUPLICATE_BOOKING` | 409 | `holdId` unique constraint violation |
| `INSUFFICIENT_BALANCE` | 422 | Withdrawal exceeds available balance |
| `PAYOUT_ACCOUNT_UNVERIFIED` | 422 | `PayoutAccount.verifiedAt` is null |
| `BELOW_MINIMUM_WITHDRAWAL` | 422 | Amount below 100,000 VND threshold |

**Payment errors (422):**

| Code | Status | Trigger |
|------|--------|---------|
| `PAYMENT_FAILED` | 422 | PSP returned failure result code |
| `PAYMENT_TIMEOUT` | 422 | PSP window (20 min) elapsed |
| `REFUND_NOT_ELIGIBLE` | 422 | Booking status or cancellation policy blocks refund |

**Rate limiting (429):**

| Code | Status | Headers |
|------|--------|---------|
| `RATE_LIMITED` | 429 | `Retry-After: <seconds>`, `X-RateLimit-Remaining: <count>` |

---

## 6. Customer-Facing Endpoints

### 6.1 Auth -- Customer Realm

#### `POST /api/auth/otp/send`

Send OTP to Vietnamese phone number.

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `phone` | body | string | Yes | Vietnamese format `+84[35789]\d{8}` |

**Response (200):** `{ "message": "OTP sent" }`

**Errors:** 429 (rate limited: 5 req / 15 min per IP+phone), 403 (lockout active)

**Side effect:** OTP SMS enqueued via notification system. New OTP supersedes prior active OTP for same phone.

#### `POST /api/auth/otp/verify`

Verify OTP code. Returns `otpProof` JWT on success.

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `phone` | body | string | Yes | |
| `code` | body | string | Yes | 6-digit OTP |

**Response (200):**
```json
{
  "otpProof": "<JWT>",
  "isRegistered": true
}
```

**Errors:** 422 (invalid code, `attemptCount` incremented), 403 (lockout: 3 failures → 15-min sentinel)

#### `POST /api/auth/register`

Register new customer account with verified phone.

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `otpProof` | body | string | Yes | JWT from verify step. Single-use (jti consumed via Redis) |
| `displayName` | body | string | No | |

**Response (201):** Customer object + session cookies set

**Side effect:** Guest bookings matching phone are backfilled via `attachGuestBookingByPhone`.

#### `POST /api/auth/login`

Login with verified phone.

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `otpProof` | body | string | Yes | JWT with `purpose: 'login'` |

**Response (200):** Session cookies set. `{ "customerId": "..." }`

#### `POST /api/auth/refresh`

Rotate refresh token and issue new access token.

**Response (200):** New cookies set. Token family rotation enforced.

**Reuse detection:** If a consumed refresh token is replayed, the entire token family is revoked (all sessions in that family).

#### `POST /api/auth/logout`

Revoke current session.

**Response (200):** Cookies cleared.

#### `DELETE /api/auth/account`

Customer-initiated account deletion (PDPL 2025 erasure right).

**Response (200):** Soft-delete: `Customer.deletedAt = now()`, `anonymizedAt = now()`, phone set to NULL, all sessions revoked. Financial records retained per regulatory minimums. Guest bookings remain (PII anonymized on retention schedule).

### 6.2 Trip Search

#### `GET /api/trips/search`

Primary customer-facing search endpoint. SSR-rendered via React Server Components.

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `origin` | query | string | Yes | Place name or slug. Diacritic-insensitive via `unaccent_immutable(lower(...))` |
| `destination` | query | string | Yes | Same normalization |
| `date` | query | string | Yes | `YYYY-MM-DD` format |
| `passengers` | query | int | No | Default 1. Filters by `availableSeats >= passengers` |

**SEO URL:** `/search/{origin-slug}/{destination-slug}/{date}` (ADR-011 D2)

**Visibility gates (all must pass):**

| Gate | Condition |
|------|-----------|
| Operator approved | `Operator.status = 'APPROVED'` |
| Sales open | `Trip.salesClosed = false` |
| Not cancelled | `Trip.status = 'scheduled'` |
| Not moderated | `Trip.moderatedAt IS NULL AND Route.moderatedAt IS NULL` |
| Future departure | `Trip.departureAt > NOW()` |
| No maintenance overlap | `maintenanceStart IS NULL OR maintenanceEnd < tripStart OR maintenanceStart > tripEnd` |
| Capacity available | Computed `availableSeats >= passengers` |

**Response (200):** Array of trip results.

**Response fields per trip:**

| Field | Source | Notes |
|-------|--------|-------|
| `id` | Trip.id | |
| `departureAt` | Trip.departureAt | UTC ISO 8601 |
| `arrivalAt` | Derived | `departureAt + route.durationMinutes` |
| `price` | Trip.price | VND integer (read-only; I7 invariant) |
| `availableSeats` | Computed | See capacity formula below |
| `route.origin` | Route.origin | |
| `route.destination` | Route.destination | |
| `route.durationMinutes` | Route.durationMinutes | |
| `bus.busType` | Bus.busType | `coach \| sleeper \| limousine` |
| `bus.capacity` | Bus.capacity | |
| `operator.brandName` | Operator.brandName | Falls back to `legalName` |
| `pickupAreas` | TripPickupArea[] | `{ label, kind, displayOrder }` |
| `cancellationPolicy` | CancellationPolicy | Policy rules summary (CPL 2023 transparency) |

**Excluded from response:** `salesClosed`, `status` (filter-only, never leaked to client).

**Availability formula (computed per trip):**

```
availableSeats = Bus.capacity
               - Trip.blockedSeats
               - COUNT(Hold WHERE tripId AND status = 'active')
               - COUNT(Booking WHERE tripId AND status = 'paid')
               - COUNT(Booking WHERE tripId AND status = 'awaiting_payment'
                       AND createdAt >= NOW() - PSP_WINDOW)
```

`PSP_WINDOW` = 20 minutes. `Hold TTL` = 10 minutes.

**Default sort:** Departure time ascending. Client-side re-sort by price available.

### 6.3 Hold Creation

#### `POST /api/holds`

Create time-limited seat reservation. Three-layer capacity guard (ADR-009).

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `tripId` | body | string | Yes | |
| `ticketCount` | body | int | Yes | Min 1 |
| `customerPhone` | body | string | Yes | Vietnamese format `+84[35789]\d{8}` |
| `customerName` | body | string | Yes | |
| `customerEmail` | body | string | No | |
| `pickupKind` | body | enum | Yes | `station \| point \| custom` |
| `pickupAreaId` | body | string | Conditional | Required when `pickupKind` = `station` or `point` |
| `pickupDetail` | body | string | Conditional | Required when `pickupKind` = `custom` (min 5 trimmed chars) |

**Price is NEVER accepted in the request body** (I7 invariant).

**Response (201):**
```json
{
  "id": "<holdId>",
  "tripId": "...",
  "ticketCount": 2,
  "expiresAt": "2026-06-19T10:10:00Z",
  "status": "active",
  "pickupKind": "station",
  "pickupAreaLabel": "Ben xe My Dinh"
}
```

**Cookie:** `bb_hold` set with signed holdId (12-min expiry).

**Concurrency control (sequential advisory lock acquisition):**
1. `pg_advisory_xact_lock(hashtext('hold-phone:' || phone))` -- per-phone serialization
2. `pg_advisory_xact_lock(hashtext('hold:' || tripId))` -- per-trip serialization
3. Conditional INSERT with capacity check subquery (zero rows = capacity exhausted)

**Preconditions checked in conditional INSERT:**
- Trip status = `scheduled`
- `salesClosed = false`
- Operator status = `APPROVED`
- `departureAt > NOW()`
- Capacity available (L1 guard)

**Errors:** 422 (`SEAT_UNAVAILABLE`, `SALES_CLOSED`, `TRIP_CANCELLED`, `HOLD_LIMIT_EXCEEDED`), 404 (`TRIP_NOT_FOUND`)

### 6.4 Booking Initiation

#### `POST /api/bookings/initiate`

Consume hold, create booking, initiate payment.

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `holdId` | body | string | Yes | From active hold |
| `paymentMethod` | body | enum | Yes | `momo \| zalopay \| card \| vnpay \| bank_transfer` |
| `consentRecords` | body | array | Yes | `[{ type: 'no_refund', version: '...' }, { type: 'pii_storage', version: '...' }]` |
| `voucherCode` | body | string | No | Discount voucher code |

**Server-computed (I7 invariant):**
```
totalVnd = (Trip.price * ticketCount) - discountVnd
```

**Response (201):**
```json
{
  "id": "<uuid>",
  "bookingRef": "BB-2026-a1b2-c3d4",
  "confirmationToken": "<token>",
  "status": "awaiting_payment",
  "totalVnd": 350000,
  "payUrl": "https://momo.vn/pay?orderId=...",
  "paymentMethod": "momo"
}
```

- `payUrl` present for PSP methods (MoMo, VNPay, ZaloPay); absent for `cash`
- `confirmationToken` for ticket page access: `/booking/confirmation/<token>`
- `bookingRef` format: `BB-YYYY-[0-9a-z]{4}-[0-9a-z]{4}` (lowercase base36)

**Errors:** 422 (`HOLD_EXPIRED`, `HOLD_ALREADY_CONSUMED`), 409 (`DUPLICATE_BOOKING` -- `holdId` unique constraint, ON CONFLICT DO NOTHING)

**Side effects:** Hold marked `consumed`. Two `ConsentRecord` rows created atomically. Hold `bb_hold` cookie cleared.

### 6.5 Charter Requests

#### `POST /api/charters`

Submit charter/group hire request (lead-gen, no payment rail).

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `contactName` | body | string | Yes | |
| `contactPhone` | body | string | Yes | Vietnamese format |
| `contactEmail` | body | string | Yes | |
| `originPlaceId` | body | string | No | FK to Place |
| `destinations` | body | array | Yes | `[{ placeId?: string, name: string }]` |
| `startDate` | body | datetime | Yes | |
| `endDate` | body | datetime | No | |
| `passengers` | body | int | Yes | |
| `vehicleType` | body | string | Yes | `coach \| sleeper \| limousine` |
| `budgetVnd` | body | int | No | |
| `notes` | body | string | No | |

**Response (201):** CharterRequest with `ref` (format: `CH-YYYY-XXXXXX`), `status: 'SUBMITTED'`.

### 6.6 Complaints

#### `POST /api/complaints`

Submit customer complaint (CPL 2023 Art. 31-34).

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `bookingId` | body | string | No | UUID. For booking-related complaints |
| `category` | body | string | Yes | `booking_issue \| payment_issue \| service_quality \| other` |
| `description` | body | string | Yes | |

**Response (201):** Complaint with `id`, `slaDeadline` (createdAt + 3 business days), `status: 'open'`.

**SLA deadlines (CPL 2023):** 3 business days to acknowledge, 7-30 days to resolve.

### 6.7 Data Requests (DSAR)

#### `POST /api/data-requests`

Submit Data Subject Access Request (PDPL 2025 compliance).

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `requestType` | body | enum | Yes | `access \| rectify \| erase \| port` |

**Response (201):** DataRequest with `id`, `status: 'received'`.

**Statutory deadlines (PDPL 2025):** Access/correction 10 days; deletion 20 days; consent withdrawal 15 days.

---

## 7. Operator-Facing Endpoints

All `/api/op/**` endpoints require operator JWT. `operatorId` is ALWAYS derived from the JWT claim, NEVER accepted from request body (ADR-004 D6, ADR-008 D8). Every query uses `withOperatorScope` or equivalent `WHERE operatorId = <jwt.operatorId>`.

### 7.1 Auth -- Operator Realm

#### `POST /api/op/auth/login`

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `username` | body | string | Yes | Format: `BRAND_ACRONYM-last4phone` |
| `password` | body | string | Yes | |

**Response (200):** Session cookies set. If `requiresPasswordChange: true` in JWT, Edge middleware redirects to `/op/first-login`.

#### `POST /api/op/auth/password`

Change password (first-login or voluntary).

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `currentPassword` | body | string | Yes | |
| `newPassword` | body | string | Yes | |

**Response (200):** New JWT minted with `requiresPasswordChange: false` in same transaction as DB update.

#### `POST /api/op/auth/refresh`

Rotate operator refresh token. Must include `X-CSRF-Token` header.

**Note:** Operator access JWT is 15-min. Clients that run longer must call this endpoint before mutations to avoid 401.

#### `POST /api/op/auth/logout`

Revoke operator session.

### 7.2 Fleet Management -- Buses

#### `POST /api/op/buses`

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `licensePlate` | body | string | Yes | Unique per operator |
| `capacity` | body | int | Yes | |
| `busType` | body | enum | Yes | `coach \| sleeper \| limousine` |

**Response (201):** Bus object.

**Errors:** 422 (`PLATE_IN_USE`)

#### `PATCH /api/op/buses/:id`

Update bus properties. Capacity reduction blocked if active bookings exceed new capacity (`CAPACITY_REDUCTION_BLOCKED`, 422). Wrapped in `$transaction` with `SELECT FOR UPDATE` (TOCTOU protection).

#### `POST /api/op/buses/:id/deactivate`

Soft-deactivate bus. Blocked if future trips assigned (`FUTURE_TRIPS_ASSIGNED`, 422).

#### `PATCH /api/op/buses/:id/maintenance`

Set maintenance window (`maintenanceStart`, `maintenanceEnd`). Overlap with scheduled trips returns 409 (`MAINTENANCE_OVERLAP`).

### 7.3 Fleet Management -- Routes

#### `POST /api/op/routes`

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `origin` | body | string | Yes | Free-text (back-compat) |
| `destination` | body | string | Yes | Free-text (back-compat) |
| `durationMinutes` | body | int | Yes | |
| `originPlaceId` | body | string | No | FK to Place |
| `destPlaceId` | body | string | No | FK to Place |

**Response (201):** Route object.

#### `PATCH /api/op/routes/:id`

Update route. `deactivatedAt` for soft-deactivation.

### 7.4 Trip Management

#### `POST /api/op/trips`

Create trip. **I7-exempt**: operator IS the price authority.

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `routeId` | body | string | Yes | |
| `busId` | body | string | Yes | |
| `departureAt` | body | datetime | Yes | |
| `price` | body | int | Yes | VND integer. I7-exempt for `/api/op/**` |
| `blockedSeats` | body | int | No | Default 0 |
| `cancellationPolicyId` | body | string | No | Defaults to operator's `isDefault` policy |

**Response (201):** Trip object with `status: 'scheduled'`.

**Guards (inside `$transaction`):**
- Bus overlap check: `[departureAt, departureAt + durationMinutes + 60 min buffer]` must not overlap non-cancelled trips on same bus (409 `MAINTENANCE_OVERLAP`)
- Maintenance window check: trip window must not overlap `[maintenanceStart, maintenanceEnd]`

#### `POST /api/op/trips/:id/paired-return`

Create paired return trip for an existing outbound trip.

**Response (201):** Return trip linked via `pairedTripId`.

**Errors:** 422 (`BUS_OVERLAP_WITH_OUTBOUND` -- SPEC CONFLICT: 422 here per AC6, 409 in `reassignBus` per I3)

#### `POST /api/op/trips/:id/cancel`

Cancel trip. Idempotent (ADR-019).

**Response (200):**
```json
{
  "trip": { "id": "...", "status": "cancelled" },
  "alreadyCancelled": false,
  "cancelledBookings": 5
}
```

Second call: `{ "alreadyCancelled": true, "cancelledBookings": 0 }` -- detected inside `$transaction` after `SELECT FOR UPDATE`.

**Cascade:** All active holds → `cancelled_trip`. All paid bookings → `trip_cancelled`. Refund enqueued per paid booking. SMS notification per affected booking.

#### `POST /api/op/trips/:id/close-sales`

Toggle `salesClosed` flag.

#### `POST /api/op/trips/:id/depart`

Mark trip departed. Sets `salesClosed = true`, `departedAt = now()`, `status = 'departed'`.

#### `POST /api/op/trips/:id/complete`

Mark trip completed. Sets `completedAt = now()`, `status = 'completed'`. Creates `Payout(requested, scheduledAt = completedAt + 1 day)`. Enqueues `payout_scheduled` notification with top-level `scheduledFor` column.

#### `PATCH /api/op/trips/:id/reassign-bus`

Reassign bus. Bus overlap returns 409 (`BUS_OVERLAP`).

### 7.5 Booking Management (Operator)

#### `GET /api/op/bookings`

List bookings for operator's trips.

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `serviceDate` | query | string | No | `YYYY-MM-DD` in Vietnam local time (UTC+7) |
| `status` | query | enum | No | Filter by booking status |
| `contactStatus` | query | enum | No | Filter by contact status |
| `cursor` | query | string | No | Pagination cursor |
| `limit` | query | int | No | Page size |

**Response (200):** `{ items: [BookingDto...], nextCursor: "..." }`

#### `POST /api/op/bookings/:id/check-in`

Boarding confirmation. SET-ONCE: atomic `UPDATE WHERE checkedInAt IS NULL`. Idempotent (second call is no-op).

**Guard:** `checkedInAt IS NULL` (mutually exclusive with no-show).

#### `POST /api/op/bookings/:id/no-show`

Mark passenger no-show. Sets `noShowAt = now()`, `status = 'no_show'`.

**Guard:** `checkedInAt IS NULL` (mutually exclusive with check-in).

#### `PATCH /api/op/bookings/:id/contact-status`

Update operator call-queue tracking.

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `contactStatus` | body | enum | Yes | `pending \| reached \| no_answer \| callback` |

#### `POST /api/op/bookings/:id/confirm-cash`

Confirm cash payment (station-collected). Transitions `awaiting_payment → paid`.

#### `GET /api/op/trips/:id/manifest`

Passenger manifest for trip. Returns list of bookings with: passenger name, phone (masked), ticket count, pickup info, booking status, check-in status.

### 7.6 Pickup Area Management

> **Phase 2 (deferred)**: Pickup area management APIs deferred to post-launch (trigger: 4 operators onboarded). Phase 1 = station-only pickup.

#### `POST /api/op/pickup-areas`

Create named pickup/station point.

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `provinceCode` | body | string | Yes | GSO province code |
| `districtCode` | body | string | Yes | GSO district code |
| `wardCode` | body | string | Yes | GSO ward code |
| `name` | body | string | Yes | Named point (e.g., "Ben xe My Dinh") |
| `kind` | body | enum | Yes | `station \| pickup` |
| `displayOrder` | body | int | Yes | |

#### `PATCH /api/op/pickup-areas/:id`

Update. Deactivate via `isActive = false` (never delete for referential integrity).

### 7.7 Recurring Trip Templates

#### `POST /api/op/recurring-templates`

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `routeId` | body | string | Yes | |
| `busId` | body | string | Yes | |
| `price` | body | int | Yes | VND |
| `departureLocalTime` | body | string | Yes | `HH:MM` in Asia/Ho_Chi_Minh |
| `daysOfMask` | body | int | Yes | Bitmask: Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64 (range 1-127) |
| `validFrom` | body | date | Yes | |
| `validUntil` | body | date | Yes | |

**Trip generation:** `generateFromTemplate` daily cron generates Trip rows for 14-day rolling horizon. Dedup via `RecurringGenerationLog`.

### 7.8 Finance -- Payouts & Ledger

#### `GET /api/op/balance`

Operator balance (always computed from ledger, never stored).

**Response (200):**
```json
{
  "pending": 5000000,
  "available": 12500000,
  "paidOut": 8000000
}
```

`available` = SUM(non-payout LedgerEntry WHERE trip completed AND `completedAt + 1 day <= NOW()`) - SUM(payout debits).

#### `POST /api/op/payouts/withdraw`

Request on-demand withdrawal.

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `amount` | body | int | Yes | VND. Min 100,000 |
| `idempotencyKey` | body | string | Yes | Client-generated dedup key |

**Guards:** `PayoutAccount.verifiedAt IS NOT NULL`. Available balance >= amount. Amount >= 100,000 VND.

**Response (201):** Payout with `status: 'requested'`, `scheduledAt = NOW()`.

**Errors:** 422 (`PAYOUT_ACCOUNT_UNVERIFIED`, `INSUFFICIENT_BALANCE`, `BELOW_MINIMUM_WITHDRAWAL`)

#### `GET /api/op/payouts`

Payout history with status filter.

#### `GET /api/op/ledger`

Ledger entry listing.

#### `PATCH /api/op/payout-account`

Update bank account details. Any field edit resets `verifiedAt = null`, blocking withdrawals until admin re-verifies.

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `bankName` | body | string | Yes | |
| `accountNumber` | body | string | Yes | AES-256-GCM encrypted at rest. Masked to last-4 in all API responses |
| `accountHolderName` | body | string | Yes | |

### 7.9 Revenue Reports

#### `GET /api/op/reports/revenue`

Revenue report by date range.

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `from` | query | date | Yes | |
| `to` | query | date | Yes | |
| `format` | query | enum | No | `json` (default) or `csv` |

**Response (200):** Revenue breakdown including gross, platformFee, taxTotal, net per trip/payout.

**Payout fields in response:** `gross` (VND Int), `platformFee` (VND Int), `taxVat` (VND Int), `taxPit` (VND Int), `taxTotal` (VND Int), `net` (VND Int).

### 7.10 Staff Management

#### `POST /api/op/staff`

Create staff member. Generates username in format `BRAND_ACRONYM-last4phone`.

#### `GET /api/op/staff`

List operator staff.

#### `POST /api/op/trips/:id/assign-staff`

Assign staff to trip with role.

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `operatorUserId` | body | string | Yes | |
| `role` | body | string | No | `driver \| conductor \| checker` |

### 7.11 Settings

#### `GET /api/op/settings`

Get operator settings.

#### `PATCH /api/op/settings`

Update operator settings.

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `autoConfirmBookings` | body | boolean | No | |
| `notificationPreference` | body | enum | No | `sms \| email \| both` |
| `bookingReminderHours` | body | int | No | Hours before departure |
| `customBrandingText` | body | string | No | |

### 7.12 Cancellation Policies

#### `POST /api/op/cancellation-policies`

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `name` | body | string | Yes | E.g., "Flexible", "Standard", "Non-refundable" |
| `rules` | body | array | Yes | `[{ hoursBeforeDeparture: number, refundPercentage: number }]` |
| `isDefault` | body | boolean | No | At most one default per operator |
| `effectiveFrom` | body | datetime | Yes | |

### 7.13 Vouchers (Operator-Scoped)

#### `POST /api/op/vouchers`

Create operator-specific voucher.

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `code` | body | string | Yes | Unique |
| `discountType` | body | enum | Yes | `fixed_amount \| percentage` |
| `discountValue` | body | int | Yes | VND for fixed; PPM for percentage |
| `minOrderVnd` | body | int | No | Minimum order value |
| `maxDiscountVnd` | body | int | No | Cap for percentage type |
| `validFrom` | body | datetime | Yes | |
| `validUntil` | body | datetime | Yes | |
| `usageLimit` | body | int | No | Total redemptions. NULL = unlimited |

### 7.14 KYB Documents

#### `POST /api/op/kyb-documents`

Upload verification document.

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `type` | body | enum | Yes | `business_license \| identity \| payout_account` |
| `file` | body | file | Yes | Uploaded to S3 via signed URL |

### 7.15 Reviews (Operator Read)

#### `GET /api/op/reviews`

List reviews for operator's trips (read-only; aggregated ratings).

---

## 8. Admin-Facing Endpoints

All `/api/admin/**` endpoints require admin JWT. Admin routes may access any operator's data via explicit `operatorId` in path or query parameter.

### 8.1 Operator Lifecycle

#### `GET /api/admin/operators`

List operators with status filter.

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `status` | query | enum | No | `PENDING_REVIEW \| UNDER_REVIEW \| APPROVED \| REJECTED \| SUSPENDED` |

#### `POST /api/admin/operators/:id/approve`

Transition: `UNDER_REVIEW → APPROVED`. Clears `disabledAt`. Sends SMS + email notification.

#### `POST /api/admin/operators/:id/reject`

Transition: `UNDER_REVIEW → REJECTED`. Sets `rejectionReason`.

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `rejectionReason` | body | string | Yes | |

#### `POST /api/admin/operators/:id/suspend`

Transition: `APPROVED → SUSPENDED`. Sets `disabledAt = now()`. Hides listings from search.

#### `POST /api/admin/operators/:id/reinstate`

Transition: `SUSPENDED → APPROVED`. Clears `disabledAt`.

#### `POST /api/admin/operators`

Provision new operator (CLI or admin panel).

### 8.2 Content Moderation

#### `POST /api/admin/moderation/:targetType/:targetId`

Moderate content (trip, route, or operator). Sets `moderatedAt` on target -- soft-hide from search and direct links.

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `targetType` | path | enum | Yes | `trip \| route \| operator` |

#### `GET /api/admin/content-reports`

Moderation queue with status filter.

#### `POST /api/admin/reviews/:id/publish`

Publish a pending review.

#### `POST /api/admin/reviews/:id/hide`

Hide a review.

### 8.3 Finance Administration

#### `GET /api/admin/payouts`

Cross-operator payout queue.

#### `GET /api/admin/ledger`

Cross-operator ledger queries.

#### `POST /api/admin/fee-configs`

Create fee configuration (global or per-operator override).

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `operatorId` | body | string | No | NULL = global default |
| `ratePpm` | body | int | Yes | Parts-per-million (60000 = 6%). Floor 50000 (5%), ceiling 200000 (20%) |
| `effectiveFrom` | body | datetime | Yes | |
| `effectiveTo` | body | datetime | No | NULL = open-ended |

Effective-dated, append-audited: creates new row. Never edit existing `ratePpm`.

#### `GET /api/admin/audit-log`

Append-only admin audit trail. Time-ordered.

### 8.4 Compliance

#### `GET /api/admin/complaints`

Complaint queue with SLA countdown. Filterable by status.

#### `PATCH /api/admin/complaints/:id`

Update complaint (acknowledge, assign, resolve, escalate, close).

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `status` | body | enum | No | Next status in state machine |
| `assignedTo` | body | string | No | Admin actor ID |
| `resolution` | body | string | No | Required on resolve/close |
| `escalationNote` | body | string | No | On escalation |

#### `GET /api/admin/data-requests`

DSAR processing queue with statutory countdown timers.

#### `PATCH /api/admin/data-requests/:id`

Process DSAR.

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `status` | body | enum | Yes | `processing \| completed \| rejected` |
| `responseRef` | body | string | No | Link to exported data (access/port) |
| `notes` | body | string | No | |

### 8.5 System Configuration

#### `GET /api/admin/feature-flags`

List feature flags.

#### `PATCH /api/admin/feature-flags/:key`

Toggle feature flag.

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `enabled` | body | boolean | Yes | |
| `value` | body | string | No | JSON string for non-boolean flags |

### 8.6 Place Registry

#### `POST /api/admin/places`

Create canonical place.

| Field | In | Type | Required | Notes |
|-------|-----|------|----------|-------|
| `canonicalName` | body | string | Yes | |
| `aliases` | body | string[] | Yes | Alternate names for merging |
| `slug` | body | string | No | URL-friendly identifier |

#### `PATCH /api/admin/places/:id`

Update place (add aliases, change canonical name).

### 8.7 Customer Lookup

#### `GET /api/admin/bookings`

Cross-operator booking search by phone, email, or booking reference.

#### `GET /api/admin/customers`

Customer lookup for support.

---

## 9. Webhook Contracts

### 9.1 MoMo IPN

#### `POST /api/payments/momo/webhook`

**Authentication:** HMAC-SHA256 signature verification. Invalid HMAC → HTTP 400.

**CSRF:** Exempt (HMAC-authenticated; not cookie-based).

**Body fields:** `resultCode`, `orderId`, `transId`, `amount`, `message`, `signature`

**Processing:**

| Step | Action |
|------|--------|
| 1 | Verify HMAC signature. Invalid → 400 |
| 2 | Idempotency check: `PaymentEvent` INSERT with `@@unique([adapter, providerTxnId])`. Duplicate (P2002) → 200 no-op |
| 3 | Amount guard: `amount >= booking.totalVnd AND currency = 'VND'`. Underpay → do NOT mark paid. Overpay → log warning, still mark paid |
| 4 | `applyPaidStatusTransition`: `SELECT FOR UPDATE` on Trip, recount capacity (L2 guard), transition booking to `paid` |
| 5 | Ledger entries: `booking_credit` + `platform_fee` (idempotent via `sourceEventId` unique) |
| 6 | Notification enqueue: customer confirmation + operator alert |

**Result code handling:**

| Codes | Action |
|-------|--------|
| `0` | Success → `paid` |
| `{1001, 1002, 1003, 1004, 1005, 4100}` | Failure → `payment_failed_expired` |
| `9000` | Pending (transaction in process) → no action |
| Other | Unknown → log, no transition |

**Failure codes pinned to spec AC verbatim** (Issue 004 lesson). Never augment from vendor docs.

**Response:** Always HTTP 200 (except 400 for invalid HMAC). Never return 5xx (causes PSP retry storms).

### 9.2 VNPay IPN

#### `POST /api/payments/vnpay/webhook`

Same idempotency pattern as MoMo. Checksum verification per VNPay spec. Dual path: return URL (redirect) + IPN (server-to-server), both idempotent.

### 9.3 Bank Transfer (SePay) Webhook

#### `POST /api/payments/bank_transfer/webhook`

**Authentication:** Bearer token (`Authorization: Bearer <SEPAY_API_KEY>`) — verified in route handler before `processPaymentWebhook`. CSRF exempt.

SePay sends webhook when incoming transfer arrives in Agribank account. Adapter extracts bookingRef from `content` field via case-insensitive regex. Same idempotency pattern as MoMo (PaymentEvent `@@unique([adapter, providerTxnId])` with `adapter='bank_transfer'`).

| Response | Condition |
|----------|-----------|
| 200 | Valid token, event processed (or duplicate) |
| 401 | Invalid/missing bearer token |

See DS-013 for full design.

### 9.4 Oversold Race Handling (L2)

When L2 capacity recount detects `paid_count > capacity` after marking booking as `paid`:

1. Booking status → `refunded`
2. Post-commit `refundOut` (async)
3. Refund keyed as `cancel:<tripId>:<bookingId>` for idempotency
4. Always return HTTP 200 to gateway

---

## 10. Cron Job Endpoints

All cron jobs are Next.js API route handlers triggered by external scheduler (Vercel Cron). Protected by cron secret header. Use `FOR UPDATE SKIP LOCKED` in batches.

| Route | Job | Schedule | Predicate | Batch |
|-------|-----|----------|-----------|-------|
| `/api/cron/expire-holds` | expireHolds | 1 min | `status = 'active' AND expiresAt < NOW()` | 500 |
| `/api/cron/notification-dispatch` | notificationDispatch | 1 min | `status = 'pending' AND (nextAttemptAt IS NULL OR nextAttemptAt <= NOW())` | configurable |
| `/api/cron/settle-payout` | settlePayout | 5 min | `status = 'requested' AND scheduledAt <= NOW()` | configurable |
| `/api/cron/auto-complete-trips` | autoCompleteTrips | 15 min | `status = 'departed'` past arrival window | configurable |
| `/api/cron/charter-expiry` | charterExpirySweeper | 15 min | `ASSIGNED_DIRECT` past `acceptByAt`, `PUBLISHED` past `claimByAt` | configurable |
| `/api/cron/einvoice-submission` | einvoiceSubmission | 5 min | `EInvoice.status = 'pending'` | configurable |
| `/api/cron/ticket-pdf-generation` | ticketPdfGeneration | 5 min | `status = 'paid' AND ticketPdfKey IS NULL` | configurable |
| `/api/cron/24h-reminder` | 24hSmsReminder | periodic | Paid bookings, `reminderSentAt IS NULL`, trip within 24h window | configurable |
| `/api/cron/generate-from-template` | generateFromTemplate | daily | Active templates, 14-day horizon, dedup via GenerationLog | per template |
| `/api/cron/operator-license-alert` | operatorLicenseAlert | daily | `expiryDate <= NOW() + 60 days AND expiryAlertSentAt IS NULL` | configurable |
| `/api/cron/pii-anonymization` | piiAnonymization | daily | `snapshotAnonymizedAt IS NULL` + retention window past | configurable |
| `/api/cron/kyb-doc-purge` | kybDocumentPurge | periodic | `purgedAt IS NULL` + operator REJECTED/SUSPENDED 90+ days | configurable |
| `/api/cron/complaint-sla-monitor` | complaintSlaMon | hourly | Open complaints past `slaDeadline` | configurable |
| `/api/cron/refund-retry` | refundRetry | 5 min | `status = 'failed' AND nextRetryAt <= NOW()` | configurable |
| `/api/cron/subscription-billing` | subscriptionBilling | daily | `status = 'active' AND nextBillingAt <= NOW()` | configurable |

**Response contract:**

```json
{
  "job": "<jobName>",
  "status": "success",
  "rowsAffected": 42,
  "durationMs": 1250
}
```

Each invocation logged to `JobRunLog` with status (`success`, `failed`, `skipped_locked`).

---

## 11. Security Contract

### 11.1 CSRF Protection

**Mechanism:** Double-submit cookie pattern (ADR-008 D5).

| Component | Value |
|-----------|-------|
| Cookie | `bb_csrf` (non-HttpOnly, readable by client JS) |
| Header | `X-CSRF-Token` |
| Required on | All non-safe methods (POST, PUT, PATCH, DELETE) to `/api/*` |
| Exempt | Webhook routes authenticated via HMAC or bearer token (`/api/payments/*/webhook`) |
| Client helper | `readCsrfToken()` from `lib/auth/csrfClient` |
| E2E helper | `primeCsrf()` from `e2e/helpers/csrf.ts` |

**Client component rule:** `'use client'` components MUST deep-import `@/lib/auth/csrfClient`, NEVER the `@/lib/auth` barrel (barrel pulls server-only modules into client bundle -- causes 500 on all routes).

### 11.2 Rate Limiting

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| `/api/auth/otp/send` | 5 requests | 15 min | IP + phone |
| `/api/auth/otp/verify` | 3 attempts | Per OTP (lockout) | Phone |
| `/api/auth/login` | 10 requests | 15 min | IP |
| `/api/auth/register` | 5 requests | 15 min | IP |
| `/api/holds` (POST) | 3 active holds | Per phone per trip | Phone |
| General API | 100 requests | 1 min | IP |
| Admin API | 30 requests | 1 min | IP |

Implementation: Upstash Redis-based rate limiter. API: `ratelimit.limit(ip)` → `{ allowed, remaining, retryAfter }`.

Rate limiter fails OPEN on Redis/Upstash downtime (known gap -- no circuit-breaker or in-memory fallback).

### 11.3 Input Validation

- **Zod** schemas at every API boundary (route handler entry). Parse failure → 400 (fail-fast)
- Zod `.strip()` mode removes unrecognized keys -- prevents mass assignment of `operatorId`, `price`, `status`
- Phone validation: Vietnamese format `+84[35789]\d{8}` (10 digits after country code)
- Integer bounds on all numeric fields
- Enum validation via Zod `.enum()` for all status/type fields
- JSON payload validation for `Json` column inputs (cancellation rules, charter destinations)
- No raw user input reaches SQL: Prisma parameterizes; raw SQL uses `Prisma.sql` tagged template

### 11.4 Tenant Isolation

- `operatorId` from JWT claim ONLY. Never from request body (greppable: `grep -rn "body.*operatorId" app/api/op/` must return zero)
- Every operator-scoped query uses `withOperatorScope` or manual `WHERE operatorId = <jwt.operatorId>`
- Admin routes may specify `operatorId` as path/query parameter for cross-tenant access
- Same 404 returned for "doesn't exist" and "not your tenant" (no information leak)

### 11.5 PII in API Responses

| Data | Treatment |
|------|-----------|
| Phone numbers | Masked to last 4 in non-owner responses (`****1234`) |
| `PayoutAccount.accountNumber` | Always masked to last 4 in ALL responses |
| Error responses | Never leak PII |
| `NotificationLog.payload` | No PII (I9 invariant). `recipient` is sole PII column |
| `adminAuditLog.argsRedacted` | Phone numbers masked to last 4 |

### 11.6 Webhook Security

| Provider | Auth Method | Header |
|----------|------------|--------|
| MoMo | HMAC-SHA256 | `X-MoMo-Signature` (or body field) |
| VNPay | Checksum | Per VNPay spec |

Webhook routes skip CSRF. Raw payload stored in `PaymentEvent.rawBody` for forensic audit.

---

## 12. Business Invariants Affecting API

### 12.1 I7 -- No Client-Originated Price

Customer-facing endpoints (`/api/holds/**`, `/api/bookings/**`, `/api/payments/**`) MUST NEVER accept `price` from the request body. `totalVnd` is server-computed: `Trip.price * ticketCount - discountVnd`. Operator-side `/api/op/**` endpoints are I7-exempt (operator IS the price authority). Each exempt site carries `// I7-exempt:` inline comment.

### 12.2 Capacity Guard (Three Layers)

| Layer | Trigger | Mechanism |
|-------|---------|-----------|
| L1 | `POST /api/holds` | Conditional INSERT + phone advisory lock + trip advisory lock |
| L2 | PSP webhook (payment confirmation) | `SELECT FOR UPDATE` on Trip + full recount. If `paid > capacity` → `status = 'refunded'` + refundOut |
| L3 | Hold creation | Per-phone active hold cap per trip |

### 12.3 Ledger Immutability (I8)

`LedgerEntry`, `AdminAuditLog`, `ConsentRecord` are append-only. PostgreSQL `BEFORE UPDATE/DELETE` triggers block modification. No UPDATE/DELETE endpoints exist.

### 12.4 Notification PII Rule (I9)

`NotificationLog.payload` must NOT contain phone/PII. `recipient` is the sole PII column. Logger redaction list must include `recipient` and `otpProof`.

### 12.5 Currency Math (I10)

All multiplication of integer minor-unit (VND) by fractional rate MUST use BigInt domain. ES2017 target: `BigInt(n)` constructor calls only (no `1n` suffix). `ratePpm` encoding: parts-per-million (60000 = 6%).

### 12.6 Settlement Delay (I11)

Revenue available for withdrawal: `completedAt + 1 day <= NOW()`. Minimum withdrawal: 100,000 VND. `SETTLEMENT_DELAY_DAYS = 1`.

### 12.7 Idempotency Mechanisms

| Operation | Mechanism |
|-----------|-----------|
| Payment webhook | `@@unique([adapter, providerTxnId])` → P2002 catch → 200 no-op |
| Booking creation | `INSERT ON CONFLICT (holdId) DO NOTHING` |
| LedgerEntry writes | `sourceEventId` unique constraint |
| Withdrawal | `withdraw-key:<idempotencyKey>` double-probe |
| Trip cancel/complete/depart | Discriminated result: `{ alreadyApplied: boolean }` → 200 |
| Refund | `refund_out:<key>` replay guard |

---

## 13. Performance Targets

### 13.1 Latency Budgets (p95)

| Endpoint Class | p95 Target | Alert Threshold |
|---------------|------------|-----------------|
| Trip search API | <= 300 ms | <= 500 ms |
| Hold creation | <= 200 ms | <= 400 ms |
| Operator console CRUD | <= 200 ms | <= 400 ms |
| Payment webhook processing | <= 500 ms | <= 1,000 ms |
| Customer pages (LCP) | <= 2,500 ms | <= 4,000 ms |

### 13.2 Throughput

| Target | Value | Notes |
|--------|-------|-------|
| Concurrent booking attempts (Tet peak) | ~2,000 | Phase 3: 500 bookings/day * 20x surge * hold window |
| Hold expiry cron batch | 500 | Clears 2,000 expired holds in 4 iterations |

### 13.3 Availability

| Period | Target | Downtime Budget |
|--------|--------|-----------------|
| Monthly (standard) | 99.5% | ~3.6 hours/month |
| Tet 2-week window | 99.9% | ~43 minutes |

---

## 14. Regulatory Constraints on API Design

### 14.1 Consumer Protection (CPL 2023)

| Requirement | API Obligation |
|-------------|---------------|
| Price transparency (Art. 8-12) | Search results and booking details must show total price inclusive of all fees. Price shown = price charged |
| Cancellation policy disclosure | Trip search response must include cancellation policy summary. Booking confirmation must include full terms |
| 3-day remote cancellation right (Art. 29) | Cancellation endpoint must enforce window. Legal opinion pending on exact boundary |
| Complaint SLA (Art. 31-34) | 3 business days to acknowledge, 7-30 days to resolve. Complaint response must include ticket ID and SLA deadline |
| Booking confirmation content | Must include: departure details, price, operator info, cancellation terms |

### 14.2 Data Privacy (PDPL 2025)

| Requirement | API Obligation |
|-------------|---------------|
| Consent collection | Registration and booking must not proceed without explicit per-purpose consent. No pre-ticked boxes |
| DSAR portal | Must support access (10 days), correction (10 days), deletion (20 days), portability |
| Data minimization | API responses must not include unnecessary PII. Search results contain no customer PII |
| Cross-border transfer | Current Vercel Singapore setup = breach until CDTIA filed. No new PII columns without CDTIA assessment |
| Breach notification | 72-hour reporting to A05 (MPS). Audit log endpoints must be always-on |

### 14.3 Payment (SBV Regulations)

| Requirement | API Obligation |
|-------------|---------------|
| Licensed intermediaries only | MoMo, VNPay, ZaloPay (SBV-licensed). No crypto/stablecoin |
| E-wallet transaction cap | 20M VND/transaction, 100M VND/month (Circular 41/2025). Graceful error on cap exceeded |
| Refund in same method | Track original payment method. Cash refund within 7 days if digital fails (CPL 2023 Art. 30) |
| Settlement windows | T+1 (MoMo, VNPay). Payout API must respect PSP settlement timing |

### 14.4 E-Invoice (Decree 70/2025)

| Requirement | API Obligation | Status |
|-------------|---------------|--------|
| Transport invoice fields | `vehiclePlateNumber`, `departureCityCode`, `destinationCityCode`, operator MST | **OVERDUE** -- missing from MISA integration |
| Issuance timing | Within 24 hours of trip completion (Decree 123/2020) | Cron-driven, ~5 min batch |
| 10-year retention | Original electronic form. No soft-delete on invoice records | Enforced at DB level |
| Operator as seller | Invoice stamps operator's tax code (MST) even when platform issues on their behalf | Requires operator MST at onboarding |

### 14.5 Transport (BGTVT)

| Requirement | API Obligation |
|-------------|---------------|
| Operator licensing | Only BGTVT-licensed operators list trips. KYB verification at onboarding |
| Passenger manifest | `GET /api/op/trips/:id/manifest` must produce manifest for BGTVT inspection |
| License expiry | 60-day alert cron on `KybDocument.expiryDate` |
| Tet pricing | Government guidance caps Tet increases at 40-60% above normal |

---

## Appendix A: Payment Flow Sequences

### A.1 MoMo Payment

```
Customer                Platform API              MoMo PSP
   |                        |                        |
   |-- POST /api/holds ---->|                        |
   |<-- 201 { hold } -------|                        |
   |                        |                        |
   |-- POST /api/bookings   |                        |
   |   /initiate ---------->|                        |
   |                        |-- createPayment() ---->|
   |<-- 201 { payUrl } -----|<-- { payUrl } ---------|
   |                        |                        |
   |-- redirect to payUrl ->|                        |
   |                        |                        |
   |         (customer completes payment on MoMo)    |
   |                        |                        |
   |                        |<-- POST /webhook ------|
   |                        |    (HMAC-signed)       |
   |                        |-- HMAC verify          |
   |                        |-- idempotency check    |
   |                        |-- amount guard         |
   |                        |-- L2 capacity recheck  |
   |                        |-- booking → paid       |
   |                        |-- ledger entries       |
   |                        |-- notification enqueue |
   |                        |-- 200 OK ------------->|
   |                        |                        |
   |<-- redirect to return -|                        |
```

### A.2 Cash Payment

```
Customer                Platform API              Operator
   |                        |                        |
   |-- POST /api/holds ---->|                        |
   |-- POST /api/bookings   |                        |
   |   /initiate ---------->|                        |
   |   (paymentMethod: cash)|                        |
   |<-- 201 { booking } ----|                        |
   |   (status: awaiting)   |                        |
   |                        |                        |
   |     (customer pays cash at station)             |
   |                        |                        |
   |                        |<-- POST /api/op/       |
   |                        |    bookings/:id/       |
   |                        |    confirm-cash -------|
   |                        |-- booking → paid       |
   |                        |-- ledger entries       |
   |                        |-- 200 OK ------------->|
```

### A.3 PSP Window Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| Hold TTL | 10 minutes | Seat reservation lifetime |
| PSP_WINDOW | 20 minutes | Capacity reservation for `awaiting_payment` bookings |
| Access JWT TTL | 15 minutes | Auth token lifetime |
| OTP Proof TTL | 5 minutes | Cross-route verified phone state |
| OTP Lockout | 15 minutes | After 3 failed verifications |

---

## Appendix B: State Machine Summary

Complete state machines are documented in 01-data-model-design sections 7.1-7.11. API-relevant summary:

| Entity | API Transition Pattern | Notes |
|--------|----------------------|-------|
| Trip | Action-based endpoints (not generic PATCH on status) | `POST /depart`, `/complete`, `/cancel`, `/close-sales` |
| Booking | Automatic (webhook-driven) + operator action endpoints | `POST /check-in`, `/no-show`, `/confirm-cash` |
| Hold | Automatic (cron-driven expiry, booking consumption) | No manual transition endpoint |
| Payout | Cron-driven settlement + admin retry | `POST /withdraw` creates; cron settles |
| Operator | Admin action endpoints | `POST /approve`, `/reject`, `/suspend`, `/reinstate` |
| EInvoice | Cron-driven submission | No manual endpoints |
| CharterRequest | Admin assign/publish + operator accept/decline | Complex routing with timeout sweepers |
| Complaint | Admin lifecycle management | SLA-tracked with deadline enforcement |
| DataRequest | Admin processing | Statutory deadline tracking |
| Refund | System-initiated + cron retry | `requested → processing → completed/failed` |
| OperatorSubscription | Billing cron + operator action | Active/cancelled/past_due/expired |

---

## Appendix C: Human-Readable Reference Formats

| Entity | Format | Example |
|--------|--------|---------|
| Booking ref | `BB-YYYY-[0-9a-z]{4}-[0-9a-z]{4}` | `BB-2026-a1b2-c3d4` |
| Operator application ref | `OP-YYYY-XXXXXX` | `OP-2026-AB12CD` |
| Charter request ref | `CH-YYYY-XXXXXX` | `CH-2026-XY78ZA` |
| Operator username | `BRAND_ACRONYM-last4phone` | `FUTA-1234` |
