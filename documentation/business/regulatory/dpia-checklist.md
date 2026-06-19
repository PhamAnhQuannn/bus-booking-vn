# DPIA Checklist — Vietnam Bus Marketplace

> Data Protection Impact Assessment per PDPL 2025 (Law No. 91/2025/QH15, effective January 1, 2026) + Decree 356/2025/ND-CP.
> Last researched: June 2026.

---

## A. Data Inventory

| Data Category | Specific Fields | Classification | Where Collected |
|---------------|-----------------|----------------|-----------------|
| Identity | Full name, date of birth | Basic personal data | Registration, booking |
| Contact | Phone number, email address | Basic personal data | Registration, OTP verification |
| Booking history | Trip ID, origin/destination, seat number, departure time, booking ref | Basic personal data | Booking flow |
| Payment tokens | Method type, last 4 digits, transaction ID | Financial (Sensitive) | Payment flow (stored by PSP, not us) |
| Payment records | Amount, PSP reference, payment status | Financial (Sensitive) | Payment flow |
| Government ID | CCCD/CMND number (if collected) | Sensitive | Identity verification (if required) |
| Location | IP address, GPS coordinates (if enabled) | Sensitive (precise location) | App usage, booking flow |
| Device/session | Browser fingerprint, device ID, session tokens | Basic personal data | All authenticated sessions |
| OTP attempts | Phone number, attempt count, timestamps | Basic personal data (security) | OTP verification flow |
| Operator data (B2B) | Name, phone, company name, tax code | Basic personal data | Operator registration |
| Operator bank account (PayoutAccount) | Full account number, bank name, branch, account holder name | Financial (Sensitive) | Payout processing (stored in plaintext — encryption pending) |
| Support tickets | Complaint content, name, phone | Basic/Sensitive (content-dependent) | Support flow |

---

## B. Legal Basis per Data Category

| Category | Legal Basis (Art. 9/11/19) | Notes |
|----------|---------------------------|-------|
| Registration data (name, phone, email) | Consent (Art. 9) | Collected at signup; consent banner required |
| Booking history | Contract performance (Art. 19.1) | Necessary to fulfill the transport booking |
| Payment data | Contract + Legal obligation | Tax/e-invoice laws mandate retention |
| OTP security logs | Legitimate interests + security | Rate-limit enforcement, fraud prevention |
| Location (GPS) | Explicit consent | Sensitive under Decree 356; separate opt-in required |
| Financial records | Legal obligation | 5-10 year retention per Accounting Law / Decree 123 |
| Government ID | Consent or Legal obligation | Only if KYC/AML regulations require collection |
| Marketing communications | Consent | Separate consent; cannot bundle with service access |
| Analytics/behavioral | Consent | Cookie consent required; separate from service consent |

---

## C. Cross-Border Transfer Assessment (CDTIA/TIA)

| Dimension | Detail |
|-----------|--------|
| Trigger | Vercel Singapore hosting = Vietnamese user data transits outside Vietnam |
| TIA required | Yes -- within 60 days of first data transfer offshore |
| Filing authority | Ministry of Public Security portal (A05 Department) |
| Contents | Explicit consent record, protection measures, recipient identity, retention periods, risk assessment, binding transfer contract |
| Exemptions | Employee cloud storage, payment transfer logistics -- customer PII is NOT exempt |
| Mitigation option A | Vietnam-hosted DB for PII with Singapore for compute only |
| Mitigation option B | File TIA with binding transfer agreement between controller and processor |
| Risk | MPS can suspend transfers deemed threatening to "national interests" (vague standard; no precedent yet) |

---

## D. Consent Mechanism Requirements

| Requirement | Detail |
|-------------|--------|
| Standard | Voluntary, specific, informed, purpose-specific |
| Pre-ticked boxes | Prohibited |
| Bundled consent | Prohibited -- cannot tie marketing consent to service access |
| Separate consent per purpose | (1) Service delivery, (2) Marketing, (3) Analytics, (4) Location |
| Sensitive data | Explicit additional consent required (location, financial, government ID) |
| Right to withdraw | One-click in account settings; must be as easy as granting |
| Consent documentation | Log timestamp, policy version, user ID, purpose for each consent event |
| Children | Enhanced protection; parental consent required if under 16 |
| Silence | Silence, inactivity, or pre-ticked boxes do NOT constitute consent |
| Language | Consent text must be in Vietnamese (primary) with optional English |

---

## E. Data Retention Periods

| Category | Retention Period | Legal Basis |
|----------|-----------------|-------------|
| Booking records | 5 years | Accounting Law |
| Payment records / invoices | 10 years | Decree 123/2020, Decree 70/2025 |
| OTP attempt logs | 90 days | Security (internal policy) |
| Session tokens | Until expiry (max 15 min for operator JWT) | Security (internal policy) |
| Identity data post-deletion request | Delete within 10-20 working days | PDPL 2025 (Art. 14) |
| Support tickets | 2 years after resolution | Internal policy |
| Marketing consent records | Duration of consent + 1 year | Audit trail requirement |
| Financial transaction logs | 5-10 years | AML/CTF regulations |
| Location data (GPS) | Session only -- do not persist | Data minimization principle |
| Behavioral/analytics data | 13 months | Cookie consent best practice |

---

## F. Breach Notification Procedures

| Step | Timeline | Authority | Notes |
|------|----------|-----------|-------|
| Internal detection | 0 hours | SOC / on-call engineer | Automated alerting via observability stack |
| Internal escalation | 0-2 hours | DPO + CEO | Invoke incident response playbook |
| Notify MPS (A05 Department) | Within 72 hours | Ministry of Public Security | File via MPS portal; include scope, affected count, remediation |
| Notify affected users | Within 72 hours | Data subjects | In-app notification + email/SMS |
| Notify SBV | If payment data involved | State Bank of Vietnam | Additional obligation for financial data breaches |
| Forensic investigation | Within 30 days | Internal + external counsel | Preserve evidence; engage forensic firm if needed |
| Remediation report | 30 days post-breach | MPS | Document root cause, remediation, prevention measures |
| Penalties | -- | -- | Up to VND 3 billion or 5% annual revenue (whichever higher) |

---

## G. DPO Responsibilities

| Dimension | Detail |
|-----------|--------|
| Requirement | Mandatory under PDPL 2025 for all organizations from January 1, 2026 |
| SME exemption | 5-year grace period if <100,000 records AND no sensitive data AND not providing data processing services to third parties |
| Bus marketplace eligibility | **Required at launch.** Platform stores operator bank account numbers (PayoutAccount.accountNumber = sensitive financial PII per PDPL Art. 12). SME grace period (Art. 9) does not apply when sensitive data is processed. Appoint DPO before launch. |
| Appointment form | Internal designated personnel, internal department, or external service provider |
| Core responsibilities | DPIA preparation and filing, CDTIA/TIA filing, breach coordination, consent management, data subject request handling, staff training |
| Data subject request SLA | Acknowledge within 2 working days; complete within 10-20 working days |
| Reporting line | Direct access to senior management; independent from business operations |
| Training | Annual data protection training for all staff handling personal data |

---

## H. DPIA Filing Checklist

- [ ] Identify all processing activities (see Section A)
- [ ] Classify each activity as standard or high-risk processing
- [ ] Document purpose, legal basis, data categories, retention periods, security measures, and data recipients for each activity
- [ ] Assess necessity and proportionality of each processing activity
- [ ] Identify and document risks to data subjects
- [ ] Define risk mitigation controls for each identified risk
- [ ] Submit DPIA to MPS within 60 days of start of processing
- [ ] Submit TIA/CDTIA within 60 days of first offshore data transfer
- [ ] Update DPIA every 6 months or upon material change in processing
- [ ] Retain all DPIA documentation (controller + processor copies)
- [ ] Confirm DPO appointment (or document SME exemption rationale)
- [ ] Verify consent mechanisms are implemented and logging correctly
- [ ] Verify breach notification procedures are documented and tested
- [ ] Verify data retention automation matches periods in Section E

---

## I. Risk Flags for Bus Marketplace

| Risk | Severity | Mitigation |
|------|----------|------------|
| Phone as primary ID (OTP-based auth) | HIGH | Minimize collection; mask phone in all logs (already implemented via logger redaction) |
| Payment tokens stored by PSP | MEDIUM | Confirm PSP's SBV-compliant data handling; no card numbers stored locally |
| Booking history = movement pattern inference | MEDIUM | Anonymize analytics data; do not expose full history to third parties |
| Location via IP address | LOW-MEDIUM | Log minimization; do not persist resolved geolocation |
| Cross-border data on Vercel Singapore | HIGH | File TIA within 60 days; evaluate Vietnam-hosted DB for PII isolation |
| Cross-border data on Upstash Redis (SG/US) | HIGH | Rate-limit counters keyed by IP address (PII under PDPL 2025); OTP JTI tokens. Requires CDTIA coverage |
| Cross-border data on Resend (US) | MEDIUM | Email delivery with customer email addresses. Requires CDTIA coverage |
| OTP attempt logs containing phone numbers | MEDIUM | Phone redaction in structured logs (already implemented); 90-day retention cap |
| Operator staff personal data | MEDIUM | Include in DPIA scope; apply same retention and consent rules as customer data |
| Government ID collection (if added) | HIGH | Collect only if legally required; encrypt at rest; strict access control |
| Analytics/cookie tracking | MEDIUM | Cookie consent banner required before any non-essential tracking |
