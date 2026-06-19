> ← [Previous](../06-data-model/) | [Index](../README.md) | [Next →](../07a-form-validation/)

## 7. API Design

### 7.1 REST + Webhooks

**REST** (Representational State Transfer) is the API style: each URL represents a resource, HTTP methods indicate the action.

| Method | Meaning | Example |
|--------|---------|---------|
| `GET` | Read | `GET /api/trips/search?from=hanoi&to=hcm` |
| `POST` | Create | `POST /api/holds` (create a seat hold) |
| `PATCH` | Update | `PATCH /api/op/buses/123` (edit a bus) |
| `DELETE` | Delete | `DELETE /api/op/trips/123` (cancel a trip) |

**Webhooks** are the reverse: instead of us calling the payment provider, the payment provider calls US when something happens (payment confirmed, refund processed). We expose a URL like `POST /api/payments/momo/webhook` that the provider hits.

### 7.2 Three API Realms

The API is segmented by who's calling:

| Realm | URL Prefix | Auth | Who |
|-------|-----------|------|-----|
| Customer | `/api/trips/`, `/api/holds/`, `/api/bookings/` | Guest (no auth) or customer JWT | Travelers |
| Operator | `/api/op/*` | Operator JWT (tenant-scoped) | Bus company staff |
| Admin | `/api/admin/*` | Admin JWT + TOTP step-up | Platform admins |
| Webhooks | `/api/payments/*/webhook` | HMAC signature (no JWT) | Payment providers |
| Cron | `/api/cron/*` | Internal secret/bearer | Scheduled jobs |

### 7.3 Thin Route Handlers

Route handlers (the code at each URL) are **thin** — they parse the request, call a domain function, and format the response. All business logic lives in `lib/<domain>/`.

```
POST /api/holds
  → parse request body (tripId, seatCount, buyerPhone)
  → call lib/booking/createHold(tripId, seatCount, buyerPhone)
  → return { holdId, expiresAt } or error
```

**Why?** The domain function is testable without HTTP. Multiple consumers (API route, cron job, admin action) can call the same function.

### 7.4 Pagination — Cursor-based

**Offset pagination** (`?page=5&limit=20`) breaks when data changes between pages (items shift, duplicates appear).

**Cursor pagination** (`?cursor=clx4a2b3c&limit=20`) uses the last item's ID as the starting point for the next page. Stable even when data changes.

```
GET /api/op/bookings?cursor=clx4a2b3c&limit=20
→ returns { items: [...], nextCursor: "clx7d8e9f" }
```

### 7.5 Error Format

Consistent error shape across all endpoints:

```json
{
  "error": {
    "code": "plate_in_use",
    "message": "A bus with this plate number already exists",
    "status": 422
  }
}
```

Error codes are typed (a `TripErrorCode` union, a `BookingErrorCode` union) so clients can switch on them programmatically.

### 7.6 Concrete API Examples

The abstract patterns above are easier to understand with real request/response shapes from the codebase.

**POST /api/holds — Create a seat hold**

Request body (validated by Zod schema in `lib/core/validation/hold.ts`):
```json
{
  "tripId": "clx4a2b3c0000abcd1234efgh",
  "ticketCount": 2,
  "buyerName": "Nguyễn Văn A",
  "buyerPhone": "0912345678",
  "buyerEmail": "a@example.com",
  "pickupKind": "station"
}
```

Validation rules:
- `tripId`: must be a valid CUID
- `ticketCount`: integer, 1–10
- `buyerName`: 4–100 chars, Unicode letters/spaces/apostrophes/hyphens (`/^[\p{L}\p{M}\s'.-]+$/u`)
- `buyerPhone`: Vietnamese mobile format (`/^(0|\+84)[35789][0-9]{8}$/`)
- `buyerEmail`: valid email, trimmed + lowercased, max 254 chars
- `pickupKind`: `"station"` | `"point"` | `"custom"`, defaults to `"station"`

Success (200):
```json
{ "holdId": "clx...", "expiresAt": "2026-07-01T10:15:00.000Z" }
```
+ `Set-Cookie: bb_hold=<HMAC-signed holdId>` (used to verify ownership at booking initiation)

Errors: `409 SOLD_OUT` | `429 HOLD_CAP_EXCEEDED` (max 5 concurrent holds per phone) | `429 TOO_MANY_REQUESTS`

---

**POST /api/bookings/initiate — Initiate online payment**

Request body (validated inline in `app/api/bookings/initiate/route.ts`):
```json
{
  "holdId": "clx...",
  "paymentMethod": "momo",
  "consents": {
    "noRefund": true,
    "piiStorage": true,
    "version": "2026-06-01"
  }
}
```

- `paymentMethod`: `"momo"` | `"zalopay"` | `"card"` (no cash — removed in Issue 039)
- `consents.noRefund` and `consents.piiStorage`: must both be `true`
- `consents.version`: must match server's `CONSENT_VERSION` (blocks stale clients showing old policy text)
- Requires `bb_hold` cookie matching `holdId` (prevents hold hijacking)
- Rate-limited by client IP

Success (200):
```json
{ "bookingId": "550e8400-e29b-41d4-a716-446655440000", "payUrl": "https://momo.vn/pay/..." }
```

Errors: `403 FORBIDDEN` (cookie mismatch) | `409 HOLD_EXPIRED` / `TRIP_DEPARTED` / `OPERATOR_NOT_BOOKABLE` | `422 consent_required` | `429 TOO_MANY_REQUESTS` | `502 GATEWAY_ERROR` (PSP call failed — compensating transaction deletes booking, reverts hold)

---

**POST /api/payments/momo/webhook — MoMo IPN callback**

Request: Raw JSON body from MoMo. Authenticated via HMAC-SHA256 signature (not JWT — webhooks don't carry user sessions).

The adapter translates MoMo's proprietary format into a canonical event:
```json
{
  "orderRef": "BB-2026-a3x7-k9m2",
  "providerTxnId": "momo_txn_123456",
  "amount": 450000,
  "currency": "VND",
  "status": "paid"
}
```

Always returns `200 OK` — even for unknown booking refs (prevents enumeration) or duplicate webhooks (idempotent via `providerTxnId` unique constraint).

---

**POST /api/admin/auth/login — Admin login**

Request body (validated by Zod):
```json
{
  "email": "admin@busbooking.vn",
  "password": "..."
}
```

Success (200):
```json
{ "role": "SUPER_ADMIN", "totpDisabled": false }
```
+ `Set-Cookie: bb_admin_access` (HttpOnly, Secure, SameSite=strict, 600s)
+ `Set-Cookie: bb_admin_refresh` (HttpOnly, Secure, SameSite=strict, 30 days)

Tokens are NEVER in the response body — cookies only.

Error (401): `{ "error": "INVALID_CREDENTIALS" }` — uniform message, no email/password distinction (prevents enumeration).
Error (429): `{ "error": "RATE_LIMITED" }` + `Retry-After` header.

After login: `totpVerified = false` in the JWT. The admin must complete TOTP verification (`POST /api/admin/auth/totp/verify`) before accessing protected routes. Finance and approval routes additionally require step-up re-auth (`POST /api/admin/auth/step-up`).
