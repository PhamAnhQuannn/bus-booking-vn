# 06 -- lib/core, lib/config, lib/logger, lib/utils

Cross-cutting primitives layer. Everything in `lib/core/` sits at the bottom of the
dependency graph: `app/` and `components/` import `lib/<domain>/`, which imports
`lib/core/`. No reverse dependencies, no cycles.

---

## Overview

| Area | Source files | Test files | Status |
|------|-------------|------------|--------|
| `lib/core/db/` | 7 | 5 | Live -- Prisma client, tenant scope, hold repo, notification log, search cursor, selects, active routes |
| `lib/core/validation/` | 9 | 3 | Live -- Zod schemas for every API surface |
| `lib/core/config/` | 1 (re-export) | 0 | Re-exports `lib/config/` |
| `lib/core/logger/` | 1 (re-export) | 0 | Re-exports `lib/logger` |
| `lib/core/errors/` | 1 | 0 | Placeholder (`export {}`) |
| `lib/core/http/` | 1 | 0 | Placeholder (`export {}`) |
| `lib/core/money/` | 1 | 0 | Placeholder (`export {}`) |
| `lib/core/time/` | 1 | 0 | Placeholder (`export {}`) |
| `lib/core/id/` | 1 | 0 | Placeholder (`export {}`) |
| `lib/core/result/` | 1 | 0 | Placeholder (`export {}`) |
| `lib/core/jobs/` | 1 | 0 | Placeholder (`export {}`) |
| `lib/config/` | 2 | 0 | Typed env schema (Zod) + barrel |
| `lib/logger.ts` | 1 | 0 | Pino structured logger with PII redaction |
| `lib/utils/` | 2 | 0 | Client-side utility hooks |
| **Total** | **30** | **8** | |

### Top-level barrel (`lib/core/index.ts`)

Re-exports only the three populated sub-barrels:

```ts
export * from './logger';
export * from './config';
export * from './db';
```

Placeholder sub-areas (`errors`, `http`, `money`, `time`, `id`, `result`, `jobs`) are
intentionally excluded from the top-level barrel to avoid exposing dead surface.

---

## lib/core/db/

### `client.ts`

Prisma client singleton with `pg` driver adapter (`@prisma/adapter-pg`).

| Export | Kind | Description |
|--------|------|-------------|
| `prisma` | `PrismaClient` | Singleton instance. Reused across hot reloads (dev, via `globalThis`) and warm invocations (prod serverless). Uses a `pg.Pool` with configurable `DATABASE_POOL_MAX` (default 5), 10s idle timeout, 3s connect timeout. Logging: `['warn', 'error']` in dev, `['error']` in prod. |

### `tenantScope.ts`

Multi-tenancy guard (SYS20 rule 5).

| Export | Signature | Description |
|--------|-----------|-------------|
| `withOperatorScope` | `<W>(operatorId: string, args?: { where?: W } & Record<string, unknown>) => { where: W & { operatorId: string } } & Record<string, unknown>` | Injects `operatorId` into the Prisma `where` clause. Preserves all sibling keys (`select`, `orderBy`, `take`, etc.). The injected `operatorId` wins over any colliding key in the caller's `where` (tenant filter is authoritative). Does not mutate the input object. |

### `holdRepo.ts`

Atomic seat-reservation via PostgreSQL advisory locks + conditional INSERT.

| Export | Kind | Description |
|--------|------|-------------|
| `HOLD_TTL_MINUTES` | `const 10` | Hold window duration. Leaves 2-min buffer inside the 12-min cookie. |
| `PSP_WINDOW_MINUTES` | `const 20` | Issue 100: awaiting_payment bookings within this window occupy capacity. After it elapses, abandoned payments self-release. Must exceed `HOLD_TTL_MINUTES`. |
| `CreateHoldInput` | `interface` | `{ tripId, ticketCount, customerPhone, customerName, customerEmail?, pickupKind?, pickupAreaId?, pickupAreaLabel?, pickupDetail? }` |
| `HoldResult` | `interface` | `{ holdId: string, expiresAt: Date }` |
| `createHold` | `(input: CreateHoldInput) => Promise<HoldResult \| null>` | Atomically reserves seats inside a `$transaction`. Acquires phone-level advisory lock first (Issue 098 -- serializes per-phone cap check), then trip-level lock. Conditionally INSERTs only if `capacity - active_holds - confirmed_bookings >= ticketCount`. Returns `null` when sold out or trip unavailable. |
| `CONCURRENT_HOLD_CAP` | re-export from `holdErrors` | `5` |
| `HoldCapExceededError` | re-export from `holdErrors` | Error class |

Lock ordering: phone lock always acquired before trip lock to prevent deadlocks.

### `holdErrors.ts`

Error types extracted from `holdRepo` so they can be imported without pulling in the
Prisma client.

| Export | Kind | Description |
|--------|------|-------------|
| `CONCURRENT_HOLD_CAP` | `const 5` | Max simultaneous active holds per phone number (Issue 098). |
| `HoldCapExceededError` | `class extends Error` | Thrown by `createHold` when the caller already holds `CONCURRENT_HOLD_CAP` active seats. `name = 'HoldCapExceededError'`, `message = 'HOLD_CAP_EXCEEDED'`. |

### `notificationLogRepo.ts`

Append-only audit log for SMS dispatch attempts.

| Export | Kind | Description |
|--------|------|-------------|
| `CreateNotificationLogInput` | `interface` | `{ bookingId?, channel?, template, recipient, payload, status, externalRef?, sentAt?, attemptCount? }`. Channel defaults to `'sms'`. |
| `createNotificationLog` | `(input: CreateNotificationLogInput) => Promise<NotificationLog>` | Creates a `NotificationLog` row. Best-effort: failures never roll back the parent booking. |

### `searchCursor.ts`

Opaque seek-cursor codec for customer search pagination (Issue 097). Isolated from the
Prisma client so it can be unit-tested without `DATABASE_URL`.

| Export | Kind | Description |
|--------|------|-------------|
| `SeekCursor` | `interface` | `{ departureAt: Date, id: string }` |
| `encodeCursor` | `(departureAtIso: string, id: string) => string` | Encodes to `${departureAtISO}_${id}`. ISO instants and CUIDs never contain `_`. |
| `decodeCursor` | `(cursor: string \| null \| undefined) => SeekCursor \| null` | Decodes; returns `null` for malformed/absent input. Splits on the first `_` only. |

### `selects.ts`

Prisma select whitelists for trip search results (AC-13: only API contract fields).

| Export | Kind | Description |
|--------|------|-------------|
| `searchResultSelect` | `Prisma.TripSelect` (const) | Select whitelist: `id`, `departureAt`, `price`, `bus.{capacity, busType, operatorId, operator.legalName}`, `route.{origin, destination, durationMinutes}`. |
| `TripSearchResult` | `type` | `Prisma.TripGetPayload<{ select: typeof searchResultSelect }>` |
| `toTripResult` | `(trip: TripSearchResult) => object` | Maps DB shape to API shape. Returns `{ tripId, departureAt (ISO), price, availableSeats, operatorLegalName, operatorId, busType, durationMinutes, routeOrigin, routeDestination }`. |

### `getActiveRoutes.ts`

Aggregates active routes with upcoming bookable trips for the public browse page.

| Export | Kind | Description |
|--------|------|-------------|
| `ActiveRoute` | `interface` | `{ origin, destination, operatorCount, minPrice, minDurationMinutes, nextDepartureAt (ISO) }` |
| `getActiveRoutes` | `() => Promise<ActiveRoute[]>` | Raw SQL query: groups by `(origin, destination)` across operators, filtering for scheduled/sales-open/future trips on non-deactivated routes. Ordered by `operatorCount DESC, origin ASC`. |

### `index.ts` (barrel)

```ts
export { prisma } from '@/lib/core/db/client';
export { withOperatorScope } from './tenantScope';
```

Note: `holdRepo`, `holdErrors`, `notificationLogRepo`, `searchCursor`, `selects`, and
`getActiveRoutes` are NOT re-exported through the barrel. Consumers import them via deep
paths.

---

## lib/core/validation/

All schemas use Zod. Each file exports one or more Zod schemas plus inferred TypeScript
types.

### `auth.ts`

| Export | Kind | Description |
|--------|------|-------------|
| `registerInput` | Zod schema | `{ phone, password, displayName? }`. Phone: VN local/international regex. Password: 8-128 chars, min 1 letter + 1 digit. |
| `loginInput` | Zod schema | `{ phone, password }`. |
| `operatorLoginInput` | Zod schema | `{ username, password }`. Operators log in by generated username (e.g. `BRAND_ACRONYM-last4phone`), not phone. |
| `otpSendInput` | Zod schema | `{ phone }`. |
| `otpVerifyInput` | Zod schema | `{ phone, code }`. Code: exactly 6 numeric digits. |
| `RegisterInput` | type | Inferred from `registerInput`. |
| `LoginInput` | type | Inferred from `loginInput`. |
| `OperatorLoginInput` | type | Inferred from `operatorLoginInput`. |
| `OtpSendInput` | type | Inferred from `otpSendInput`. |
| `OtpVerifyInput` | type | Inferred from `otpVerifyInput`. |

### `phone.ts`

| Export | Kind | Description |
|--------|------|-------------|
| `PhoneNormalizeError` | `class extends Error` | Thrown on invalid input. `name = 'PhoneNormalizeError'`. |
| `normalizePhone` | `(raw: string) => string` | Normalizes VN phone to E.164 (`+84xxxxxxxxx`). Accepts `0xxxxxxxxx`, `84xxxxxxxxx`, `+84xxxxxxxxx`. Valid mobile prefixes after country code: 3, 5, 7, 8, 9. Throws `PhoneNormalizeError` on invalid format/prefix/length. |

### `search.ts`

| Export | Kind | Description |
|--------|------|-------------|
| `searchParamsSchema` | Zod schema | `{ origin (1-50 chars), destination (1-50 chars), date (YYYY-MM-DD), ticketCount (coerced int 1-10) }`. |
| `SearchParams` | type | Inferred from `searchParamsSchema`. |
| `BUS_TYPES` | `const ['coach', 'sleeper', 'limousine']` | Valid bus type filter values. |
| `TIME_WINDOWS` | `const ['morning', 'afternoon', 'evening', 'night']` | Departure time buckets in Asia/Ho_Chi_Minh. |
| `SORT_OPTIONS` | `const ['departure_asc', 'price_asc', 'price_desc', 'duration_asc']` | Result ordering options. |
| `searchFiltersSchema` | Zod schema | `{ operatorId?, busType? (comma-separated), priceMin?, priceMax?, window?, maxDurationMinutes?, sort (default 'departure_asc') }`. Client-side filters applied in-memory over the base search result set. |
| `SearchFilters` | type | Inferred from `searchFiltersSchema`. |
| `BusType` | type | `'coach' \| 'sleeper' \| 'limousine'` |
| `TimeWindow` | type | `'morning' \| 'afternoon' \| 'evening' \| 'night'` |
| `SortOption` | type | `'departure_asc' \| 'price_asc' \| 'price_desc' \| 'duration_asc'` |

### `hold.ts`

| Export | Kind | Description |
|--------|------|-------------|
| `holdInputSchema` | Zod schema | `{ tripId (CUID), ticketCount (int 1-10), buyerName (4-100 chars, Unicode letters/marks/spaces/apostrophes/hyphens/dots), buyerPhone (VN regex), buyerEmail (required, trimmed+lowercased), pickupKind? (default 'station'), pickupAreaId?, pickupDetail? (max 300) }`. |
| `HoldInput` | type | Inferred from `holdInputSchema`. |

### `bus.ts`

| Export | Kind | Description |
|--------|------|-------------|
| `BusTypeSchema` | Zod enum | `'coach' \| 'sleeper' \| 'limousine'` |
| `CreateBusSchema` | Zod schema | `{ licensePlate (6-11 alphanum/dash/dot/space, uppercased), capacity (int 1-80), busType }`. |
| `CreateBusInput` | type | Inferred. |
| `UpdateBusSchema` | Zod schema | Partial of `{ licensePlate?, capacity?, busType? }` with at-least-one-field refinement. |
| `UpdateBusInput` | type | Inferred. |
| `CreateMaintenanceSchema` | Zod schema | `{ startAt (future datetime), endAt (after startAt), reason? (max 500) }`. |
| `CreateMaintenanceInput` | type | Inferred. |

### `route.ts`

| Export | Kind | Description |
|--------|------|-------------|
| `routeCreateSchema` | Zod schema | `{ origin (1-120), destination (1-120), durationMinutes (int 1-7200) }`. |
| `RouteCreateInput` | type | Inferred. |
| `routePatchSchema` | Zod schema | `{ origin?, destination?, durationMinutes? }`. All optional. |
| `RoutePatchInput` | type | Inferred. |

### `trip.ts`

| Export | Kind | Description |
|--------|------|-------------|
| `CreateTripSchema` | Zod schema | `{ routeId, busId, departureAt (ISO datetime -> Date), price (int >= 0), blockedSeats? (default 0), pickupAreaIds? (max 50) }`. |
| `CreateTripInput` | type | Inferred. |
| `PatchTripSchema` | Zod schema | `{ price?, salesClosed?, blockedSeats? }` with at-least-one-field refinement. |
| `PatchTripInput` | type | Inferred. |
| `ReassignBusSchema` | Zod schema | `{ busId }`. |
| `ReassignBusInput` | type | Inferred. |
| `CancelTripSchema` | Zod schema | `{ reason (min 10 chars) }`. |
| `CancelTripInput` | type | Inferred. |
| `FromTemplateSchema` | Zod schema | `{ templateId, departureAt (ISO -> Date), price? }`. |
| `FromTemplateInput` | type | Inferred. |
| `CreateRecurringTemplateSchema` | Zod schema | `{ routeId, busId, price, departureLocalTime (HH:MM), daysOfMask (1-127 bitmask: Mon=1..Sun=64), validFrom (YYYY-MM-DD), validUntil (>= validFrom), pickupAreaIds? }`. |
| `CreateRecurringTemplateInput` | type | Inferred. |
| `PatchRecurringTemplateSchema` | Zod schema | `{ price?, departureLocalTime?, daysOfMask?, validFrom?, validUntil?, busId?, deactivatedAt? (nullable) }` with at-least-one refinement. |
| `PatchRecurringTemplateInput` | type | Inferred. |
| `SalesToggleSchema` | Zod schema | `{ salesClosed: boolean }`. |
| `SalesToggleInput` | type | Inferred. |

### `staff.ts`

| Export | Kind | Description |
|--------|------|-------------|
| `CreateStaffSchema` | Zod schema | `{ name (1-120), phone (VN, validated via `normalizePhone`) }`. |
| `CreateStaffInput` | type | Inferred. |
| `UpdateStaffSchema` | Zod schema | `{ name (1-120) }`. Role is immutable in V1. |
| `UpdateStaffInput` | type | Inferred. |
| `AssignServiceSchema` | Zod schema | `{ tripId }`. |
| `AssignServiceInput` | type | Inferred. |

### `pickupArea.ts`

| Export | Kind | Description |
|--------|------|-------------|
| `operatorPickupAreaCreateSchema` | Zod schema | `{ provinceCode, districtCode, wardCode, name (2-120), addressLine? (max 200), kind (default 'station') }`. Kind: `'station' \| 'pickup'`. Server resolves canonical names from GSO dataset. |
| `OperatorPickupAreaCreateInput` | type | Inferred. |
| `operatorPickupAreaUpdateSchema` | Zod schema | `{ name (2-120), addressLine?, kind }`. Ward is not editable. |
| `OperatorPickupAreaUpdateInput` | type | Inferred. |

---

## lib/core/ placeholder sub-areas

These directories each contain a single `index.ts` with `export {}`. They reserve
namespace for future primitive migrations:

| Directory | Planned content |
|-----------|----------------|
| `errors/` | Base tagged-error union + HTTP-status mapping |
| `http/` | Rate-limit, CSRF double-submit, webhook HMAC verification |
| `money/` | VND minor-unit BigInt math, fee/payout rounding, formatting |
| `time/` | UTC+7 service-date helpers, window-overlap math, clock abstraction |
| `id/` | CUID/UUIDv7 generation, booking-ref formatting + `BOOKING_REF_REGEX` |
| `result/` | `{ ok: true, ... } \| { ok: false, ... }` discriminated result type |
| `jobs/` | Job/cron handler contract for `app/api/cron/**` and future workers |

---

## lib/config/

### `index.ts` (barrel)

```ts
export { getEnv } from './env';
```

### `env.ts` -- typed environment schema

Parsed once at module-load time via Zod `safeParse(process.env)`. Cached after first
successful parse. Server-only (never imported from client bundles).

#### Exported functions and types

| Export | Kind | Description |
|--------|------|-------------|
| `AppEnv` | `type` | Inferred type from the env Zod schema. |
| `getEnv` | `() => AppEnv` | Returns parsed, validated env config. Throws on first call if vars are missing/invalid (fail-fast). Cached after first successful parse. |
| `_resetEnvCache` | `() => void` | Test helper only. Resets the cached env to `null` so `getEnv()` re-parses on next call. |

#### Environment variables

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `HOLD_SECRET` | hex string (min 64 chars) | -- | Always | HMAC-SHA256 signing secret for `bb_hold` cookies. |
| `HOLD_SWEEPER_MODE` | `'count' \| 'update'` | `'count'` | No | Sweeper cron behavior: `count` = log only, `update` = mark expired holds. |
| `MOMO_PARTNER_CODE` | string | `'MOMOBKUN20180529'` | No | MoMo merchant partner code. |
| `MOMO_ACCESS_KEY` | string | `'klm05TvNBzhg7h7j'` | No | MoMo signature access key. |
| `MOMO_SECRET_KEY` | string | `'at67qH6mk8w5Y1nAyMoYKMWACiEi2bsa'` | No | MoMo HMAC-SHA256 key. Never log. |
| `MOMO_ENDPOINT` | URL | `'https://test-payment.momo.vn/v2/gateway/api/create'` | No | MoMo create-order endpoint. |
| `VNPAY_TMN_CODE` | string | `'VNPAYTEST'` | No | VNPay terminal code. Must not be default when `PAYMENTS_STUB=false`. |
| `VNPAY_HASH_SECRET` | string (min 32) | `'VNPAYSECRETTEST0123456789ABCDEF01'` | No | VNPay HMAC secret. Must not be default when `PAYMENTS_STUB=false`. |
| `VNPAY_URL` | URL | `'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'` | No | VNPay gateway URL. |
| `VNPAY_IPN_URL` | URL | -- | No | VNPay IPN callback URL. Falls back to request-derived URL if unset. |
| `VNPAY_RETURN_URL` | URL | -- | When `PAYMENTS_STUB=false` | VNPay browser return URL. |
| `PAYOUT_SETTLEMENT_FORCE_FAIL` | boolean (string) | `'false'` | No | Test injection: forces `settlePayout()` failure. |
| `PAYMENTS_STUB` | boolean (string) | `'false'` | No | Route all online payments through local fake-gateway stub. |
| `NOTIFY_STUB` | boolean (string) | `'true'` | No | Route SMS/email through local no-network stub. |
| `ESMS_API_KEY` | string | -- | When `NOTIFY_STUB=false` | eSMS API key. |
| `ESMS_SECRET_KEY` | string | -- | When `NOTIFY_STUB=false` | eSMS secret key. Never log. |
| `ESMS_BRANDNAME` | string | -- | When `NOTIFY_STUB=false` | eSMS registered sender ID. |
| `ESMS_OTP_SMSTYPE` | string | `'2'` | No | eSMS SmsType for OTP (`2` = CSKH/OTP brandname). |
| `ESMS_SANDBOX` | boolean (string) | `'true'` | No | eSMS sandbox mode (no charge, no real SMS). |
| `ESMS_BASE_URL` | URL | `'https://rest.esms.vn'` | No | eSMS REST base URL. |
| `STUB_PAYMENT_SECRET` | string (min 16) | `'dev-stub-payment-secret-local-only-change-me'` | No | HMAC key for fake-gateway stub IPNs. Dev-only. |
| `STORAGE_STUB` | boolean (string) | `'true'` | No | Route object storage through local stub URL-signer. |
| `STORAGE_BUCKET` | string | -- | No | S3 bucket name (real branch only). |
| `STORAGE_REGION` | string | -- | No | S3 region (real branch only). |
| `STORAGE_ENDPOINT` | string | -- | No | S3-compatible endpoint URL (real branch only). |
| `STORAGE_ACCESS_KEY` | string | -- | No | S3 access key id (real branch only). |
| `STORAGE_SECRET_KEY` | string | -- | No | S3 secret access key (real branch only). Never log. |
| `STORAGE_STUB_SECRET` | string (min 16) | `'dev-stub-storage-secret-local-only-change-me'` | No | HMAC key for storage stub URLs. Dev-only. |
| `SENTRY_DSN` | string | -- | No | Sentry DSN. Unset = events go to structured logger fallback. |
| `TICKET_SECRET` | string (min 16) | -- | No | HS256 key for ticket QR lookup tokens. Test fallback: `'t'.repeat(32)` when `NODE_ENV=test`. |
| `JWT_SECRET` | string (min 32) | -- | Production | HS256 key for customer session JWTs. |
| `JWT_OPERATOR_SECRET` | string (min 32) | -- | Production | HS256 key for operator session JWTs. |
| `JWT_ADMIN_SECRET` | string (min 32) | -- | Production | HS256 key for admin session JWTs. |
| `TOTP_ENCRYPTION_KEY` | hex string (exactly 64 chars) | -- | Production | AES-256-GCM key for AdminUser TOTP secret at-rest encryption. |
| `DATABASE_URL` | string | -- | Production | PostgreSQL connection string. |
| `DIRECT_URL` | URL | -- | Production + `PAYMENTS_STUB=false` | Direct PG URL (bypasses PgBouncer for migrations). |
| `DATABASE_POOL_MAX` | int (1-50) | `1` | No | Max connections per `pg.Pool` instance. |
| `CRON_SECRET` | string (min 16) | -- | Production | Bearer token for Vercel Cron authorization. |
| `OPS_EMAIL` | email | -- | No | Ops team email for internal notifications. |
| `EINVOICE_ENABLED` | `'stub' \| 'misa'` | `'stub'` | No | E-invoice mode: stub (log only) or real MISA API. |
| `MISA_API_URL` | URL (HTTPS enforced) | -- | When `EINVOICE_ENABLED=misa` | MISA meInvoice API base URL. |
| `MISA_API_KEY` | string | -- | When `EINVOICE_ENABLED=misa` | MISA API key. Never log. |
| `MISA_COMPANY_CODE` | string | -- | When `EINVOICE_ENABLED=misa` | MISA company code. |
| `MISA_TEMPLATE_CODE` | string | -- | When `EINVOICE_ENABLED=misa` | MISA invoice template code. |
| `EMAIL_PROVIDER` | `'stub' \| 'resend'` | `'stub'` | No | Email dispatch provider. |
| `RESEND_API_KEY` | string | -- | When `EMAIL_PROVIDER=resend` | Resend API key. Never log. |
| `EMAIL_FROM` | string | `'noreply@busbookvn.com'` | No | Sender address for transactional email. |
| `REDIS_PROVIDER` | `'memory' \| 'ioredis' \| 'upstash'` | `'memory'` | No | Redis backend selection. |
| `REDIS_URL` | string | `'redis://localhost:6379'` | No | Redis connection URL. Must not be localhost in production with `ioredis`. |

#### Cross-field validation (superRefine)

- `NOTIFY_STUB=false` requires `ESMS_API_KEY`, `ESMS_SECRET_KEY`, `ESMS_BRANDNAME`.
- `PAYMENTS_STUB=false` requires non-default `VNPAY_HASH_SECRET`, non-default `VNPAY_TMN_CODE`, and `VNPAY_RETURN_URL`.
- `EINVOICE_ENABLED=misa` requires `MISA_API_URL` (HTTPS), `MISA_API_KEY`, `MISA_COMPANY_CODE`, `MISA_TEMPLATE_CODE`.
- `EMAIL_PROVIDER=resend` requires `RESEND_API_KEY`.
- `NODE_ENV=production` requires `JWT_SECRET`, `JWT_OPERATOR_SECRET`, `JWT_ADMIN_SECRET`, `TOTP_ENCRYPTION_KEY`, `DATABASE_URL`, `CRON_SECRET`, and conditionally `DIRECT_URL` (when `PAYMENTS_STUB=false`). `REDIS_URL` must be non-localhost when `REDIS_PROVIDER=ioredis` in production.

---

## lib/logger.ts -- structured logger with PII redaction

Pino logger singleton with `[REDACTED]` censoring.

| Export | Kind | Description |
|--------|------|-------------|
| `loggerOptions` | `LoggerOptions` | Pino config object. Level: `LOG_LEVEL` env var, or `'info'` in production / `'debug'` otherwise. Includes redaction paths and `level` formatter. |
| `logger` | `pino.Logger` | Singleton Pino instance. |

### Redaction paths

All paths below are censored with `'[REDACTED]'`:

| Category | Paths |
|----------|-------|
| **Request metadata** | `req.query`, `req.url`, `req.headers.authorization`, `req.headers.cookie` |
| **Customer PII** | `customerPhone`, `customerName`, `customerEmail`, `buyerPhone`, `buyerName`, `buyerEmail` |
| **Auth tokens/secrets** | `bb_hold`, `HOLD_SECRET`, `accessToken`, `refreshToken`, `otpProof`, `confirmationToken`, `*.confirmationToken` |
| **Passwords** | `*.password`, `*.passwordHash`, `newPassword`, `currentPassword`, `tempPassword`, `*.tempPassword`, `tempPasswordPlain`, `*.tempPasswordPlain` |
| **OTP** | `phone`, `otp`, `*.otpCode`, `*.code`, `*.codeHash` |
| **Session tokens** | `*.accessToken`, `*.refreshToken`, `*.refreshTokenHash` |
| **Operator PII** | `contactPhone`, `notificationPhone`, `newPhone` |
| **Address/pickup PII** | `*.address`, `pickupAddress`, `pickupDetail`, `customPickup` |
| **Booking PII** | `escalationNote` |
| **Notification** | `*.recipient` |
| **TOTP** | `totpSecret`, `*.totpSecret`, `totpCode` |
| **Financial** | `accountNumber`, `*.accountNumber` |
| **Provider credentials** | `ESMS_API_KEY`, `ESMS_SECRET_KEY`, `MISA_API_KEY`, `RESEND_API_KEY` |

---

## lib/utils/

### `index.ts` (barrel)

```ts
export { useReducedMotion } from './useReducedMotion';
```

### `useReducedMotion.ts`

| Export | Kind | Description |
|--------|------|-------------|
| `useReducedMotion` | `() => boolean` | SSR-safe React hook that subscribes to `prefers-reduced-motion: reduce` media query via `useSyncExternalStore`. Returns `false` on server. Used by chart components to disable Recharts entrance animations and by any animation surface honouring the OS preference. Marked `'use client'`. |

---

## Test files

### `lib/core/db/__tests__/`

| File | Type | What it tests |
|------|------|---------------|
| `holdRepo.int.test.ts` | Integration | `createHold()`: single insert success, null on nonexistent trip, null on exceeding capacity, 20 parallel inserts on capacity-1 trip (exactly 1 succeeds). |
| `holdCap.int.test.ts` | Integration | Concurrent-hold cap (Issue 098): single hold unaffected; N+1 parallel holds from same phone = cap succeed + 1 `HoldCapExceededError`; distinct phones have independent caps. |
| `holdRepo.pspWindow.int.test.ts` | Integration | PSP-window awaiting_payment capacity protection (Issue 100): within-window blocks new hold; beyond-window does not block; paid booking always blocks regardless of age. |
| `searchCursor.test.ts` | Unit | `encodeCursor`/`decodeCursor` round-trip, first-underscore split rule, null/malformed tolerance. |
| `tenantScope.test.ts` | Unit | `withOperatorScope`: injects `operatorId` into empty/populated where, preserves sibling keys, authoritative override of colliding key, non-mutation of input. |

### `lib/core/validation/__tests__/`

| File | Type | What it tests |
|------|------|---------------|
| `hold.test.ts` | Unit | `holdInputSchema`: valid payload, CUID tripId validation, ticketCount bounds (0/1/10/11/non-integer), buyerName (Vietnamese diacritics, length bounds, digit rejection, apostrophe/hyphen/dot, trimming), buyerPhone (valid VN formats, invalid formats, trimming), buyerEmail (required, empty, malformed, trim+lowercase). |
| `phone.test.ts` | Unit | `normalizePhone`: all 5 VN mobile prefixes (03/05/07/08/09), E.164 passthrough, missing `+` prefix, whitespace trimming, invalid prefix/length/empty/random throws. |
| `search.test.ts` | Unit | `searchParamsSchema`: happy path, origin/destination length limits, ticketCount bounds (0/11), date format, missing fields, string-to-number coercion. |
