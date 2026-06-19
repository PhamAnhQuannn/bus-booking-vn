# Payment Regulations — Vietnam

> Domain 3 of [regulatory scan](README.md). See [consolidated checklist](README.md#consolidated-pre-launch-compliance-checklist) for cross-domain view.
> Last researched: June 2026.

## Regulatory Stack

| Law/Decree | Status | Effective |
|------------|--------|-----------|
| **Decree 52/2024/ND-CP** (Non-cash payments) | Enforced, replaces Decree 101/2012 | 1 Jul 2024 |
| Circular 40/2024/TT-NHNN (IPS implementation) | Enforced | 17 Jul 2024 |
| Circular 41/2025/TT-NHNN (KYC/biometric amendments) | Enforced | 5 Nov 2025 |
| Circular 22/2026/TT-NHNN (procedural amendments) | Enforced | 19 May 2026 |
| E-Commerce Law 2025 | **Effective 1 Jul 2026** (imminent) | 1 Jul 2026 |
| Decree 117/2025/ND-CP (E-Commerce implementation) | **Effective 1 Jul 2026** (imminent) | 1 Jul 2026 |

## 1. Payment Intermediary License (IPS)

### Six IPS categories requiring SBV license
1. Financial switching
2. International financial switching
3. Electronic clearing
4. **E-wallet services**
5. **Collection and payment support (thu ho chi ho)**
6. **Electronic payment gateway services**

### Capital requirements
- E-wallets, collection/payment support, gateways: **VND 50 billion** (~USD 2M)
- Switching/clearing: **VND 300 billion** (~USD 12M)
- No foreign ownership cap (proposed 49% cap was dropped from final decree)

### Does a bus booking platform need an IPS license?

**No — if using marketplace model with licensed gateway.**

Key distinction in Decree 52:
- **Payment acceptance unit (merchant)**: integrates licensed gateway, no own license needed
- **IPS provider**: IS the payment infrastructure, needs SBV license

Circular 40 Article 9(6): if gateway provider contracts directly with merchants, the gateway assumes full responsibility — merchant bears no licensing obligation.

### Risk: Article 3(17) "thu ho chi ho" definition
> "The receipt and processing of electronic data, computing of results of authorized collection/payment, and cancellation of authorized collection/payment for customers having payment accounts or bank cards, and making of payments to related parties"

If platform collects from customer and remits to operator — even through VNPay — the fund flow could be characterized as unlicensed thu ho chi ho.

**No SBV written guidance confirms booking platforms are exempt.** Operating on industry precedent only.

## 2. Marketplace vs. Merchant Model

**⚠️ Current implementation status (2026-06-18)**: Central collection model (single platform merchant account). All payments flow through one `tmnCode`/`partnerCode`. Split-settlement is the target architecture but is NOT yet implemented. This means the current fund flow matches the "Hybrid/pooling" row below — the highest-risk option. See risk-register #1 and ADR-005.

| Model | License? | Fund flow | Risk level |
|-------|----------|-----------|------------|
| **Marketplace** (recommended) | No | Customer → VNPay → Operator | Low |
| Merchant of record | No (different basis) | Customer → Platform (as principal) | Medium |
| **Hybrid/pooling** (AVOID — **current state**) | **Likely yes** | Customer → Platform bank account → Operator | **High** |

### Vexere Precedent
- Vietnam's largest bus booking platform (5,000+ routes, 2,000+ operators)
- Operates as marketplace/agent — "does not own or operate bus services"
- Collects on behalf of operators under agency contracts
- Uses VNPay as payment gateway
- **Does NOT hold SBV IPS license** (not on SBV's published list of 32+ licensed IPS providers)
- Operating since 2013 without regulatory challenge

### Fund flow matters more than contract label
Even with a marketplace contract, if VNPay settles to platform's merchant account first, then platform transfers to operators — the practical fund flow looks like thu ho chi ho.

**Safest approach**: VNPay settles directly to each operator's bank account. Platform invoices operator separately for commission.

## 3. E-Wallet Limits

| Parameter | Limit |
|-----------|-------|
| Personal e-wallet monthly cap | **VND 100M** (~USD 4,000) |
| Expanded cap (utilities, govt services) | VND 300M — bus tickets do NOT qualify |
| Biometric authentication trigger | Single transaction **>= VND 10M** (~USD 400) |
| E-wallet opening KYC (from Jan 2026) | In-person or remote biometric face-matching |

Impact on bus booking:
- Individual tickets (100k-500k VND) — well within limits
- Group bookings (5+ premium seats > 10M VND) — may trigger biometric auth mid-checkout
- High-frequency business travelers — could hit 100M monthly cap

## 4. Refunds

- **No statutory same-channel mandate** in Decree 52 or Circular 40
- Card network rules (Visa/Mastercard) require same-card refunds — card scheme rule, not SBV
- Bank transfer refunds can go to different account if customer requests
- Vexere targets 10 working days; Vietnam Airlines targets 15 working days
- Cancellation fee deductions permissible under contract terms

## 5. Foreign Contractor Tax (FCT)

FCT is NOT a tax on foreign-owned Vietnamese companies. It applies to payments FROM Vietnamese entities TO foreign contractors.

| Scenario | FCT? | Rate |
|----------|------|------|
| VN company with foreign shareholders paying domestic operators | No | N/A |
| VN company paying AWS/GCP for cloud hosting | **Yes** | 5% VAT + 5% CIT |
| VN company paying foreign SaaS subscriptions | **Yes** | 5% VAT + 5% CIT |
| Foreign parent providing management services to VN subsidiary | **Yes** | 5% VAT + 5% CIT |
| Interest on foreign shareholder loans | **Yes** | 5% on interest |
| Payments to VNPay/MoMo (Vietnamese entities) | No | N/A |

## 6. E-Commerce Law Tax Withholding (from July 2026)

**NEW obligation**: platforms must withhold and remit VAT + PIT on behalf of individual/household operators.

| Operator type | Platform withholding? | Rates |
|---------------|----------------------|-------|
| Incorporated company | No — self-files | N/A |
| Individual/household business | **Yes** | VAT ~3% + PIT ~1.5% |

Platform must:
1. Determine operator entity type (company vs. individual)
2. Apply correct withholding rates
3. Remit to GDT on schedule
4. Issue withholding certificates

## Compliance Actions

| Action | Urgency | Detail |
|--------|---------|--------|
| Confirm fund flow: VNPay → operator account (not platform) | Before launch | Critical for avoiding IPS classification |
| Collect operator bank accounts | Before launch | For gateway settlement |
| Separate commission invoicing | Before launch | Platform → Operator B2B invoice for service fee |
| Legal opinion on thu ho chi ho classification | Before launch | Written opinion from VN fintech firm |
| Implement E-Commerce Law withholding | Before Jul 2026 | Tax withholding for individual operators |
| Handle e-wallet checkout failures | Before launch | Graceful fallback when VND 100M cap hit |

## Open Risks

1. SBV could reclassify booking platform collect-and-remit as unlicensed thu ho chi ho — no grandfathering
2. E-Commerce Law withholding creates operator type identification burden
3. MoMo/ZaloPay VND 100M monthly cap causes invisible checkout failures
4. Biometric auth friction for >VND 10M transactions increases checkout abandonment
5. No formal SBV guidance confirming booking platform exemption despite 10+ years of industry practice

## Cross-References

- E-Commerce Law withholding implementation → [einvoice-tax.md](einvoice-tax.md#4-withholding-tax-on-operators)
- Platform classification (technology vs. transport) → [transport.md](transport.md#2-platform-classification)
- Legal entity and VSIC code strategy → [legal-entity.md](legal-entity.md#3-vsic-code-strategy)
- Operator onboarding document checklist → [README.md](README.md#operator-onboarding--consolidated-document-requirements)

## Sources

- [Tilleke — Decree 52 Overview](https://www.tilleke.com/insights/vietnams-new-decree-on-non-cash-payments/)
- [Tilleke — IPS Regulatory Updates](https://www.tilleke.com/insights/critical-updates-to-vietnams-regulatory-framework-for-intermediary-payment-services/)
- [Mondaq — Decree 52 Analysis](https://www.mondaq.com/financial-services/1474726/non-cash-payment-under-decree-no-522024nd-cp)
- [Vexere Terms & Conditions](https://vexere.com/en-US/terms-and-conditions)
- [SBV Licensed IPS List](https://sbv.gov.vn/en/w/list-of-non-bank-institutions-licensed-for-providing-payment-intermediary-service-as-of-09th-december-2024-)
- [Vietnam Briefing — E-Commerce Law 2025](https://www.vietnam-briefing.com/news/vietnams-e-commerce-law-2025-key-provisions-and-business-implications.html/)
- [Indochine Counsel — Circular 41](https://indochinecounsel.com/special-alert-circular-41-key-regulatory-updates-for-e-wallets-and-intermediary-payment-services)
