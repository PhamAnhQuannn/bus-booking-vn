# DS-012 -- Transport E-Invoice Fields Design

## 1. Overview

This document defines the data model changes, source mapping, MISA meInvoice API integration, and migration strategy required to add transport-specific fields to e-invoices as mandated by Decree 70/2025 (amending Decree 123/2020). The BusBooking platform currently issues e-invoices for paid bookings via the MISA meInvoice integration but omits the transport-specific fields (vehicle registration plate, departure/destination points, transport route description) that Decree 70/2025 requires for transport service invoices. This is a compliance gap: invoices issued without these fields may be considered invalid by the General Department of Taxation (GDT), preventing operators from deducting VAT input. The platform is **overdue** on this requirement -- Decree 70/2025 is already in effect.

**Source ADRs.** This document synthesizes decisions from ADR-014 (E-Invoice Compliance -- Decree 123/2020, MISA integration, invoice lifecycle), ADR-005 (Payment Architecture -- applyPaidStatusTransition, invoice creation trigger), ADR-010 (Booking Lifecycle -- paid transition side effects). Business context from regulatory/einvoice-tax.md.

**Cross-references.** 01-data-model-design for `EInvoice`, `Booking`, `Trip`, `Bus`, `Route`, `Place`, `Operator` entity schemas. 02-migration-strategy for raw-SQL-plus-schema-prisma migration rules. 05-webhook-design section 9 for e-invoice creation trigger and EInvoice state machine. 06-background-jobs for `einvoiceSubmission` cron (5-minute cycle).

---

## 2. Regulatory Requirement (Decree 70/2025)

### 2.1 Transport E-Invoice Mandatory Fields

Decree 70/2025 amends Decree 123/2020 to require transport service e-invoices to include the following fields in addition to the standard e-invoice content:

| Vietnamese Term | English | Required | Enforcement |
|---|---|---|---|
| Bien so xe | Vehicle registration plate | Yes | Invoice invalid without it |
| Diem di | Departure point | Yes | Invoice invalid without it |
| Diem den | Destination point | Yes | Invoice invalid without it |
| Tuyen duong van chuyen | Transport route description | Yes | Invoice invalid without it |
| Ma so thue (MST) | Tax identification number (seller) | Yes (Decree 123/2020) | Already required by base decree |

### 2.2 Consequences of Non-Compliance

- **Invoice invalidity**: Invoices missing transport fields are not recognized by GDT. The operator cannot use them to claim VAT input deductions.
- **Administrative fine**: VND 4,000,000 -- VND 8,000,000 per invoice for incorrect/incomplete e-invoice content (Decree 125/2020 Art. 24).
- **Operator trust erosion**: Operators receiving non-compliant invoices may switch to competitors with compliant invoicing.

### 2.3 Effective Date

Decree 70/2025 is **already in effect**. The platform is currently issuing e-invoices without transport fields. Every invoice issued without these fields is potentially non-compliant.

**Source:** regulatory/einvoice-tax.md, ADR-014 D1.

---

## 3. Data Model Changes

### 3.1 New Columns on EInvoice Entity

Add five columns to the existing `EInvoice` model:

```prisma
model EInvoice {
  // ... existing columns ...

  vehiclePlate     String?   // Bus.licensePlate at time of invoice creation
  departureCity    String?   // Place.name for Route.fromPlaceId
  destinationCity  String?   // Place.name for Route.toPlaceId
  transportRoute   String?   // Derived: "{departureCity} -> {destinationCity}"
  operatorMst      String?   // Operator.taxCode (MST) at time of invoice creation
}
```

### 3.2 Nullability Rationale

All five columns are nullable (`String?`) because:

1. **Existing rows**: EInvoice rows created before this migration do not have transport field values. Backfill is best-effort (section 7.3).
2. **Missing source data**: A Bus may lack a `licensePlate` (newly added, plate not yet registered); an Operator may lack a `taxCode` (KYB incomplete). The system must handle these edge cases gracefully rather than blocking invoice creation entirely.
3. **Forward contract**: New EInvoice rows created after this migration MUST populate all five fields when source data is available. Missing `operatorMst` blocks invoice creation (section 8).

### 3.3 Snapshot vs Reference

Transport fields are **snapshot copies** (denormalized), not FK references:

| Approach | Chosen | Rationale |
|---|---|---|
| Snapshot (copy at creation time) | Yes | Invoice is a legal document -- its content must not change if the Bus plate is updated or the Route is modified after invoice issuance |
| FK reference (join at read time) | No | A bus plate change or route rename would retroactively alter the content of an already-issued legal invoice -- Decree 123/2020 violation |

**Source:** ADR-014 D1 (invoice immutability principle).

---

## 4. Source Mapping

### 4.1 Field-to-Entity Mapping

| EInvoice Field | Source Entity | Source Column | Join Path from Booking | Notes |
|---|---|---|---|---|
| `vehiclePlate` | Bus | `licensePlate` | Booking -> Trip -> Bus | Snapshot at invoice creation |
| `departureCity` | Place | `name` | Booking -> Trip -> Route -> fromPlace (Place) | Vietnamese city name with diacritics |
| `destinationCity` | Place | `name` | Booking -> Trip -> Route -> toPlace (Place) | Vietnamese city name with diacritics |
| `transportRoute` | (derived) | (computed) | -- | `${departureCity} -> ${destinationCity}` |
| `operatorMst` | Operator | `taxCode` | Booking -> Trip -> Route -> Operator | 10 or 13 digit MST |

### 4.2 Join Query

The resolution query at invoice creation time (inside the `applyPaidStatusTransition` transaction):

```typescript
const tripData = await tx.trip.findUnique({
  where: { id: booking.tripId },
  select: {
    bus: { select: { licensePlate: true } },
    route: {
      select: {
        fromPlace: { select: { name: true } },
        toPlace: { select: { name: true } },
        operator: { select: { taxCode: true } },
      },
    },
  },
})

const vehiclePlate = tripData?.bus?.licensePlate ?? null
const departureCity = tripData?.route?.fromPlace?.name ?? null
const destinationCity = tripData?.route?.toPlace?.name ?? null
const transportRoute = (departureCity && destinationCity)
  ? `${departureCity} → ${destinationCity}`
  : null
const operatorMst = tripData?.route?.operator?.taxCode ?? null
```

The Unicode arrow `→` (right arrow) is used in `transportRoute` for clarity in both UI display and MISA XML submission. Vietnamese business convention uses this arrow format for route descriptions.

**Source:** 01-data-model-design Trip, Bus, Route, Place, Operator entities.

---

## 5. Invoice Creation Changes

### 5.1 Current Flow (DS-005 Section 9.1)

When a booking transitions to `paid` via webhook, `applyPaidStatusTransition` creates an `EInvoice` row with `status = 'pending'` containing booking/payment data (amount, customer info, booking ref). The `einvoiceSubmission` cron (every 5 minutes) submits pending invoices to MISA meInvoice.

### 5.2 New Flow

In the same `$transaction` as the booking-paid transition:

```
applyPaidStatusTransition (inside $transaction)
  │
  ├─ ... existing booking/hold/ledger/notification logic ...
  │
  ├─ Resolve transport fields:
  │   ├─ Trip -> Bus.licensePlate
  │   ├─ Trip -> Route -> fromPlace.name
  │   ├─ Trip -> Route -> toPlace.name
  │   ├─ Trip -> Route -> Operator.taxCode
  │   └─ Derive transportRoute string
  │
  ├─ Validate transport fields:
  │   ├─ operatorMst is null? → BLOCK invoice creation, flag for admin
  │   ├─ vehiclePlate is null? → CREATE invoice without plate, log warning
  │   ├─ departureCity/destinationCity is null? → CREATE invoice without cities, log warning
  │   └─ All present? → CREATE complete transport invoice
  │
  └─ INSERT EInvoice row with transport fields populated
```

### 5.3 Validation Rules

| Field | Missing Behavior | Rationale |
|---|---|---|
| `operatorMst` | **BLOCK** invoice creation; set `EInvoice.status = 'blocked'`; create `AdminAuditLog` entry | MST is legally required on every invoice (Decree 123/2020, not just 70/2025); issuing without it is never acceptable |
| `vehiclePlate` | **WARN** and create invoice without plate; flag `needsReview = true` | Plate may be temporarily unregistered; invoice is better issued partially than not at all |
| `departureCity` | **WARN** and create invoice without cities; flag `needsReview = true` | Place data should always exist but defensive coding requires handling the null path |
| `destinationCity` | Same as departureCity | -- |
| `transportRoute` | Derived from cities; null if either city is null | -- |

### 5.4 Vehicle Plate Format Validation

Vietnamese vehicle registration plates follow several formats:

| Format | Example | Description |
|---|---|---|
| Standard | `51B-123.45` | Province code (2 digits) + series letter + dash + 3-5 digits + dot + 2 digits |
| Transport | `51B-123.45` | Same format; transport vehicles use specific series letters |
| Diplomatic | `NG-01-001` | Rare; excluded from validation |

Regex (permissive): `^\d{2}[A-Z]\d?-\d{3,5}\.\d{2}$`

**Implementation**: Log a warning if the plate does not match the regex, but **store the value as-is**. Operators may have non-standard plates (temporary plates, plates from other ASEAN countries for cross-border routes). The regex is a diagnostic aid, not a hard gate.

**Source:** ADR-014 D1, 05-webhook-design section 9.

---

## 6. MISA meInvoice API Changes

### 6.1 Transport Invoice Template

MISA meInvoice supports transport service invoice templates with additional XML fields in the invoice body. The platform must activate the transport invoice template via MISA portal configuration (may require MISA support ticket).

### 6.2 XML Field Mapping

| Platform Field | MISA XML Element | Location in XML | Notes |
|---|---|---|---|
| `vehiclePlate` | `<BienSoXe>` | Invoice body / transport detail section | Plain text, no formatting |
| `departureCity` | `<DiemDi>` | Invoice body / transport detail section | UTF-8 encoded, Vietnamese diacritics preserved |
| `destinationCity` | `<DiemDen>` | Invoice body / transport detail section | UTF-8 encoded |
| `transportRoute` | `<TuyenDuong>` | Invoice body / transport detail section | `{departureCity} -> {destinationCity}` |
| `operatorMst` | `<MaSoThue>` | Seller block (`<NguoiBan>`) | Already mapped in current integration |

### 6.3 Invoice Type Selection

| Invoice Type | MISA Code | When Used |
|---|---|---|
| Goods/services invoice | `01GTKT` | Current default (incorrect for transport) |
| Transport service invoice | `01GTKT` with transport template | New default for all booking invoices |

The invoice type code remains `01GTKT` (VAT invoice) but the template changes to include transport-specific fields. MISA distinguishes via the template ID, not the invoice type code.

### 6.4 Submission Flow Change

The `einvoiceSubmission` cron (06-background-jobs) currently serializes EInvoice rows to MISA XML. The serialization function must be updated to:

1. Check if transport fields are populated on the EInvoice row.
2. If populated: include `<BienSoXe>`, `<DiemDi>`, `<DiemDen>`, `<TuyenDuong>` in the XML body.
3. If not populated (legacy rows, incomplete data): submit without transport fields (MISA may accept or reject depending on template configuration; log the outcome).
4. Use the transport invoice template ID (configured via `MISA_TRANSPORT_TEMPLATE_ID` env var).

### 6.5 Vietnamese Diacritics

City names in the Place model use Vietnamese diacritics (e.g., "Da Nang" as "Da Nang", "Ho Chi Minh" as "Thanh pho Ho Chi Minh"). MISA XML uses UTF-8 encoding, which supports Vietnamese diacritics natively. No transliteration or encoding conversion is required.

**Source:** ADR-014 D2, regulatory/einvoice-tax.md.

---

## 7. Migration Plan

### 7.1 Schema Migration

Migration file: `prisma/migrations/<timestamp>_add_einvoice_transport_fields/migration.sql`

```sql
-- Add transport-specific fields to EInvoice (Decree 70/2025)
ALTER TABLE "EInvoice" ADD COLUMN "vehiclePlate" TEXT;
ALTER TABLE "EInvoice" ADD COLUMN "departureCity" TEXT;
ALTER TABLE "EInvoice" ADD COLUMN "destinationCity" TEXT;
ALTER TABLE "EInvoice" ADD COLUMN "transportRoute" TEXT;
ALTER TABLE "EInvoice" ADD COLUMN "operatorMst" TEXT;
```

### 7.2 Schema.prisma Declaration

Per 02-migration-strategy rules (and Mistake Log Issue 007/012): non-partial columns added via raw SQL MUST also be declared in `schema.prisma` in the same migration:

```prisma
model EInvoice {
  // ... existing fields ...
  vehiclePlate     String?
  departureCity    String?
  destinationCity  String?
  transportRoute   String?
  operatorMst      String?
}
```

**Verification**: After migration, confirm schema-DB parity by reading `schema.prisma` column declarations against `migration.sql` `ADD COLUMN` statements side-by-side (the Prisma 7.x `migrate diff` CLI flags have changed -- read `--help` output before using, per Mistake Log Issue 012).

### 7.3 Backfill Strategy

Existing EInvoice rows (issued before this migration) need transport fields populated for consistency and potential re-issuance:

```sql
-- Backfill transport fields for existing EInvoice rows
UPDATE "EInvoice" e
SET
  "vehiclePlate"   = b_data."licensePlate",
  "departureCity"   = fp."name",
  "destinationCity" = tp."name",
  "transportRoute"  = fp."name" || ' -> ' || tp."name",
  "operatorMst"     = op."taxCode"
FROM "Booking" bk
JOIN "Trip" t ON t.id = bk."tripId"
LEFT JOIN "Bus" bus ON bus.id = t."busId"
LEFT JOIN "Route" r ON r.id = t."routeId"
LEFT JOIN "Place" fp ON fp.id = r."fromPlaceId"
LEFT JOIN "Place" tp ON tp.id = r."toPlaceId"
LEFT JOIN "Operator" op ON op.id = r."operatorId"
CROSS JOIN LATERAL (
  SELECT bus."licensePlate"
) b_data
WHERE e."bookingId" = bk.id
  AND e."vehiclePlate" IS NULL;
```

**Backfill caveats:**

| Risk | Mitigation |
|---|---|
| Trip deleted or soft-deleted | LEFT JOIN returns NULL; fields remain NULL for that invoice |
| Bus reassigned to different trip since invoice | Backfill uses current Bus assignment, not historical; accept inaccuracy for legacy rows |
| Operator taxCode added after invoice was issued | Backfill picks up the current taxCode; acceptable since the MST is an operator attribute, not a per-invoice attribute |
| Large table scan | Run during off-peak hours; batch by `EInvoice.createdAt` range if > 10,000 rows |

### 7.4 Backfill Execution

The backfill is a one-time operational script, NOT part of the Prisma migration (migrations must be idempotent and fast). Run manually after the schema migration completes:

```bash
psql "$DATABASE_URL" -f scripts/backfill-einvoice-transport.sql
```

**Source:** 02-migration-strategy, Mistake Log Issue 007, Mistake Log Issue 012.

---

## 8. Validation and Error Handling

### 8.1 Missing Field Decision Matrix

| Missing Field | Severity | Action | EInvoice Status | Admin Notification |
|---|---|---|---|---|
| `operatorMst` | CRITICAL | Block invoice creation | `blocked` | Yes -- admin must ensure operator completes KYB with MST |
| `vehiclePlate` | WARNING | Create invoice without plate | `pending` (flagged `needsReview`) | Yes -- admin reviews and may correct before MISA submission |
| `departureCity` | WARNING | Create invoice without cities | `pending` (flagged `needsReview`) | Yes |
| `destinationCity` | WARNING | Create invoice without cities | `pending` (flagged `needsReview`) | Yes |
| All present | OK | Create complete transport invoice | `pending` | No |

### 8.2 `needsReview` Flag

Add a boolean `needsReview` column to EInvoice (default `false`). The `einvoiceSubmission` cron skips rows where `needsReview = true` -- these require admin correction before submission to MISA.

Admin UI: filter EInvoice list by `needsReview = true` to surface incomplete invoices.

### 8.3 Blocked Invoice Recovery

When an invoice is `blocked` due to missing `operatorMst`:

1. Admin ensures operator completes KYB with MST.
2. Admin triggers invoice re-creation via `POST /api/admin/einvoice/:id/retry`.
3. Re-creation resolves transport fields again (MST now available).
4. Invoice moves to `pending` status for MISA submission.

**Source:** ADR-014 D1, ADR-014 D3.

---

## 9. E-Invoice Correction Flow

### 9.1 When Correction Is Needed

If transport fields on an already-issued invoice (status = `issued` or `sent`) are discovered to be incorrect:

| Error | Example | Action |
|---|---|---|
| Wrong vehicle plate | Bus plate was updated after invoice issued | Issue correction invoice |
| Wrong departure/destination | Route changed after invoice issued | Issue correction invoice |
| Missing transport fields on issued invoice | Legacy invoice submitted without Decree 70/2025 fields | Issue supplementary invoice |

### 9.2 Correction Invoice Process (Decree 123/2020 Art. 19)

1. **Create new EInvoice row** with:
   - `type = 'correction'` (new enum value on EInvoice)
   - `originalInvoiceId` referencing the incorrect invoice's `id`
   - `originalInvoiceNumber` referencing the incorrect invoice's `invoiceNumber`
   - Corrected transport field values
   - `status = 'pending'`

2. **Submit to MISA** via the correction invoice API endpoint (different from the standard issuance endpoint).

3. **MISA returns** a new invoice number for the correction invoice.

4. **Original invoice** status remains `issued`/`sent` (not changed to `cancelled` -- correction invoices coexist with originals per Decree 123/2020).

### 9.3 Data Model for Corrections

```prisma
model EInvoice {
  // ... existing + new transport fields ...
  type                  EInvoiceType  @default(original)  // original | correction
  originalInvoiceId     String?       // FK -> EInvoice (self-reference)
  originalInvoiceNumber String?       // Snapshot of the original's invoiceNumber
}

enum EInvoiceType {
  original
  correction
}
```

**Source:** Decree 123/2020 Art. 19, ADR-014 D3.

---

## 10. Testing Strategy

### 10.1 Unit Tests

| Test | Assertion |
|---|---|
| Transport field resolution (happy path) | All 5 fields populated from Trip -> Bus/Route/Place/Operator |
| Missing Bus.licensePlate | vehiclePlate is null; invoice created with `needsReview = true` |
| Missing Operator.taxCode | Invoice creation blocked; status = `blocked` |
| Missing Route.fromPlace | departureCity is null; transportRoute is null |
| Vehicle plate regex validation | Valid plates pass; invalid plates logged but stored |
| transportRoute derivation | `"Ha Noi" + "Da Nang"` produces `"Ha Noi -> Da Nang"` |

### 10.2 Integration Tests

| Test | Assertion |
|---|---|
| applyPaidStatusTransition creates EInvoice with transport fields | All 5 fields match source entities |
| Backfill script populates existing rows | Pre-migration rows gain transport fields after backfill |
| MISA XML serialization includes transport elements | `<BienSoXe>`, `<DiemDi>`, `<DiemDen>`, `<TuyenDuong>` present in XML output |

### 10.3 E2E Tests

| Test | Assertion |
|---|---|
| Full booking -> payment -> invoice flow | EInvoice row has vehiclePlate, departureCity, destinationCity, transportRoute, operatorMst |

---

## 11. Known Gaps

| Gap | Category | Risk | Notes |
|---|---|---|---|
| MISA transport invoice template activation | Integration | HIGH | May require MISA support ticket to enable transport template; cannot test without it |
| GDT acceptance testing | Compliance | HIGH | GDT may have specific formatting requirements for transport fields not documented in the decree; requires test submission |
| Bulk backfill for existing invoices | Operations | MEDIUM | Scope depends on volume of already-issued invoices; if > 10,000, needs batched execution |
| Multi-leg trips | Feature | LOW | If a booking covers a route with intermediate stops, the departure/destination should be first origin to final destination; current model assumes single-leg routes |
| Vietnamese diacritics in MISA XML | Integration | LOW | UTF-8 should handle diacritics natively; needs verification with MISA sandbox |
| `needsReview` column addition | Migration | LOW | Requires separate migration if not bundled with transport field migration; trivial `ALTER TABLE ADD COLUMN` |
| Correction invoice MISA API endpoint | Integration | MEDIUM | Correction invoice submission uses a different MISA API path; not yet integrated |
| `EInvoiceType` enum addition | Migration | LOW | New enum value `correction` and `type` column on EInvoice; requires Prisma enum migration |
| Historical invoice re-issuance | Compliance | MEDIUM | Whether GDT requires re-issuance of all historical invoices with transport fields or only prospective compliance; needs legal counsel |
| Bus plate changes between booking and departure | Data integrity | LOW | Plate snapshot at invoice creation may differ from plate at actual departure; legally the invoice should reflect the vehicle used, which is the departure-time plate |
| `originalInvoiceId` self-referential FK | Migration | LOW | Prisma supports self-referential FKs but the migration needs explicit SQL for the constraint |

---

## 12. Decision Log

| # | Decision | Date | Rationale |
|---|----------|------|-----------|
| E1 | Snapshot transport fields on EInvoice (not FK joins at read time) | 2026-06-19 | Invoices are legal documents; content must not change retroactively if source entities are updated |
| E2 | All transport columns nullable | 2026-06-19 | Existing rows lack data; some source entities may lack values; nullable allows gradual rollout |
| E3 | Missing operatorMst blocks invoice creation; missing plate/cities do not | 2026-06-19 | MST is legally required on every invoice (Decree 123/2020 base requirement); transport fields are Decree 70/2025 additions -- issuing without them is non-ideal but better than not issuing at all |
| E4 | Backfill as separate script, not in Prisma migration | 2026-06-19 | Migrations must be fast and idempotent; backfill is a one-time bulk UPDATE with JOINs that may take minutes on large tables |
| E5 | Vehicle plate regex is a warning, not a hard gate | 2026-06-19 | Operators may have non-standard plates (temporary, cross-border ASEAN); rejecting would block legitimate invoices |
| E6 | Correction invoice model (Art. 19) over void-and-reissue | 2026-06-19 | Decree 123/2020 Art. 19 prescribes adjustment/correction invoices for field errors on issued invoices; void-and-reissue is reserved for substantive amount/tax changes |
| E7 | Unicode arrow in transportRoute (`→`) | 2026-06-19 | Vietnamese business convention; clear visual separator; MISA XML UTF-8 encoding handles it natively |
| E8 | `needsReview` flag to hold incomplete invoices from MISA submission | 2026-06-19 | Submitting incomplete transport invoices to MISA may result in GDT rejection; better to hold and fix than submit and correct |
