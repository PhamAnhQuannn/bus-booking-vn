# API Backward Compatibility Review

Date: 2026-06-12
Reviewer: Automated audit (Claude Sonnet 4.6)
Scope: 134 API routes — contract stability, consistency, versioning
Portals covered: Customer (`/api/`), Operator (`/api/op/`), Admin (`/api/admin/`)

---

## Summary

The API surface has no versioning scheme whatsoever — every route is mounted at a bare path with no `/v1/` prefix. Error response shapes are inconsistent across the three portals (SCREAMING_SNAKE vs lowercase_snake vs mixed), the customer trip-search endpoint uses a non-standard `X-Next-Cursor` header for pagination instead of a body field, and one documented error code (`bus_overlap_with_outbound`) maps to different HTTP status codes (422 vs 409) depending on which endpoint encounters it. These issues are all fixable before launch but become progressively more expensive to fix after clients have shipped against the current shapes.

---

## P1 — Breaking Change Risks

### 1. Documented spec conflict: `bus_overlap_with_outbound` returns 422 and 409 on different routes

**Files:**
- `app/api/op/trips/[id]/reassign-bus/route.ts:65` — returns **409**
- The AGENTS.md Mistake Log (2026-05-19 Issue 013) confirms `bus_overlap_with_outbound` in `pairedReturn` returns **422** (the named file `app/api/op/trips/[id]/paired-return/route.ts` was not found in the filesystem — likely the file was renamed or removed, but the Mistake Log records its existence and the divergence)

**Issue:** The same semantic error — "this bus is already scheduled for an overlapping window" — maps to 409 in `reassign-bus` and 422 in `paired-return`. Any client SDK or test that drives both flows needs separate handling for the same error code. The AGENTS.md Mistake Log entry for Issue 013 explicitly flags this as a `// SPEC CONFLICT:` site with resolution deferred.

**Risk:** If `paired-return` is later canonicalized to 409 (the Issue 011 convention), any client that already hard-codes 422 for that path breaks. If it is canonicalized to 422, clients relying on 409 from `reassign-bus` break.

**Fix:** Open a single tracking issue to canonicalize `bus_overlap_*` to 409 everywhere (consistent with the `maintenance_overlap` convention at `app/api/op/buses/[id]/maintenance/route.ts:77`). Do it before the operator portal ships.

---

### 2. `POST /api/holds` returns SCREAMING_SNAKE error codes; `GET /api/holds/[id]` also SCREAMING_SNAKE — but `POST /api/bookings/initiate` mixes SCREAMING_SNAKE with lowercase

**Files:**
- `app/api/holds/route.ts:54` — `{ error: 'INVALID' }`
- `app/api/holds/route.ts:60` — `{ error: 'INVALID' }`
- `app/api/holds/route.ts:139` — `{ error: 'HOLD_CAP_EXCEEDED' }`
- `app/api/holds/route.ts:146` — `{ error: 'SOLD_OUT' }`
- `app/api/bookings/initiate/route.ts:51` — `{ error: 'TOO_MANY_REQUESTS' }` (SCREAMING)
- `app/api/bookings/initiate/route.ts:80` — `{ error: 'consent_required' }` (lowercase — mixed!)
- `app/api/bookings/initiate/route.ts:85` — `{ error: 'FORBIDDEN' }` (SCREAMING)
- `app/api/bookings/initiate/route.ts:124–136` — `{ error: 'NOT_FOUND' }`, `{ error: 'HOLD_EXPIRED' }`, `{ error: 'TRIP_DEPARTED' }`, `{ error: 'OPERATOR_NOT_BOOKABLE' }`, `{ error: 'UNAVAILABLE' }`, `{ error: 'GATEWAY_ERROR' }` (all SCREAMING)

**Issue:** `consent_required` at line 80 of `initiate/route.ts` is the sole lowercase code in a route that is otherwise SCREAMING_SNAKE. Any client doing exact string comparison for this error breaks if it is later uppercased.

**Fix:** Normalize `consent_required` → `CONSENT_REQUIRED` in `app/api/bookings/initiate/route.ts:80`.

---

### 3. `POST /api/auth/otp/verify` error codes are bare lowercase; inconsistent with peer auth routes

**File:** `app/api/auth/otp/verify/route.ts:36–43`

Error codes returned: `'expired'`, `'invalid'`, `'attempt_cap'` — all lowercase, no prefix.

**Peers for comparison:**
- `app/api/auth/otp/send/route.ts:30` — `{ error: 'rate_limited', retryAfter: number }` (lowercase with extra field)
- `app/api/auth/register/route.ts:54` — `{ error: 'INVALID' }` (SCREAMING)
- `app/api/auth/register/route.ts:59` — `{ error: 'otp_proof_invalid' }` (lowercase_snake)
- `app/api/auth/register/route.ts:67` — `{ error: 'invalid_credentials' }` (lowercase_snake)

**Issue:** The customer-facing auth flow has three different casing conventions across a four-step flow (send → verify → register → login). This is the flow most likely to be consumed by a future mobile SDK. A client doing `error === 'INVALID'` on every step breaks on the verify step.

**Fix:** Standardize the customer auth flow on one casing convention before launch. Recommendation: lowercase_snake throughout (already dominant: `otp_proof_invalid`, `invalid_credentials`, `rate_limited`). The SCREAMING cases at the register route were likely written early and should be normalized.

---

### 4. `GET /api/trips/search` returns pagination cursor in `X-Next-Cursor` HTTP header, not the body

**File:** `app/api/trips/search/route.ts:68–82`

```
const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
if (nextCursor) headers['X-Next-Cursor'] = nextCursor;
return NextResponse.json(trips, { status: 200, headers });
```

The response body is a raw `TripResult[]` array. The next-page cursor is in the `X-Next-Cursor` response header.

**Issue:** All other paginated endpoints in this codebase (`/api/bookings`, `/api/op/bookings`, `/api/op/trips/upcoming`) return `{ rows: T[], nextCursor: string | null }` as a JSON body. The search endpoint is the only one using a header-based cursor. This comment in the source code acknowledges the pattern: *"The JSON body stays a plain TripResult[] (unchanged contract); the next-page cursor rides an X-Next-Cursor header so existing array-shape consumers keep working."* This means the decision was made to preserve a pre-existing client — but if the pre-existing client is the same project's frontend, there is no external compatibility to preserve.

**Risk:** A mobile app or partner consuming the search API will receive an array body with no cursor field visible without header access. Not all HTTP clients expose custom response headers easily (e.g. fetch API on some platforms, some API gateways strip custom headers).

**Fix:** Add `nextCursor` as a top-level field in the response body (alongside the array, e.g. `{ trips: T[], nextCursor: string | null }`) and deprecate the header. The header can remain for a transition period. This is a breaking change for clients that are currently consuming the raw array — coordinate with the frontend team to update the search results page.

---

### 5. `POST /api/op/auth/forgot-password` leaks lockout state through differentiated 429 error codes

**File:** `app/api/op/auth/forgot-password/route.ts:51–63`

```ts
if (result.reason === 'locked_out') {
  return NextResponse.json(
    { error: 'LOCKED_OUT', retryAfter: result.retryAfter },
    { status: 429 }
  );
}
return NextResponse.json(
  { error: 'RATE_LIMITED', retryAfter: result.retryAfter },
  { status: 429 }
);
```

The route's docstring says *"always return 202 regardless to prevent enumeration"* but then returns two distinct 429 error codes when the operator IS found and IS rate-limited: `LOCKED_OUT` vs `RATE_LIMITED`. A caller that receives `LOCKED_OUT` knows (a) the phone exists in the system, and (b) someone has been actively submitting OTPs for it — partial enumeration. The 202 "no enumeration" path only fires when the phone is not found or the OTP send returns `ok: true`.

**Risk:** Operator accounts enumerable via the forgot-password endpoint under lockout conditions.

**Fix:** Return `{ error: 'RATE_LIMITED', retryAfter: N }` unconditionally (do not distinguish `LOCKED_OUT` from `RATE_LIMITED` at this public surface). The lockout state is an internal implementation detail.

---

### 6. `tempPasswordPlain` column added in the most recent migration — exposed in API response for admin portal

**File:** `app/api/admin/operators/[id]/create-account/route.ts:44`

```ts
return NextResponse.json(
  { username: result.username, tempPassword: result.tempPassword },
  { status: 201 }
);
```

The migration `prisma/migrations/20260612063249_add_temp_password_plain/migration.sql` adds a `TEXT` column `tempPasswordPlain` to `OperatorUser`. This plaintext password is returned to the admin in the 201 response body. The MEMORY.md entry `temp-password-plain-gate.md` explicitly notes: *"OperatorUser.tempPasswordPlain is dev-only; Issue 113 blocks 094 go-live; remove or encrypt before real keys."*

**Risk:** The column currently persists the plaintext password to the database even after display. The API contract exposes `tempPassword` in the response body. This is a go-live blocker for Issue 094.

**Fix:** Track via Issue 113 (already open per git status). Before go-live: either delete the column post-display and only return it from the service layer without persisting it, or encrypt at rest and document the decryption key lifecycle.

---

## P2 — Consistency Issues

### 7. Three distinct error key formats exist across portals

Summary of observed `error` field casing patterns:

| Portal | Dominant pattern | Examples |
|--------|-----------------|---------|
| Customer booking | SCREAMING_SNAKE | `INVALID`, `SOLD_OUT`, `HOLD_EXPIRED`, `FORBIDDEN` |
| Customer auth | lowercase_snake | `invalid`, `expired`, `otp_proof_invalid`, `invalid_credentials` |
| Operator | lowercase_snake | `not_found`, `bus_overlap`, `invalid_body`, `validation_failed` |
| Admin operators | SCREAMING_SNAKE | `INVALID`, `ILLEGAL_TRANSITION`, `OPERATOR_NOT_FOUND` |
| Admin moderation | SCREAMING_SNAKE | `NOT_FOUND`, `INVALID` |
| Admin finance | SCREAMING_SNAKE | `INVALID`, `NOT_APPROVABLE`, `PAYOUT_NOT_FOUND` |
| Payment webhooks | SCREAMING_SNAKE | `INVALID_SIGNATURE` |
| Webhooks success | lowercase_snake | `{ message: 'ok' }` |

**Implication:** A client library consuming multiple portals must implement separate error normalizers for each. There is no canonical error type to import. If the team plans to publish a TypeScript client SDK, this fragmentation means the SDK cannot have a single `ApiError` type.

---

### 8. Success response envelope is inconsistent across list and detail endpoints

| Endpoint | Success shape |
|----------|-------------|
| `GET /api/trips/search` | Raw array `TripResult[]` |
| `GET /api/bookings` | `{ rows: T[], nextCursor }` |
| `GET /api/bookings/:id` | `{ booking: T }` |
| `GET /api/op/trips` | `{ trips: T[] }` |
| `GET /api/op/trips/:id` | `{ trip: T }` |
| `GET /api/op/buses` | `{ buses: T[] }` |
| `GET /api/op/buses/:id` | `{ bus: T }` |
| `GET /api/op/routes` | `{ routes: T[] }` |
| `GET /api/op/bookings` | `{ rows: T[], nextCursor }` |
| `POST /api/admin/operators/:id/approve` | `{ ok: true }` |
| `POST /api/op/trips/:id/cancel` | `{ trip, ok, already_cancelled, cancelledBookings?, ... }` |
| `POST /api/op/trips/:id/depart` | `{ ok, alreadyDeparted, trip }` |
| `POST /api/op/trips/:id/complete` | `{ ok, alreadyCompleted, trip, payoutJobsEnqueued }` |
| `POST /api/op/buses/:id/deactivate` | `{ ok: true, deactivatedAt }` |
| `POST /api/charter` | `{ ref }` |
| `POST /api/admin/finance/payouts/:id/approve` | `{ ok: true, status: 'processing' }` |
| `POST /api/admin/finance/ledger/adjustment` | `{ ledgerEntryId }` |

**Issues:**
- The `ok` field appears in some action endpoints (`approve`, `deactivate`) but not others (`trip` PATCH returns `{ trip }` with no `ok`).
- Idempotent action endpoints like `cancel`, `depart`, `complete` return composite shapes (`{ ok, alreadyCancelled, trip, ... }`) that are not consistent with each other: `cancel` uses `already_cancelled` (snake_case with underscore beginning with `already_`), `depart` uses `alreadyDeparted` (camelCase), `complete` uses `alreadyCompleted` (camelCase).

**Fix (naming):** Standardize the idempotent-action discriminator field to one casing. Given the operator portal is JavaScript/TypeScript, camelCase is preferable: use `alreadyCancelled`, `alreadyDeparted`, `alreadyCompleted` uniformly. Currently `cancel` uses `already_cancelled` (snake) while `depart` and `complete` use camelCase — fix `cancel` to use `alreadyCancelled`.

**File:** `app/api/op/trips/[id]/cancel/route.ts:44` — `already_cancelled: result.alreadyCancelled` is the specific mismatch.

---

### 9. Validation error detail exposure is inconsistent

Some routes expose Zod issue detail arrays to the caller on validation failure; others suppress them entirely:

| Route | Validation error response |
|-------|--------------------------|
| `POST /api/holds` | `{ error: 'INVALID' }` — no details |
| `POST /api/bookings/initiate` | `{ error: 'INVALID' }` — no details |
| `POST /api/op/trips` POST | `{ error: 'validation_failed', issues: ZodIssue[] }` |
| `POST /api/op/buses` POST | `{ error: 'invalid_input', issues: ZodIssue[] }` (400) |
| `POST /api/op/buses/:id` PATCH | `{ error: 'invalid_input', issues: ZodIssue[] }` (400) |
| `GET /api/bookings` | `{ error: 'validation_failed', issues: ZodIssue[] }` (422) |
| `GET /api/op/bookings` | `{ error: 'validation_failed', issues: ZodIssue[] }` (422) |

The customer-facing routes suppress detail (security best practice — no field enumeration). The operator-facing routes expose Zod issue arrays (useful for operator UIs). The difference in approach is intentional for the two portals, but within the operator portal there are three different error code strings for the same class of error: `validation_failed`, `invalid_input`, and `invalid_body`. None of these are standardized.

**Fix:** Within the operator portal, adopt one canonical error code for Zod failures (recommend `validation_failed`) and for JSON parse failures (recommend `invalid_body`). Update `app/api/op/buses/route.ts:39` (`invalid_input` → `validation_failed`), `app/api/op/buses/[id]/route.ts:76` (`invalid_input` → `validation_failed`), and `app/api/op/buses/[id]/maintenance/route.ts:49` (`invalid_input` → `validation_failed`).

---

### 10. HTTP 400 vs 422 for Zod validation failures is inconsistent in the operator portal

| Route | Method | Zod failure status |
|-------|--------|--------------------|
| `app/api/op/buses/route.ts:39` | POST create | **400** |
| `app/api/op/buses/[id]/route.ts:76` | PATCH update | **400** |
| `app/api/op/buses/[id]/maintenance/route.ts:49` | POST create | **422** |
| `app/api/op/routes/route.ts:38` | POST create | **422** |
| `app/api/op/trips/route.ts:50` | POST create | **422** |
| `app/api/op/trips/[id]/route.ts:49` | PATCH update | **422** |
| `app/api/op/bookings/route.ts:23` | GET list | **422** |

The two bus-collection routes use 400 for Zod failures while every other operator resource route uses 422. This is likely an authoring-order artifact (fleet routes were written early; the 422 convention solidified later).

**Fix:** Change `app/api/op/buses/route.ts:39` and `app/api/op/buses/[id]/route.ts:76` from 400 to 422 for Zod failures. The JSON parse error (`invalid_body`) should stay 400 — that is correct.

---

### 11. `POST /api/op/auth/refresh` leaks the access token in the response body; admin auth does not

**Files:**
- `app/api/op/auth/refresh/route.ts:83` — `return NextResponse.json({ accessToken: result.accessToken })`
- `app/api/admin/auth/login/route.ts:89` — `return NextResponse.json({ role: result.role, totpDisabled: totpSkipped })` — tokens only in HttpOnly cookies

The operator refresh route returns `accessToken` in the JSON body in addition to setting the `bb_op_access` HttpOnly cookie. The admin login route correctly puts tokens only in HttpOnly cookies and returns only the `role`.

**Issue:** Exposing the access token in the response body means it can be read by JavaScript (XSS risk). The `bb_op_access` HttpOnly cookie exists specifically to prevent this. The body token is redundant for browser clients and an information leak for any XSS.

**Fix:** Remove `accessToken` from the operator refresh response body. If the operator portal's fetch client needs to know the new token (e.g. for an in-memory Authorization header), read it from the cookie-based flow instead. Alternatively, if the operator portal uses `Authorization: Bearer` headers (not cookies), document this deliberately and add a note that the route is intentionally dual-path — but then the HttpOnly cookie is unnecessary.

---

### 12. `GET /api/bookings/:id` uses `{ booking: T }` wrapper; `GET /api/op/bookings` uses `{ rows: T[] }`; customer ticket route at `/api/bookings/:id/ticket` returns `{ status: 'pending', message: string }` (202) — mixed semantic

**File:** `app/api/bookings/[id]/ticket/route.ts:63–66`

When the ticket PDF is not yet ready the route returns:
```json
{ "status": "pending", "message": "Ticket is being generated" }
```
with HTTP 202 Accepted. This `status` field collides with the booking `status` enum field that appears in all other booking DTOs. A client that assumes `status` is always a `BookingPaymentStatus` will misparse this response.

**Fix:** Rename the polling field to `ticketStatus` or `pdfStatus` to avoid collision with the booking status enum field.

---

## P3 — Advisory

### 13. No API versioning strategy

None of the 134 routes include a version prefix. All routes are mounted at `/api/*`, `/api/op/*`, or `/api/admin/*`. There is no `Accept: application/vnd.bb+json; version=1` header negotiation, no `X-API-Version` header, and no `/v1/` path segment.

**Impact for go-live:** The customer-facing routes (`/api/trips/search`, `/api/holds`, `/api/bookings/initiate`) are at highest risk. Once a mobile app ships against these URLs with hardcoded expectations about response shapes, any structural change (adding required fields, renaming keys, changing casing) becomes a breaking change with no migration path.

**Recommendation (see Versioning Recommendation section below).**

---

### 14. `withErrorHandler` is not consistently applied to all route exports

**Pattern observed:** Some routes use the HOF pattern correctly:
```ts
export const GET = withErrorHandler(handler);
```

Others use an unusual nesting pattern where `withErrorHandler` is called inline inside the exported function body:
```ts
export async function GET(req, ctx) {
  const wrappedHandler = withErrorHandler(/* ... */);
  return wrappedHandler(req);
}
```

Files using the nested pattern:
- `app/api/holds/[id]/route.ts:25–47` — wraps inside the function body
- `app/api/bookings/[id]/route.ts:22–30` — wraps inside the function body
- `app/api/op/trips/[id]/route.ts:26–33` and `:39–104` — wraps per HTTP method
- `app/api/op/buses/[id]/route.ts:41–52` and `:58–196` — wraps per HTTP method
- `app/api/op/trips/[id]/reassign-bus/route.ts:26–71` — wraps inside the function body

This creates a risk: if a developer adds error handling to the exported function's outer scope (before calling `wrappedHandler`), an uncaught exception outside the wrapper will bypass the scrubbing and leak stack traces. The canonical pattern (`export const GET = withErrorHandler(handler)`) does not have this surface.

**Fix:** Refactor to the HOF-export pattern. For routes that need dynamic params (`ctx.params`), capture them before the handler:
```ts
async function handler(req, id) { /* ... */ }
export const GET = async (req, ctx) => {
  const { id } = await ctx.params;
  return withErrorHandler((r) => handler(r, id))(req);
};
```

---

### 15. `POST /api/auth/otp/verify` returns OTP errors on HTTP 400 — semantically ambiguous

**File:** `app/api/auth/otp/verify/route.ts:35–43`

`'gone'` (expired OTP) and `'mismatch'` (wrong code) both return HTTP 400. 400 conventionally means "bad request format." A semantically more accurate status for "the code is wrong" is 422 (unprocessable entity) or 401 (unauthorized). Many OTP implementations use 401 for wrong codes.

**Impact:** Client-side handling: a generic 400 handler will treat an expired OTP the same as a malformed JSON body — both return 400. If the client has retry logic that only retries on non-4xx, an expired OTP will not be retried (correct), but neither will a server-side validation error (also correct), making these indistinguishable without parsing the body.

**Advisory:** Consider 422 for semantic OTP errors (`expired`, `invalid`) and 400 only for malformed request format. This is low risk but worth aligning before a mobile SDK is built.

---

### 16. Webhook response shapes differ from 400 vs 200 paths

**File:** `lib/payment/processWebhook.ts:97,141,357,437`

- Signature failure: `{ error: 'INVALID_SIGNATURE' }` with 400
- Booking not found (no-op): `{ message: 'ok' }` with 200
- Duplicate IPN: `{ message: 'ok' }` with 200
- Success: `{ message: 'ok' }` with 200

The `message: 'ok'` pattern on success is inconsistent with the `ok: true` pattern used in admin action routes. For webhooks this is a minor concern because PSP documentation for IPN response formats is usually "return 200 with any body" — the response body is not machine-parsed by the PSP. However the 400 error response uses `{ error: '...' }` while the 200 uses `{ message: '...' }` — two different key names.

---

### 17. Cursor implementation is not HMAC-signed — cursors are guessable/manipulable

**File:** `lib/core/db/searchCursor.ts:23–37`

The cursor format is `${departureAtISO}_${id}` — plain unencoded text. A malicious caller can construct arbitrary cursors by knowing the format, allowing them to "jump" to any point in the result set without sequential pagination. For the customer search endpoint this means a caller could paginate backwards or to arbitrary offsets by crafting a cursor.

**Impact:** Low for this use case (trip search is public data), but if cursors are later used in authenticated endpoints with tenancy boundaries, a signed cursor would prevent cross-tenant probing.

**Advisory:** Consider Base64url-encoding the cursor (to obscure the format) and adding an HMAC to prevent tampering, especially for the operator booking queue where tenant isolation is critical.

---

### 18. `POST /api/op/auth/forgot-password` accepts `phone` field but operator login now uses `username`

**File:** `app/api/op/auth/forgot-password/route.ts:43`

```ts
const operator = await prisma.operatorUser.findUnique({
  where: { phone },
```

The `20260606010000_operator_application_fields_and_username` migration added `username` as the new login key for operators ("Generated by admin provisioning as BRAND_ACRONYM-last4phone; phone becomes contact-only"). If the forgot-password flow still accepts `phone` and looks up by phone, it is operating on the pre-migration contract — operators who know their `username` but not their exact registered phone cannot use forgot-password. Conversely, the flow exposes whether a phone number is registered as an operator account.

**Advisory:** Align the forgot-password request body with the current login credentials (which are now `username`-based). Confirm whether `ForgotPasswordSchema` accepts `username` or `phone` — if `phone`, update to `username`.

---

## Response Envelope Audit

| Route pattern | Success shape | Error shape | Notes |
|---------------|--------------|-------------|-------|
| `GET /api/trips/search` | Raw `TripResult[]` array | `{ errors: Record<string,string> }` (400) | Cursor in header, not body; error key is `errors` (plural) not `error` |
| `POST /api/holds` | `{ holdId, expiresAt }` | `{ error: 'CODE' }` | SCREAMING codes |
| `GET /api/holds/:id` | Raw hold detail object | `{ error: 'CODE' }` | SCREAMING codes |
| `POST /api/bookings/initiate` | `{ bookingId, payUrl }` | `{ error: 'CODE' }` | Mixed SCREAMING + lowercase (`consent_required`) |
| `GET /api/bookings` | `{ rows: T[], nextCursor }` | `{ error: 'CODE', issues: ZodIssue[] }` | Cursor in body |
| `GET /api/bookings/:id` | `{ booking: T }` | `{ error: 'not_found' }` | lowercase code |
| `GET /api/bookings/:id/ticket` | 302 redirect or `{ status: 'pending', message }` | `{ error: 'not_found'\|'not_ticketable'\|'ticket_url_failed' }` | `status` field collides with booking status enum |
| `POST /api/auth/otp/send` | `{ success: true }` | `{ error: 'rate_limited', retryAfter: N }` | lowercase; extra field on 429 |
| `POST /api/auth/otp/verify` | `{ otpProof: string }` | `{ error: 'expired'\|'invalid'\|'attempt_cap' }` | lowercase bare words |
| `POST /api/auth/register` | `{ accessToken, customer }` | `{ error: 'otp_proof_invalid'\|'invalid_credentials'\|'INVALID' }` | mixed casing |
| `GET /api/op/trips` | `{ trips: T[] }` | `{ error: 'CODE', issues? }` | lowercase codes |
| `POST /api/op/trips` | `{ trip: T }` (201) | `{ error: 'CODE', issues? }` | lowercase codes |
| `GET /api/op/trips/:id` | `{ trip: T }` | `{ error: 'not_found' }` | lowercase |
| `PATCH /api/op/trips/:id` | `{ trip: T }` | `{ error: 'CODE', issues? }` | lowercase |
| `POST /api/op/trips/:id/cancel` | `{ trip, ok, already_cancelled, ... }` | `{ error: 'not_found' }` | `already_cancelled` is snake_case, rest camelCase |
| `POST /api/op/trips/:id/depart` | `{ ok, alreadyDeparted, trip }` | `{ error: 'CODE' }` | camelCase discriminator |
| `POST /api/op/trips/:id/complete` | `{ ok, alreadyCompleted, trip, payoutJobsEnqueued }` | `{ error: 'CODE' }` | camelCase discriminator |
| `POST /api/op/trips/:id/reassign-bus` | `{ trip }` | `{ error: 'CODE' }` | `capacity_too_small` adds `required`, `provided` fields |
| `GET /api/op/buses` | `{ buses: T[] }` | `{ error: 'CODE' }` | lowercase |
| `POST /api/op/buses` | `{ bus: T }` (201) | `{ error: 'invalid_input', issues }` (400) | uses 400 not 422 for Zod |
| `GET /api/op/buses/:id` | `{ bus: T }` | `{ error: 'not_found' }` | lowercase |
| `PATCH /api/op/buses/:id` | `{ bus: T }` | `{ error: 'CODE', violatingTrips? }` | uses 400 not 422 for Zod |
| `POST /api/op/buses/:id/deactivate` | `{ ok: true, deactivatedAt }` | `{ error: 'CODE', tripIds? }` | lowercase |
| `POST /api/op/buses/:id/maintenance` | `{ maintenance, conflictingTrips }` (201) | `{ error: 'CODE', overlapping? }` | uses 422 for Zod (correct) |
| `GET /api/op/routes` | `{ routes: T[] }` | `{ error: 'CODE' }` | lowercase |
| `POST /api/op/routes` | `{ route: T }` (201) | `{ error: 'CODE', issues? }` | lowercase |
| `GET /api/op/bookings` | `{ rows: T[], nextCursor }` | `{ error: 'validation_failed', issues }` | cursor in body |
| `POST /api/op/auth/refresh` | `{ accessToken }` | `{ error: 'NO_SESSION'\|'INVALID_SESSION'\|'SESSION_REUSE' }` | leaks token in body; SCREAMING errors |
| `POST /api/op/auth/password/change` | 204 No Content | `{ error: 'WEAK_PASSWORD'\|'WRONG_CURRENT'\|'SAME_AS_OLD'\|'UNAUTHORIZED' }` | SCREAMING errors; empty body on success |
| `POST /api/admin/auth/login` | `{ role, totpDisabled }` | `{ error: 'INVALID_CREDENTIALS'\|'RATE_LIMITED'\|'INVALID' }` | SCREAMING; tokens only in cookies |
| `POST /api/admin/operators/:id/approve` | `{ ok: true }` | `{ error: 'ILLEGAL_TRANSITION'\|'OPERATOR_NOT_FOUND'\|'INVALID' }` | SCREAMING |
| `POST /api/admin/operators/:id/reject` | `{ ok: true }` | `{ error: 'ILLEGAL_TRANSITION'\|... }` | SCREAMING |
| `POST /api/admin/operators/:id/suspend` | `{ ok: true }` | `{ error: 'ILLEGAL_TRANSITION'\|... }` | SCREAMING |
| `POST /api/admin/operators/:id/reinstate` | `{ ok: true }` | `{ error: 'ILLEGAL_TRANSITION'\|... }` | SCREAMING |
| `POST /api/admin/operators/:id/create-account` | `{ username, tempPassword }` (201) | `{ error: 'OPERATOR_NOT_FOUND'\|'ACCOUNT_ALREADY_EXISTS'\|'INVALID' }` | exposes plaintext password |
| `POST /api/admin/finance/payouts/:id/approve` | `{ ok: true, status: 'processing' }` | `{ error: 'PAYOUT_NOT_FOUND'\|'NOT_APPROVABLE'\|'INVALID' }` | SCREAMING |
| `POST /api/admin/finance/ledger/adjustment` | `{ ledgerEntryId }` | `{ error: 'INVALID' }` | SCREAMING; uses 422 for validation |
| `POST /api/admin/moderation/trips/:id/disable` | `{ ok: true }` | `{ error: 'NOT_FOUND'\|'INVALID' }` | SCREAMING |
| `POST /api/admin/system/flags` | `{ ok: true }` | `{ error: 'UNKNOWN_FLAG'\|'INVALID' }` | SCREAMING |
| `POST /api/payments/momo/webhook` | `{ message: 'ok' }` | `{ error: 'INVALID_SIGNATURE' }` | SCREAMING on error, `message` key on success |
| `POST /api/payments/zalopay/webhook` | `{ message: 'ok' }` | `{ error: 'INVALID_SIGNATURE' }` | same as momo |
| `POST /api/payments/card/webhook` | `{ message: 'ok' }` | `{ error: 'INVALID_SIGNATURE' }` | same as momo |
| `POST /api/charter` | `{ ref }` (201) | `{ error: 'INVALID'\|'TOO_MANY_REQUESTS' }` | SCREAMING; honeypot returns `{ ok: true }` 200 |
| `GET /api/trips/search` (validation 400) | — | `{ errors: fieldErrors }` | **`errors` (plural) not `error` — unique across all routes** |

---

## Status Code Mapping

| Error type | Customer portal | Operator portal | Admin portal | Recommendation |
|------------|----------------|----------------|--------------|----------------|
| Malformed JSON body | 400 | 400 | 400 | Consistent — keep |
| Zod validation failure | 400 (holds, initiate) | **400** (buses) or **422** (trips, routes) | 400 or 422 | Standardize to **422** everywhere for Zod failures; 400 only for unparseable JSON |
| Resource not found (own) | 404 | 404 | 404 | Consistent — keep |
| Resource not found (cross-tenant) | 404 (indistinguishable) | 404 (indistinguishable) | 404 | Consistent — keep |
| Unauthorized / no session | 401 | 401 | 401 | Consistent — keep |
| Forbidden / wrong ownership | 403 | — | 403 (step-up) | Consistent — keep |
| Business rule violation | 409 (`SOLD_OUT`, `HOLD_EXPIRED`) or 422 | 409 or 422 | 422 | Mixed — see P2 #10 |
| Duplicate / conflict | 409 | 409 | 409 | Generally consistent |
| Overlap conflict | — | 409 (`maintenance_overlap`) vs **422** (`bus_overlap_with_outbound` in paired-return) vs **409** (`bus_overlap_with_outbound` in reassign-bus) | — | P1 #1 — fix |
| Rate limit | 429 + Retry-After | 429 + Retry-After | 429 + Retry-After | Consistent — keep |
| Hold cap exceeded | 429 (`HOLD_CAP_EXCEEDED`) | — | — | Semantically debatable (429 for business limit) — advisory only |
| Gateway error | 502 | — | — | Correct |
| Service unavailable | 503 (`ref_collision`) | — | — | Correct |
| Server error | 500 (scrubbed) | 500 (scrubbed) | 500 (scrubbed) | Consistent — keep |
| Consent gate | 422 | — | — | Correct semantic |
| Idempotent re-apply | 200 with discriminator | 200 with discriminator | — | Consistent — keep |

---

## Webhook Contracts

### MoMo (`POST /api/payments/momo/webhook`)

**Entry point:** `app/api/payments/momo/webhook/route.ts`
**Processing:** Delegated to `lib/payment/processWebhook.ts` via `getMomoAdapter()`
**Adapter:** `lib/payment/adapters/momo.ts`

**Expected request:** Raw body (text), HMAC signature verified by MoMo adapter before any DB work.
**Response on success:** `{ message: 'ok' }` HTTP 200
**Response on bad sig:** `{ error: 'INVALID_SIGNATURE' }` HTTP 400
**Idempotency:** `PaymentEvent.@@unique([adapter, providerTxnId])` — P2002 on duplicate → 200 no-op logged.
**Status codes mapped:** `paid`, `failed`, `pending`, `unknown` (from MoMo native `resultCode`)
**Failure result codes:** Pinned to Issue 004 AC spec verbatim `{1001, 1002, 1003, 1004, 1005, 4100}` (not augmented from MoMo docs — per AGENTS.md mistake log).
**Documentation status:** STUB gateway (`PAYMENTS_STUB=true`). Real MoMo adapter is in `lib/payment/adapters/momo.ts` but not yet wired to real credentials (Phase 2).

### ZaloPay (`POST /api/payments/zalopay/webhook`)

**Entry point:** `app/api/payments/zalopay/webhook/route.ts`
**Processing:** Delegated to `lib/payment/processWebhook.ts` via `getGatewayFor('zalopay', baseUrl)`
**Adapter:** `lib/payment/adapters/stub.ts` (PAYMENTS_STUB=true)

**Expected request:** Raw body (text), stub adapter HMAC verification.
**Response:** Same as MoMo (`{ message: 'ok' }` / `{ error: 'INVALID_SIGNATURE' }`)
**Idempotency:** Same `@@unique([adapter, providerTxnId])` guard.
**Status codes:** Stub maps `STUB_SUCCESS_CODE (0)` → paid, `STUB_FAILURE_CODE (99)` → failed. No real ZaloPay adapter yet.
**Documentation status:** Stub only. Real ZaloPay adapter to be swapped in Phase 2.

### Card (`POST /api/payments/card/webhook`)

**Entry point:** `app/api/payments/card/webhook/route.ts`
**Processing:** Same shared `processPaymentWebhook`, `getGatewayFor('card', baseUrl)`
**Adapter:** Stub only.

**Documentation status:** Stub only. Real card PSP (unspecified) to be swapped in Phase 2.

**Common webhook observations:**
1. All three webhook routes delegate to identical logic — a good pattern for consistency.
2. The PSP response contract (`{ message: 'ok' }` for 200, `{ error: 'INVALID_SIGNATURE' }` for 400) is the same for all three; consistent.
3. The shared `processPaymentWebhook` function correctly handles currency mismatch, amount underpay, overpay, and duplicate IPN via idempotency key — these are all documented inline.
4. No webhook authentication other than HMAC — no IP allowlist per PSP. This is acceptable if the HMAC keys are strong, but should be documented in the runbook.

---

## Pagination Patterns

| Endpoint | Method | Cursor style | Cursor location | Page size default | Consistent with peers? |
|----------|--------|--------------|-----------------|--------------------|----------------------|
| `GET /api/trips/search` | Seek cursor (`departureAt_id`) | **Response header** (`X-Next-Cursor`) | Header | 20 (inferred from `searchTrips`) | **No** — only header-based cursor |
| `GET /api/bookings` | Prisma id cursor | Response body `nextCursor` | Body | 50 | Yes |
| `GET /api/op/bookings` | Prisma id cursor (gt) | Response body `nextCursor` | Body | 50 | Yes |
| `GET /api/op/trips/upcoming` | Seek cursor | Response body `nextCursor` | Body | Configured via `ListUpcomingParamsSchema` | Yes |
| `GET /api/op/trips` | None — returns all | N/A | N/A | Unbounded | Not paginated — potential N+1 |

**Issues:**
1. `GET /api/trips/search` is the sole route returning the cursor in a header. See P1 #4.
2. `GET /api/op/trips` (list all trips for operator) returns `{ trips: T[] }` with no pagination whatsoever — if an operator has hundreds of trips this becomes a large payload and slow query.
3. Cursor implementations differ: `/api/bookings` uses Prisma's `cursor: { id }` + `skip: 1` mechanism (stable); `/api/op/bookings` uses `id: { gt: cursor }` (simpler but order-dependent). Both work correctly for their respective sort orders but a developer unifying them in the future needs to understand both patterns.
4. The `searchCursor.ts` module encodes `departureAt_id` as plain text. See P3 #17 on signing.

---

## Versioning Recommendation

This project is pre-launch with no external API consumers yet — this is the optimal window to add versioning before the contracts are frozen. The recommendation is to adopt **URL path versioning** (`/api/v1/`, `/api/op/v1/`, `/api/admin/v1/`) at go-live for the routes most likely to be consumed by external clients or a mobile app (the customer portal routes). Admin and operator portal routes are internal browser-only surfaces and can defer versioning. Concretely: add a Next.js route group `(v1)` under `app/api/`, implement a thin rewrite in `middleware.ts` that maps `/api/v1/*` → `/api/*` for now (zero-cost alias), and establish the rule that any breaking change to customer-facing routes requires bumping to `/api/v2/`. This adds one line of middleware, zero file moves, and locks in the v1 contract before any mobile SDK ships. Header-based versioning (`Accept-Version: 1`) is more RESTful but harder to cache and harder to use in browser fetch — skip it for this use case. The operator and admin portals are deployed alongside the server, so they can be updated atomically and do not need URL versioning.

---

## Recommendations (Prioritized)

### Pre-launch blockers

1. **[P1-6] Remove or encrypt `tempPasswordPlain`** before go-live. This is already tracked in Issue 113 and explicitly gates Issue 094. Do not launch with a plaintext password column in the database. Options: display once and return from service layer without persisting to DB, or encrypt at rest with a per-tenant key.

2. **[P1-2] Fix `consent_required` casing** in `app/api/bookings/initiate/route.ts:80` — change to `CONSENT_REQUIRED` to match all other codes in that file. One-line fix, zero risk.

3. **[P1-1] Canonicalize `bus_overlap_with_outbound` status code** — pick 409 (consistent with `maintenance_overlap` and the Issue 011 conventions) and apply to both `reassign-bus` and `paired-return`. If `paired-return` is not in use yet, this is zero migration cost.

4. **[P2-8] Fix `already_cancelled` → `alreadyCancelled`** in `app/api/op/trips/[id]/cancel/route.ts:44` to match the camelCase convention of `alreadyDeparted` and `alreadyCompleted`.

5. **[P2-10] Normalize Zod failure status from 400 → 422** in `app/api/op/buses/route.ts:39` and `app/api/op/buses/[id]/route.ts:76`. Two-line change each.

### Post-launch high priority

6. **[P1-4] Add `nextCursor` to the `/api/trips/search` response body** and deprecate `X-Next-Cursor` header. Update the search results page client to read from the body.

7. **[P1-5] Deduplicate operator forgot-password error codes** — return `RATE_LIMITED` unconditionally regardless of `locked_out` vs `rate_limited` internal state.

8. **[P2-9] Standardize operator portal validation error codes** to `validation_failed` across all bus, route, and trip routes. Normalize `invalid_input` → `validation_failed` in three files.

9. **[P1-3] Standardize customer auth error casing** — lowercase_snake throughout the send/verify/register/login flow. Two files to update.

10. **[P3-13] Add URL versioning** — add `/api/v1/` prefix for customer-facing routes before any mobile SDK ships.

### Long-term

11. **[P3-11] Remove `accessToken` from operator refresh response body** or document the dual-mode (cookie + body) intentionally and add a test asserting it is intentional.

12. **[P3-12] Rename `status` to `pdfStatus`/`ticketStatus`** in `app/api/bookings/[id]/ticket/route.ts:63` to avoid collision with booking status enum field.

13. **[P3-14] Refactor nested `withErrorHandler` calls** to the HOF-export pattern across the six affected route files.

14. **[P3-17] Sign or opaque-encode cursors** for the operator booking queue where cursor manipulation could probe cross-tenant data.

15. **[P2-7] Consider documenting the three-casing convention as intentional** with a short internal API style guide: SCREAMING_SNAKE for admin routes (human-readable in logs), lowercase_snake for operator routes (closer to REST conventions), and SCREAMING_SNAKE for customer routes (matching PSP conventions). If intentional, document it. If not, normalize.
