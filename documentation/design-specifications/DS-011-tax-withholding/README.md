# DS-011 -- Tax Withholding Design

## 1. Overview

This document defines the tax withholding calculation, application, and reporting architecture for the BusBooking platform -- a multi-tenant Vietnam bus booking marketplace that must withhold and remit taxes on behalf of individual and household business operators as mandated by Decree 117/2025 (effective July 2025). The platform acts as a withholding agent: it deducts VAT and PIT from operator payouts before disbursement, remits the withheld amounts to the General Department of Taxation (GDT), and issues withholding certificates to operators for their own tax filings. This document also addresses Foreign Contractor Tax (FCT) obligations for overseas SaaS vendors used by the platform itself, though FCT is an operational concern outside the product scope.

**Source ADRs.** This document synthesizes decisions from ADR-005 (Payment Architecture -- payout flow, settlement timing), ADR-006 (Pricing/Currency -- VND integer arithmetic, BigInt mandate), ADR-014 (E-Invoice Compliance -- tax classification, Decree 123/2020 invoicing). Business context from regulatory/einvoice-tax.md, regulatory/payment.md, domain-model/invariants-catalog.md.

**Cross-references.** 01-data-model-design for `Payout`, `LedgerEntry`, `Operator` entity schemas and `TaxClassification` enum. 05-webhook-design for `calcPayout` BigInt arithmetic and ledger two-entry pattern. 06-background-jobs for `settlePayout` cron flow and `JobRunLog` audit trail. 09-split-settlement (planned) for post-withholding disbursement via VNPay split-settlement.

---

## 2. Regulatory Framework

### 2.1 Tax Withholding by Entity Type

| Entity Type | VAT Rate | PIT/CIT Rate | Total Withholding | Governing Law | Platform Action |
|---|---|---|---|---|---|
| Company (LLC/JSC) | Exempt (self-declares) | Exempt (self-declares) | 0% | Tax Administration Law | No withholding -- operator files and pays own taxes |
| Individual operator | ~3% of revenue | ~1.5% of revenue | ~4.5% | Decree 117/2025 | Platform withholds from payout |
| Household business | ~3% of revenue | ~1.5% of revenue | ~4.5% | Decree 117/2025 | Platform withholds from payout |
| Foreign contractor (Vercel, Resend, Upstash) | 5% of invoice | 5% CIT of invoice | 10% | Circular 103/2014, Circular 69/2025 | Platform pays on own vendor invoices (not operator payouts) |

**Source:** regulatory/einvoice-tax.md, ADR-014 D5.

### 2.2 Legal Basis for Platform Withholding

Under Decree 117/2025, e-commerce platforms that facilitate payments to individual/household business sellers are obligated to:

1. **Withhold** VAT and PIT from each payout at the rates prescribed by the General Department of Taxation.
2. **Remit** withheld amounts to GDT within the quarterly filing deadline (30th of the month following quarter-end).
3. **Issue** tax withholding certificates to operators upon request for their annual personal income tax filings.
4. **Report** total withheld amounts per operator per quarter via the GDT electronic tax filing portal.

Non-compliance: administrative fines of 1x--3x the underwithholding amount, plus 0.03%/day late-payment interest.

**Source:** regulatory/einvoice-tax.md.

---

## 3. Tax Classification Flow

### 3.1 Classification at Onboarding

Tax classification is determined during the operator KYB (Know Your Business) process and stored permanently on the `Operator` model:

```
Operator.taxClassification: TaxClassification  // COMPANY | INDIVIDUAL | HOUSEHOLD
```

| Classification | Required Documents | Tax Code Format | Validation |
|---|---|---|---|
| COMPANY | Business registration certificate (GCN DKKD), MST (tax code) | 10 digits (HQ) or 13 digits (branch: 10-digit parent + 3-digit suffix) | MST regex: `^\d{10}(-\d{3})?$` |
| INDIVIDUAL | Citizen ID (CCCD), personal tax code (MST ca nhan) | 10 digits | MST regex: `^\d{10}$`; CCCD format: 12 digits |
| HOUSEHOLD | Household business registration, personal tax code | 10 digits | Same as INDIVIDUAL |

### 3.2 Classification Immutability

Once an operator's `taxClassification` is set and payouts have been processed:

- **COMPANY -> INDIVIDUAL/HOUSEHOLD**: Requires admin override + retroactive withholding assessment for the current quarter.
- **INDIVIDUAL/HOUSEHOLD -> COMPANY**: Requires admin override + operator provides business registration. Future payouts stop withholding; past withholdings are not refunded (operator claims credit on annual tax filing).
- **Any change**: Creates an `AdminAuditLog` entry with `action = 'tax_classification_changed'`, old/new values, and admin user ID.

**Source:** ADR-014 D1, 01-data-model-design Operator entity.

---

## 4. Calculation Logic

### 4.1 `calcWithholding` Function

```typescript
interface WithholdingResult {
  taxVat: number       // VND integer, VAT withheld
  taxPit: number       // VND integer, PIT withheld
  taxTotal: number     // VND integer, taxVat + taxPit
  netAmount: number    // VND integer, grossOperatorShare - taxTotal
}

function calcWithholding(
  taxClassification: TaxClassification,
  grossOperatorShare: number    // VND integer (already net of platform fee)
): WithholdingResult {
  if (taxClassification === 'COMPANY') {
    return {
      taxVat: 0,
      taxPit: 0,
      taxTotal: 0,
      netAmount: grossOperatorShare,
    }
  }

  // Individual/Household: Decree 117/2025 rates
  // All math in BigInt to prevent representation drift (Mistake Log Issue 016)
  // ES2017 constraint: BigInt(n) constructor calls only, no 1n literal syntax
  const vatRatePpm = BigInt(30000)   // 3.0% as parts-per-million
  const pitRatePpm = BigInt(15000)   // 1.5% as parts-per-million
  const ppmDenom = BigInt(1000000)

  const gross = BigInt(grossOperatorShare)
  const taxVat = gross * vatRatePpm / ppmDenom    // integer division truncates
  const taxPit = gross * pitRatePpm / ppmDenom
  const taxTotal = taxVat + taxPit
  const netAmount = gross - taxTotal

  return {
    taxVat: Number(taxVat),
    taxPit: Number(taxPit),
    taxTotal: Number(taxTotal),
    netAmount: Number(netAmount),
  }
}
```

### 4.2 Arithmetic Rules

| Rule | Implementation | Source |
|---|---|---|
| All currency math via BigInt | `BigInt(grossOperatorShare) * BigInt(ratePpm) / BigInt(1_000_000)` | Mistake Log Issue 016 |
| ES2017 target compatibility | `BigInt(n)` constructor calls only -- `1n`/`2n`/`0n` literal suffixes are parser errors | Mistake Log Issue 016 |
| Rounding policy | Integer division truncates (floor). Conservative: platform withholds slightly less, operator receives slightly more. | Vietnamese tax practice accepts truncation for VND (no sub-unit) |
| Rate encoding | Parts-per-million (ppm): `30000` = 3.0%, `15000` = 1.5% | Consistent with `platformFeePpm` encoding in `calcPayout` |
| Greppable bug smell | `Math.round(<int> * <fractional>)` in any `lib/payouts/**` or `lib/tax/**` file is a representation drift bug | Mistake Log Issue 016 |

### 4.3 Calculation Chain

The full payout calculation chain from gross booking revenue to operator bank transfer:

```
grossBookingAmount (Booking.totalVnd)
  │
  ├─ calcPayout(grossBookingAmount, platformFeePpm)
  │   ├─ platformFee = gross * feePpm / 1_000_000  (BigInt)
  │   └─ operatorShare = gross - platformFee
  │
  └─ calcWithholding(taxClassification, operatorShare)
      ├─ taxVat = operatorShare * 30000 / 1_000_000  (BigInt)
      ├─ taxPit = operatorShare * 15000 / 1_000_000  (BigInt)
      ├─ taxTotal = taxVat + taxPit
      └─ netAmount = operatorShare - taxTotal
          │
          └─ Payout to operator bank = netAmount
```

**Example** (VND 500,000 ticket, 6% platform fee, INDIVIDUAL operator):

| Step | Calculation | Amount (VND) |
|---|---|---|
| Gross booking | -- | 500,000 |
| Platform fee (6%) | 500,000 * 60,000 / 1,000,000 | 30,000 |
| Operator share | 500,000 - 30,000 | 470,000 |
| VAT withheld (3%) | 470,000 * 30,000 / 1,000,000 | 14,100 |
| PIT withheld (1.5%) | 470,000 * 15,000 / 1,000,000 | 7,050 |
| Tax total | 14,100 + 7,050 | 21,150 |
| Net to operator bank | 470,000 - 21,150 | 448,850 |

**Source:** ADR-005 D6, ADR-006 D5, 05-webhook-design section 7.2.

---

## 5. Integration with settlePayout

### 5.1 Current Payout Flow (Without Withholding)

```
settlePayout cron
  → query eligible Payout rows (status='requested', trip completed, T+3 elapsed)
  → calcPayout(gross, platformFeePpm)
  → UPDATE Payout SET grossAmount, platformFee, netAmount, status='processing'
  → initiate bank transfer for netAmount
  → on success: status='paid'
  → on failure: status='failed'
```

### 5.2 New Payout Flow (With Withholding)

```
settlePayout cron
  → query eligible Payout rows (status='requested', trip completed, T+3 elapsed)
  → calcPayout(gross, platformFeePpm)
  → resolve Operator.taxClassification via Payout → Booking → Trip → Route → Operator
  → calcWithholding(taxClassification, operatorShare)
  → UPDATE Payout SET
      grossAmount,
      platformFee,
      taxVat,        // NEW
      taxPit,        // NEW
      taxTotal,      // NEW
      netAmount = operatorShare - taxTotal,   // CHANGED
      status='processing'
  → initiate bank transfer for netAmount
  → on success: status='paid'; append LedgerEntry rows
  → on failure: status='failed'
```

### 5.3 Payout Column Mapping

| Column | Type | Before Withholding | After Withholding |
|---|---|---|---|
| `grossAmount` | Int | Booking.totalVnd | Booking.totalVnd (unchanged) |
| `platformFee` | Int | calcPayout result | calcPayout result (unchanged) |
| `taxVat` | Int | 0 (unused) | calcWithholding result |
| `taxPit` | Int | 0 (unused) | calcWithholding result |
| `taxTotal` | Int | 0 (unused) | calcWithholding result |
| `netAmount` | Int | grossAmount - platformFee | grossAmount - platformFee - taxTotal |
| `status` | PayoutStatus | requested/processing/paid/failed | (unchanged) |

The three tax columns (`taxVat`, `taxPit`, `taxTotal`) already exist on the Payout model as `Int` with default value 0. No migration required for the column additions.

**Source:** 01-data-model-design Payout entity, 06-background-jobs section on settlePayout.

---

## 6. Ledger Entries

### 6.1 Tax Withholding Ledger Rows

On each payout where `taxTotal > 0`, append additional `LedgerEntry` rows within the same `$transaction` as the payout status update:

| Entry Type | `entryType` | Sign | Amount | `sourceEventId` Pattern | Purpose |
|---|---|---|---|---|---|
| VAT withheld | `tax_withheld_vat` | Negative (-) | taxVat | `tax_vat:<payoutId>` | Records VAT deduction from operator share |
| PIT withheld | `tax_withheld_pit` | Negative (-) | taxPit | `tax_pit:<payoutId>` | Records PIT deduction from operator share |

### 6.2 Distinction from Platform Fee

Tax withholding entries are distinct from `platform_fee` entries in both semantics and reporting:

| Dimension | Platform Fee | Tax Withholding |
|---|---|---|
| Nature | Revenue to platform | Regulatory obligation to GDT |
| Beneficiary | Platform | Government |
| Reporting | Platform P&L (revenue line) | Tax remittance report (liability line) |
| Entry type | `platform_fee` | `tax_withheld_vat`, `tax_withheld_pit` |
| Frequency | Every payout | Only INDIVIDUAL/HOUSEHOLD payouts |

### 6.3 Full Ledger Entry Set per Payout (INDIVIDUAL/HOUSEHOLD)

A complete payout for an individual operator produces four `LedgerEntry` rows:

| # | entryType | Sign | Amount | sourceEventId |
|---|---|---|---|---|
| 1 | `booking_credit` | + | grossAmount | `booking:<bookingId>` |
| 2 | `platform_fee` | - | platformFee | `fee:<bookingId>` |
| 3 | `tax_withheld_vat` | - | taxVat | `tax_vat:<payoutId>` |
| 4 | `tax_withheld_pit` | - | taxPit | `tax_pit:<payoutId>` |

Rows 1--2 are created at booking-paid time (webhook handler). Rows 3--4 are created at payout-settlement time (settlePayout cron). The `sourceEventId` unique constraint on LedgerEntry guarantees idempotency for each row independently.

### 6.4 Immutability

All LedgerEntry rows including tax withholding entries are subject to the PostgreSQL `BEFORE UPDATE/DELETE` trigger (`ledger_entry_immutable`). Tax entries are append-only and can never be modified or deleted.

**Correction handling:** If a tax calculation was wrong, a new `tax_adjustment_vat` or `tax_adjustment_pit` entry is appended with the correction amount (positive for underwithholding, negative for overwithholding). The original entries remain intact.

**Source:** ADR-005 D5, 05-webhook-design section 7, 01-data-model-design LedgerEntry entity.

---

## 7. Tax Withholding Certificate

### 7.1 Operator API

Operators need quarterly and annual tax withholding summaries for their own tax filings with GDT.

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/op/tax/withholding-summary` | GET | `requireOperatorAuth` | Aggregated withholding for a period |

**Query parameters:**

| Parameter | Type | Required | Example | Notes |
|---|---|---|---|---|
| `year` | Int | Yes | `2026` | Calendar year |
| `quarter` | String | No | `Q3` | If omitted, returns full-year summary |

**Response:**

```json
{
  "period": { "year": 2026, "quarter": "Q3", "from": "2026-07-01", "to": "2026-09-30" },
  "operator": {
    "companyName": "Nha Xe Phuong Trang",
    "taxCode": "0301234567",
    "taxClassification": "INDIVIDUAL"
  },
  "summary": {
    "totalGrossRevenue": 125000000,
    "totalPlatformFee": 7500000,
    "totalOperatorShare": 117500000,
    "totalTaxVat": 3525000,
    "totalTaxPit": 1762500,
    "totalTaxWithheld": 5287500,
    "totalNetPaid": 112212500,
    "payoutCount": 47
  },
  "payouts": [
    {
      "payoutId": "clx...",
      "settledAt": "2026-08-15T10:30:00+07:00",
      "grossAmount": 2500000,
      "platformFee": 150000,
      "operatorShare": 2350000,
      "taxVat": 70500,
      "taxPit": 35250,
      "taxTotal": 105750,
      "netAmount": 2244250
    }
  ]
}
```

### 7.2 PDF Certificate

Withholding certificates may be exported as PDF using the existing PDF generation pattern (same infrastructure as ticket PDF generation).

| Field | Value |
|---|---|
| Certificate header | "CHUNG TU KHAU TRU THUE" (Tax Withholding Certificate) |
| Withholding agent | Platform legal entity name + MST |
| Taxpayer | Operator name + MST/personal tax code |
| Period | Quarter or year |
| Total income | Sum of operatorShare across payouts in period |
| VAT withheld | Sum of taxVat |
| PIT withheld | Sum of taxPit |
| Total withheld | Sum of taxTotal |

**Source:** Decree 117/2025 withholding certificate requirements.

---

## 8. Foreign Contractor Tax (FCT)

### 8.1 Scope

FCT applies to the platform's own payments to overseas SaaS vendors, NOT to operator payouts:

| Vendor | Service | Monthly Cost (est.) | FCT Rate | FCT Amount |
|---|---|---|---|---|
| Vercel | Hosting, Edge, Cron | ~USD 20/month | 10% (5% VAT + 5% CIT) | ~USD 2 |
| Resend | Email delivery | ~USD 10/month | 10% | ~USD 1 |
| Upstash | Redis (rate limiting) | ~USD 10/month | 10% | ~USD 1 |
| Sentry | Error monitoring | ~USD 26/month | 10% | ~USD 2.60 |

### 8.2 Compliance

- Platform must self-assess and remit FCT within 10 days of each payment to a foreign contractor.
- Filing: quarterly FCT declaration on GDT portal.
- Documentation: foreign contractor invoices + proof of payment + FCT calculation worksheet.

### 8.3 Out of Product Scope

FCT is an operational/accounting obligation, not a product feature. It does not affect operator payouts, customer pricing, or any in-app flow. Tracked in the platform's accounting ledger (manual or accounting software), not in the BusBooking LedgerEntry table.

**Source:** Circular 103/2014, Circular 69/2025, ADR-014 D5.

---

## 9. Admin Dashboard

### 9.1 Tax Withholding Summary API

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/admin/tax/withholding-summary` | GET | `requireAdminAuth` | Cross-operator withholding summary |

**Query parameters:**

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `year` | Int | Yes | Calendar year |
| `quarter` | String | No | Q1/Q2/Q3/Q4; omit for full year |
| `taxClassification` | String | No | Filter by INDIVIDUAL/HOUSEHOLD |
| `operatorId` | String | No | Filter by specific operator |

**Response includes:**

- Total withheld by entity type (INDIVIDUAL vs HOUSEHOLD)
- Total withheld per operator
- Quarterly filing deadline status
- Variance report: expected withholding (rate * operator shares) vs actual withheld (sum of LedgerEntry tax rows)

### 9.2 Tax Remittance Tracking

The platform must remit withheld taxes to GDT quarterly. Admin dashboard tracks:

| Metric | Source | Alert |
|---|---|---|
| Total VAT withheld this quarter | SUM(LedgerEntry.amount) WHERE entryType='tax_withheld_vat' AND createdAt in quarter | -- |
| Total PIT withheld this quarter | SUM(LedgerEntry.amount) WHERE entryType='tax_withheld_pit' AND createdAt in quarter | -- |
| Filing deadline | 30th of month following quarter-end | P2 alert 7 days before deadline |
| Remittance status | Manual toggle (filed/not-filed) | P1 alert if not filed by deadline |

### 9.3 Quarterly Filing Deadlines

| Quarter | Period | Filing Deadline |
|---|---|---|
| Q1 | Jan 1 -- Mar 31 | April 30 |
| Q2 | Apr 1 -- Jun 30 | July 30 |
| Q3 | Jul 1 -- Sep 30 | October 30 |
| Q4 | Oct 1 -- Dec 31 | January 30 (next year) |

**Source:** ADR-014 D5, regulatory/einvoice-tax.md.

---

## 10. Rate Configuration

### 10.1 Default Rates

| Rate | Value (ppm) | Percentage | Notes |
|---|---|---|---|
| VAT withholding | 30,000 | 3.0% | Decree 117/2025 transport services |
| PIT withholding | 15,000 | 1.5% | Decree 117/2025 transport services |
| Total withholding | 45,000 | 4.5% | Combined |
| Platform fee (default) | 60,000 | 6.0% | ADR-005, configurable per operator via FeeConfig |

### 10.2 Rate Change Strategy

Tax rates are set by government decree and cannot be negotiated per operator. When rates change:

1. Admin updates the rate constants in `lib/tax/rates.ts`.
2. Change is effective from a specific date (decree effective date, not deploy date).
3. The `calcWithholding` function accepts an optional `effectiveDate` parameter to apply the correct rate for historical vs current calculations.
4. LedgerEntry rows record the rate applied (stored in the entry metadata or derivable from the payout's `settledAt` timestamp and the rate schedule).

### 10.3 Revenue Threshold Exemption

Decree 117/2025 may exempt individual operators below a certain annual revenue threshold from withholding (threshold TBD -- see Known Gaps). If implemented:

- Track cumulative `operatorShare` per operator per calendar year.
- When cumulative revenue crosses the threshold mid-year, begin withholding on subsequent payouts.
- No retroactive withholding for payouts below the threshold.

---

## 11. Known Gaps

| Gap | Category | Risk | Notes |
|---|---|---|---|
| Decree 117/2025 exact rate confirmation | Regulatory | HIGH | 3%/1.5% are estimates from business documentation; must verify with tax counsel before go-live |
| Revenue threshold exemption | Regulatory | MEDIUM | Individual operators below a certain annual revenue may be exempt from withholding; threshold not yet confirmed |
| Tax withholding certificate PDF template | Feature | MEDIUM | PDF layout and legal text not yet designed; requires legal review for compliance |
| GDT electronic tax filing integration | Feature | LOW (Stage 0) | Manual filing acceptable initially; API integration with GDT portal is a future optimization |
| Retroactive withholding | Operations | MEDIUM | If individual operators are already receiving payouts without withholding when this feature launches, the current quarter's prior payouts may need adjustment |
| Rate change effective date handling | Feature | LOW | Current design uses compile-time constants; a rate schedule table may be needed if rates change mid-quarter |
| Underwithholding correction workflow | Operations | MEDIUM | If a COMPANY operator is reclassified to INDIVIDUAL, underwithholding for the current quarter must be assessed and collected |
| FCT remittance automation | Operations | LOW | Currently manual; low volume (< USD 100/month total FCT) makes automation unjustified |
| Operator tax certificate download (PDF) | Feature | MEDIUM | JSON API defined; PDF generation not yet implemented |
| Quarterly tax remittance filing automation | Feature | LOW | Manual GDT portal filing at Stage 0; automation deferred to post-launch |

---

## 12. Decision Log

| # | Decision | Date | Rationale |
|---|----------|------|-----------|
| T1 | Withholding applied at payout settlement, not at booking-paid | 2026-06-19 | Booking-paid ledger entries record gross amounts for accurate revenue reporting; withholding is a disbursement-time deduction, not a revenue recognition event |
| T2 | Tax rates encoded as ppm (parts-per-million) integers, consistent with platformFeePpm | 2026-06-19 | Eliminates floating-point representation drift; all rate arithmetic stays in BigInt domain |
| T3 | Truncation (floor) rounding for tax amounts, not half-even | 2026-06-19 | Conservative -- platform withholds slightly less; VND has no sub-unit; Vietnamese tax practice accepts truncation |
| T4 | Separate LedgerEntry rows for VAT vs PIT (not a single combined tax entry) | 2026-06-19 | GDT quarterly filing requires separate VAT and PIT totals; combined entry would require decomposition at reporting time |
| T5 | COMPANY classification exempts from ALL withholding (not just reduced rate) | 2026-06-19 | Companies self-declare and remit their own taxes; platform has no withholding obligation for corporate entities |
| T6 | FCT excluded from product scope (operational/accounting only) | 2026-06-19 | FCT applies to platform vendor payments, not operator payouts; volume too low (< USD 100/month) to justify product features |
| T7 | Tax columns (taxVat, taxPit, taxTotal) reuse existing Payout columns rather than new model | 2026-06-19 | Columns already exist with Int type and default 0; no migration needed; avoids model proliferation |
