# 12 — lib/admin/ (Platform Admin Operations)

> Auto-generated documentation of `lib/admin/` — the platform-admin domain module.

## Overview

`lib/admin/` contains all service-layer functions for **platform administration**: operator lifecycle management, admin user management, content moderation, financial queues, audit logging, and user search/suspension. Functions are designed to be **Next.js-free** where possible (accepting `PrismaClient` as a parameter) so they can be shared between the web app routes and the sealed admin CLI.

All write operations record an `AdminAuditLog` row inside the same `$transaction`. PII (phone numbers, account numbers) is masked via `redactPhone()` / `maskAccountNumber()` before leaving the data layer.

**Dependency flow:** `lib/admin/` depends on `lib/core/`, `lib/auth/`, `lib/audit/`, `lib/staff/`, `lib/notification/`, `lib/ledger/`, `lib/onboarding/`. No reverse dependencies.

---

## Barrel (index.ts)

`lib/admin/index.ts` re-exports the public API surface. All cross-domain consumers import through this barrel.

| Export | Source File |
|--------|-------------|
| `AdminServiceError` | `errors.ts` |
| `createOperatorAccount`, `CreateOperatorAccountInput` (type), `CreateOperatorAccountResult` (type) | `createOperatorAccount.ts` |
| `getActionQueue` | `getActionQueue.ts` |
| `getApprovalQueue`, `ApprovalQueueOperator` (type) | `getApprovalQueue.ts` |
| `getAuditLog`, `auditLogToCsv`, `AuditLogRow` (type) | `getAuditLog.ts` |
| `getCharterDispatchQueue`, `getApprovedOperatorsForAssign`, `CharterDispatchItem` (type) | `getCharterDispatchQueue.ts` |
| `getFailureAlerts` | `getFailureAlerts.ts` |
| `getLedgerView` | `getLedgerView.ts` |
| `getOpenReports`, `getModeratedItems` | `getModerationQueue.ts` |
| `getOperatorDetail` | `getOperatorDetail.ts` |
| `getPayoutQueue`, `PayoutQueueRow` (type) | `getPayoutQueue.ts` |
| `getCustomerDetail` | `getUserDetail.ts` |
| `inviteAdmin` | `inviteAdmin.ts` |
| `listAdmins`, `AdminRow` (type) | `listAdmins.ts` |
| `listAllOperators` | `listAllOperators.ts` |
| `resolveReport`, `setRouteModeration`, `setTripModeration` | `moderation.ts` |
| `resetAdminTotp` | `resetAdminTotp.ts` |
| `revokeAdmin` | `revokeAdmin.ts` |
| `searchUsers`, `UserKind` (type), `UserStatus` (type) | `searchUsers.ts` |
| `setAdminRole` | `setAdminRole.ts` |
| `suspendCustomer`, `reinstateCustomer` | `suspendCustomer.ts` |

**Not barrel-exported** (CLI-only / internal): `bootstrapSuperAdmin`, `createOperator`, `disableOperator`, `listOperators`, `resetOperatorAdminPassword`.

---

## File-by-File Reference

### errors.ts

Error type for platform-admin operations. Kept Next.js-free so the node-only admin CLI container can import it.

| Export | Kind | Description |
|--------|------|-------------|
| `AdminErrorCode` | Type union | `'phone_in_use'` \| `'operator_not_found'` \| `'operator_user_not_found'` \| `'already_disabled'` \| `'email_in_use'` \| `'forbidden'` \| `'no_self_reset'` \| `'admin_not_found'` \| `'no_self_revoke'` \| `'no_self_role_change'` \| `'invalid_role'` \| `'account_already_exists'` |
| `AdminServiceError` | Class (extends `Error`) | Constructor takes an `AdminErrorCode`. Exposes `code` as a readonly property. `name` is `'AdminServiceError'`. |

---

### bootstrapSuperAdmin.ts

Provisions the FIRST platform `SUPER_ADMIN` (Issue 057). **Security-critical.** Only driven by the sealed CLI (`scripts/admin/bootstrapSuperAdmin.ts`) reading out-of-band env. No public/web route exposes it.

**Idempotent re-run guard:** if any `SUPER_ADMIN` already exists, returns the existing id with `created: false` and makes no write.

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `BootstrapSuperAdminInput` | Interface | `{ email, password, actor }` | Input for the bootstrap function. `actor` recorded in audit log. |
| `BootstrapSuperAdminResult` | Interface | `{ created: boolean, adminUserId: string }` | Result indicating whether a new admin was created. |
| `bootstrapSuperAdmin` | Async function | `(prisma: PrismaClient, input: BootstrapSuperAdminInput) => Promise<BootstrapSuperAdminResult>` | Creates the genesis super-admin in a `$transaction`. Writes `AdminAuditLog` row. Throws `AdminServiceError('email_in_use')` on P2002 unique constraint violation. |

---

### createOperator.ts

Provisions a new `Operator` + its bootstrap admin `OperatorUser` from the platform-admin CLI (Issue 020). The temp password is SMS'd after commit; never persisted in plaintext.

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `CreateOperatorInput` | Interface | `{ legalName, contactEmail, contactPhone, notificationPhone?, baseUrl, actor }` | Input fields for operator creation. |
| `CreateOperatorResult` | Interface | `{ operatorId, operatorUserId, loginPhone }` | Result with created IDs and normalized login phone. |
| `createOperator` | Async function | `(prisma: PrismaClient, input: CreateOperatorInput) => Promise<CreateOperatorResult>` | Single `$transaction`: creates `Operator` + `OperatorUser` (role=admin, `requiresPasswordChange=true`) with generated username. Writes `AdminAuditLog`. After commit, sends SMS with temp password and writes `NotificationLog`. Throws `AdminServiceError('phone_in_use')` on P2002. |

---

### createOperatorAccount.ts

Admin-console provisioning of a bootstrap login account from an EXISTING operator application (PENDING_REVIEW to APPROVED transition). Differs from `createOperator` (CLI, creates Operator from scratch): this takes an `operatorId` that already exists.

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `CreateOperatorAccountInput` | Interface | `{ operatorId, baseUrl, actor }` | Identifies the existing operator application. |
| `CreateOperatorAccountResult` | Interface | `{ operatorUserId, username, tempPassword }` | Temp password returned ONCE to admin for on-screen relay; never persisted or emailed. |
| `createOperatorAccount` | Async function | `(prisma: PrismaClient, input: CreateOperatorAccountInput) => Promise<CreateOperatorAccountResult>` | Single `$transaction`: loads Operator (404 if missing), guards double-provisioning (`account_already_exists`), generates username, creates `OperatorUser` (role=admin, `requiresPasswordChange=true`), flips `Operator.status` to `APPROVED`, writes `AdminAuditLog`. After commit, enqueues account-created email as pending `NotificationLog` row (body carries NO password). |

Internal helper: `renderAccountCreatedBody(username, loginUrl, setupUrl)` -- renders the Vietnamese-language email body.

---

### disableOperator.ts

Platform-admin kill switch for an operator (Issue 020, AC2). Atomic `$transaction` with `SELECT ... FOR UPDATE` on the Operator row.

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `DisableOperatorInput` | Interface | `{ operatorId, actor }` | Target operator and audit actor. |
| `DisableOperatorResult` | Interface | `{ operatorId, disabledAt, usersDisabled, sessionsRevoked, tripsClosed }` | Summary of all cascading effects. |
| `disableOperator` | Async function | `(prisma: PrismaClient, input: DisableOperatorInput) => Promise<DisableOperatorResult>` | Locks Operator row with `FOR UPDATE`. Stamps `Operator.disabledAt`, disables all `OperatorUser` rows, revokes all live `OperatorSession` rows, forces `salesClosed=true` on scheduled trips, writes `AdminAuditLog`. Throws `operator_not_found` or `already_disabled`. In-flight bookings are untouched (honored per AC2). |

---

### listAllOperators.ts

Admin Operators tab list (Issue 067, Part D). Cursor/seek paginated on `(createdAt DESC, id DESC)` with optional `OperatorStatus` filter. Contact phone is masked via `redactPhone()`.

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `OperatorListItem` | Interface | `{ id, legalName, status, contactMasked, createdAt }` | Single operator row for the list. Phone is redacted. |
| `ListAllOperatorsParams` | Interface | `{ status?, cursor?, limit? }` | Optional status filter + seek cursor + page size (default 20, max 100). |
| `ListAllOperatorsResult` | Interface | `{ items: OperatorListItem[], nextCursor: string \| null }` | Paginated result. |
| `listAllOperators` | Async function | `(params, prisma?) => Promise<ListAllOperatorsResult>` | Prisma `findMany` with seek-cursor pagination. |

---

### listOperators.ts

Read-only operator roster for the platform-admin CLI (Issue 020). No pagination (returns all rows). No audit log (read-only).

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `OperatorRosterRow` | Interface | `{ id, legalName, contactPhone, disabledAt, createdAt }` | Full operator row including raw phone (CLI context). |
| `listOperators` | Async function | `(prisma: PrismaClient) => Promise<OperatorRosterRow[]>` | Returns all operators ordered by `createdAt DESC`. |

---

### getOperatorDetail.ts

Admin Operators tab detail read for a single operator (Issue 067, Part C). Aggregates profile, fleet count, trip count, GMV, balance, fee rate, and payout history.

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `OperatorPayoutHistoryItem` | Interface | `{ id, net, status, scheduledAt, settledAt }` | Single payout row in history. |
| `OperatorDetail` | Interface | `{ id, legalName, brandName, contactName, address, routesSummary, contactEmail, contactPhone, status, createdAt, rejectionReason, hasLoginAccount, loginUsername, fleetCount, tripCount, upcomingTripCount, gmvVnd (bigint), balance (OperatorBalance), currentFeePpm, payoutHistory[] }` | Full operator detail. Money values are BigInt to avoid float drift. |
| `getOperatorDetail` | Async function | `(operatorId, prisma?, now?) => Promise<OperatorDetail \| null>` | Returns null when operator does not exist. Runs 8 parallel queries: operator profile, bus count, trip count, upcoming trip count, GMV via raw SQL, balance (`getOperatorBalance`), fee rate (`getEffectiveFeeRate`), payout history (last 10), login account lookup. |

---

### getApprovalQueue.ts

Operators awaiting an admin decision (Issue 065). Lists every operator with status `PENDING_REVIEW` or `UNDER_REVIEW`, oldest first (FIFO). Includes KYB documents (Issue 077) and payout account with name-match signal (Issue 078).

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `ApprovalQueueDoc` | Interface | `{ id, type, status, uploadedAt }` | KYB document metadata (no signed URLs -- minted on demand). |
| `ApprovalQueuePayoutAccount` | Interface | `{ bankName, accountNumberMasked, accountHolderName, verifiedAt, verifyMethod, nameMatchScore, suggestVerified }` | Payout account with masked account number and name-match signal. |
| `ApprovalQueueOperator` | Interface | `{ id, legalName, contactEmail, contactPhone, status, createdAt, rejectionReason, docs[], payoutAccount }` | Full approval queue entry. Phone and email shown in full (admins need to contact applicants). |
| `getApprovalQueue` | Async function | `(prisma?) => Promise<ApprovalQueueOperator[]>` | Returns all pending operators with included KYB docs and payout accounts. Uses `maskAccountNumber()` and `nameMatchScore()` from `lib/onboarding`. |

---

### getActionQueue.ts

The "needs-a-human" counts for the admin Overview action queue (Issue 064). Four parallel counts linking to the tabs that resolve them.

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `ActionQueueCounts` | Interface | `{ pendingApprovals, pendingCharters, openDisputes, failedPayouts }` | Four integer counts. |
| `getActionQueue` | Async function | `(prisma?) => Promise<ActionQueueCounts>` | Counts: operators in `PENDING_REVIEW`/`UNDER_REVIEW`, charter requests in `ADMIN_REVIEW`, ledger entries of type `chargeback`, payouts in status `failed`. |

---

### getPayoutQueue.ts

Admin Finance tab payout-queue read (Issue 068). Cursor/seek paginated on `(scheduledAt DESC, id DESC)` with optional single-status filter.

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `PayoutQueueRow` | Interface | `{ id, operatorId, net, status, scheduledAt, settledAt, failureReason }` | Single payout row. |
| `GetPayoutQueueParams` | Interface | `{ status?, cursor?, limit? }` | Optional status filter + cursor + page size (default 20, max 100). |
| `GetPayoutQueueResult` | Interface | `{ items: PayoutQueueRow[], nextCursor }` | Paginated result. |
| `getPayoutQueue` | Async function | `(params, prisma?) => Promise<GetPayoutQueueResult>` | Seek-paginated payout list across all operators. |

---

### getModerationQueue.ts

Admin Moderation tab read queries (Issue 069, Part D). Two functions:

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `OpenReport` | Interface | `{ id, targetType, targetId, reason, reportedBy, createdAt }` | Single content report. |
| `GetOpenReportsParams` | Interface | `{ cursor?, limit? }` | Cursor + page size (default 20, max 100). |
| `GetOpenReportsResult` | Interface | `{ items: OpenReport[], nextCursor }` | Paginated result. |
| `getOpenReports` | Async function | `(params?, prisma?) => Promise<GetOpenReportsResult>` | Open `ContentReport` queue, cursor/seek paginated on `(createdAt DESC, id DESC)`. |
| `ModeratedTrip` | Interface | `{ id, label, departureAt }` | Trip with human-readable label (`origin -> destination`). |
| `ModeratedRoute` | Interface | `{ id, origin, destination }` | Moderated route. |
| `ModeratedItems` | Interface | `{ trips: ModeratedTrip[], routes: ModeratedRoute[] }` | Currently-disabled trips + routes. |
| `getModeratedItems` | Async function | `(prisma?) => Promise<ModeratedItems>` | Lists trips and routes where `moderatedAt` is not null (take 50 each, no pagination). |

---

### getCharterDispatchQueue.ts

Admin charter-dispatch reads (Issue 085). Three functions backing the admin charter console.

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `CharterDispatchItem` | Interface | `{ id, ref, contactName, contactPhone, contactEmail, originName, destinations (JsonValue), startDate, endDate, durationDays, passengers, vehicleType, budgetVnd, notes, createdAt, priorAssigneeOperatorId, priorAssigneeName }` | Full charter request detail for dispatch. |
| `GetCharterDispatchQueueParams` | Interface | `{ cursor?, limit? }` | Seek cursor + page size (default 20, max 100). |
| `GetCharterDispatchQueueResult` | Interface | `{ items: CharterDispatchItem[], nextCursor }` | Paginated result. |
| `getCharterDispatchQueue` | Async function | `(prisma, params?) => Promise<GetCharterDispatchQueueResult>` | FIFO dispatch queue: `CharterRequest` rows in `ADMIN_REVIEW`, oldest first `(createdAt ASC, id ASC)`. |
| `ApprovedOperatorOption` | Interface | `{ id, legalName }` | Operator picker option. |
| `getApprovedOperatorsForAssign` | Async function | `(prisma) => Promise<ApprovedOperatorOption[]>` | Every APPROVED operator, sorted by `legalName ASC`. |
| `CharterDetail` | Interface | extends `CharterDispatchItem` + `{ status, assigneeOperatorId, assigneeName, publishedAt, claimByAt, acceptByAt, rejectionReason }` | Full single-request detail including current status and deadlines. |
| `getCharterById` | Async function | `(prisma, charterId) => Promise<CharterDetail \| null>` | Full detail for one charter request (any status), or null. |

Internal helpers: `DISPATCH_SELECT` (shared select object), `toDispatchItem(row)` (row mapper).

---

### getFailureAlerts.ts

Recent operational failures for the admin Overview "Failure alerts" section (Issue 064). Triage-level glance.

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `FailureAlertItem` | Interface | `{ id, template, recipient, createdAt, lastError }` | Single failed notification. |
| `FailureAlerts` | Interface | `{ failedNotifications, failedPayouts, recent: FailureAlertItem[] }` | Counts + recent failed notification list. |
| `getFailureAlerts` | Async function | `(limit?, prisma?) => Promise<FailureAlerts>` | Counts failed notifications + failed payouts; returns last N (default 5) failed `NotificationLog` rows. |

---

### getLedgerView.ts

Admin Finance tab ledger read for ONE operator (Issue 068). Cursor/seek paginated. BigInt amounts returned as strings (Issue 016 -- no JSON/float drift).

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `LedgerEntryRow` | Interface | `{ id, type, amountMinor (string), currency, bookingId, payoutId, sourceEventId, createdAt }` | Single ledger entry. `amountMinor` is a string (BigInt serialization). |
| `GetLedgerViewParams` | Interface | `{ operatorId, cursor?, limit? }` | Operator ID + cursor + page size (default 50, max 200). |
| `GetLedgerViewResult` | Interface | `{ items: LedgerEntryRow[], nextCursor, balance: { pending, available, paidOut } }` | Paginated ledger entries + derived balance summary (all strings). |
| `getLedgerView` | Async function | `(params, prisma?, balanceFn?) => Promise<GetLedgerViewResult>` | Runs ledger query + `getOperatorBalance` in parallel. Balance function is injectable for tests. |

---

### getAuditLog.ts

Read + export the immutable `AdminAuditLog` (Issue 062) for the System tab (Issue 070). Append-only, read-only module.

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `AuditLogRow` | Interface | `{ id, timestamp, actor, action, target, argsRedacted }` | Single audit log entry. |
| `GetAuditLogParams` | Interface | `{ action?, cursor?, limit? }` | Optional exact-action filter + cursor + page size (default 50, max 1000). |
| `GetAuditLogResult` | Interface | `{ items: AuditLogRow[], nextCursor }` | Paginated result. |
| `getAuditLog` | Async function | `(params, prisma?) => Promise<GetAuditLogResult>` | Seek-paginated on `(timestamp DESC, id DESC)`. Optional `action` filter. |
| `auditLogToCsv` | Pure function | `(rows: AuditLogRow[]) => string` | Serializes rows to RFC 4180 CSV with header `id,timestamp,actor,action,target,argsRedacted`. No I/O. |

Internal helper: `csvField(value)` -- RFC 4180 field escaping.

---

### getUserDetail.ts

Admin "Users" tab detail read for a single customer (Issue 066). Phone is masked; email shown in full.

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `CustomerDetail` | Interface | `{ id, name, phoneMasked, email, status (UserStatus), createdAt, lastLoginAt, bookingCount }` | Customer profile + activity summary. |
| `getCustomerDetail` | Async function | `(customerId, prisma?) => Promise<CustomerDetail \| null>` | Returns null when customer does not exist. Derives status from `deletedAt`/`suspendedAt` timestamps. |

---

### inviteAdmin.ts

Provisions a new `AdminUser` of any role, invited by an existing super-admin (Issue 057). **Security-critical.**

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `InviteAdminInput` | Interface | `{ inviterAdminId, email, role (AdminRole), actor }` | Inviter ID + invitee email + role. |
| `InviteAdminResult` | Interface | `{ adminUserId, tempPassword }` | Temp password returned ONCE; conveyed out-of-band. |
| `inviteAdmin` | Async function | `(prisma: PrismaClient, input) => Promise<InviteAdminResult>` | Defense-in-depth: re-verifies inviter is ACTIVE SUPER_ADMIN at data layer. Creates `AdminUser` (status=ACTIVE) in `$transaction` with hashed temp password. Writes `AdminAuditLog`. Throws `forbidden` (bad inviter), `email_in_use` (P2002). |

---

### listAdmins.ts

Lists all `AdminUser` rows for the System tab (Issue 070). No pagination (admin set is tiny). Never selects `passwordHash` or `totpSecret`.

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `AdminRow` | Interface | `{ id, email, role (AdminRole), status (AdminStatus), totpEnabledAt, invitedBy, createdAt }` | Admin identity + role + enrollment state. |
| `listAdmins` | Async function | `(prisma?) => Promise<AdminRow[]>` | Returns all admins ordered by `createdAt ASC`. |

---

### setAdminRole.ts

Changes a target `AdminUser`'s role (Issue 070). **Security-critical.**

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `ADMIN_ROLES` | Const array | `['SUPER_ADMIN', 'FINANCE', 'SUPPORT']` | Valid `AdminRole` values for input validation. |
| `SetAdminRoleInput` | Interface | `{ actorAdminId, targetAdminId, role (string), actor }` | Actor + target + new role. |
| `SetAdminRoleResult` | Interface | `{ ok: true }` | Success indicator. |
| `setAdminRole` | Async function | `(prisma: PrismaClient, input) => Promise<SetAdminRoleResult>` | Guards: no self-role-change (`no_self_role_change`), valid role (`invalid_role`), target exists (`admin_not_found`). Updates role in `$transaction` + `AdminAuditLog`. |

Internal helper: `isAdminRole(role)` -- type guard against `ADMIN_ROLES`.

---

### revokeAdmin.ts

Disables a target `AdminUser` so they can no longer authenticate (Issue 070). **Security-critical.** Sets `status = 'DISABLED'`. No separate session eviction needed: `requireAdminAuth` re-reads the row on every request and the access token TTL is 600s.

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `RevokeAdminInput` | Interface | `{ actorAdminId, targetAdminId, actor }` | Actor + target. |
| `RevokeAdminResult` | Interface | `{ ok: true }` | Success indicator. |
| `revokeAdmin` | Async function | `(prisma: PrismaClient, input) => Promise<RevokeAdminResult>` | Guards: no self-revoke (`no_self_revoke`), target exists (`admin_not_found`). Sets `DISABLED` in `$transaction` + `AdminAuditLog`. |

---

### resetAdminTotp.ts

Clears a target admin's TOTP secret so they must re-enroll on next login (Issue 057, lost-TOTP recovery). **Security-critical.**

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `ResetAdminTotpInput` | Interface | `{ actorAdminId, targetAdminId, actor, bypassActorCheck? }` | `bypassActorCheck` only set by the sealed break-glass CLI (env-seal authorized). |
| `ResetAdminTotpResult` | Interface | `{ ok: true }` | Success indicator. |
| `resetAdminTotp` | Async function | `(prisma: PrismaClient, input) => Promise<ResetAdminTotpResult>` | Guards: no self-reset (`no_self_reset`) -- applies even under break-glass. Actor must be ACTIVE SUPER_ADMIN (unless `bypassActorCheck`). Target must exist (`admin_not_found`). Sets `totpSecret=null`, `totpEnabledAt=null` in `$transaction` + `AdminAuditLog`. |

---

### searchUsers.ts

Admin "Users" tab search over customers OR operators (Issue 066). Per-kind tabs with cursor/seek pagination on `(createdAt DESC, id DESC)`.

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `UserKind` | Type | `'customer' \| 'operator'` | Which user list to page. |
| `UserStatus` | Type | `'active' \| 'suspended' \| 'deleted' \| OperatorStatus` | Derived display status. |
| `UserListItem` | Interface | `{ kind, id, name, contactMasked, status, createdAt }` | Single row in either list. Phone masked via `redactPhone()`. |
| `SearchUsersParams` | Interface | `{ q?, kind?, cursor?, limit? }` | Free-text query + kind (default `'customer'`) + cursor + limit (default 20, max 100). |
| `SearchUsersResult` | Interface | `{ items: UserListItem[], nextCursor }` | Paginated result. |
| `searchUsers` | Async function | `(params, prisma?) => Promise<SearchUsersResult>` | Operator mode: searches `legalName`/`contactEmail`/`contactPhone` (case-insensitive contains). Customer mode: searches `displayName`/`email`/`phone`. |

Internal helpers: `customerContact(phone, email)`, `customerStatus(suspendedAt, deletedAt)`.

---

### suspendCustomer.ts

Admin moderation of a customer account (Issue 066). Customer-side equivalent of operator disable.

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `SuspendCustomerInput` | Interface | `{ customerId, actor }` | Target customer + audit actor. |
| `suspendCustomer` | Async function | `(prisma: PrismaClient, input) => Promise<void>` | `$transaction`: stamps `Customer.suspendedAt`, revokes all live sessions (soft-delete `revokedAt`), writes `AdminAuditLog`. Idempotent: re-suspending re-stamps + re-revokes. |
| `reinstateCustomer` | Async function | `(prisma: PrismaClient, input) => Promise<void>` | `$transaction`: clears `Customer.suspendedAt`, writes `AdminAuditLog`. Does NOT restore revoked sessions (customer logs in fresh). |

---

### moderation.ts

Admin content-moderation services (Issue 069, Part C). "Disable, never edit" policy (AC4): admins flip a `moderatedAt` kill-switch column and NEVER touch catalog fields.

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `SetTripModerationInput` | Interface | `{ tripId, disabled, actor, reason? }` | `disabled: true` stamps `moderatedAt`; `false` clears it. |
| `SetRouteModerationInput` | Interface | `{ routeId, disabled, actor, reason? }` | Same pattern for routes. |
| `ResolveReportInput` | Interface | `{ reportId, actor }` | Closes an open content report. |
| `setTripModeration` | Async function | `(prisma: PrismaClient, input) => Promise<void>` | `$transaction`: sets/clears `Trip.moderatedAt` + `AdminAuditLog` (`moderate-disable-trip` / `moderate-enable-trip`). |
| `setRouteModeration` | Async function | `(prisma: PrismaClient, input) => Promise<void>` | `$transaction`: sets/clears `Route.moderatedAt` + `AdminAuditLog` (`moderate-disable-route` / `moderate-enable-route`). |
| `resolveReport` | Async function | `(prisma: PrismaClient, input) => Promise<void>` | `$transaction`: updates `ContentReport` status to `'resolved'` with `resolvedBy`/`resolvedAt` + `AdminAuditLog` (`moderate-resolve-report`). |

---

### resetOperatorAdminPassword.ts

Regenerates an operator admin's temp password from the platform-admin CLI (Issue 020, AC3). Atomic `$transaction` with `SELECT ... FOR UPDATE` on the `OperatorUser` row.

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `ResetOperatorAdminPasswordInput` | Interface | `{ operatorUserId, baseUrl, actor }` | Target operator user + base URL for SMS link. |
| `ResetOperatorAdminPasswordResult` | Interface | `{ operatorUserId, phone, sessionsRevoked }` | Confirmation with session revocation count. |
| `resetOperatorAdminPassword` | Async function | `(prisma: PrismaClient, input) => Promise<ResetOperatorAdminPasswordResult>` | `$transaction` with `FOR UPDATE`: sets fresh hashed password, sets `requiresPasswordChange=true`, revokes all live `OperatorSession` rows, writes `AdminAuditLog`. After commit: SMS's the new temp password and writes `NotificationLog`. Throws `operator_user_not_found`. |

---

## Test Files

| Test File | Covers |
|-----------|--------|
| `__tests__/adminService.int.test.ts` | Integration tests (needs live DB) |
| `__tests__/bootstrapSuperAdmin.test.ts` | `bootstrapSuperAdmin` |
| `__tests__/createOperatorAccount.test.ts` | `createOperatorAccount` |
| `__tests__/getActionQueue.test.ts` | `getActionQueue` |
| `__tests__/getApprovalQueue.test.ts` | `getApprovalQueue` |
| `__tests__/getAuditLog.test.ts` | `getAuditLog`, `auditLogToCsv` |
| `__tests__/getCharterDispatchQueue.test.ts` | `getCharterDispatchQueue`, `getApprovedOperatorsForAssign` |
| `__tests__/getLedgerView.test.ts` | `getLedgerView` |
| `__tests__/getModerationQueue.test.ts` | `getOpenReports`, `getModeratedItems` |
| `__tests__/getOperatorDetail.test.ts` | `getOperatorDetail` |
| `__tests__/getPayoutQueue.test.ts` | `getPayoutQueue` |
| `__tests__/getUserDetail.test.ts` | `getCustomerDetail` |
| `__tests__/inviteAdmin.test.ts` | `inviteAdmin` |
| `__tests__/listAllOperators.test.ts` | `listAllOperators` |
| `__tests__/moderation.test.ts` | `resolveReport`, `setRouteModeration`, `setTripModeration` |
| `__tests__/resetAdminTotp.test.ts` | `resetAdminTotp` |
| `__tests__/revokeAdmin.test.ts` | `revokeAdmin` |
| `__tests__/searchUsers.test.ts` | `searchUsers` |
| `__tests__/setAdminRole.test.ts` | `setAdminRole` |
| `__tests__/suspendCustomer.test.ts` | `suspendCustomer`, `reinstateCustomer` |

---

## Cross-Cutting Patterns

- **Prisma-by-param:** Write functions accept `PrismaClient` as a parameter (Next.js-free). Read-only functions default to the app singleton but accept an injectable `PrismaLike` stub surface for unit tests.
- **Audit logging:** Every write operation calls `writeAdminAuditLog(tx, ...)` inside its `$transaction`. PII in args is redacted (`redactPhone()`, `maskAccountNumber()`).
- **Cursor/seek pagination:** All paginated reads use the `(sortKey DESC, id DESC)` seek pattern with `take: limit + 1` to detect `hasMore`, returning `nextCursor` as the opaque last-row id.
- **Concurrency:** Destructive operations (`disableOperator`, `resetOperatorAdminPassword`) use `SELECT ... FOR UPDATE` inside `$transaction` (callback form, not array form).
- **Self-action guards:** Admin mutation functions enforce no-self-* rules (`no_self_revoke`, `no_self_role_change`, `no_self_reset`) checked BEFORE any DB read.
- **BigInt safety:** Money values (GMV, ledger amounts, balance) use BigInt or string serialization to avoid float drift (Issue 016 rule).
