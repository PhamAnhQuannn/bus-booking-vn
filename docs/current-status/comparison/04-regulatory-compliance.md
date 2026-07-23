# Regulatory Compliance — Spec vs Reality

Comparison of HD-007, FI-013, FI-015, FI-010 requirements against implementation status.

> **Phase 1 note (GL-006):** Family operator, <10k users. Most regulatory items deferred per GL-006. Only privacy policy + terms of service needed for Phase 1. DPO, DPAs, CDTIA, DSAR, e-invoice, tax withholding, breach playbook all Phase 2+ triggers.

---

## 1. Data Protection Officer (DPO)

**Spec says (HD-007 Section 1):**
- PDPL 2025: DPO appointment mandatory. No SME exemption for platforms processing personal data.
- Published DPO contact in privacy policy and registration page.

**Reality:** NOT DONE. No DPO appointed. No privacy policy published on the platform.

**Gap:** Legal obligation unmet. DPO must be a named individual with contact information published per PDPL 2025.

---

## 2. Data Processor Agreements (DPAs)

**Spec says (HD-007 Section 2, PDPL 2025 Art. 25):**

Phase 1 DPAs required with:
| Processor | Service | Data Processed |
|---|---|---|
| SePay | Bank transfer webhooks | Customer names, booking refs, amounts |
| eSMS | SMS dispatch | Phone numbers, OTP codes |
| Resend | Email dispatch | Email addresses, booking details |
| MISA | E-invoice submission | Customer names, tax IDs, amounts |

Each DPA must specify: purpose limitation, retention period, breach notification timeline, data deletion on termination.

Phase 2 DPAs (when MoMo/VNPay ship): VNPay, MoMo.

**Reality:** NOT DONE. No DPAs signed with any vendor. Vendor relationships are informal/API-key-only.

**Gap:** PDPL 2025 Art. 25 violation. Any vendor data breach = platform liability without DPA protection.

---

## 3. Cross-Border Data Transfer (CDTIA)

**Spec says (HD-007 Section 3, Decree 53/2022, Law 116/2025):**
- If Resend (US-based) is used for email: Cross-border Data Transfer Impact Assessment must be filed with MPS A05 within 60 days of go-live
- If Vercel (Singapore) is used for hosting: Same CDTIA requirement
- If FPT Cloud Vietnam only: CDTIA obligation eliminated — document the determination

**Reality:** UNKNOWN. No CDTIA analysis has been performed. Decision on email provider (Resend vs alternative) not finalized.

**Gap:** If using any non-Vietnam service that processes PII, CDTIA filing is legally required. Decision tree:
- FPT Cloud + Vietnam-based email = no CDTIA needed
- FPT Cloud + Resend (US) = CDTIA required for email PII
- Vercel hosting = CDTIA required for all PII

---

## 4. DSAR API (Data Subject Access Request)

**Spec says (FI-013, PDPL 2025 Art. 14):**
- 72-hour response deadline for data export requests
- 72-hour response deadline for data deletion requests
- Customer self-service data export endpoint
- Customer self-service account deletion endpoint (with anonymization, not hard delete)
- `lib/account/retentionPolicy.ts` should implement anonymization logic

**Reality:**
- `lib/account/anonymizeCustomer.ts` exists (anonymization logic implemented)
- `POST /api/account/delete` exists (account deletion endpoint)
- No data export endpoint exists (`GET /api/account/export` or equivalent)
- No admin DSAR response workflow
- Schema supports soft-delete (`deletedAt` nullable DateTime on Customer)

**Gap:** Deletion path exists. Export path does not. No admin workflow for handling DSAR requests within 72-hour deadline.

**Resolution:** Implement data export endpoint. Document admin DSAR response procedure.

---

## 5. PII Anonymization Cron

**Spec says (FI-013, SI-006 Section 5.2, DS-006):**
- `piiAnonymization` cron route: daily at 03:00 VN time
- Anonymize guest booking PII after retention period (5 years per DS-006)
- Preserve ledger integrity (anonymize names/phones but keep financial records intact)
- Must not break `LedgerEntry` append-only invariant

**Reality:**
- Route `/api/cron/retention` exists in current-status/23-api-cron-dev.md
- `lib/account/retentionPolicy.ts` exists
- Actual anonymization logic implementation status unclear — schema supports it, service may be stub

**Gap:** Route exists but service completeness not verified. Need to confirm anonymization actually runs and preserves ledger integrity.

---

## 6. Breach Notification Playbook

**Spec says (HD-007 Section 5, PDPL 2025 Art. 21, ADR-008 D11):**
- 72-hour notification to MPS A05 for data breaches
- 24-hour notification for cyberattacks
- If payment data involved: parallel SBV notification
- Tabletop exercise completed quarterly, mandatory before go-live
- Evidence preservation: AdminAuditLog append-only + 24-month structured logs

**Reality:**
- `AdminAuditLog` model exists (append-only, immutable)
- Pino structured logging implemented
- NO breach notification playbook documented
- NO tabletop exercise executed
- NO notification templates or contact lists for MPS A05 / SBV

**Gap:** Technical evidence infrastructure exists (audit log, structured logs). Procedural response plan does not.

---

## 7. E-Invoice Transport Fields (Decree 70/2025)

**Spec says (FI-015, HD-007 Section 7):**
- Transport-specific fields required in MISA XML payload:
  - `vehiclePlate` (bus license plate)
  - `departureCity` (origin city name)
  - `destinationCity` (destination city name)
  - `operatorMst` (operator tax registration number / MST)
- Missing fields = non-compliant invoice → fine 4M-8M VND per invoice
- MISA must be GDT-certified provider (Circular 32/2025)

**Reality:**
- `EInvoice` model exists in Prisma schema with snapshot approach (denormalized fields)
- `EInvoiceType` enum exists (original, correction)
- `einvoiceSubmission` cron exists
- Transport-specific field MAPPING to MISA API payload NOT implemented
- `vehiclePlate`, `departureCity`, `destinationCity`, `operatorMst` NOT in MISA submission code

**Gap:** E-invoice infrastructure exists. Transport-specific fields (mandatory for transport businesses under Decree 70/2025) NOT mapped to MISA payload.

**Resolution:** Map 4 transport fields from Trip/Bus/Route/Operator models to MISA XML. Test with MISA sandbox.

---

## 8. Tax Withholding (E-Commerce Law 2025)

**Spec says (FI-010 Section 7.6, HD-007 Section 8, HD-009):**
- Effective **1 July 2026**
- Individual/household operators: ~3% VAT + ~1.5% PIT deducted from payouts
- Corporate operators: exempt (self-report)
- `calcWithholding()` service function
- `applyWithholding()` integration in `settlePayout` cron
- Schema columns: `taxVat`, `taxPit`, `taxTotal` on Payout model
- Withholding report exportable for quarterly GDT filing

**Reality:**
- No `calcWithholding()` function exists
- No `applyWithholding()` function exists
- No `taxVat`, `taxPit`, `taxTotal` columns on Payout model
- `settlePayout` cron does not deduct tax
- Operator payouts compute without tax deduction

**Gap:** ENTIRE tax withholding system absent.

**Deferral:** If launch is pre-July 2026, deferral is legally acceptable. Must implement before 1 July 2026 effective date.

---

## 9. Consumer Protection (CPL 2023)

**Spec says (HD-007 Section 9):**
- Customer complaint: 3-day acknowledge, 30-day resolve (Law 19/2023)
- No trapping customer funds (refund capability required)
- `paid -> cancelled` customer self-cancel: legal opinion needed OR flow implemented

**Reality:**
- Charter request lifecycle exists (complaint-adjacent but not general complaints)
- No `complaintSlaMon` cron (specified in DS-006, not built)
- Customer refund endpoint NOT IMPLEMENTED (see 01-critical-blockers.md Section 6)
- No general complaint submission endpoint

**Gap:** Complaint tracking and refund capability both absent. CPL 2023 compliance requires at minimum a refund path.

---

## 10. Consent Management (PDPL 2025 Art. 9)

**Spec says (HD-007 Section 6):**
- T1 data collection (name, phone, email): consent at registration
- T2 data collection (payment details, location, gov ID): explicit consent before processing
- Withdrawal mechanism available
- Records retained for audit duration + 1 year

**Reality:**
- `lib/booking/consent.ts` exists with `CONSENT_VERSION` and `CONSENT_TEXT`
- Booking flow captures consent
- No standalone consent management UI (view/withdraw)
- No consent record retention tracking

**Gap:** Basic consent capture exists. Full PDPL-compliant consent management (view, withdraw, audit trail) not built.
