# E-Invoice & Tax Obligations — Vietnam

> Domains 4-5 of [regulatory scan](README.md). See [consolidated checklist](README.md#consolidated-pre-launch-compliance-checklist) for cross-domain view.
> Last researched: June 2026.

## Regulatory Stack

| Law/Decree | Status | Effective |
|------------|--------|-----------|
| Decree 123/2020/ND-CP (E-invoicing base) | Enforced, amended | 1 Jul 2022 |
| Circular 78/2021/TT-BTC | Replaced by Circular 32/2025 | — |
| **Decree 70/2025/ND-CP** (amending Decree 123) | **Enforced** | **1 Jun 2025** |
| **Circular 32/2025/TT-BTC** (replaces Circular 78) | **Enforced** | **1 Jun 2025** |
| VAT Law 48/2024/QH15 | Enforced | 1 Jul 2025 |
| **Law 149/2025/QH15** (VAT amendments) | **Enforced** | **1 Jan 2026** |
| **Decree 310/2025/ND-CP** (penalty restructure) | **Enforced** | **16 Jan 2026** |
| Decree 132/2020/ND-CP (Transfer pricing) | Enforced | 20 Dec 2020 |
| E-Commerce Law 2025 / Decree 117/2025 | **Effective 1 Jul 2026** (imminent) | 1 Jul 2026 |

## 1. E-Invoicing Requirements

### Mandate
- Mandatory nationwide since 1 July 2022 for all VAT-registered businesses
- Standardized XML format: invoice data payload + digital signature
- Digital signature from GDT-approved provider, completed within next working day of creation
- Two models: (1) real-time GDT clearance with tax authority code, (2) same-day post-issuance reporting
- **10-year** archival in original electronic form

### Transport-Specific (Decree 70/2025)
- Transport invoices must include: **vehicle license plate number** and **route information** (departure + destination)
- Bus operators with annual revenue >= **VND 1 billion** must use POS cash registers connected to GDT for real-time data transmission
- E-invoice cancellation process abolished — replaced with adjustment and replacement procedures

### GDT-Certified Providers
| Provider | Notes |
|----------|-------|
| **MISA meInvoice** | Most popular for SMEs. Private API per customer. Already integrated (#74) |
| VNPT-Invoice | Government-affiliated |
| Viettel S-Invoice | Large enterprise focus |
| FPT eInvoice | Competitive pricing |
| BKAV | Alternative option |
| Thai Son | Used by some transport operators |

Cost: ~500-2,000 VND per invoice depending on provider and volume.

## 2. Invoice Issuer in Marketplace Model

### Who issues what?

| Invoice | Issuer | Recipient | Content |
|---------|--------|-----------|---------|
| Ticket invoice | **Bus operator** (or platform if authorized) | Passenger | Ticket price, VAT, route, plate number |
| Commission invoice | **Platform** | Bus operator | Service fee, 10% VAT |

### Third-Party Authorization
- Operators can formally authorize platform to issue e-invoices on their behalf (Decree 123 Art. 17, expanded by Decree 70/2025)
- Authorization requires: formal written agreement + notification to tax authority before arrangement begins
- Invoice must show **operator as seller** (with operator's tax ID/MST), not platform
- Decree 70/2025 expanded authorization right to business households and individual businesses (previously enterprises only)

### Practical Industry Approach
Most VN booking platforms (Vexere, Ve Xe Nhanh) take the authorization approach:
1. Operators sign agreement authorizing platform to issue e-invoices
2. Platform integrates with T-VAN provider (MISA)
3. Invoices flow automatically at ticket sale with operator's tax code
4. Platform's own commission invoice issued separately (typically monthly)

## 3. Tax Rates

| Tax | Rate | Who |
|-----|------|-----|
| VAT on bus tickets | **10%** | Operator collects and remits |
| VAT on platform commission | **10%** | Platform charges to operator |
| Corporate Income Tax (CIT) | **20%** | Platform on net profit |
| PIT withholding (individual operators) | **0.5-2%** | Platform withholds (from Jul 2026) |
| Foreign Contractor Tax | **5% VAT + 5% CIT** | VN payer withholds (if applicable) |

### VAT Notes
- 10% standard rate on domestic transport (unchanged by VAT Law 48/2024)
- The temporary 8% reduced rate (2022-2024 COVID relief) is no longer available
- VAT-inclusive pricing standard in Vietnam
- Quarterly provisional CIT payments required; annual finalization within 90 days

## 4. Withholding Tax on Operators

### Incorporated operators (companies)
- No platform withholding — they self-declare CIT
- Platform collects their MST (tax code) for e-invoicing

### Individual/household operators (from E-Commerce Law, July 2026)
- Platform must withhold: VAT ~3% + PIT ~1.5% (transport services estimated rates)
- Must issue withholding certificates
- File periodic withholding returns to GDT

### Operator type determination
- Platform must determine for every operator: incorporated company vs. individual/household
- Collect **business registration certificate** or **household business certificate** at onboarding
- Many small VN bus operators are sole proprietors or family businesses

## 5. Transfer Pricing (Decree 132/2020)

Applies if platform has **related-party transactions** (>25% direct/indirect ownership, shared management):
- Must prepare: Local File, Master File, Country-by-Country Report (if applicable)
- Transfer pricing declaration filed with annual CIT return
- Arm's length principle for all related-party transactions
- Vietnam tax authorities increasingly aggressive on TP audits since 2022

Common triggers for bus booking platform:
- Management fees paid to foreign parent
- Technology licensing fees between related entities
- Shareholder loan interest

## Compliance Actions

| Action | Urgency | Detail |
|--------|---------|--------|
| MISA integration live | Before launch | Already built (#74). Verify issuer role |
| Operator MST collection | Before launch | All operators need valid tax code |
| Authorization agreements | Before launch | For platform to issue e-invoices on behalf of operators |
| VAT registration | Before launch | Platform needs own VAT registration |
| GDT digital signature | Before launch | Required for e-invoice signing |
| E-Commerce Law withholding setup | Before Jul 2026 | Individual operator tax withholding system |
| Transfer pricing docs | If foreign ownership | Local File + Master File |
| Decree 70/2025 compliance | **NOT DONE** | MISA integrated for generic invoices; transport-specific fields MISSING: vehicle plate number, departure city, destination city. Operator MST (tax code) column also absent. Must implement before transport e-invoices are GDT-compliant. |

## Open Risks

1. Many small operators haven't fully implemented e-invoicing — platform may need to help them comply
2. E-Commerce Law withholding (Jul 2026) creates new operational burden for individual operators
3. Operator entity type determination is error-prone — withholding on wrong type creates liability
4. Decree 310/2025 penalty restructure increases fine exposure
5. If platform issues invoices without proper authorization → violation

## Cross-References

- Marketplace fund flow (who settles to whom) → [payment.md](payment.md#2-marketplace-vs-merchant-model)
- Foreign Contractor Tax detail → [payment.md](payment.md#5-foreign-contractor-tax-fct)
- Operator onboarding document checklist → [README.md](README.md#operator-onboarding--consolidated-document-requirements)

## Sources

- [EY — Decree 70/2025 Changes](https://www.ey.com/en_vn/technical/tax/tax-and-law-updates/tax-alert-april-2025-changes-to-invoicing-regulations-effective-from-1-june-2025)
- [Vietnam Briefing — Decree 70](https://www.vietnam-briefing.com/news/decree-70-key-amendments-to-invoice-regulations-in-vietnam.html/)
- [WA Consulting — Decree 70](https://www.waconsulting.vn/post/decree-no-70-2025-nd-cp-amending-supplementingon-invoices-and-documents)
- [Vietnam Incorp — E-Invoice Update](https://vietnam.incorp.asia/vietnams-e-invoice-regulations-update/)
- [KPMG — Circular 32/2025](https://kpmg.com/us/en/taxnewsflash/news/2025/06/tnf-vietnam-guidance-on-invoices-including-electronic-invoices-and-documents.html)
- [PwC — Vietnam Withholding Taxes](https://taxsummaries.pwc.com/vietnam/corporate/withholding-taxes)
