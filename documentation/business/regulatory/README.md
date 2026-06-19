# Vietnam Regulatory Scan — Bus Booking Platform

> Deep-researched June 2026 across 16 regulatory domains using current Vietnamese law.
> 35 findings, 26 open risks, 5 cross-domain conflicts.

## Cross-Domain Conflicts (must resolve with legal counsel)

| # | Conflict | Domains | Risk |
|---|----------|---------|------|
| C1 | Data localization applies automatically for domestic enterprises (Decree 53/2022) but enforcement has been selective. Singapore DB is technically non-compliant but MPS enforcement against startups is not yet observed. | Data + Privacy | MPS can request localization at any time; forced emergency migration |
| C2 | Commission deduction: VNPay settling to platform account first (not operator) looks like payment intermediary regardless of contract label. Decree 52/2024 Article 3(17) "thu ho chi ho" definition could cover this. | Payment + E-Invoice | SBV could classify as unlicensed payment intermediary |
| C3 | 3-day cancellation right (Consumer Protection Law 2023, Art. 29) applies to remote contracts. Bus tickets pre-departure likely qualify. Conflicts with industry no-refund practice. | Consumer + Transport | Must design refund policy compliant with new law |
| C4 | MOIT sees platform as "e-commerce trading platform" (Decree 85/2021). BGTVT has no specific classification for online bus booking platforms. Regulatory gap between two ministries. | Transport + E-Commerce | Either ministry could assert jurisdiction |
| C5 | Not a direct AML reporting entity without payment license. But tracking cash-on-board bookings could look like informal payment processing. | Payment + AML | Gray area; avoid cash tracking features until clarified |

## Domain Index

| # | Domain | File | Urgency |
|---|--------|------|---------|
| 1-2 | Data Residency + Privacy | [data-privacy.md](data-privacy.md) | BLOCKING |
| 3 | Payment Regulations | [payment.md](payment.md) | BLOCKING |
| 4-5 | E-Invoice + Tax | [einvoice-tax.md](einvoice-tax.md) | BLOCKING |
| 6 | Telecom / SMS / OTP | [telecom-sms.md](telecom-sms.md) | BLOCKING |
| 7 | Transportation | [transport.md](transport.md) | BLOCKING |
| 8-9 | Legal Entity + E-Commerce | [legal-entity.md](legal-entity.md) | BLOCKING |
| 10-11 | Consumer Protection + Advertising | [consumer-protection.md](consumer-protection.md) | BLOCKING |
| 12-16 | Labor, AML, IP, Insurance, Accessibility | [labor-aml-ip.md](labor-aml-ip.md) | MEDIUM |

## Priority Matrix

### BLOCKING — Before go-live

| # | Item | Lead time | Notes |
|---|------|-----------|-------|
| 1 | Legal entity (LLC + ERC + tax code + seal) | 1-2 weeks | First step. Everything depends on this |
| 2 | Sector classification legal opinion | 1-2 weeks | Determines foreign ownership, VSIC codes |
| 3 | Payment model: marketplace confirmed | Decision | Fund flow through VNPay → operator account |
| 4 | MOIT e-commerce platform registration | 2-4 weeks | Need operational rules, privacy policy, dispute mechanism |
| 5 | Brandname SMS registration | 2-4 weeks | Hard blocker for production OTP |
| 6 | Privacy policy + ToS (PDPL 2025 + CPL 2023) | Legal draft | Consent UI, data rights, cancellation policy |
| 7 | E-invoice issuer role clarified | Legal opinion | Marketplace: operator issues ticket invoice |
| 8 | Operator onboarding: license + insurance + tax code | Process design | Must verify before listing |
| 9 | Transfer Impact Assessment (CDTIA) | Document prep | Required under PDPL for any overseas processing |
| 10 | Complaint handling system | Build | 3-day acknowledge, 7-30 day resolve |

### HIGH — Within 3 months post-launch

| # | Item |
|---|------|
| 11 | DPIA filing with A05/MPS |
| 12 | Trademark registration filed (12-18mo process) |
| 13 | .vn domain registered |
| 14 | Zalo Official Account + ZNS integration |
| 15 | DPAs with all processors |
| 16 | New E-Commerce Law 2025 review (effective July 2026) |

### MEDIUM — Within 6 months

| # | Item |
|---|------|
| 17 | VN cloud migration plan (Viettel/FPT/VNG Cloud) |
| 18 | Cyber insurance (Bao Viet/PVI SME package) |
| 19 | Promotion registration process with MOIT |
| 20 | Annual MOIT reporting setup |

## Consolidated Pre-Launch Compliance Checklist

All compliance actions from domain files in one view. See each domain file for regulatory detail.

### Legal Entity & Registration
- [ ] Register LLC (ERC + tax code + seal) — [legal-entity.md](legal-entity.md)
- [ ] IRC if foreign ownership — [legal-entity.md](legal-entity.md)
- [ ] VSIC code selection (technology + e-commerce, NOT transport) — [legal-entity.md](legal-entity.md)
- [ ] MOIT e-commerce platform registration at Online.gov.vn — [legal-entity.md](legal-entity.md)
- [ ] Prepare operational rules, dispute resolution, privacy policy, ToS — [legal-entity.md](legal-entity.md)

### Payment & Fund Flow
- [ ] Confirm fund flow: VNPay → operator account (not platform) — [payment.md](payment.md)
- [ ] Collect operator bank accounts for gateway settlement — [payment.md](payment.md)
- [ ] Separate commission invoicing (platform → operator B2B) — [payment.md](payment.md)
- [ ] Legal opinion on thu ho chi ho classification — [payment.md](payment.md)
- [ ] Handle e-wallet checkout failures (VND 100M cap) — [payment.md](payment.md)

### E-Invoice & Tax
- [ ] MISA integration live (verify issuer role) — [einvoice-tax.md](einvoice-tax.md)
- [ ] Operator MST (tax code) collection — [einvoice-tax.md](einvoice-tax.md)
- [ ] E-invoice authorization agreements with operators — [einvoice-tax.md](einvoice-tax.md)
- [ ] Platform VAT registration — [einvoice-tax.md](einvoice-tax.md)
- [ ] GDT digital signature for e-invoice signing — [einvoice-tax.md](einvoice-tax.md)

### Data Privacy
- [ ] Submit CDTIA to A05 (if overseas hosting) — [data-privacy.md](data-privacy.md)
- [ ] Submit DPIA to A05 — [data-privacy.md](data-privacy.md)
- [ ] Explicit per-purpose consent UI — [data-privacy.md](data-privacy.md)
- [ ] Data subject rights portal (access/correct/delete) — [data-privacy.md](data-privacy.md)
- [ ] DPAs with all processors (VNPay, MoMo, eSMS, MISA, hosting) — [data-privacy.md](data-privacy.md)
- [ ] Appoint DPO — [data-privacy.md](data-privacy.md)
- [ ] Define retention schedules — [data-privacy.md](data-privacy.md)

### Telecom / SMS
- [ ] Start brandname SMS registration (2-4 week hard blocker) — [telecom-sms.md](telecom-sms.md)
- [ ] Choose aggregator (eSMS already stubbed) — [telecom-sms.md](telecom-sms.md)
- [ ] Zalo Official Account verification — [telecom-sms.md](telecom-sms.md)
- [ ] Dual-channel OTP: ZNS primary → SMS fallback — [telecom-sms.md](telecom-sms.md)

### Transport
- [ ] Legal opinion on platform classification (technology, not transport) — [transport.md](transport.md)
- [ ] Operator transport license verification at onboarding — [transport.md](transport.md)
- [ ] Route authorization check — [transport.md](transport.md)
- [ ] Passenger insurance verification at onboarding — [transport.md](transport.md)

### Consumer Protection
- [ ] Legal review of ToS against CPL 2023 unfair terms (Art. 25-26) — [consumer-protection.md](consumer-protection.md)
- [ ] Refund/cancellation policy (3-day right, legal opinion on bus ticket exception) — [consumer-protection.md](consumer-protection.md)
- [ ] Complaint handling system (3-day acknowledge, 7-30 day resolve) — [consumer-protection.md](consumer-protection.md)
- [ ] Price transparency audit (total price before payment) — [consumer-protection.md](consumer-protection.md)
- [ ] Review-and-confirm step before payment (E-Transactions Law) — [consumer-protection.md](consumer-protection.md)

## Operator Onboarding — Consolidated Document Requirements

Documents to collect from each operator at KYB, drawn from multiple regulatory domains:

| Document | Source requirement | Domain |
|----------|-------------------|--------|
| Business Registration Certificate (ERC/household cert) | Decree 85/2021 (MOIT), E-Commerce Law 2025 | [legal-entity.md](legal-entity.md) |
| Tax code (MST) | Decree 123/2020 (e-invoicing) | [einvoice-tax.md](einvoice-tax.md) |
| Transport Business License | Decree 10/2020 (MoT) | [transport.md](transport.md) |
| Route authorization certificates | Provincial transport dept | [transport.md](transport.md) |
| Passenger insurance certificate | Decree 03/2021 (amended 67/2023) | [transport.md](transport.md) |
| Bank account details | VNPay split-settlement | [payment.md](payment.md) |
| E-invoice authorization agreement | Decree 123 Art. 17 / Decree 70/2025 | [einvoice-tax.md](einvoice-tax.md) |
| Entity type determination (company vs. individual) | E-Commerce Law 2025 (withholding) | [einvoice-tax.md](einvoice-tax.md) |

## Must-Get Legal Opinions (8 items)

| # | Question | Impact if wrong |
|---|----------|-----------------|
| 1 | Platform = "technology services" or "transport business"? | Wrong VSIC codes → foreign ownership blocked or transport license required |
| 2 | Marketplace fund flow: does VNPay settling to platform account first = payment intermediary? | SBV enforcement → shutdown risk |
| 3 | Consumer Protection Law 2023 Art. 29: does 3-day cancellation apply to bus tickets? | Non-compliant refund policy → fines up to 200M VND |
| 4 | Is Singapore DB hosting compliant with CDTIA filing alone? | MPS request → forced emergency migration |
| 5 | E-invoice: can platform issue on behalf of operators (authorized invoicing), or must each operator issue? | Tax compliance failure → invoice invalidity |
| 6 | Foreign Contractor Tax: does ownership structure trigger FCT? | Revenue leakage 10% (5% VAT + 5% CIT) |
| 7 | Labor Code 2019: could operator relationship be reclassified as employment? | SI contributions + back-taxes + penalties |
| 8 | Social Insurance Law 2024 (July 2025): will gig worker expansion affect bus operators? | Future mandatory SI for platform operators |

## High-Confidence Findings (act without waiting for counsel)

1. **Marketplace model is correct** — confirmed by Vexere precedent (10+ years, no IPS license, no SBV enforcement), payment law, e-invoice law, and transport classification
2. **MOIT e-commerce registration is mandatory** — Decree 85/2021, specific to "trading platforms", fines 40-60M VND
3. **Brandname SMS takes 2-4 weeks** — hard blocker, start immediately
4. **If classified as "tech services", 100% foreign ownership OK** — WTO commitments + Grab Vietnam precedent
5. **E-invoicing through MISA is mandatory** — Decree 123/2020 + Decree 70/2025
6. **Consumer Protection Law 2023 creates new platform liability** — enforceable since July 2024
7. **Trademark: file early, first-to-file** — 12-18 month process, squatting risk

## Related Documents

- [../vietnam-market-context.md](../vietnam-market-context.md) — market entry strategy and positioning
- [../stakeholder-map.md](../stakeholder-map.md) — stakeholder analysis and engagement
- [../risk-matrix.md](../risk-matrix.md) — risk matrix with mitigations
