# 22 -- Admin API Routes

Comprehensive reference for all route handlers under `app/api/admin/`.

Every route runs on the `nodejs` runtime. All handlers are wrapped with `withErrorHandler`. Auth guards compose via higher-order functions: `requireAdminAuth` verifies the `bb_admin_access` JWT cookie (role + TOTP claims), `requireStepUp` verifies a fresh `bb_admin_stepup` cookie (300s TTL, minted by the step-up flow).

---

## Auth (`/api/admin/auth/`)

| Method | Path | Auth Guard | Request Body | Success Response | Error Codes | Lib Function |
|--------|------|------------|-------------|-----------------|-------------|--------------|
| POST | `/api/admin/auth/login` | None (rate-limited per IP) | `{ email: string, password: string }` | 200 `{ role, totpDisabled }` + Set-Cookie `bb_admin_access` (600s) + `bb_admin_refresh` (30d) | 400 INVALID, 401 INVALID_CREDENTIALS, 429 RATE_LIMITED | `adminLogin`, `issueAdminSession` |
| POST | `/api/admin/auth/logout` | None (reads `bb_admin_refresh` cookie) | None | 200 `{ ok: true }` + clears both admin cookies | (idempotent -- always 200) | `verifyAdminRefreshToken`, `revokeAdminSession` |
| POST | `/api/admin/auth/refresh` | None (reads `bb_admin_refresh` cookie) | None | 200 `{ role }` + rotated Set-Cookie `bb_admin_access` + `bb_admin_refresh` | 401 NO_SESSION, 401 SESSION_REUSE (family revoked), 401 INVALID_SESSION | `rotateAdminRefresh`, `verifyAdminRefreshToken`, `verifyAdminAccess` |
| POST | `/api/admin/auth/step-up` | `requireAdminAuth({ requireTotp: true })` | `{ code: string }` | 200 `{ ok: true }` + Set-Cookie `bb_admin_stepup` (300s) | 400 INVALID, 401 INVALID_CODE, 429 RATE_LIMITED, 429 LOCKED_OUT | `verifyLoginTotp`, `signAdminStepUp` |
| POST | `/api/admin/auth/totp/enroll` | `requireAdminAuth({ requireTotp: false })` | None | 200 `{ secret, otpauthUri }` | 409 ALREADY_ENROLLED | `beginEnrollment` |
| POST | `/api/admin/auth/totp/confirm` | `requireAdminAuth({ requireTotp: false })` | `{ code: string }` | 200 `{ role }` + re-issued session cookies (totpVerified=true) | 400 INVALID, 400 INVALID_CODE | `confirmEnrollment`, `issueAdminSession` |
| POST | `/api/admin/auth/totp/verify` | `requireAdminAuth({ requireTotp: false })` | `{ code: string }` | 200 `{ role }` + re-issued session cookies (totpVerified=true) | 400 INVALID, 401 INVALID_CODE, 409 TOTP_ENROLLMENT_REQUIRED, 429 RATE_LIMITED, 429 LOCKED_OUT | `verifyLoginTotp`, `issueAdminSession` |

---

## Operators (`/api/admin/operators/`)

Shared helpers in `operators/[id]/_shared.ts`: `operatorIdFromUrl` (path parse), `mapOperatorStatusError` (illegal_transition -> 422, operator_not_found -> 404).

| Method | Path | Auth Guard | Request Body | Success Response | Error Codes | Lib Function |
|--------|------|------------|-------------|-----------------|-------------|--------------|
| POST | `/api/admin/operators/[id]/approve` | `requireAdminAuth({ requireTotp: true, role: 'SUPER_ADMIN' })` + `requireStepUp` | None | 200 `{ ok: true }` | 400 INVALID, 404 OPERATOR_NOT_FOUND, 422 ILLEGAL_TRANSITION | `transitionOperatorStatus` (to: APPROVED) |
| POST | `/api/admin/operators/[id]/reject` | `requireAdminAuth({ requireTotp: true, role: 'SUPER_ADMIN' })` | `{ reason: string }` | 200 `{ ok: true }` | 400 INVALID, 404 OPERATOR_NOT_FOUND, 422 ILLEGAL_TRANSITION | `transitionOperatorStatus` (to: REJECTED) |
| POST | `/api/admin/operators/[id]/suspend` | `requireAdminAuth({ requireTotp: true, role: 'SUPER_ADMIN' })` + `requireStepUp` | None | 200 `{ ok: true }` | 400 INVALID, 404 OPERATOR_NOT_FOUND, 422 ILLEGAL_TRANSITION | `transitionOperatorStatus` (to: SUSPENDED) |
| POST | `/api/admin/operators/[id]/reinstate` | `requireAdminAuth({ requireTotp: true, role: 'SUPER_ADMIN' })` + `requireStepUp` | None | 200 `{ ok: true }` | 400 INVALID, 404 OPERATOR_NOT_FOUND, 422 ILLEGAL_TRANSITION | `transitionOperatorStatus` (to: APPROVED) |
| POST | `/api/admin/operators/[id]/under-review` | `requireAdminAuth({ requireTotp: true, role: 'SUPER_ADMIN' })` | None | 200 `{ ok: true }` | 400 INVALID, 404 OPERATOR_NOT_FOUND, 422 ILLEGAL_TRANSITION | `transitionOperatorStatus` (to: UNDER_REVIEW) |
| POST | `/api/admin/operators/[id]/request-info` | `requireAdminAuth({ requireTotp: true, role: 'SUPER_ADMIN' })` | `{ note: string }` | 200 `{ ok: true }` | 400 INVALID, 404 OPERATOR_NOT_FOUND | `requestOperatorInfo` |
| POST | `/api/admin/operators/[id]/create-account` | `requireAdminAuth({ requireTotp: true, role: 'SUPER_ADMIN' })` + `requireStepUp` | None | 201 `{ username, tempPassword }` | 400 INVALID, 404 OPERATOR_NOT_FOUND, 409 ACCOUNT_ALREADY_EXISTS | `createOperatorAccount` |
| POST | `/api/admin/operators/[id]/confirm-payout-account` | `requireAdminAuth({ requireTotp: true, role: 'SUPER_ADMIN' })` + `requireStepUp` | `{ method?: 'name_match' \| 'micro_deposit' }` (optional body, defaults to name_match) | 200 `{ ok: true }` | 400 invalid_body, 422 PAYOUT_ACCOUNT_NOT_FOUND, 422 validation_failed | `confirmPayoutAccountOwnership` |
| POST | `/api/admin/operators/[id]/fee-override` | `requireAdminAuth({ requireTotp: true, role: ['SUPER_ADMIN', 'FINANCE'] })` + `requireStepUp` | `{ ratePpm: int }` | 200 `{ feeConfigId }` | 400 INVALID, 422 INVALID_RATE | `setOperatorFeeOverride` |
| GET | `/api/admin/operators/[id]/kyb/[docId]/url` | `requireAdminAuth({ requireTotp: true, role: 'SUPER_ADMIN' })` | None | 200 `{ url }` | 400 INVALID, 404 NOT_FOUND | `createSignedDownloadUrl` |

---

## Customers (`/api/admin/customers/`)

Shared helpers in `customers/[id]/_shared.ts`: `customerIdFromUrl` (path parse).

| Method | Path | Auth Guard | Request Body | Success Response | Error Codes | Lib Function |
|--------|------|------------|-------------|-----------------|-------------|--------------|
| POST | `/api/admin/customers/[id]/suspend` | `requireAdminAuth({ requireTotp: true, role: ['SUPER_ADMIN', 'SUPPORT'] })` | None | 200 `{ ok: true }` | 400 INVALID | `suspendCustomer` |
| POST | `/api/admin/customers/[id]/reinstate` | `requireAdminAuth({ requireTotp: true, role: ['SUPER_ADMIN', 'SUPPORT'] })` | None | 200 `{ ok: true }` | 400 INVALID | `reinstateCustomer` |

Both are idempotent. No step-up required.

---

## Finance (`/api/admin/finance/`)

All finance routes share the same auth chain via `financeRoute()` helper in `finance/_shared.ts`:
`requireAdminAuth({ requireTotp: true, role: ['SUPER_ADMIN', 'FINANCE'] })` + `requireStepUp`.

Shared helpers: `payoutIdFromUrl` (path parse for payout routes), `readJsonBody` (JSON body parse with 400 on failure).

| Method | Path | Auth Guard | Request Body | Success Response | Error Codes | Lib Function |
|--------|------|------------|-------------|-----------------|-------------|--------------|
| POST | `/api/admin/finance/fee/global` | financeRoute | `{ ratePpm: int }` | 200 `{ feeConfigId }` | 400 INVALID, 422 INVALID_RATE | `setGlobalFee` |
| POST | `/api/admin/finance/payouts/[id]/approve` | financeRoute | None | 200 `{ ok: true, status: 'processing' }` | 400 INVALID, 404 PAYOUT_NOT_FOUND, 422 NOT_APPROVABLE | `approvePayout` (inline, SELECT FOR UPDATE in $transaction) |
| POST | `/api/admin/finance/payouts/[id]/retry` | financeRoute | None | 200 `{ ok: true, status }` | 400 INVALID, 404 PAYOUT_NOT_FOUND, 422 NOT_RETRYABLE | `retryPayout` |
| POST | `/api/admin/finance/chargeback` | financeRoute | `{ bookingId: string, amountMinor: int>0, sourceEventId?: string }` | 200 `{ recorded, alreadyDone, backstopped }` | 400 INVALID, 404 BOOKING_NOT_FOUND, 422 (chargeback error code) | `recordChargeback` |
| POST | `/api/admin/finance/refund-out` | financeRoute | `{ bookingId: string, amountMinor: int>0, reason: string }` | 200 `{ refunded, alreadyDone }` | 400 INVALID, 404 BOOKING_NOT_FOUND, 422 (refund error code) | `refundOut` |
| POST | `/api/admin/finance/ledger/adjustment` | financeRoute | `{ operatorId: string, amountMinor: int, reason: string }` | 200 `{ ledgerEntryId }` | 400 INVALID, 422 INVALID | `addManualAdjustment` |

All finance mutations are audited via `writeAdminAuditLog` (except the approve route which calls it explicitly; others have it in the lib function or inline).

---

## Admins (`/api/admin/admins/`)

| Method | Path | Auth Guard | Request Body | Success Response | Error Codes | Lib Function |
|--------|------|------------|-------------|-----------------|-------------|--------------|
| POST | `/api/admin/admins` | `requireAdminAuth({ requireTotp: true, role: 'SUPER_ADMIN' })` + `requireStepUp` | `{ email: string, role: 'SUPER_ADMIN' \| 'FINANCE' \| 'SUPPORT' }` | 201 `{ adminUserId, tempPassword }` | 400 INVALID, 403 FORBIDDEN, 409 EMAIL_IN_USE | `inviteAdmin` |
| POST | `/api/admin/admins/[id]/reset-totp` | `requireAdminAuth({ requireTotp: true, role: 'SUPER_ADMIN' })` + `requireStepUp` | None | 200 `{ ok: true }` | 400 INVALID, 403 FORBIDDEN, 404 ADMIN_NOT_FOUND, 422 NO_SELF_RESET | `resetAdminTotp` |

---

## System (`/api/admin/system/`)

### Admin management (under `/api/admin/system/admins/`)

| Method | Path | Auth Guard | Request Body | Success Response | Error Codes | Lib Function |
|--------|------|------------|-------------|-----------------|-------------|--------------|
| POST | `/api/admin/system/admins/[id]/role` | `requireAdminAuth({ requireTotp: true, role: 'SUPER_ADMIN' })` + `requireStepUp` | `{ role: 'SUPER_ADMIN' \| 'FINANCE' \| 'SUPPORT' }` | 200 `{ ok: true }` | 400 INVALID, 404 ADMIN_NOT_FOUND, 422 NO_SELF_ROLE_CHANGE, 422 INVALID_ROLE | `setAdminRole` |
| POST | `/api/admin/system/admins/[id]/revoke` | `requireAdminAuth({ requireTotp: true, role: 'SUPER_ADMIN' })` + `requireStepUp` | None | 200 `{ ok: true }` | 400 INVALID, 404 ADMIN_NOT_FOUND, 422 NO_SELF_REVOKE | `revokeAdmin` |

### Flags and audit

| Method | Path | Auth Guard | Request Body | Success Response | Error Codes | Lib Function |
|--------|------|------------|-------------|-----------------|-------------|--------------|
| POST | `/api/admin/system/flags` | `requireAdminAuth({ requireTotp: true, role: ['SUPER_ADMIN', 'FINANCE'] })` + `requireStepUp` | `{ key: string, enabled: boolean, value?: string }` | 200 `{ ok: true }` | 400 INVALID, 422 UNKNOWN_FLAG | `setFlag` |
| GET | `/api/admin/system/audit/export` | `requireAdminAuth({ requireTotp: true, role: ['SUPER_ADMIN', 'FINANCE'] })` | Query: `?action=` (optional exact filter) | 200 `text/csv` attachment (up to 1000 rows) | -- | `getAuditLog`, `auditLogToCsv` |

The audit export is a safe GET -- no step-up, no CSRF. Response has `Cache-Control: no-store`.

---

## Moderation (`/api/admin/moderation/`)

All moderation routes share the same auth chain via `moderationRoute()` helper in `moderation/_shared.ts`:
`requireAdminAuth({ requireTotp: true, role: ['SUPER_ADMIN', 'SUPPORT'] })`. No step-up required -- moderation is lower-privilege than finance/suspend.

Shared helpers: `idFromUrl(req, segment)` (generic path parse), `readReason(req)` (tolerant optional body -> `{ reason? }`), `prismaErrorToStatus` (P2025 -> 404, else rethrow).

| Method | Path | Auth Guard | Request Body | Success Response | Error Codes | Lib Function |
|--------|------|------------|-------------|-----------------|-------------|--------------|
| POST | `/api/admin/moderation/reports/[id]/resolve` | moderationRoute | None | 200 `{ ok: true }` | 400 INVALID, 404 NOT_FOUND | `resolveReport` |
| POST | `/api/admin/moderation/trips/[id]/disable` | moderationRoute | `{ reason?: string }` (optional) | 200 `{ ok: true }` | 400 INVALID, 404 NOT_FOUND | `setTripModeration` (disabled: true) |
| POST | `/api/admin/moderation/trips/[id]/enable` | moderationRoute | `{ reason?: string }` (optional) | 200 `{ ok: true }` | 400 INVALID, 404 NOT_FOUND | `setTripModeration` (disabled: false) |
| POST | `/api/admin/moderation/routes/[id]/disable` | moderationRoute | `{ reason?: string }` (optional) | 200 `{ ok: true }` | 400 INVALID, 404 NOT_FOUND | `setRouteModeration` (disabled: true) |
| POST | `/api/admin/moderation/routes/[id]/enable` | moderationRoute | `{ reason?: string }` (optional) | 200 `{ ok: true }` | 400 INVALID, 404 NOT_FOUND | `setRouteModeration` (disabled: false) |

---

## Charter (`/api/admin/charter/`)

Charter dispatch routes for routing customer charter leads to operators. Shared helpers in `charter/[id]/_shared.ts`: `charterIdFromUrl` (path parse), `mapCharterError` (illegal_transition -> 422, charter_not_found -> 404).

All routes: `requireAdminAuth({ requireTotp: true, role: ['SUPER_ADMIN', 'SUPPORT'] })`. No step-up -- dispatching a sales lead is an ops action, not money movement.

| Method | Path | Auth Guard | Request Body | Success Response | Error Codes | Lib Function |
|--------|------|------------|-------------|-----------------|-------------|--------------|
| POST | `/api/admin/charter/[id]/assign-direct` | SUPER_ADMIN \| SUPPORT + TOTP | `{ operatorId: string }` | 200 `{ ok: true }` | 400 INVALID, 404 CHARTER_NOT_FOUND, 422 NOT_APPROVED (operator not approved), 422 ILLEGAL_TRANSITION | `transitionCharterRequest` (to: ASSIGNED_DIRECT, acceptByAt: now+24h) |
| POST | `/api/admin/charter/[id]/publish` | SUPER_ADMIN \| SUPPORT + TOTP | None | 200 `{ ok: true }` | 400 INVALID, 404 CHARTER_NOT_FOUND, 422 ILLEGAL_TRANSITION | `transitionCharterRequest` (to: PUBLISHED, claimByAt: now+48h) |
| POST | `/api/admin/charter/[id]/reject` | SUPER_ADMIN \| SUPPORT + TOTP | `{ reason: string }` | 200 `{ ok: true }` | 400 INVALID, 404 CHARTER_NOT_FOUND, 422 ILLEGAL_TRANSITION | `transitionCharterRequest` (to: REJECTED) |

---

## Auth Guard Summary

| Guard Level | Description | Routes Using It |
|------------|-------------|-----------------|
| None | Public, rate-limited | login, logout, refresh |
| `requireAdminAuth({ requireTotp: false })` | Authenticated, TOTP not yet verified | totp/enroll, totp/confirm, totp/verify |
| `requireAdminAuth({ requireTotp: true })` | Authenticated + TOTP verified | step-up |
| `requireAdminAuth + role` | Role-gated + TOTP | operator transitions (no step-up), moderation, charter, customer suspend/reinstate |
| `requireAdminAuth + role + requireStepUp` | Full privilege (fresh TOTP re-verify) | approve, suspend, reinstate (operators), create-account, confirm-payout-account, fee-override, all finance, admin invite, reset-totp, role change, revoke, flags |

## Role Matrix

| Role | Operators | Customers | Finance | Admins/System | Moderation | Charter | Flags | Audit |
|------|-----------|-----------|---------|---------------|------------|---------|-------|-------|
| SUPER_ADMIN | All | suspend/reinstate | All | All | All | All | toggle | export |
| FINANCE | fee-override only | -- | All | -- | -- | -- | toggle | export |
| SUPPORT | -- | suspend/reinstate | -- | -- | All | All | -- | -- |

## Total Route Count

38 route handlers across 8 groups (7 auth + 10 operators + 2 customers + 6 finance + 2 admins + 4 system + 5 moderation + 3 charter = 39 handler exports; 38 distinct endpoints since one file has no GET).
