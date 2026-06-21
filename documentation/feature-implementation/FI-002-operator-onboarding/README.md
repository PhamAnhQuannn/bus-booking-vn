# FI-002: Operator Onboarding (Dang ky Nha xe)

> **Status:** DOCUMENTED
> **Last Updated:** 2026-06-20
> **Related:** ADR-003, ADR-004, ADR-014, DS-001, DS-003, FD-021

## Overview

Operator Onboarding is the admin-gated KYB (Know-Your-Business) lifecycle that takes a transport company from public registration through document verification to an APPROVED status enabling search visibility and ticket sales. The platform acts as a marketplace technology intermediary (not a transport business itself), allowing 100% foreign ownership and no transport license of its own, while requiring operators to prove transport regulatory compliance before going live. Multi-tenancy is enforced at the application layer via shared PostgreSQL with `operatorId` FK on all operator-scoped tables and a `withOperatorScope` wrapper in `lib/core/db/tenantScope.ts`.

## Scope & Boundaries

### In Scope

- Operator registration (`/op/register`) -- email, phone, password, company name, entity type
- First-login password change gate (`/op/first-login`) via `requiresPasswordChange` JWT claim
- 5-step KYB wizard (`/op/kyb`): Company Info, Documents, Bank Account, E-Invoice Authorization, Review & Submit
- Admin approval lifecycle: PENDING_REVIEW -> UNDER_REVIEW -> APPROVED | REJECTED | SUSPENDED
- Username generation: `BRAND_ACRONYM-last4phone` (uppercase, diacritics stripped, collision suffix -N)
- OTP proof JWT flow for registration (HS256, 5-min TTL, single-use via Redis SETNX)
- `applicationRef` format: `OP-YYYY-AB12CD`
- License expiry alerts (60-day warning, 7-30 day red, restriction on expired)
- KYB document upload to S3 via signed URL with `StoredObject` metadata
- Operator settings: `autoConfirmBookings`, `notificationPreference`, `bookingReminderHours`

### Out of Scope

- PSP split-settlement: documented in ADR-004 but NOT IMPLEMENTED (central collection used; flagged as potentially requiring SBV license)
- Commission invoice (platform -> operator, monthly B2B): not yet implemented
- `OperatorUser.tempPasswordPlain`: dev-only field; must be removed/encrypted before go-live (Issue 113 blocks 094)
- Subscription billing (SubscriptionPlan/OperatorSubscription): post-launch scope
- Customer auth flows -> [FI-001](../FI-001-core-auth/README.md)
- Fleet management (requires APPROVED status) -> [FI-003](../FI-003-fleet-management/README.md)
- E-Invoice issuance (requires `operatorMst` from KYB) -> [FI-015](../FI-015-e-invoice/README.md)
- Staff RBAC and driver assignment -> [FI-011](../FI-011-staff-management/README.md)
- Notification dispatch infrastructure -> [FI-014](../FI-014-notifications/README.md)

### Bounded Context(s)

**Onboarding / KYB Context** -- Models: `KybDocument`, `PayoutAccount`, `OperatorPickupArea`, `StoredObject`, `Operator`, `OperatorUser`, `OperatorSession`, `OperatorOtpAttempt`, `OperatorSettings`. Services: `lib/onboarding/registerOperator.ts`, `lib/onboarding/operatorStatus.ts`, `lib/onboarding/kyb.ts`.

**Dependencies on other FI features:**
- [FI-001](../FI-001-core-auth/README.md) (Core Auth): Operator realm JWT, CSRF, refresh rotation, `requiresPasswordChange` gate
- [FI-014](../FI-014-notifications/README.md) (Notifications): SMS + email delivery for approval state transitions, OTP dispatch
- [FI-015](../FI-015-e-invoice/README.md) (E-Invoice): `Operator.taxCode` (MST) required for invoice issuance; KYB Step 4 collects MISA authorization

## Key Entities

| Model | Key Columns | Constraints | Notes |
|-------|-------------|-------------|-------|
| Operator | id (CUID PK), legalName, brandName?, contactName?, address?, routesSummary?, provinceCode?, provinceName?, contactPhone, contactEmail, notificationPhone?, status (OperatorStatus default PENDING_REVIEW), rejectionReason?, disabledAt?, applicationRef? (@unique), taxClassification (TaxClassification default company), taxCode?, transportLicenseNumber?, businessRegNumber?, insurancePolicyRef?, createdAt | `@unique` on applicationRef; partial unique on taxCode WHERE NOT NULL | `disabledAt` is back-compat freeze flag synced to status -- NOT source of truth; read `status` instead. `brandName` nullable for pre-2026-06-06 rows |
| OperatorUser | id (CUID PK), operatorId (FK->Operator), username (@unique), phone (@unique), contactPhone, notificationPhone, passwordHash (bcrypt), requiresPasswordChange (default true), displayName, role (OperatorRole default admin), disabledAt?, createdAt, updatedAt, lastBookingsViewedAt? | `@unique` on username, `@unique` on phone | `OperatorUser_phones_differ` CHECK constraint was DROPPED (Issue 020) -- contactPhone and notificationPhone MAY equal phone |
| OperatorSession | id (CUID PK), operatorUserId (FK->OperatorUser), refreshTokenHash (@unique), tokenFamily, rotationCount (default 0), expiresAt, createdAt, revokedAt? | `@unique` on refreshTokenHash | SHA-256 hash of refresh token; family rotation for reuse detection |
| OperatorOtpAttempt | id (CUID PK), phone, codeHash (salted SHA-256), salt, expiresAt, consumed (default false), consumedAt?, attemptCount (default 0), createdAt, ipAddress? | Same dual-semantics as OtpAttempt | Operator-specific OTP; separate from customer OtpAttempt |
| KybDocument | id (CUID PK), operatorId (FK->Operator), type ('business_license'\|'identity'\|'payout_account'), storageKey, status (default 'submitted'), uploadedAt, purgedAt?, expiryDate?, expiryAlertSentAt? | onDelete: Restrict on Operator FK | `purgedAt` = storage object removed (pointer row retained as audit trail). `expiryDate` drives `operatorLicenseAlert` cron |
| StoredObject | id (CUID PK), key (@unique), contentType, sizeBytes, purpose ('kyb_doc'\|'ticket_pdf'), uploadedBy?, createdAt | `@unique` on key | S3 object key; DB stores key, never bytes |
| PayoutAccount | id (CUID PK), operatorId (@unique FK->Operator), bankName, accountNumber (AES-256-GCM encrypted), accountHolderName, verifiedAt?, verifyMethod? ('name_match'\|'micro_deposit'), createdAt, updatedAt | `@unique` on operatorId (1:1) | Any edit resets `verifiedAt = null` (blocks withdrawals until admin re-verifies). Go-live blocker: verify encryption active |
| OperatorSettings | id (CUID PK), operatorId (@unique FK->Operator), autoConfirmBookings (default false), notificationPreference (default 'sms'), bookingReminderHours (default 24), customBrandingText?, updatedAt | `@unique` on operatorId (1:1) | |

**Enums relevant to FI-002:**

| Enum | Values |
|------|--------|
| OperatorStatus | `PENDING_REVIEW`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `SUSPENDED` |
| OperatorRole | `admin`, `staff` |
| TaxClassification | `company`, `individual_household` |

## API Endpoints

| Method | Path | Auth | Description | Status Codes |
|--------|------|------|-------------|--------------|
| POST | `/api/auth/otp/send` | Public (rate-limited) | Send OTP for operator registration (same endpoint as customer; routes by context) | 200, 429, 403 |
| POST | `/api/op/auth/login` | Public (rate-limited) | Username + password login; if `requiresPasswordChange: true` in JWT, Edge redirects to `/op/first-login` | 200, 401, 403 |
| POST | `/api/op/auth/password` | Operator JWT | Change password; mints new JWT with `requiresPasswordChange: false` in same `$transaction` | 200, 422 |
| POST | `/api/op/auth/refresh` | Operator JWT (refresh) + X-CSRF-Token | Rotate refresh token; 15-min access JWT -- long scripts must call this periodically | 200, 401 |
| POST | `/api/op/auth/logout` | Operator JWT | Revoke operator session | 200 |
| POST | `/api/op/auth/forgot-password` | Public | Operator password-reset OTP flow | 200, 429 |
| POST | `/api/op/kyb-documents` | Operator JWT | Upload KYB doc (type: business_license, identity, payout_account); file uploaded to S3 via signed URL | 201, 422, 413 |
| PATCH | `/api/op/payout-account` | Operator JWT | Update bank account; any edit resets `verifiedAt = null` | 200, 422 |
| GET | `/api/op/settings` | Operator JWT | Get operator settings | 200 |
| PATCH | `/api/op/settings` | Operator JWT | Update settings (autoConfirmBookings, notificationPreference, bookingReminderHours, customBrandingText) | 200, 422 |
| GET | `/api/admin/operators` | Admin JWT | List operators with status filter | 200 |
| POST | `/api/admin/operators` | Admin JWT | Provision operator (CLI or admin panel) | 201 |
| POST | `/api/admin/operators/:id/approve` | Admin JWT | UNDER_REVIEW -> APPROVED; clears `disabledAt`; sends SMS + email | 200, 422 |
| POST | `/api/admin/operators/:id/reject` | Admin JWT | UNDER_REVIEW -> REJECTED; sets `rejectionReason` | 200, 422 |
| POST | `/api/admin/operators/:id/suspend` | Admin JWT | APPROVED -> SUSPENDED; sets `disabledAt = now()` | 200, 422 |
| POST | `/api/admin/operators/:id/reinstate` | Admin JWT | SUSPENDED -> APPROVED; clears `disabledAt` | 200, 422 |

## State Machine

### Operator Approval Lifecycle

```
States: PENDING_REVIEW | UNDER_REVIEW | APPROVED | REJECTED | SUSPENDED

Transitions:
  PENDING_REVIEW -> UNDER_REVIEW   (admin starts review; SELECT FOR UPDATE on Operator)
  UNDER_REVIEW   -> APPROVED       (admin approves; clears disabledAt; SMS + email sent)
  UNDER_REVIEW   -> REJECTED       (admin rejects; sets rejectionReason)
  REJECTED       -> PENDING_REVIEW (operator resubmits; clears rejectionReason)
  APPROVED       -> SUSPENDED      (admin suspends; sets disabledAt = NOW())
  SUSPENDED      -> APPROVED       (admin reinstates; clears disabledAt)
```

**Side effects per transition:**
- SMS + email `NotificationLog` rows enqueued
- `AdminAuditLog` entry written in same `$transaction`

**Capability Map by Status:**

| Status | Login | Dashboard | Buses/Routes/Trips | Search Visible | Sell Tickets | Edit KYB / Resubmit |
|--------|-------|-----------|-------------------|----------------|--------------|----------------------|
| PENDING_REVIEW | Yes | Yes (limited) | No | No | No | Yes |
| UNDER_REVIEW | Yes | Yes (limited) | No | No | No | No |
| APPROVED | Yes | Yes (full) | Yes | Yes | Yes | Yes |
| REJECTED | Yes | Yes (limited) | No | No | No | Yes |
| SUSPENDED | Yes | Yes (read-only) | No | No | No | No |

**Implementation:** `lib/onboarding/operatorStatus.ts` -> `transitionOperatorStatus`:
1. `$transaction` + `SELECT FOR UPDATE` on Operator row
2. Validate transition via `LEGAL_OPERATOR_TRANSITIONS` map
3. Apply side effects per target state (clear/set `disabledAt`, `rejectionReason`)
4. Enqueue NotificationLog (SMS + email)
5. Write AdminAuditLog entry when `actor` is present

## Business Rules & Invariants

1. **I1 -- Concurrency Control** -- `transitionOperatorStatus` uses `$transaction` (callback form) with `SELECT ... FOR UPDATE` on the Operator row. Prevents concurrent approval race conditions.

2. **ADR-004 D6 -- operatorId from JWT** -- `operatorId` is ALWAYS derived from the JWT claim via `requireOperatorAuth`, NEVER accepted from the request body. `withOperatorScope` in `lib/core/db/tenantScope.ts` enforces tenant isolation. Zod `.strip()` removes unrecognized keys.

3. **ADR-004 -- Approval Gates** -- Only APPROVED operators appear in search (`SEARCH_VISIBLE_STATUSES`) and can sell tickets (`BOOKABLE_STATUSES`). Enforced in `searchTrips.ts` Operator.status gate.

4. **AUTH-1 -- requiresPasswordChange Edge Gate** -- `requiresPasswordChange: true` in JWT claim triggers Edge middleware exact-match allowlist redirect to `/op/first-login`. NOT `startsWith` -- prevents `/op/first-login-bypass` sneak-throughs. Fresh JWT with `requiresPasswordChange: false` minted in same `$transaction` as password update.

5. **AUTH-2 -- Token Family Rotation** -- Consumed refresh token replay revokes the entire token family. SHA-256 hash stored in `OperatorSession.refreshTokenHash`.

6. **COMMISSION -- Platform Fee** -- Default platform fee: 6% (`ratePpm = 60000`). Maximum override: 20% (`MAX_FEE_OVERRIDE_PPM = 200000`). Stored in `FeeConfig` table; effective-dated, append-audited.

7. **TAX-CLASS -- Tax Classification** -- `company` = self-files CIT; `individual_household` = ~3% VAT + ~1.5% PIT withheld from 1 Jul 2026 (E-Commerce Law 2025). Displayed at registration step; stored in `Operator.taxClassification`.

8. **KYB-1 -- Transport License** -- BGTVT transport license mandatory; 5-7 years validity. `operatorLicenseAlert` cron checks `expiryDate <= NOW() + 60 days` on KybDocument rows.

9. **KYB-2 -- Passenger Insurance** -- Mandatory per Decree 03/2021 (amended 67/2023). Operator's responsibility; KYB document upload required.

10. **KYB-3 -- Business Registration Certificate** -- ERC mandatory; collected in KYB wizard Step 2.

11. **KYB-PURGE** -- KybDocument storage objects purged 90+ days after operator REJECTED/SUSPENDED. `kybDocumentPurge` cron sets `purgedAt` marker; pointer row retained as audit trail.

12. **I9 -- No Raw Phone in Payload** -- `NotificationLog.recipient` carries phone number for approval notifications. The `payload` JSON field must NOT contain the phone number.

## Frontend Surfaces

| Page | Path | Key Components | Notes |
|------|------|----------------|-------|
| Registration | `/op/register` | Registration form: Email, Phone, Password, Company name, Entity type selector with tax explanation | Entity type: company / individual_household |
| First-Login Gate | `/op/first-login` | Current temp password, new password, confirm new password, strength meter | Edge middleware exact-match allowlist; min 8 chars, 1 uppercase, 1 digit, 1 special |
| KYB Wizard | `/op/kyb` | 5-step horizontal stepper (desktop) / vertical stepper (mobile) | See step detail below |
| Dashboard | `/op/dashboard` | KYB checklist widget, status banner | Shows step completion progress |
| Settings | `/op/settings` | autoConfirmBookings, notification preferences, custom branding | |

### 5-Step KYB Wizard

| Step | Content |
|------|---------|
| 1. Company Info (Thong tin doanh nghiep) | Legal name, brand name, address, province, contact |
| 2. Documents (Ho so giay to) | ERC (mandatory), transport license (mandatory), passenger insurance (mandatory), route authorization (optional) |
| 3. Bank Account (Tai khoan ngan hang) | bankName, accountNumber, accountHolderName |
| 4. E-Invoice Authorization (Uy quyen hoa don) | MISA customer code + MISA API key + authorization checkbox per Decree 123/2020 Art. 17 |
| 5. Review & Submit (Xem lai va nop) | Summary before submission; transitions to PENDING_REVIEW |

### Status Banners (shown at `/op/dashboard`)

| Status | Banner | CTA |
|--------|--------|-----|
| PENDING_REVIEW | Amber -- "Dang cho xet duyet" | None |
| UNDER_REVIEW | Blue -- "Dang duoc xem xet" | None |
| APPROVED | No banner | -- |
| REJECTED | Red -- reason shown | "Nop lai" (resubmit) |
| SUSPENDED | Red -- "Tai khoan bi dinh chi" | Contact support |

### License Expiry Banners

- 60+ days remaining: no banner
- 7-60 days remaining: warning banner (amber)
- 0-7 days remaining: red banner
- Expired: restriction banner (operations blocked)

### Operator Personas

| Persona | Size | Tech Literacy | Notes |
|---------|------|---------------|-------|
| "Bac Tam" (Micro) | 1-5 buses, 60-70% of operators | Very low | Zalo-based support critical |
| Mid-size | 6-30 buses, 25-30% | Medium | MISA AMIS already in use; KYB Step 4 familiar |
| VIP Limousine | Varies | Medium-high | Tourist corridors |
| FUTA-Scale | 50-800+ buses | High | API-first; REST/webhook integration |
| Cooperative | 10-60 buses | Low-medium | Fixed regulated fares |

## Regulatory Requirements

| Regulation | Requirement | Status |
|------------|-------------|--------|
| Transport Business License (Giay phep kinh doanh van tai) | From provincial So GTVT; 5-7 years; required for KYB | KYB document upload required |
| Passenger insurance | Mandatory per Decree 03/2021 (amended 67/2023) | KYB document upload required |
| Fixed-route service authorization | Route-specific approval from provincial transport dept | `routeAuthorization` document optional in KYB but legally required for fixed routes |
| Platform classification | Technology platform (not transport business) = 100% foreign ownership; VeXeRe precedent | No transport license required for platform itself |
| Tax classification disclosure | `individual_household` -> 3% VAT + 1.5% PIT withheld from 1 Jul 2026 (E-Commerce Law 2025) | Displayed at registration; stored in `Operator.taxClassification` |
| Decree 123/2020 Art. 17 | Written authorization agreement for platform to issue e-invoices on operator's behalf | KYB wizard Step 4 checkbox; authorization template NOT YET CREATED (go-live blocker) |
| Tax withholding | `calcWithholding()` and `applyWithholding()` absent | NOT YET IMPLEMENTED (go-live blocker per DS-006) |
| PDPL 2025 | Soft-delete with PII anonymization; data residency in Vietnam-hosted PostgreSQL | `Customer.deletedAt`/`anonymizedAt`; `piiAnonymization` cron |
| SBV license for split-settlement | PSP routing directly to operator's account may require SBV intermediary license | OPEN -- current implementation uses central collection |

## Testing Strategy

### Unit Tests

- `requiresPasswordChange` JWT claim encoding/decoding
- Username generation: diacritics strip, collision suffix logic
- `LEGAL_OPERATOR_TRANSITIONS` map: verify all valid and invalid transitions
- OtpProof JWT: single-use via Redis SETNX mock
- `applicationRef` generation and uniqueness

### Integration Tests

- `transitionOperatorStatus` with real DB: `SELECT FOR UPDATE` semantics, all 6 legal transitions, NotificationLog + AdminAuditLog written atomically
- `OperatorUser_phones_differ` constraint drop verified (contactPhone = notificationPhone = phone INSERT succeeds)
- `requiresPasswordChange = false` minted in same `$transaction` as password update
- NOT NULL column checklist (Issue 012): `contactPhone` + `notificationPhone` must appear in all test fixtures
- `createStaff`/`createOperator` INSERT paths must not trigger dropped CHECK constraint
- KYB document upload: `StoredObject` created atomically with `KybDocument`

### E2E Tests

- Full registration -> first-login gate -> KYB wizard -> PENDING_REVIEW status
- Admin approval -> status banner changes -> fleet management unlock
- License expiry warning banner (seed `expiryDate` within 60 days)
- `primeCsrf()` before all POST mutations (Issue 007 requirement)
- PII placeholders: `+8490xxxxxx9` / `+8490xxxxxx8` format (not all-digit -- trips PII regex)
- Hex string validity in crypto mocks: 64-char valid hex for SHA-256 comparisons

## Cross-References

- **Architecture Decisions:** [ADR-003](../../architecture-decisions/ADR-003-auth-architecture/README.md), [ADR-004](../../architecture-decisions/ADR-004-multi-tenancy/README.md), [ADR-014](../../architecture-decisions/ADR-014-einvoice/README.md)
- **Design Specifications:** [DS-001](../../design-specifications/DS-001-data-model/README.md) (sections 2.2, 2.11), [DS-003](../../design-specifications/DS-003-api-contract/README.md) (sections 7.1, 8.1)
- **Frontend Design:** [FD-021](../../frontend-design/FD-021-operator-onboarding/README.md)
- **Business/Domain:** [bounded-contexts.md](../../business/domain-model/bounded-contexts.md), [state-machines.md](../../business/domain-model/state-machines.md) (Section 5), [event-flows.md](../../business/domain-model/event-flows.md) (Flow 5)
- **Regulatory:** [transport.md](../../business/regulatory/transport.md)
- **Scaffolding:** [SI-005](../../scaffolding-infra/SI-005-testing-strategy/README.md)
- **Related FIs:** [FI-001](../FI-001-core-auth/README.md) (auth realm), [FI-003](../FI-003-fleet-management/README.md) (requires APPROVED), [FI-011](../FI-011-staff-management/README.md) (staff provisioning), [FI-014](../FI-014-notifications/README.md) (SMS/email dispatch), [FI-015](../FI-015-e-invoice/README.md) (MST from KYB)

## Known Gaps & Open Questions

- **HIGH -- PSP split-settlement NOT IMPLEMENTED**: ADR-004 documents split-settlement but actual implementation uses central collection. SBV intermediary license may be required. Go-live blocker.
- **HIGH -- E-invoice authorization template not created**: Decree 123/2020 Art. 17 requires written agreement per operator before any invoice is issued on their behalf. Go-live blocker.
- **HIGH -- Tax withholding not implemented**: `calcWithholding()` and `applyWithholding()` absent (DS-006 gap). Go-live blocker for `individual_household` operators from Jul 2026.
- **HIGH -- `tempPasswordPlain` field**: Dev-only field on `OperatorUser`. Must be removed or encrypted before go-live (Issue 113 blocks 094).
- **HIGH -- `PayoutAccount.accountNumber` encryption**: Must verify AES-256-GCM encryption is active before production.
- **MEDIUM -- Commission invoice**: Platform -> operator monthly B2B invoice not yet implemented. Required for platform's own tax compliance.
- **MEDIUM -- Route authorization document**: Marked optional in KYB wizard but legally required for fixed-route services. Legal review needed on whether it should be mandatory.
- **MEDIUM -- `brandName` nullable**: Pre-2026-06-06 rows have NULL brandName, which prevents username generation. Migration or seed fix needed.
- **LOW -- OTP dispatch conflict**: ADR-013 says cron-only for non-OTP notifications; actual operator OTP flow (forgot-password) uses inline `sendSms()` in `lib/auth/operatorOtp.ts`.
- **LOW -- Rate limiter fails OPEN**: Redis/Upstash downtime means no rate limiting; no circuit-breaker or in-memory fallback.
