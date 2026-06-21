# FI-015: E-Invoice (Hoa don dien tu)

> **Status:** DOCUMENTED
> **Last Updated:** 2026-06-20
> **Related:** ADR-014, DS-001, DS-003, DS-006, DS-012, FD-023

## Overview

The BusBooking platform issues VAT invoices on behalf of operators (Decree 123/2020 Art. 17 authorized arrangement) using MISA meInvoice as the sole provider. Invoices are triggered when a booking reaches `paid` status. Decree 70/2025 mandates transport-specific fields (vehicle plate, departure/destination cities, route description, operator MST) -- these are NOT YET MAPPED to the MISA payload, making every currently-issued invoice potentially non-compliant and this a hard go-live blocker. The `EInvoice` entity uses a snapshot approach (fields denormalized at creation time) because invoices are legal documents whose content must not change if source entities are updated later.

## Scope & Boundaries

### In Scope

- EInvoice creation triggered by `applyPaidStatusTransition` (booking -> paid)
- Transport field resolution: `Booking -> Trip -> Bus (licensePlate)` + `Trip -> Route -> fromPlace/toPlace (name)` + `Route -> Operator (taxCode)`
- `einvoiceSubmission` cron (every 5 min): submits `pending` EInvoice rows to MISA meInvoice API
- `needsReview = true` flag: holds incomplete invoices from MISA submission
- `blocked` status: missing `operatorMst` prevents creation entirely
- Correction invoice model (Decree 123/2020 Art. 19): `EInvoiceType` enum, `originalInvoiceId` self-FK
- Customer invoice view at `/booking/confirmation/[token]`
- Operator invoice list at `/op/invoices`
- Admin retry endpoint for blocked invoices: `POST /api/admin/einvoice/:id/retry`
- VAT computation: 10% on bus tickets (`preTax = totalVnd / 1.1`, `vat = totalVnd - preTax`)

### Out of Scope

- Commission VAT invoice (platform -> operator, monthly B2B): NOT YET IMPLEMENTED -> future issue
- Correction invoice MISA API endpoint: NOT YET INTEGRATED -> future issue
- Historical invoice re-issuance: needs legal counsel -> future issue
- VNPT-Invoice, Viettel S-Invoice (only MISA meInvoice integrated)
- Backfill script for existing EInvoice rows: separate operational script, NOT in Prisma migration
- Payment processing -> [FI-008](../FI-008-payment-integration/README.md)
- Booking lifecycle -> [FI-007](../FI-007-booking-flow/README.md)
- KYB document upload (tax code collection) -> [FI-002](../FI-002-operator-onboarding/README.md)
- Notification dispatch -> [FI-014](../FI-014-notifications/README.md)

### Bounded Context(s)

**E-Invoice Context** -- Models: `EInvoice` (linked from `Booking.einvoiceRef`). Services: `lib/einvoice/` (MISA integration, transport field resolution). Cron: `einvoiceSubmission` (every 5 min, `/api/cron/einvoice-submission`).

**Dependencies on other FI features:**
- [FI-002](../FI-002-operator-onboarding/README.md) (Operator Onboarding): `Operator.taxCode` (MST) must be set for any EInvoice to be created; blocks if null
- [FI-004](../FI-004-route-management/README.md) (Route Management): `Route.fromPlaceId` / `Route.destPlaceId` must link to `Place` records for departure/destination city names
- [FI-007](../FI-007-booking-flow/README.md) (Booking Flow): EInvoice triggered by `applyPaidStatusTransition`
- [FI-003](../FI-003-fleet-management/README.md) (Fleet Management): `Bus.licensePlate` snapshotted as `vehiclePlate`

## Key Entities

| Model | Key Columns | Constraints | Notes |
|-------|-------------|-------------|-------|
| EInvoice | id (CUID PK), bookingId (@db.Uuid FK->Booking onDelete:Restrict), operatorId (FK->Operator onDelete:Restrict), invoiceNumber? (partial unique WHERE NOT NULL), status (EInvoiceStatus default pending), vendorRef?, rawResponse?, issuedAt? (@db.Timestamptz), createdAt, vehiclePlate?, departureCity?, destinationCity?, transportRoute?, operatorMst?, needsReview (default false), type (EInvoiceType default original), originalInvoiceId? (self-FK), originalInvoiceNumber? | Partial unique: `EInvoice_invoiceNumber_key` WHERE invoiceNumber IS NOT NULL; `@@index([bookingId])`, `@@index([operatorId, createdAt])`, `@@index([status])` | Snapshot approach: all fields copied at creation time, not FK-joined at read time. DS-012 additions: vehiclePlate, departureCity, destinationCity, transportRoute, operatorMst, needsReview, type, originalInvoiceId, originalInvoiceNumber |
| Booking (EInvoice-linked) | einvoiceRef? (@unique partial WHERE NOT NULL), einvoiceIssuedAt? (@db.Timestamptz) | CHECK: `("einvoiceRef" IS NULL) = ("einvoiceIssuedAt" IS NULL)` -- both-or-neither | GDT e-invoice reference on the booking record |

### Transport Field Resolution (Join Path)

| EInvoice Field | Source Path | Source Column |
|---------------|-------------|---------------|
| `vehiclePlate` | Booking -> Trip -> Bus | `Bus.licensePlate` |
| `departureCity` | Booking -> Trip -> Route -> fromPlace | `Place.name` (Vietnamese with diacritics) |
| `destinationCity` | Booking -> Trip -> Route -> toPlace | `Place.name` |
| `transportRoute` | Derived | `"{departureCity} -> {destinationCity}"` (Unicode arrow) |
| `operatorMst` | Booking -> Trip -> Route -> Operator | `Operator.taxCode` |

**Enums relevant to FI-015:**

| Enum | Values |
|------|--------|
| EInvoiceStatus | `pending`, `issued`, `sent`, `failed`, `cancelled`, `blocked` |
| EInvoiceType | `original`, `correction` |

**Note:** `blocked` status is a DS-012 addition not yet reflected in DS-001. DS-001 Section 2.13 `EInvoiceStatus` enum has `pending | issued | sent | failed | cancelled` only -- needs updating.

## API Endpoints

| Method | Path | Auth | Description | Status Codes |
|--------|------|------|-------------|--------------|
| GET | `/booking/confirmation/[token]` | Public (token-gated) | Renders EInvoice card when `status = 'issued'` or `'sent'`. Shows invoice number, issue date, operator name, MST, route, plate, VAT breakdown | 200, 404 |
| GET | `/op/invoices` | Operator JWT | Invoice list with status badges. `needsReview = true` shows amber badge with missing fields checklist. Failed invoices show "Thu lai" retry button | 200 |
| POST | `/api/admin/einvoice/:id/retry` | Admin JWT | Retry blocked invoice. Re-resolves transport fields (MST now available). Transitions `blocked -> pending` | 200, 422, 404 |
| GET | `/api/cron/einvoice-submission` | Cron secret | Every 5 min. Predicate: `EInvoice.status = 'pending' AND needsReview = false`. Uses `FOR UPDATE SKIP LOCKED`. Response: `{ job, status, rowsAffected, durationMs }` | 200 |

### MISA meInvoice Integration

| Component | Value | Notes |
|-----------|-------|-------|
| Provider | MISA meInvoice | GDT-certified per Circular 32/2025/TT-BTC |
| Env vars | `MISA_API_KEY`, `MISA_TRANSPORT_TEMPLATE_ID` | Required for invoice submission |
| Template type | `01GTKT` | Transport-specific template |
| Transport XML elements | `<BienSoXe>`, `<DiemDi>`, `<DiemDen>`, `<TuyenDuong>`, `<MaSoThue>` | NOT YET MAPPED (except `<MaSoThue>` in seller block) |
| Digital signature + QR | Generated by MISA | Platform does not generate independently |
| PDF download | MISA-hosted | Filename: `hoadon-{bookingRef}-{invoiceNumber}.pdf` |

## State Machine

### EInvoice Status Transitions

```
States: pending | issued | sent | failed | cancelled | blocked

Transitions:
  (creation)  -> pending:    booking reaches paid status; applyPaidStatusTransition
                             creates EInvoice row with transport field snapshots
  (creation)  -> blocked:    operatorMst is null; AdminAuditLog entry; admin notification
  pending     -> issued:     MISA submission success; sets invoiceNumber + issuedAt;
                             Booking.einvoiceRef + einvoiceIssuedAt set atomically
  issued      -> sent:       delivery confirmed (GDT forwarding or customer receipt)
  pending     -> failed:     MISA submission failure (network error, MISA rejection)
  failed      -> pending:    manual retry or cron re-pick (nextAttemptAt <= NOW())
  issued      -> cancelled:  voided (correction flow creates new EInvoice row with
                             type='correction'; original row NOT deleted)
  sent        -> cancelled:  same as issued -> cancelled
  blocked     -> pending:    admin retries via POST /api/admin/einvoice/:id/retry
                             after KYB MST resolved
```

**Immutability principle:** Cancellation creates a new EInvoice row with `type='correction'`; the original invoice row is NOT modified. Correction invoice coexists with original per Decree 123/2020 Art. 19.

### Missing Field Decision Matrix

| Missing Field | Severity | EInvoice Status | `needsReview` | Admin Notified |
|---------------|----------|-----------------|---------------|----------------|
| `operatorMst` | CRITICAL | `blocked` | -- | Yes + AdminAuditLog |
| `vehiclePlate` | WARNING | `pending` | `true` | Yes |
| `departureCity` | WARNING | `pending` | `true` | Yes |
| `destinationCity` | WARNING | `pending` | `true` | Yes |
| All present | OK | `pending` | `false` | No |

**Cron behavior:** `einvoiceSubmission` skips rows where `needsReview = true`.

## Business Rules & Invariants

1. **EInvoice-1 -- Authorized Issuance** -- Platform issues invoices on behalf of operators per Decree 123/2020 Art. 17. Requires formal written authorization agreement per operator. KYB wizard Step 4 checkbox collects consent. Authorization template NOT YET CREATED (go-live blocker).

2. **EInvoice-2 -- Invoice Immutability** -- Invoice is a legal document; content MUST NOT change after issuance. All fields are snapshotted at creation time (not FK-joined at read time). The `vehiclePlate`, `departureCity`, `destinationCity`, `transportRoute`, `operatorMst` columns hold point-in-time copies.

3. **EInvoice-3 -- operatorMst Gate** -- Missing `Operator.taxCode` (MST) blocks invoice creation entirely. `applyPaidStatusTransition` sets `status = 'blocked'` and writes `AdminAuditLog` entry. Admin must resolve via `/api/admin/einvoice/:id/retry` after KYB MST is populated.

4. **EInvoice-4 -- needsReview Flag** -- Missing `vehiclePlate`, `departureCity`, or `destinationCity` creates the invoice with `needsReview = true`. Cron skips these rows. Admin UI shows amber badge with missing fields checklist.

5. **EInvoice-5 -- Correction Model (Art. 19)** -- Correction invoices create a new EInvoice row with `type = 'correction'`, `originalInvoiceId` self-FK, and `originalInvoiceNumber` snapshot. Original row is NOT deleted or modified.

6. **EInvoice-6 -- Booking Consistency CHECK** -- `Booking.einvoiceRef` and `Booking.einvoiceIssuedAt` must be both-or-neither. Enforced by CHECK constraint: `("einvoiceRef" IS NULL) = ("einvoiceIssuedAt" IS NULL)`.

7. **EInvoice-7 -- VAT Computation** -- 10% VAT on bus tickets. `preTax = totalVnd / 1.1`, `vat = totalVnd - preTax`. MISA XML: `<ThueSuat>10</ThueSuat>`.

8. **EInvoice-8 -- BigInt Currency Math** -- All monetary computation in BigInt domain. No `Math.round(int * fractional)` pattern in money-handling modules (Mistake Log Issue 016). ES2017 target: use `BigInt(n)` constructor, not `1n` literal suffix.

9. **EInvoice-9 -- Invoice Number Uniqueness** -- `invoiceNumber` unique among non-null values via partial unique index `EInvoice_invoiceNumber_key` WHERE invoiceNumber IS NOT NULL.

10. **EInvoice-10 -- I7 Exemption** -- `/api/op/**` trip creation price is operator-authoritative (I7-exempt). I7 ("no client-originated price") applies only to customer-facing endpoints (`/api/holds/**`, `/api/bookings/**`, `/api/payments/**`).

11. **EInvoice-11 -- Vehicle Plate Format** -- Permissive regex: `^\d{2}[A-Z]\d?-\d{3,5}\.\d{2}$`. Non-matching plates logged as warning but stored as-is (diagnostic only, not a hard gate).

12. **EInvoice-12 -- Backfill Not In Migration** -- Backfill for existing invoices is a separate operational script (`scripts/backfill-einvoice-transport.sql`), NOT in Prisma migration.

## Frontend Surfaces

### Customer: `/booking/confirmation/[token]` (FD-023)

Invoice card visible when `EInvoice.status = 'issued'` or `'sent'`:

| Field | Label (Vietnamese) | Source |
|-------|--------------------|--------|
| Invoice number | So hoa don | `EInvoice.invoiceNumber` |
| Issue date | Ngay phat hanh | `EInvoice.issuedAt` |
| Operator name | Nha xe | `Operator.brandName` or `legalName` |
| Tax code | MST | `EInvoice.operatorMst` (snapshot) |
| Route | Tuyen | `EInvoice.transportRoute` |
| Vehicle plate | Bien so xe | `EInvoice.vehiclePlate` |
| Pre-tax amount | Gia truoc thue | `totalVnd / 1.1` |
| VAT (10%) | VAT 10% | `totalVnd - preTax` |
| Total | Tong cong | `totalVnd` |

"Tai hoa don" (Download Invoice) -> PDF from MISA with GDT digital signature + QR code. Filename: `hoadon-{bookingRef}-{invoiceNumber}.pdf`.

### Operator: `/op/invoices` (FD-023)

**Status badges:**

| Status | Badge Color |
|--------|-------------|
| `pending` | Gray |
| `issued` | Green |
| `sent` | Blue |
| `failed` | Red |
| `cancelled` | Dark gray |
| `needsReview = true` | Amber (with missing fields checklist) |

**Actions:**
- `failed` -> "Thu lai" (retry) button
- `issued`/`sent` -> "Yeu cau dieu chinh" (request correction) -> form with current vs. corrected fields + reason

### Correction Form Fields

| Current Value | Corrected Value |
|---------------|-----------------|
| vehiclePlate | Corrected vehiclePlate |
| departureCity | Corrected departureCity |
| destinationCity | Corrected destinationCity |
| -- | Reason for correction |

## Regulatory Requirements

| Regulation | Requirement | Status |
|------------|-------------|--------|
| Decree 123/2020 | E-invoice for every transaction; platform authorized by operator via written agreement; `operatorMst` required | Written agreement template NOT YET CREATED (go-live blocker) |
| Decree 70/2025 | Transport fields: `vehiclePlate`, `departureCity`, `destinationCity`, `transportRoute` required on all transport invoices | NOT YET MAPPED to MISA payload (go-live blocker) |
| Circular 32/2025/TT-BTC | GDT-certified e-invoice providers; MISA meInvoice qualified (replaces Circular 78/2021, effective 1 Jun 2025) | MISA integrated (Issue #74) but transport template activation pending |
| VAT Law 48/2024 | 10% VAT on bus tickets; 10% VAT on platform commission | 10% applied in invoice computation |
| E-Commerce Law 2025 | `individual_household` operators: ~3% VAT + ~1.5% PIT withheld (effective 1 Jul 2026) | Tax withholding NOT YET IMPLEMENTED |
| Decree 125/2020 Art. 24 | Fine 4,000,000-8,000,000 VND per incorrect/incomplete e-invoice | Risk on all currently-issued invoices missing transport fields |
| Decree 123/2020 Art. 19 | Correction invoices for field errors; void-and-reissue for amount/tax changes | DS-012 correction model designed; MISA correction API NOT YET INTEGRATED |
| Data residency | PII in Vietnam-hosted PostgreSQL; compute on Vercel sin1 (Singapore); CDTIA filing required within 60 days | CDTIA filing status not confirmed |

## Testing Strategy

### Unit Tests

- Transport field resolution (happy path): all 5 fields populated from `Trip -> Bus/Route/Place/Operator`
- Missing `Bus.licensePlate`: `vehiclePlate = null`; invoice created with `needsReview = true`
- Missing `Operator.taxCode`: invoice creation blocked; `status = 'blocked'`
- Missing `Route.fromPlace`: `departureCity = null`; `transportRoute = null`
- Vehicle plate regex validation: valid plates pass; invalid plates logged but stored
- `transportRoute` derivation: `"Ha Noi"` + `"Da Nang"` -> `"Ha Noi -> Da Nang"`
- VAT calculation: `preTax = totalVnd / 1.1`; `vat = totalVnd - preTax`; BigInt domain
- BigInt arithmetic: no `Math.round(int * fractional)` pattern in money-handling modules

### Integration Tests

- `applyPaidStatusTransition` creates EInvoice with transport fields: all 5 fields match source entities after real DB write
- MISA XML serialization includes transport elements: `<BienSoXe>`, `<DiemDi>`, `<DiemDen>`, `<TuyenDuong>` present in XML output
- `Booking_einvoice_consistency` CHECK constraint: `einvoiceRef` and `einvoiceIssuedAt` both-or-neither enforced
- `EInvoice_invoiceNumber_key` partial unique: multiple null `invoiceNumber` rows allowed; non-null duplicates rejected
- `needsReview = true` row skipped by cron: `einvoiceSubmission` does NOT pick up `needsReview = true` rows
- `blocked` invoice unblocked by admin retry: `status: blocked -> pending` after `POST /api/admin/einvoice/:id/retry` with MST now set
- Correction invoice: `type = 'correction'`; `originalInvoiceId` set; original row status unchanged
- NOT NULL column checklist: grep `prisma.einvoice.create` and `INSERT INTO "EInvoice"` across all test fixtures when adding transport field columns

### E2E Tests

- Full booking -> payment -> invoice flow: `EInvoice` row has `vehiclePlate`, `departureCity`, `destinationCity`, `transportRoute`, `operatorMst`
- Invoice download: PDF URL from MISA resolves; filename matches `hoadon-{bookingRef}-{invoiceNumber}.pdf`
- `primeCsrf()` before all POST mutations

## Cross-References

- **Architecture Decisions:** [ADR-014](../../architecture-decisions/ADR-014-einvoice/README.md)
- **Design Specifications:** [DS-001](../../design-specifications/DS-001-data-model/README.md) (section 2.13), [DS-003](../../design-specifications/DS-003-api-contract/README.md) (section 10), [DS-006](../../design-specifications/DS-006-background-jobs/README.md), [DS-012](../../design-specifications/DS-012-transport-einvoice/README.md)
- **Frontend Design:** [FD-023](../../frontend-design/FD-023-einvoice/README.md)
- **Business/Domain:** [bounded-contexts.md](../../business/domain-model/bounded-contexts.md), [state-machines.md](../../business/domain-model/state-machines.md) (Section 7), [ubiquitous-language.md](../../business/domain-model/ubiquitous-language.md), [event-flows.md](../../business/domain-model/event-flows.md) (booking paid flow)
- **Regulatory:** [einvoice-tax.md](../../business/regulatory/einvoice-tax.md)
- **Scaffolding:** [SI-005](../../scaffolding-infra/SI-005-testing-strategy/README.md) (sections 6.1, 8.1)
- **Related FIs:** [FI-002](../FI-002-operator-onboarding/README.md) (KYB MST collection), [FI-003](../FI-003-fleet-management/README.md) (Bus.licensePlate), [FI-004](../FI-004-route-management/README.md) (Route fromPlace/toPlace), [FI-007](../FI-007-booking-flow/README.md) (booking paid trigger), [FI-008](../FI-008-payment-integration/README.md) (payment lifecycle), [FI-014](../FI-014-notifications/README.md) (admin notification dispatch)

## Known Gaps & Open Questions

- **CRITICAL -- Decree 70/2025 transport fields NOT MAPPED to MISA payload**: Every invoice currently issued is potentially non-compliant. Fine: 4,000,000-8,000,000 VND per invoice (Decree 125/2020 Art. 24). Go-live blocker.
- **CRITICAL -- Authorization agreement template not created**: Decree 123/2020 Art. 17 requires written agreement per operator before any invoice is issued on their behalf. Go-live blocker.
- **HIGH -- MISA transport invoice template not activated**: Requires MISA support ticket. Cannot test transport XML elements without it. Go-live blocker.
- **HIGH -- Correction invoice MISA API endpoint not integrated**: DS-012 Section 9 designs the correction model but the MISA API endpoint for correction submission is different from standard issuance and not yet integrated.
- **HIGH -- Commission VAT invoice not implemented**: Platform -> operator monthly B2B invoice for commission deductions. Required for operator's tax accounting.
- **HIGH -- Tax withholding for `individual_household` operators**: `calcWithholding()` and `applyWithholding()` absent. E-Commerce Law 2025 effective 1 Jul 2026. Go-live blocker for that date.
- **HIGH -- `EInvoice.status = 'blocked'` not in DS-001**: DS-001 Section 2.13 `EInvoiceStatus` enum has `pending | issued | sent | failed | cancelled` only -- DS-012 adds `blocked` but DS-001 and Prisma schema need updating.
- **MEDIUM -- GDT notification**: Formal notification to tax authority before issuing on behalf of operators. Status not confirmed.
- **MEDIUM -- Historical invoice re-issuance**: Whether GDT requires re-issuance of all historical invoices with transport fields, or only prospective compliance from Decree 70/2025 enforcement date. Needs legal counsel.
- **MEDIUM -- DS-012 columns not in DS-001**: `needsReview`, `type`, `originalInvoiceId`, `originalInvoiceNumber` present in DS-012 design but not yet in DS-001 entity table.
- **MEDIUM -- CDTIA filing**: Hybrid compute (Vercel Singapore) + data residency (Vietnam PostgreSQL) requires CDTIA filing within 60 days of going live. Status not confirmed.
- **MEDIUM -- DPO appointment + DPIA filing**: Required at launch; no deferral. Status not confirmed.
- **LOW -- Multi-leg trips**: If a booking covers routes with intermediate stops, departure/destination should be first origin to final destination. Current model assumes single-leg.
- **LOW -- Bus plate changes after booking**: Plate snapshot at invoice creation may differ from plate at actual departure. Legally the invoice should reflect the vehicle actually used.
