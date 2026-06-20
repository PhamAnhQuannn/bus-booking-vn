# DS-015 -- DSAR & Privacy API

## 1. Overview

This document defines the Data Subject Access Request (DSAR) handling architecture and privacy compliance API for the BusBooking platform under Vietnam's Personal Data Protection Law (PDPL 2025, Decree 356/2025). Customers have the right to access, export, correct, and delete their personal data. The platform must respond within 30 days of receiving a valid request.

**Source ADRs.** ADR-008 (Security Posture — data classification, PII handling, consent architecture), ADR-014 (E-Invoice & Compliance — PDPL 2025, DPO appointment, DPIA, per-purpose consent, retention tiers).

**Cross-references.** DS-001 for Customer, ConsentRecord, Booking, NotificationLog entity schemas. DS-003 for auth realms and endpoint conventions. DS-006 for `piiAnonymization` cron job (listed but NOT BUILT). DS-007 for refund interaction with deletion requests. DS-014 for complaint data retention.

**Business context.** regulatory/data-privacy.md (CDTIA filing status: NOT FILED, DPIA: required at launch), regulatory/compliance-timeline.md.

---

## 2. PDPL 2025 Rights Summary

| Right | PDPL Article | SLA | Platform Implementation |
|-------|-------------|-----|------------------------|
| Access | Art. 9 | 30 days | Data export endpoint — JSON bundle |
| Rectification | Art. 10 | 30 days | Profile update (existing `PATCH /api/customers/me`) |
| Erasure | Art. 11 | 30 days | Soft-delete + scheduled anonymization |
| Data portability | Art. 12 | 30 days | Same JSON export, machine-readable |
| Withdraw consent | Art. 9 | Immediate | Consent withdrawal endpoint per purpose |
| Object to processing | Art. 13 | 30 days | Processing halt + admin review |

**Source:** ADR-014 D5, regulatory/data-privacy.md §3.

---

## 3. Data Model

### 3.1 DsarRequest Entity

```prisma
model DsarRequest {
  id             String       @id @default(cuid())
  customerId     String
  type           DsarType     // access, export, deletion, rectification, consent_withdrawal, objection
  status         DsarStatus   // submitted, processing, completed, rejected
  reason         String?      // customer's stated reason
  responseUrl    String?      // signed download URL for export (time-limited, 7-day expiry)
  completedAt    DateTime?
  rejectedReason String?      // e.g., "retention obligation prevents full deletion"
  deadline       DateTime     // createdAt + 30 calendar days
  processedBy    String?      // admin user ID who handled
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  customer       Customer     @relation(fields: [customerId], references: [id])

  @@index([status, deadline])
  @@index([customerId])
}
```

### 3.2 DsarType Enum

```prisma
enum DsarType {
  ACCESS
  EXPORT
  DELETION
  RECTIFICATION
  CONSENT_WITHDRAWAL
  OBJECTION
}
```

### 3.3 DsarStatus Enum

```prisma
enum DsarStatus {
  SUBMITTED
  PROCESSING
  COMPLETED
  REJECTED
}
```

### 3.4 Existing ConsentRecord Entity (DS-001)

ConsentRecord is already defined — immutable, append-only, per-purpose. Latest record per `(customerId, purpose)` = current consent state.

```
ConsentRecord {
  id, customerId, purpose, granted (boolean), ipAddress, userAgent, createdAt
}
```

No modifications needed. Current consent check: `findFirst({ where: { customerId, purpose }, orderBy: { createdAt: 'desc' } })`.

---

## 4. Consent Architecture

### 4.1 Consent Purposes

| Purpose | Required for Service | Withdrawable | Consequence of Withdrawal |
|---------|---------------------|-------------|--------------------------|
| `booking_processing` | Yes | Only via account deletion | Cannot use platform |
| `payment_processing` | Yes | Only via account deletion | Cannot use platform |
| `marketing_sms` | No | Anytime | No promotional SMS (transactional SMS unaffected per Decree 91/2020) |
| `marketing_email` | No | Anytime | No promotional email |
| `analytics` | No | Anytime | Excluded from FunnelEvent tracking |
| `third_party_sharing` | No | Anytime | PII not shared with distribution partners |

### 4.2 Consent Collection Rules (PDPL 2025 Art. 9)

- **No pre-ticked boxes.** All optional consent checkboxes default to unchecked.
- **Granular.** Each purpose is a separate checkbox. No "agree to all" bundle.
- **Informed.** Each purpose has a plain-language description visible at collection time.
- **Recorded.** Every grant or withdrawal creates an immutable `ConsentRecord` row.
- **Verifiable.** Admin can query full consent history per customer.

### 4.3 Consent Withdrawal Flow

```
Customer calls POST /api/customers/me/consent/withdraw
  → Body: { purpose: 'marketing_sms' }
  → Validate: purpose exists, is withdrawable
  → Create ConsentRecord { customerId, purpose, granted: false }
  → If purpose = 'marketing_sms': immediately exclude from marketing notification queries
  → Response: { success: true, consent: { purpose, granted: false, withdrawnAt } }
```

Service-required purposes (`booking_processing`, `payment_processing`) return HTTP 422 with error: `"Cannot withdraw consent for required processing. To stop all processing, request account deletion."`

**Source:** ADR-014 D5 (per-purpose granular consent), ADR-008 D6 (consent model).

---

## 5. Data Export Bundle

### 5.1 Export Contents

Format: JSON file with sections. Generated as background job, stored temporarily.

```json
{
  "exportedAt": "2026-06-19T10:00:00Z",
  "customer": {
    "phone": "+84901234567",
    "email": "user@example.com",
    "fullName": "Nguyen Van A",
    "createdAt": "2026-01-15T08:00:00Z"
  },
  "bookings": [
    {
      "bookingRef": "BB-2026-a1b2-c3d4",
      "tripDate": "2026-02-01",
      "route": "Thanh Hóa → TP.HCM",
      "operator": "Nhà Xe ABC",
      "ticketCount": 2,
      "totalVnd": 1750000,
      "status": "completed",
      "passengerName": "Nguyen Van A",
      "createdAt": "2026-01-20T10:00:00Z"
    }
  ],
  "payments": [
    {
      "bookingRef": "BB-2026-a1b2-c3d4",
      "adapter": "momo",
      "amount": 1750000,
      "status": "paid",
      "paidAt": "2026-01-20T10:05:00Z"
    }
  ],
  "consents": [
    {
      "purpose": "booking_processing",
      "granted": true,
      "recordedAt": "2026-01-15T08:00:00Z"
    }
  ],
  "holds": [
    {
      "tripDate": "2026-02-01",
      "route": "Thanh Hóa → TP.HCM",
      "ticketCount": 2,
      "status": "consumed",
      "createdAt": "2026-01-20T09:55:00Z"
    }
  ]
}
```

### 5.2 Exclusions (Retention-Locked)

| Data | Reason for Exclusion | Retention |
|------|---------------------|-----------|
| LedgerEntry | Financial audit trail, immutable | 10 years |
| AdminAuditLog | Platform audit, immutable | 10 years |
| EInvoice | Tax records (Decree 123/2020) | 10 years |
| OtpAttempt | Security logs, codes hashed | 90 days |
| PaymentEvent raw PSP tokens | Security — no raw credentials in export | N/A |

### 5.3 Export Generation

- Triggered by DSAR completion (admin marks as COMPLETED for access/export type)
- Background job: query all related entities, assemble JSON, upload to temporary storage
- Signed URL with 7-day expiry stored in `DsarRequest.responseUrl`
- Notify customer via SMS/email when ready
- Delete file after 7 days (cron cleanup)

---

## 6. API Endpoints

### 6.1 Customer Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/customers/me/dsar` | Customer JWT | Submit DSAR request |
| `GET` | `/api/customers/me/dsar` | Customer JWT | List own DSAR requests |
| `GET` | `/api/customers/me/dsar/{id}/download` | Customer JWT | Download export file (redirect to signed URL) |
| `POST` | `/api/customers/me/consent/withdraw` | Customer JWT | Withdraw consent for specific purpose |
| `DELETE` | `/api/customers/me/account` | Customer JWT | Request account deletion (creates DSAR type=DELETION) |

#### POST /api/customers/me/dsar

```
Body: { type: 'ACCESS' | 'EXPORT' | 'DELETION' | 'OBJECTION', reason?: string }
Response 201: { dsar: { id, type, status: 'SUBMITTED', deadline, createdAt } }
```

Auto-sets `deadline = createdAt + 30 calendar days`.

Rate limit: max 3 DSAR submissions per customer per 30-day period (prevent abuse).

#### DELETE /api/customers/me/account

Sugar for `POST /api/customers/me/dsar { type: 'DELETION' }`. Returns same response.

### 6.2 Admin Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/admin/dsar` | Admin JWT | List all DSARs, filter by status/type/deadline |
| `GET` | `/api/admin/dsar/{id}` | Admin JWT + TOTP | Detail with customer context |
| `PATCH` | `/api/admin/dsar/{id}/process` | Admin JWT + TOTP | Start processing |
| `PATCH` | `/api/admin/dsar/{id}/complete` | Admin JWT + TOTP | Mark complete (with responseUrl for exports) |
| `PATCH` | `/api/admin/dsar/{id}/reject` | Admin JWT + TOTP | Reject with reason |

**Source:** ADR-003 (admin auth realm), DS-003 §3.

---

## 7. Deletion Flow

### 7.1 Immediate Actions (on deletion request approval)

Inside `$transaction`:

1. Set `Customer.deletedAt = NOW()`
2. Revoke all active sessions (delete session rows or blacklist JWT)
3. Expire all active holds immediately (set `Hold.status = 'expired'`)
4. Cancel bookings in `awaiting_payment` state (no payment received)
5. Create `ConsentRecord` entries withdrawing all optional consents

### 7.2 Preserved Data (Service Obligations)

- **Paid bookings for upcoming trips**: NOT cancelled. Service obligation remains. Customer can still travel.
- **Completed bookings**: preserved for financial audit trail (anonymized later)
- **LedgerEntry / EInvoice**: immutable, preserved for 10-year retention
- **Active refunds / chargebacks**: preserved until resolution (DS-007, DS-010)

### 7.3 Scheduled Anonymization

After 24-month post-deletion retention period, `piiAnonymization` cron anonymizes PII fields. See §8.

---

## 8. PII Anonymization Cron — `piiAnonymization`

### 8.1 Job Configuration

| Parameter | Value |
|-----------|-------|
| Interval | Daily |
| Batch size | 100 customers per run |
| Concurrency | `FOR UPDATE SKIP LOCKED` |
| Auth | `CRON_SECRET` bearer token |
| Response | `{ job: 'piiAnonymization', customersProcessed, skipped, durationMs }` |

### 8.2 Query

```sql
SELECT id FROM "Customer"
WHERE "deletedAt" IS NOT NULL
  AND "deletedAt" < NOW() - INTERVAL '24 months'
  AND "phone" != 'ANONYMIZED'
FOR UPDATE SKIP LOCKED
LIMIT 100
```

### 8.3 Per-Customer Anonymization (inside $transaction)

| Entity | Field | Anonymized Value |
|--------|-------|-----------------|
| Customer | phone | `'ANONYMIZED'` |
| Customer | email | `'anon_{id}@deleted.local'` |
| Customer | fullName | `'Deleted User'` |
| Booking | passengerName | `'ANONYMIZED'` |
| Booking | passengerPhone | `'ANONYMIZED'` |
| NotificationLog | recipient | `'ANONYMIZED'` |

### 8.4 Skip Conditions

- Customer has bookings with active refunds (`Refund.status IN ('requested','processing')`)
- Customer has active chargebacks (`Chargeback.status IN ('received','under_review','contested')`)
- Customer has upcoming paid trips (`Booking.status = 'paid' AND Trip.departureAt > NOW()`)

### 8.5 Retention-Exempt Entities

| Entity | Action | Reason |
|--------|--------|--------|
| LedgerEntry | No anonymization until 10 years | Financial audit (Accounting Law) |
| EInvoice | No anonymization until 10 years | Tax records (Decree 123/2020) |
| ConsentRecord | Never anonymized | Proof of lawful processing basis |
| AdminAuditLog | No anonymization until 10 years | Platform audit trail |

**Source:** ADR-014 D5 (retention tiers), ADR-008 D4 (data classification), DS-006 §18 (cron patterns).

---

## 9. DSAR Deadline Monitoring

### 9.1 Integration with complaintSlaMon (DS-014)

Reuse existing SLA monitoring cron pattern. Add DSAR deadline checks:

- `WHERE status = 'SUBMITTED' AND deadline < NOW() + INTERVAL '3 days'` → admin alert: deadline approaching
- `WHERE status = 'SUBMITTED' AND deadline < NOW()` → BREACH alert: overdue DSAR
- `WHERE status = 'PROCESSING' AND deadline < NOW() + INTERVAL '1 day'` → urgent alert

### 9.2 Notifications

- Customer: SMS/email confirmation on DSAR submission
- Customer: SMS/email notification when export is ready for download
- Admin: alert on approaching/breached deadlines

---

## 10. Third-Party Data Sharing Inventory

| Third Party | Data Shared | Purpose | PDPL Basis |
|-------------|------------|---------|------------|
| eSMS.vn | Phone number | OTP + transactional SMS | Contract performance |
| Resend | Email address | Transactional email | Contract performance |
| MISA meInvoice | Name, booking details | E-invoice issuance | Legal obligation (Decree 123/2020) |
| VNPay / MoMo | Phone (hashed in some flows) | Payment processing | Contract performance |
| Vercel | Request IP, user agent | Application hosting | Legitimate interest |

When consent for `third_party_sharing` is withdrawn: halt data sharing with non-essential processors (does not affect eSMS for transactional SMS or MISA for legal-obligation invoicing).

---

## 11. Known Gaps

| Gap | Severity | Dependency |
|-----|----------|------------|
| Export file generation infrastructure (background job + temp storage) | HIGH | File storage design |
| DSAR deadline monitoring cron (or extend complaintSlaMon) | MEDIUM | DS-014 |
| Cross-border CDTIA implications for DSAR processing | HIGH | regulatory/data-privacy.md — CDTIA NOT FILED |
| Consent migration for existing customers (retroactive records) | MEDIUM | Launch timing |
| Child data protection (PDPL Art. 20: under-16 stricter rules) | LOW | Age not currently collected |
| Data Processor Agreements with eSMS, Resend, MISA | HIGH | Legal/procurement |
| DPO appointment (mandatory, cannot defer) | HIGH | Organizational |
| Right to object: processing halt mechanism not designed | MEDIUM | — |
| Export file format standardization (JSON vs CSV vs PDF) | LOW | — |
