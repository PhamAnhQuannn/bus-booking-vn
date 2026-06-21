# HD-007: Regulatory & Compliance Audit

> Status: NOT_STARTED | References: ADR-008 D11, ADR-014, FI-002, FI-013, FI-015, PDPL 2025

## Purpose

Verify compliance with Vietnam regulatory requirements before production launch: data protection (PDPL 2025), payment regulation (Decree 52/2024), e-invoicing (Decree 70/2025), tax withholding (E-Commerce Law 2025), consumer protection (CPL 2023), and breach notification obligations.

## Skill Invocation

- **Primary**: `/privacy-policy` + `/terms-of-service` -- legal document review
- **Supplementary**: `/pii-inventory` -- data classification verification

## Acceptance Criteria

### Data Protection Officer (PDPL 2025)

- [ ] DPO appointed (mandatory for platforms processing sensitive personal data -- no SME exemption for payment data processors)
- [ ] DPO contact information published in privacy policy
- [ ] DPO reachable via documented internal escalation path

### Data Processor Agreements (PDPL 2025 Art. 25)

Phase 1 processors:
- [ ] DPA signed with SePay (bank transfer webhook -- processes transaction amounts, sender info, memo text)
- [ ] DPA signed with eSMS (SMS delivery -- processes phone numbers)
- [ ] DPA signed with Resend (email delivery -- processes email addresses)
- [ ] DPA signed with MISA (e-invoicing -- processes customer names, tax IDs)
- [ ] Each DPA specifies: purpose limitation, retention period, breach notification obligation, data deletion on termination

Phase 2 (when MoMo/VNPay ship):
- [ ] DPA signed with VNPay (payment processing -- processes payment data)
- [ ] DPA signed with MoMo (payment processing -- processes payment data)

### Cross-Border Data Transfer (Decree 53/2022, Law 116/2025)

- [ ] If Resend (US-hosted) processes customer email addresses: CDTIA filed with MPS A05 within 60 days of go-live
- [ ] If Vercel used for any log processing: CDTIA filed (FI-008 gap)
- [ ] If all processing on FPT Cloud Vietnam: CDTIA obligation eliminated -- document this determination
- [ ] No production PII in non-Vietnam environments (staging, CI)

### DSAR Response (PDPL 2025 Art. 14)

- [ ] Data export API: customer can request all personal data within 72 hours (FI-013 -- NOT IMPLEMENTED)
- [ ] Data deletion API: customer can request deletion within 72 hours
- [ ] `piiAnonymization` cron built and tested (schema ready, service absent per FI-013)
- [ ] Anonymization preserves ledger integrity (booking amounts, not customer identity)

### Breach Notification (ADR-008 D11)

- [ ] 72-hour notification playbook to MPS A05 documented
- [ ] 24-hour notification path for cyberattacks documented
- [ ] If payment data involved: parallel SBV notification documented
- [ ] Pre-staged notification template prepared
- [ ] Tabletop exercise completed (quarterly cadence, first exercise mandatory before go-live)
- [ ] Evidence preservation: AdminAuditLog append-only + structured logs 24-month retention

### Consent Management (PDPL 2025 Art. 9)

- [ ] T1 data collection: consent recorded at registration (name, phone, email)
- [ ] T2 data collection: explicit additional consent for payment data, location, government ID
- [ ] Consent withdrawal mechanism available to users
- [ ] Consent records retained for audit (minimum duration of data processing + 1 year)

### E-Invoice Compliance (Decree 70/2025)

- [ ] Transport-specific fields mapped to MISA XML payload:
  - [ ] `vehiclePlate` (bus license plate)
  - [ ] `departureCity` (departure location)
  - [ ] `destinationCity` (destination location)
  - [ ] `MST` (tax registration number)
- [ ] Missing field = non-compliant invoice (fine: 4,000,000-8,000,000 VND per invoice per FI-015)
- [ ] E-invoice issued via MISA GDT-certified provider (Circular 32/2025)

### Tax Withholding (E-Commerce Law 2025, effective Jul 2026)

- [ ] `calcWithholding()` service function implemented (FI-010 -- absent)
- [ ] Individual/household operators: ~3% VAT + ~1.5% PIT withheld
- [ ] Corporate operators: exempt from platform withholding (self-report)
- [ ] Schema columns `taxVat`, `taxPit`, `taxTotal` populated by `settlePayout` cron
- [ ] Withholding report exportable for quarterly GDT filing

### Consumer Protection (CPL 2023)

- [ ] Customer complaint: 3-day acknowledge, 30-day resolve (Law 19/2023)
- [ ] No trapping customer funds in platform credit (refund to original payment method)
- [ ] `paid -> cancelled` customer self-cancel: legal opinion obtained on bus ticket exemption OR flow implemented (FI-007 gap)

### Payment Regulation (Decree 52/2024)

- [ ] Central collection model applies regardless of payment channel (bank transfer or PSP)
- [ ] Phase 1 (bank transfer): customers pay to platform's Agribank account -> platform disburses to operators
- [ ] This may constitute `thu ho/chi ho` under Decree 52/2024 -- legal determination required
- [ ] Resolution documented: IPS license obtained OR legal opinion confirming exemption
- [ ] Cross-ref HD-006 for full payment security audit

## Verdict

**PASS** when: DPO appointed, all DPAs signed, CDTIA filed (if applicable), breach playbook tested, e-invoice transport fields mapped, and payment collection model has legal clearance. Tax withholding may be deferred if pre-Jul-2026 launch.

## Cross-References

- ADR-008 D11 -- breach notification playbook
- ADR-014 -- data classification and privacy
- FI-002 -- operator onboarding (DPA, DPO gaps)
- FI-013 -- customer account (DSAR, anonymization gaps)
- FI-015 -- e-invoice (Decree 70/2025 transport fields)
- FI-007 -- booking flow (CPL 2023 cancellation gap)
- FI-008 -- payment integration (CDTIA, collection model)
- FI-010 -- payout system (tax withholding)
- HD-006 -- payment webhook security (collection model cross-ref)
