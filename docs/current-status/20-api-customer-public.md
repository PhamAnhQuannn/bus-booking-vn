# 20 -- Customer-Facing & Public API Routes

> Generated 2026-06-21. Source of truth: `app/api/**/route.ts` (non-`op/`, non-`admin/`).

---

## 1. Authentication (`/api/auth/*`)

All auth routes use `withErrorHandler` wrapper. Runtime: Node.js.

| Method | Path | Auth | Request | Success | Error statuses | Lib functions | Notable |
|--------|------|------|---------|---------|----------------|---------------|---------|
| POST | `/api/auth/otp/send` | None | `{ phone }` (otpSendInput) | 200 `{ success: true }` | 400 INVALID, 429 rate_limited (+Retry-After) | `sendOtp(phone)` | CSRF-protected |
| POST | `/api/auth/otp/verify` | None | `{ phone, code }` (otpVerifyInput) | 200 `{ otpProof }` (HS256 JWT, 5-min TTL) | 400 expired/invalid, 429 attempt_cap | `verifyOtp()`, `issueOtpProof()`, `normalizePhone()` | CSRF-protected; proof is single-use via jti |
| GET | `/api/auth/otp/test-peek` | Dual: `NODE_ENV !== 'production'` AND `OTP_PEEK_ENABLED === 'true'` | Query: `phone` | 200 `{ code }` | 400 phone required, 404 not_found/disabled | `getTestOtp(phone)` | Test-only; returns last OTP from in-memory eSMS stub |
| POST | `/api/auth/register` | otpProof JWT (one-shot) | `{ phone, otpProof, password, displayName? }` | 200 `{ accessToken, customer }` + Set-Cookie `bb_rt` (30d) | 400 otp_proof_invalid, 409 invalid_credentials | `verifyOtpProof()`, `normalizePhone()`, `register()` | CSRF-protected; access token 15min in body; refresh 30d in HttpOnly cookie |
| POST | `/api/auth/forgot-password` | None | `{ phone }` (regex validated) | 200 `{ ok: true }` (always, no enumeration) | -- | `forgotPassword(phone)` | CSRF-exempt; always 200 even on invalid phone; max 3 resends / 15min |
| POST | `/api/auth/forgot-password/verify` | OTP code | `{ phone, code }` | 200 `{ otpProof }` (purpose='reset_password', 5-min TTL) | 400 OTP_EXPIRED/OTP_INVALID, 429 OTP_LOCKED_OUT | `verifyCustomerAccountOtp()`, `issueOtpProof()`, `normalizePhone()` | CSRF-exempt |
| POST | `/api/auth/reset-password` | reset_password otpProof JWT | `{ otpProof, newPassword }` | 204 No Content | 400 INVALID/WEAK_PASSWORD, 401 INVALID_PROOF, 422 PASSWORD_REUSED | `resetPassword()` | CSRF-exempt; jti anti-replay; no enumeration (404 mapped to 401) |
| POST | `/api/auth/logout` | None (reads `bb_rt` cookie) | (none) | 200 `{ success: true }` + clears `bb_rt` | -- | `logout(refreshToken)` | CSRF-protected; always succeeds even if cookie invalid |
| POST | `/api/auth/refresh` | Implicit (`bb_rt` cookie) | (none) | 200 `{ accessToken }` + rotated `bb_rt` cookie (30d) | 401 no_session/session_reuse/invalid_session | `refresh(refreshToken)` | CSRF-protected; refresh-token rotation; session-reuse detection cascades revoke |

---

## 2. Bookings (`/api/bookings/*`)

All routes use `withErrorHandler` wrapper. Runtime: Node.js.

| Method | Path | Auth | Request | Success | Error statuses | Lib functions | Notable |
|--------|------|------|---------|---------|----------------|---------------|---------|
| GET | `/api/bookings` | `requireCustomerAuth()` | Query: `tab=upcoming\|past`, cursor pagination params (ListCustomerBookingsParamsSchema) | 200 paginated bookings | 401, 422 validation | `listCustomerBookings(customerId, params)` | Customer sees only own bookings |
| GET | `/api/bookings/:id` | `requireCustomerAuth()` | URL param: `id` | 200 `{ booking }` | 401, 404 (not found or not owned) | `getCustomerBookingDetail(customerId, id)` | Strict ownership; non-owned returns 404 (no enumeration) |
| GET | `/api/bookings/:id/ticket` | `requireCustomerAuth()` | URL param: `id` | 302 redirect to signed download URL | 202 pending, 404 not found, 409 not ticketable, 401, 500 | `getCustomerBookingDetail()`, `createSignedDownloadUrl()` | Async PDF; ticketable statuses: paid, completed, no_show; bytes never proxied |
| POST | `/api/bookings/initiate` | None (hold cookie + optional customer JWT) | `{ holdId, paymentMethod: 'momo'\|'zalopay'\|'card'\|'vnpay', consents: { noRefund, piiStorage, version } }` | 200 `{ bookingId, payUrl }` | 400 INVALID, 403 FORBIDDEN (cookie mismatch), 404 NOT_FOUND, 409 HOLD_EXPIRED/TRIP_DEPARTED/OPERATOR_NOT_BOOKABLE, 422 consent_required, 429 TOO_MANY_REQUESTS, 502 GATEWAY_ERROR, 503 UNAVAILABLE | `initiateOnlineBooking()`, `extractHoldCookie()`, `getCustomerOptional()`, `ratelimit.limit(ip)` | Rate-limited by IP; `bb_hold` cookie must match holdId; consent version gate (Issue 089); baseUrl derived from request headers; optional customer attachment; analytics tracked |

---

## 3. Holds (`/api/holds/*`)

All routes use `withErrorHandler` wrapper. Runtime: Node.js.

| Method | Path | Auth | Request | Success | Error statuses | Lib functions | Notable |
|--------|------|------|---------|---------|----------------|---------------|---------|
| POST | `/api/holds` | None (public; rate-limited by IP) | `{ tripId, ticketCount, buyerName, buyerPhone, buyerEmail, pickupKind, pickupAreaId?, pickupDetail? }` (holdInputSchema) | 200 `{ holdId, expiresAt }` + Set-Cookie `bb_hold` (HttpOnly, HMAC-signed) | 400 invalid, 409 sold_out/trip_unavailable, 422 pickup validation, 429 rate_limited/hold_cap | `createHold()`, `validatePickupSelection()`, `ratelimit.limit(ip)`, `buildSetCookieHeader()` | IP rate limit + per-phone hold cap; pickup validation against trip-specific TripPickupArea |
| GET | `/api/holds/:id` | Cookie: `bb_hold` must match `id` | URL param: `id`; cookie: `bb_hold` | 200 `{ tripId, ticketCount, expiresAt, totalVND }` (Cache-Control: no-store) | 401 cookie mismatch/missing, 404 not found | `extractHoldCookie()`, `getHoldDetails(id)` | totalVND server-computed (price x ticketCount); strict cookie auth |

---

## 4. Trips (`/api/trips/*`)

All routes use `withErrorHandler` wrapper. Runtime: Node.js.

| Method | Path | Auth | Request | Success | Error statuses | Lib functions | Notable |
|--------|------|------|---------|---------|----------------|---------------|---------|
| GET | `/api/trips/search` | None (public) | Query: `origin`, `destination`, `date`, `ticketCount`, `cursor?` (searchParamsSchema) | 200 JSON array of TripResult; `X-Next-Cursor` header for pagination | 400 invalid, 429 rate_limited (+Retry-After) | `searchTrips()`, `ratelimit.limit(ip)` | Cache-Control: no-store; holds-aware capacity; diacritic-insensitive; seek pagination (Issue 097); analytics tracked |
| GET | `/api/trips/:id/pickup-areas` | None (public) | URL param: `id` | 200 `{ areas: [{ areaId, label, kind }] }` (ordered by displayOrder) | 500 internal | `prisma.trip.findUnique()`, `isSearchVisible()`, `prisma.tripPickupArea.findMany()` | Returns empty array (not 404) for non-bookable/hidden trips; prevents enumeration |

---

## 5. Payment Webhooks (`/api/payments/*`)

All webhook routes are CSRF-exempt (HMAC verification). Wrapped in `withErrorHandler`.

| Method | Path | Auth | Request | Success | Error statuses | Lib functions | Notable |
|--------|------|------|---------|---------|----------------|---------------|---------|
| POST | `/api/payments/momo/webhook` | Webhook HMAC (via MoMo adapter) | Raw body text | Delegated to `processPaymentWebhook` | Delegated | `getMomoAdapter()`, `processPaymentWebhook()` | CSRF-exempt; resultCode mapping sourced from Issue 004 AC verbatim |
| GET/POST | `/api/payments/vnpay/webhook` | HMAC signature via `verifyWebhook()` | GET: query params; POST: URL-encoded form body | 200 `{ RspCode: '00', Message: 'Confirm Success' }` | 200 `{ RspCode: '97' }` (bad sig), `{ RspCode: '01' }` (unknown order), `{ RspCode: '99' }` (error) | `getVnpayAdapter()`, `processPaymentWebhook()`, `prisma.booking.findUnique()` | CSRF-exempt; VNPay v2.1.0 format mandatory; always HTTP 200 (RspCode discriminates); dual GET+POST handling; IPN is authoritative state source |
| GET | `/api/payments/vnpay/return` | HMAC signature via `verifyWebhook()` | Query: vnp_* params | 302 redirect to `/booking/confirmation`, `/booking/payment-pending`, or `/booking/payment-error` | (always 302) | `getVnpayAdapter()` | Browser-only UX redirect; NOT authoritative (IPN is); rejects tampered/zero-amount URLs |
| POST | `/api/payments/zalopay/webhook` | Webhook HMAC (via ZaloPay adapter) | Raw body text | Delegated to `processPaymentWebhook` | Delegated | `getGatewayFor('zalopay')`, `processPaymentWebhook()` | CSRF-exempt; stub adapter locally, real PSP in Phase 2 |
| POST | `/api/payments/card/webhook` | Webhook HMAC (via card adapter) | Raw body text | Delegated to `processPaymentWebhook` | Delegated | `getGatewayFor('card')`, `processPaymentWebhook()` | CSRF-exempt; stub adapter locally, real PSP in Phase 2 |

---

## 6. Charter (`/api/charter/*`)

All routes use `withErrorHandler` wrapper. Runtime: Node.js.

| Method | Path | Auth | Request | Success | Error statuses | Lib functions | Notable |
|--------|------|------|---------|---------|----------------|---------------|---------|
| POST | `/api/charter` | None (public guest); optional `getCustomerOptional()` | `{ contactName, contactPhone, contactEmail, originName, destinationNames[], startDate, endDate?, durationDays?, passengers, vehicleType, budgetVnd?, notes?, company (honeypot) }` (charterSchema) | 201 `{ ref }` (e.g. `CH-YYYY-XXXXXX`) | 400 validation, 429 rate_limited (+Retry-After) | `createCharterRequest()`, `getCustomerOptional()`, `ratelimit.limit()` | CSRF-protected; IP rate limit 5/hour; honeypot: non-empty `company` silently returns 200 `{ ok: true }` (no row created); optional customer attachment |
| POST | `/api/charter/:ref/cancel` | None (ref is access key) | URL param: `ref` | 200 `{ ref, status: 'CANCELLED' }` | 404 NOT_FOUND, 422 CANNOT_CANCEL | `getCharterByRef()`, `transitionCharterRequest()` | CSRF-protected; customer can cancel pre-ACCEPT only (SUBMITTED, ADMIN_REVIEW, ASSIGNED_DIRECT, PUBLISHED); race-condition guarded via FOR UPDATE lock |

---

## 7. Account Management (`/api/account/*`)

All routes require `requireCustomerAuth()` (Bearer token). All use `withErrorHandler` wrapper.

| Method | Path | Auth | Request | Success | Error statuses | Lib functions | Notable |
|--------|------|------|---------|---------|----------------|---------------|---------|
| PATCH | `/api/account/name` | Customer JWT | `{ displayName }` | 200 `{ displayName }` | 400 INVALID, 422 DISPLAY_NAME_TOO_SHORT/DISPLAY_NAME_TOO_LONG | `updateName(customerId, displayName)` | |
| POST | `/api/account/password` | Customer JWT | `{ currentPassword, newPassword }` (passwordSchema) | 200 `{ ok: true }` | 400 INVALID/WEAK_PASSWORD, 422 CURRENT_PASSWORD_WRONG/PASSWORD_REUSED | `changePassword(customerId, currentPassword, newPassword)` | CSRF double-submit enforced by edge middleware |
| POST | `/api/account/phone/init` | Customer JWT | `{ newPhone }` (phoneSchema) | 200 `{ ok: true }` | 400 INVALID, 429 LOCKED_OUT/RATE_LIMITED (+retryAfter) | `sendCustomerAccountOtp(newPhone)` | Rate-limit + OTP lockout built into service; no-enumeration |
| POST | `/api/account/phone/confirm` | Customer JWT | `{ newPhone, code }` (phoneSchema + 6-digit regex) | 200 `{ phone }` | 400 INVALID/OTP_EXPIRED/OTP_INVALID, 422 PHONE_TAKEN, 429 OTP_LOCKED_OUT | `verifyCustomerAccountOtp()`, `changePhone(customerId, newPhone)` | Two-phase: OTP verify then phone change |
| DELETE | `/api/account` | Customer JWT | (none) | 200 `{ ok: true, alreadyDeleted }` | 401 | `deleteAccount(customerId)` | Idempotent soft-delete (AC5); discriminated result |

---

## 8. Geographic Data (`/api/geo`)

| Method | Path | Auth | Request | Success | Error statuses | Lib functions | Notable |
|--------|------|------|---------|---------|----------------|---------------|---------|
| GET | `/api/geo` | None (public) | Query: `province?`, `district?` | 200 `{ items: [{ code, name }] }` | 500 | `listProvinces()`, `listDistricts()`, `listWards()` | Cache-Control: public, max-age=86400, immutable; cascading: no params = provinces, province = districts, district = wards; vendored VN admin dataset (~690 KB server-side) |

---

## 9. Health (`/api/health`)

| Method | Path | Auth | Request | Success | Error statuses | Lib functions | Notable |
|--------|------|------|---------|---------|----------------|---------------|---------|
| GET | `/api/health` | None | (none) | 200 `{ status: 'ok', db: 'up', ts }` | 503 `{ status: 'degraded', db: 'down', ts }` | `prisma.$queryRaw(SELECT 1)` | force-dynamic; Cache-Control: no-store; cheap DB ping; Redis intentionally skipped |

---

## 10. Dev Stub Storage (`/api/dev/stub-storage/*`)

Dev-only. NOT deployed to production.

| Method | Path | Auth | Request | Success | Error statuses | Lib functions | Notable |
|--------|------|------|---------|---------|----------------|---------------|---------|
| PUT | `/api/dev/stub-storage/...key` | HMAC signature (`sig` + `exp` query params) | Binary body (file upload) | 200 `{ ok: true, key, sizeBytes }` | 403 invalid/expired sig, 404 stub disabled | `verifyStubSignature()`, `STUB_BLOBS` Map | In-memory Map; non-persistent; requires `STORAGE_STUB` env |
| GET | `/api/dev/stub-storage/...key` | HMAC signature (`sig` + `exp` query params) | URL: catch-all key segments | 200 blob bytes + content-type header | 403 invalid/expired sig, 404 not found/stub disabled | `verifyStubSignature()`, `STUB_BLOBS` Map | Replaces S3 pre-signed URL contract for local dev/E2E |

---

## Cross-Cutting Concerns

### CSRF Protection

Edge middleware (`proxy.ts`) enforces CSRF double-submit on all non-safe (POST/PUT/PATCH/DELETE) `/api/*` routes by default. Client reads `bb_csrf` cookie and echoes it in the `X-CSRF-Token` request header.

**Exempt routes** (authenticate via alternative mechanisms):
- `/api/auth/forgot-password` and `/api/auth/forgot-password/verify` -- pre-auth flow
- `/api/auth/reset-password` -- proof-JWT protected
- `/api/payments/*/webhook` -- HMAC-authenticated webhooks

### Rate Limiting

IP-based rate limiting (`@upstash/ratelimit` via `lib/ratelimit`) is applied per-route, not globally:
- `/api/auth/otp/send` -- per IP
- `/api/trips/search` -- per IP (429 + Retry-After)
- `/api/holds` (POST) -- per IP + per-phone hold cap
- `/api/bookings/initiate` -- per IP
- `/api/charter` (POST) -- per IP, 5/hour
- OTP lockout: 3 failed verifies in 15 min triggers 429 (lockout sentinel pattern)

### Token Strategy

- **Access token**: 15-min TTL (900s), returned in JSON response body, sent as `Authorization: Bearer` header
- **Refresh token**: 30-day TTL, stored in HttpOnly `bb_rt` cookie (SameSite=Lax), rotated on each `/api/auth/refresh` call
- **CSRF token**: non-HttpOnly `bb_csrf` cookie, read by client JS, echoed in `X-CSRF-Token` header
- **Hold cookie**: `bb_hold` HttpOnly HMAC-signed cookie, set on hold creation, validated on hold read and booking initiation
- **OTP proof**: HS256 JWT with 5-min TTL and single-use jti (consumed via Redis SETNX)

### Error Handling

All routes (except health and test-peek) use `withErrorHandler` wrapper which catches unexpected exceptions and returns scrubbed 500 responses. Validation errors return 400 with `{ error: 'INVALID' }`. Domain-specific errors use typed error codes (e.g., `HOLD_EXPIRED`, `PHONE_TAKEN`).

### Payment Architecture

Payment webhooks are thin gateway shells delegating to shared `processPaymentWebhook()`. Each uses a factory pattern (`getMomoAdapter()`, `getGatewayFor('zalopay')`, etc.) to swap between local stub adapters (`PAYMENTS_STUB=true`) and real PSP integrations with zero route-handler changes. VNPay is the exception with more complex dual GET+POST handling and gateway-mandated response format.

The VNPay return route (`/api/payments/vnpay/return`) is a browser redirect endpoint only -- it is NOT the authoritative payment state source. The IPN webhook is always authoritative.
