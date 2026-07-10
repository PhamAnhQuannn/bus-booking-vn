# FI-013: Customer Account (Tai khoan khach hang)

> **Status:** DOCUMENTED
> **Last Updated:** 2026-06-20
> **Related:** ADR-008, ADR-014, DS-001, DS-015, FD-019

## Overview

Customer Account covers the lifecycle of a registered customer on the platform: profile management, consent preference center, Data Subject Access Request (DSAR) self-service portal, privacy policy disclosure, account deletion with 72-hour cooling-off period, and scheduled PII anonymization after the 24-month post-deletion retention period. This feature implements Vietnam's PDPL 2025 (No. 91/2025/QH15) data subject rights (access, rectification, erasure, portability, consent withdrawal) and is a legal launch gate -- the platform cannot process personal data without compliant consent collection, a published privacy policy, and a functional DSAR portal.

## Scope & Boundaries

### In Scope

- Customer profile (phone, email, displayName) -- view and update
- Consent banner (first-visit, persistent bottom bar)
- Registration consent (inline checkboxes during OTP registration)
- Consent preference center (`/account/settings` -- per-purpose toggle UI)
- Consent withdrawal endpoint per purpose
- DSAR self-service portal (submit access/export/deletion/rectification/consent-withdrawal requests)
- DSAR status tracking with statutory deadline countdown
- Data export bundle (JSON) generation and 7-day signed URL download
- Account deletion flow: soft-delete, 72-hour cooling-off period, session revocation, hold expiry, `awaiting_payment` booking cancellation, scheduled anonymization
- PII anonymization cron (`piiAnonymization`): after 24-month post-deletion retention period
- Privacy policy page (`/privacy`)
- DPO contact display

### Out of Scope

- OTP auth flow -> [FI-001](../FI-001-core-auth/README.md)
- Booking creation and consent capture at booking initiation -> [FI-007](../FI-007-booking-flow/README.md) (Booking Context -- `no_refund` + `pii_storage` ConsentRecord written at `POST /api/bookings/initiate`)
- Admin DSAR management UI -> [FI-012](../FI-012-admin-console/README.md)
- Complaint handling (Complaint model, `/api/complaints`) -> separate FI
- Customer suspension by admin -> [FI-012](../FI-012-admin-console/README.md) (Admin Context)
- Guest booking backfill (`attachGuestBookingByPhone`) -> [FI-001](../FI-001-core-auth/README.md) registration side effect

### Bounded Context(s)

- **Auth Context (Customer Realm):** Account state management, session lifecycle
- **Admin/Compliance Context:** DSAR processing by admin staff
- **Booking Context:** Consent collection at booking initiation (`ConsentRecord` rows written at `POST /api/bookings/initiate`)

**Dependencies on other FI features:**
- [FI-001](../FI-001-core-auth/README.md) (Core Auth): customer login required for authenticated account management endpoints; `requireCustomerAuth` guard; session revocation on deletion
- Booking Context: `ConsentRecord` model (append-only, immutable); `Booking` model for export bundle and anonymization skip conditions
- Admin DSAR queue ([FI-012](../FI-012-admin-console/README.md)): `DataRequest`/`DsarRequest` model processed by admin

## Key Entities

| Model | Key Columns | Constraints | Notes |
|-------|-------------|-------------|-------|
| Customer | id (CUID PK), phone (String?), email (String?), passwordHash (String?), displayName (String?), createdAt, updatedAt, lastLoginAt (DateTime?), deletedAt (DateTime?), anonymizedAt (DateTime?), suspendedAt (DateTime?) | `@unique` on phone (NULL-tolerant); partial unique on email WHERE NOT NULL | Soft-delete: `deletedAt=NOW()`, phone->NULL. Suspension: `suspendedAt` non-null -> fails `requireCustomerAuth`. `anonymizedAt` set at deletion time; PII fields replaced at 24-month mark by cron. |
| Session | id (CUID PK), customerId (String FK->Customer), refreshTokenHash (String @unique), tokenFamily (String), rotationCount (Int default 0), expiresAt, createdAt, revokedAt (DateTime?) | Cascade on Customer delete | All sessions revoked when customer deletes account |
| ConsentRecord | id (CUID PK), bookingId (String @db.Uuid FK->Booking cascade), consentType (String), version (String), consentedAt (DateTime default now()) | Immutability: BEFORE UPDATE trigger blocks modification; DELETE allowed (Booking CASCADE propagates) | Documented consentType union: `no_refund`, `pii_storage`, `marketing_sms`, `marketing_email`, `marketing_zns`. Append-only: withdrawal = new row with appropriate type (not mutation). |
| DataRequest | id (CUID PK), customerId (String? FK->Customer onDelete: SetNull), requestType (DataRequestType), status (DataRequestStatus default received), requestedAt, acknowledgedAt (DateTime?), completedAt (DateTime?), handledBy (String?), responseRef (String?), notes (String?), createdAt | Indexes: `[status]`, `[customerId]` | GLOBAL entity (admin-managed, not tenant-scoped). DataRequestType: `access, rectify, erase, port`. DataRequestStatus: `received, processing, completed, rejected`. |
| DsarRequest | id (CUID PK), customerId (String FK->Customer), type (DsarType), status (DsarStatus), reason (String?), responseUrl (String?), completedAt (DateTime?), rejectedReason (String?), deadline (DateTime = createdAt+30 days), processedBy (String?), createdAt, updatedAt | Indexes: `[status, deadline]`, `[customerId]` | DsarType: `ACCESS, EXPORT, DELETION, RECTIFICATION, CONSENT_WITHDRAWAL, OBJECTION`. DsarStatus: `SUBMITTED, PROCESSING, COMPLETED, REJECTED`. `responseUrl` = 7-day signed URL to export file. Rate limit: max 3 submissions per 30-day period. |
| Hold | id (CUID PK), tripId, ticketCount, customerPhone, customerName, customerEmail?, expiresAt, status (HoldStatus default active), pickupKind, pickupAreaId?, pickupAreaLabel?, pickupDetail?, customPickupRequested | -- | On deletion: all active holds set `status='expired'` immediately |
| Booking | id (@db.Uuid PK), bookingRef, confirmationToken, tripId, holdId, customerId (String? FK->Customer onDelete: SetNull), buyerName, buyerPhone, buyerEmail?, ticketCount, totalVnd, paymentMethod, status (BookingStatus), snapshotAnonymizedAt (DateTime?), ... | Customer FK OnDelete SetNull | `snapshotAnonymizedAt` = PII scrub marker. Anonymization replaces `buyerName`, `buyerPhone`. Financial columns (`totalVnd`, ledger amounts) retained. Paid upcoming bookings NOT cancelled on deletion. `awaiting_payment` bookings cancelled on deletion. |
| NotificationLog | id, recipient (String NOT NULL), payload (String NOT NULL), template, channel, status, scheduledFor (DateTime?), ... | I9: recipient is sole PII column | `recipient` -> `'ANONYMIZED'` at anonymization time |

**Consent Purposes (expanded, per FD-019):**

| Purpose | Required for Service | Withdrawable |
|---------|---------------------|-------------|
| `booking_processing` | Yes | Only via account deletion |
| `payment_processing` | Yes | Only via account deletion |
| `marketing_sms` | No | Anytime |
| `marketing_email` | No | Anytime |
| `analytics` | No | Anytime |
| `third_party_sharing` | No | Anytime |

**Anonymization Values (DS-015 section 8.3):**

| Entity | Field | Anonymized Value |
|--------|-------|-----------------|
| Customer | phone | `'ANONYMIZED'` |
| Customer | email | `'anon_{id}@deleted.local'` |
| Customer | fullName | `'Deleted User'` |
| Booking | passengerName | `'ANONYMIZED'` |
| Booking | passengerPhone | `'ANONYMIZED'` |
| NotificationLog | recipient | `'ANONYMIZED'` |

## API Endpoints

| Method | Path | Auth | Description | Status Codes |
|--------|------|------|-------------|--------------|
| GET | `/api/customers/me` | Customer JWT | Fetch own profile (phone masked to last 4 in non-owner contexts) | 200, 401 |
| PATCH | `/api/customers/me` | Customer JWT | Update profile (displayName, email) | 200, 400, 401 |
| POST | `/api/customers/me/consent/withdraw` | Customer JWT | Withdraw consent for specific purpose; creates new ConsentRecord{granted:false} | 200, 422 (service-required purpose) |
| POST | `/api/customers/me/dsar` | Customer JWT | Submit DSAR request. Body: `{type: 'ACCESS'\|'EXPORT'\|'DELETION'\|'OBJECTION', reason?: string}`. Sets `deadline = createdAt + 30 days`. Rate limit: max 3 per 30 days | 201, 429 (rate limit) |
| GET | `/api/customers/me/dsar` | Customer JWT | List own DSAR requests | 200 |
| GET | `/api/customers/me/dsar/{id}/download` | Customer JWT | Download export file (redirect to 7-day signed URL) | 302 (redirect), 404 (not found/expired) |
| DELETE | `/api/customers/me/account` | Customer JWT | Request account deletion (sugar for `POST /dsar {type:'DELETION'}`) | 200, 401 |
| DELETE | `/api/auth/account` | Customer JWT | Soft-delete: `Customer.deletedAt=now()`, `anonymizedAt=now()`, phone->NULL, all sessions revoked. Financial records retained. | 200, 401 |
| POST | `/api/data-requests` | Customer JWT | Submit DSAR (DS-003 endpoint). Body: `{requestType: 'access'\|'rectify'\|'erase'\|'port'}` | 201, 401 |
| GET | `/api/admin/data-requests` | Admin JWT | DSAR processing queue with statutory countdown timers | 200, 401 |
| PATCH | `/api/admin/data-requests/:id` | Admin JWT | Process DSAR: `{status: 'processing'\|'completed'\|'rejected', responseRef?, notes?}` | 200, 401, 404 |
| GET | `/api/admin/dsar` | Admin JWT | List all DSARs filtered by status/type/deadline | 200 |
| GET | `/api/admin/dsar/{id}` | Admin JWT + TOTP | Detail with customer context | 200 |
| PATCH | `/api/admin/dsar/{id}/process` | Admin JWT + TOTP | Start processing | 200 |
| PATCH | `/api/admin/dsar/{id}/complete` | Admin JWT + TOTP | Mark complete (with responseUrl for exports) | 200 |
| PATCH | `/api/admin/dsar/{id}/reject` | Admin JWT + TOTP | Reject with reason | 200 |

### Statutory Deadlines (PDPL 2025)

| Right | Deadline |
|-------|----------|
| Access | 10 days |
| Correction | 10 days |
| Deletion | 20 days |
| Consent withdrawal | 15 days |
| Portability | 30 days |

### Cron Jobs

| Route | Job | Schedule | Predicate |
|-------|-----|----------|-----------|
| `/api/cron/pii-anonymization` | piiAnonymization | Daily | `deletedAt IS NOT NULL AND deletedAt < NOW() - INTERVAL '24 months' AND phone != 'ANONYMIZED'` batch 100, `FOR UPDATE SKIP LOCKED` |

## State Machine

This feature does not have a single dedicated state machine. The relevant state transitions are:

### Customer Lifecycle

| State | Indicator | Entry Trigger |
|-------|-----------|--------------|
| Active | `deletedAt IS NULL AND suspendedAt IS NULL` | Registration |
| Suspended | `suspendedAt IS NOT NULL` | Admin action (`lib/admin/suspendCustomer.ts`) |
| Deleted (pending anonymization) | `deletedAt IS NOT NULL` | Account deletion request approved |
| Anonymized | `phone = 'ANONYMIZED'` | `piiAnonymization` cron after 24-month retention period |

### DSAR Status Machine

| From | To | Trigger | Guard |
|------|----|---------|-------|
| SUBMITTED | PROCESSING | Admin starts processing | Admin JWT + TOTP required |
| PROCESSING | COMPLETED | Admin marks complete | responseUrl set for exports |
| PROCESSING | REJECTED | Admin rejects | rejectedReason required |

### Deletion Flow Immediate Actions (inside `$transaction`)

1. Set `Customer.deletedAt = NOW()`
2. Revoke all active sessions (delete session rows or blacklist JWT)
3. Expire all active holds immediately (`Hold.status = 'expired'`)
4. Cancel bookings in `awaiting_payment` state (no payment received)
5. Create `ConsentRecord` entries withdrawing all optional consents

**Preserved Data (Service Obligations):**
- Paid bookings for upcoming trips: NOT cancelled (service obligation remains)
- Completed bookings: preserved for financial audit trail (anonymized later)
- LedgerEntry / EInvoice: immutable, preserved for 10-year retention
- Active refunds / chargebacks: preserved until resolution

## Business Rules & Invariants

1. **ConsentRecord Immutability (I8 pattern)** -- `ConsentRecord` is append-only, protected by BEFORE UPDATE trigger (`consent_record_immutable()`). UPDATE is blocked; DELETE is allowed (Booking CASCADE propagates). Withdrawing consent = new `ConsentRecord` row with `granted: false`, never mutation of existing row. Current consent check: `findFirst({ where: { customerId, purpose }, orderBy: { createdAt: 'desc' } })`.

2. **No Pre-Ticked Consent Boxes (PDPL 2025 Art. 9)** -- All optional consent checkboxes default to OFF/unchecked. Service-required purposes (`booking_processing`, `payment_processing`) shown as always-on with lock icon -- non-toggleable. Enforcement: FD-019 UI requirement; verified server-side by never assuming implicit consent.

3. **Per-Purpose Granular Consent (Decree 91/2020 / PDPL 2025)** -- Each consent purpose is a separate ConsentRecord row -- no "agree to all" bundle. Marketing consent (`marketing_sms`, `marketing_email`, `marketing_zns`) requires explicit separate opt-in. Enforcement: application code at booking initiation and consent banner.

4. **DSAR Rate Limit** -- Maximum 3 DSAR submissions per customer per 30-day period (prevent abuse). Enforcement: application rate limiting logic.

5. **Service-Required Consent Withdrawal Protection** -- Withdrawing `booking_processing` or `payment_processing` returns HTTP 422 with message: "Cannot withdraw consent for required processing. To stop all processing, request account deletion." Enforcement: `POST /api/customers/me/consent/withdraw` handler.

6. **72-Hour Deletion Cooling-Off** -- After deletion submission, account enters 72-hour cooling-off period. Customer can cancel during this window; after 72 hours, deletion proceeds automatically. Paid bookings for upcoming trips are NOT cancelled -- service obligation remains.

7. **PII Anonymization Skip Conditions (DS-015 section 8.4)** -- Customer has bookings with active refunds (`Refund.status IN ('requested','processing')`), customer has active chargebacks, or customer has upcoming paid trips (`Booking.status = 'paid' AND Trip.departureAt > NOW()`).

8. **Retention-Exempt Entities** -- LedgerEntry (financial audit, Accounting Law, 10 years), EInvoice (tax records, Decree 123/2020, 10 years), ConsentRecord (proof of lawful processing basis, never anonymized), AdminAuditLog (platform audit trail, 10 years).

9. **I9 -- No Raw Phone in NotificationLog Payload** -- `NotificationLog.recipient` is the sole PII column; `payload` must never contain phone numbers. `recipient` -> `'ANONYMIZED'` at anonymization time.

## Frontend Surfaces

| Page | Path | Key Components | Notes |
|------|------|----------------|-------|
| Consent Banner | (all pages, first visit) | Persistent bottom bar; "Chap nhan tat ca", "Tu choi tat ca", "Tuy chinh" buttons | NOT modal, does not block page interaction; per-purpose toggles when expanded; all optional default OFF |
| Registration Consent | `/register` | Inline checkboxes below registration fields | Service-required: checked + disabled + "(bat buoc)" label; optional: unchecked by default |
| Consent Preference Center | `/account/settings` > "Quyen rieng tu" | "Muc dich bat buoc" section (lock icon), "Muc dich tuy chon" section (toggles) | Toggle OFF -> `POST /api/customers/me/consent/withdraw`; "Luu thay doi" CTA |
| Privacy Policy | `/privacy` | Public, no auth; Vietnamese language with proper diacritics | Sections: Gioi thieu, Du lieu thu thap, Muc dich xu ly, Thoi gian luu tru, Chia se voi ben thu ba, Quyen cua ban, Chuyen du lieu ra nuoc ngoai, Bao mat du lieu, Lien he DPO, Cap nhat chinh sach |
| DSAR Portal | `/account/settings` > "Quyen du lieu" | Request form (radio: Truy cap/Xuat du lieu/Chinh sua/Xoa/Rut dong y); status list with deadline countdown | Color-coded countdown: >5d default, 3-5d amber, 1-2d red, overdue red+alert; export download "Tai xuong" button with 7-day signed URL |
| Account Deletion | `/account/settings` > deletion flow | Consequence list; type "XOA" to confirm; 72-hour cancellation banner | Post-submission: "Tai khoan se bi xoa vao DD/MM/YYYY luc HH:MM. [Huy yeu cau xoa]" |
| DPO Contact | `/privacy`, `/account/settings`, footer | Full section on privacy page; link on settings; footer link "Bao mat du lieu: [email]" | Name/title, email, phone, address |

### Consent Withdrawal Consequence Messages

| Purpose | Vietnamese Message |
|---------|-------------------|
| `marketing_sms` | Ban se khong nhan tin nhan quang cao nua. Tin nhan dat ve va OTP khong bi anh huong. |
| `marketing_email` | Ban se khong nhan email quang cao nua. Email xac nhan dat ve khong bi anh huong. |
| `analytics` | Du lieu su dung an danh se khong duoc thu thap. |
| `third_party_sharing` | Thong tin ca nhan se khong duoc chia se voi doi tac phan phoi. |

## Regulatory Requirements

| Law/Decree | Requirement | Impact |
|------------|-------------|--------|
| PDPL 2025 Art. 9 (Access) | 30 days (10 days per DS-003) response deadline | Data export JSON bundle via DSAR |
| PDPL 2025 Art. 10 (Rectification) | 30 days (10 days per DS-003) response deadline | Profile update endpoint |
| PDPL 2025 Art. 11 (Erasure) | 30 days (20 days per DS-003) response deadline | Soft-delete + scheduled anonymization |
| PDPL 2025 Art. 12 (Portability) | 30 days response deadline | Same JSON export, machine-readable |
| PDPL 2025 Art. 9 (Consent withdrawal) | 15 days response deadline | `POST /api/customers/me/consent/withdraw` |
| PDPL 2025 Art. 13 (Object to processing) | 30 days response deadline | DSAR type=OBJECTION (processing halt + admin review) |
| PDPL 2025 Art. 9 (Consent) | No pre-ticked boxes; separate consent per purpose; silence/inactivity is NOT consent; log timestamp, version, user ID, purpose per consent event | Consent banner + preference center + ConsentRecord model |
| PDPL 2025 Art. 20 | Children (<16): parental consent required | Age not currently collected -- GAP |
| Decree 53/2022 (Data Residency) | All customer PII on Neon (Singapore). CDTIA filing required and accepted (ADR-020 D11). Resend (US email) remains potential CDTIA obligation | CDTIA filing required for Neon + Upstash + Vercel; status still open for Resend |
| PDPL 2025 (Breach) | 72h to MPS A05; 24h for cybersecurity attacks; SBV if payment data | Breach notification runbook |
| Consumer Protection Law 2023 Art. 29 | Right to cancel remote contracts within 3 working days | Legal opinion pending on "service already performed" exception |
| Decree 123/2020 + Decree 70/2025 | Payment records / invoices: 10-year retention | EInvoice, LedgerEntry retention-exempt from anonymization |
| Accounting Law | Booking records: 5-year retention | Financial columns retained |

### Data Retention Schedules

| Category | Retention | Legal Basis |
|----------|-----------|------------|
| Booking records | 5 years | Accounting Law |
| Payment records / invoices | 10 years | Decree 123/2020, Decree 70/2025 |
| OTP attempt logs | 90 days | Security (internal policy) |
| Identity data post-deletion | Delete within 10-20 working days | PDPL 2025 Art. 14 |
| Marketing consent records | Duration of consent + 1 year | Audit trail |
| Financial transaction logs | 5-10 years | AML/CTF regulations |
| Location data (GPS) | Session only | Data minimization |
| Behavioral/analytics data | 13 months | Cookie consent best practice |
| Breach records | 5 years | PDPL 2025 |

### Third-Party Data Sharing Inventory

| Third Party | Data Shared | Purpose | PDPL Basis |
|-------------|------------|---------|-----------|
| eSMS.vn | Phone number | OTP + transactional SMS | Contract performance |
| Resend | Email address | Transactional email | Contract performance |
| MISA meInvoice | Name, booking details | E-invoice issuance | Legal obligation |
| VNPay / MoMo | Phone (hashed in some flows) | Payment processing | Contract performance |
| Cloudflare | Request IP, user agent | CDN | Legitimate interest |

## Testing Strategy

### Unit Tests

- Consent purpose validation: withdrawable vs service-required distinction
- DSAR deadline calculation: `createdAt + 30 days` with correct timezone handling
- Anonymization value mapping: correct replacement values per entity
- Retention period date math: 24-month post-deletion window

### Integration Tests

- ConsentRecord immutability trigger: `prisma.consentRecord.update(...)` must throw (trigger blocks it); `prisma.consentRecord.delete(...)` succeeds via Booking CASCADE (real DB required -- trigger only fires against PostgreSQL)
- Consent withdrawal of service-required purpose: returns 422 with exact error message
- DSAR rate limit: 4th submission in 30 days -> 429
- `piiAnonymization` cron: customer with `deletedAt < NOW() - 24 months` fields anonymized; customer with active refund skipped; customer with upcoming paid trip skipped; LedgerEntry amount NOT anonymized (retention-exempt); ConsentRecord NOT anonymized
- `piiAnonymization` cron uses `FOR UPDATE SKIP LOCKED` -- concurrent-write test needed to verify skip-locked behavior under parallel workers
- Soft-delete cascade: on account deletion, `Hold.status` set to `expired`; `Booking` with `status='awaiting_payment'` -> `status='cancelled'`; `Booking` with `status='paid' AND Trip.departureAt > NOW()` preserved
- Export JSON bundle: verify all DS-015 section 5.2 exclusions are NOT included (LedgerEntry, AdminAuditLog, EInvoice, OtpAttempt raw codes)

### E2E Tests

- Consent banner on first visit -> "Chap nhan tat ca" creates ConsentRecord rows per purpose
- Consent preference center toggle withdrawal -> ConsentRecord{granted:false} created
- DSAR submission flow -> status tracking with deadline countdown
- Account deletion 72-hour confirmation flow
- Export download with signed URL
- Privacy policy page accessible without authentication
- Date comparisons for retention periods must account for Vietnam timezone (UTC+7 shift)

## Cross-References

- **Architecture Decisions:** [ADR-003](../../architecture-decisions/ADR-003-auth-architecture/README.md), [ADR-008](../../architecture-decisions/ADR-008-security-posture/README.md), [ADR-014](../../architecture-decisions/ADR-014-einvoice-compliance/README.md)
- **Design Specifications:** [DS-001](../../design-specifications/DS-001-data-model/README.md) (sections 2.1, 2.5, 2.9, 6.2), [DS-003](../../design-specifications/DS-003-api-contract/README.md) (sections 6.7, 14.2), [DS-015](../../design-specifications/DS-015-dsar-privacy/README.md)
- **Frontend Design:** [FD-019](../../frontend-design/FD-019-consent-privacy/README.md)
- **Business/Domain:** [bounded-contexts.md](../../business/domain-model/bounded-contexts.md), [ubiquitous-language.md](../../business/domain-model/ubiquitous-language.md), [customer-personas.md](../../business/personas/customer-personas.md)
- **Regulatory:** [data-privacy.md](../../business/regulatory/data-privacy.md), [consumer-protection.md](../../business/regulatory/consumer-protection.md)
- **Scaffolding:** [SI-005](../../scaffolding-infra/SI-005-testing-strategy/README.md)

## Known Gaps & Open Questions

- **HIGH -- Export file generation infrastructure NOT BUILT** -- Background job + temporary storage for DSAR export JSON bundle does not exist. `DsarRequest.responseUrl` signed URL generation is not implemented (DS-015 section 11).
- **HIGH -- CDTIA for Resend still open** -- Resend (US email delivery) with customer email addresses still requires CDTIA filing or replacement with Vietnam-hosted email. Not yet resolved (data-privacy.md CDTIA Filing Status).
- **HIGH -- DPO appointment mandatory but not confirmed** -- DPO must be appointed before launch. Platform processes payment data (sensitive) -> SME 5-year exemption does NOT apply. No appointment confirmed in docs.
- **HIGH -- Data Processor Agreements (DPAs) not signed** -- With eSMS, Resend, MISA, VNPay/MoMo -- legally required before processing customer PII through these processors (DS-015 section 11).
- **MEDIUM -- DSAR deadline monitoring cron absent** -- No cron job for monitoring DSAR approaching/breached deadlines (DS-015 section 9). The complaintSlaMon pattern could be extended.
- **MEDIUM -- Consent migration for existing customers** -- Retroactive ConsentRecord creation for customers who registered before consent system was implemented -- no plan documented (DS-015 section 11).
- **MEDIUM -- Right to object (PDPL Art. 13) processing halt mechanism NOT designed** -- DSAR type=OBJECTION exists in enum but processing halt mechanism is undesigned (DS-015 section 11).
- **LOW -- Child data protection (PDPL Art. 20)** -- Age is not currently collected. Under-16 stricter rules (parental consent) apply -- not addressed (DS-015 section 11).
- **LOW -- 3-day remote cancellation right (CPL 2023 Art. 29)** -- Legal opinion pending on whether bus ticket = "service already performed" exemption. No `paid -> cancelled` customer-initiated booking transition exists. Deferred to risk-register.
- **LOW -- ADR-003 IMPLEMENTATION STATUS: passwordHash column** -- Customer.passwordHash exists in schema despite OTP-only customer auth decision. Column unused but creates misleading schema signal.
- **MEDIUM -- 72-hour cooling-off cancellation endpoint NOT_IMPLEMENTED** -- DS-015 describes it but no API endpoint is specified for cancelling a deletion request during the 72-hour window.
- **MEDIUM -- Admin DSAR management UI out of scope** -- Admin processing UI for DSAR requests is not covered by FD-019 and requires a separate admin FI spec.
