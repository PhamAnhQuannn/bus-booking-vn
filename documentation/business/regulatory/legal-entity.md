# Legal Entity & E-Commerce Registration — Vietnam

> Domains 8-9 of [regulatory scan](README.md). See [consolidated checklist](README.md#consolidated-pre-launch-compliance-checklist) for cross-domain view.
> Last researched: June 2026.

## Regulatory Stack

| Law/Decree | Status | Effective |
|------------|--------|-----------|
| Enterprise Law 2020 (No. 59/2020/QH14) | Enforced | 1 Jan 2021 |
| Investment Law 2020 (No. 61/2020/QH14) | Enforced | 1 Jan 2021 |
| Decree 01/2021/ND-CP (Business registration) | Enforced | 2021 |
| Decree 31/2021/ND-CP (Investment Law implementation) | Enforced | 2021 |
| Decree 47/2021/ND-CP (Conditional business sectors) | Enforced | 2021 |
| Decree 52/2013/ND-CP (E-commerce, original) | Superseded | — |
| **Decree 85/2021/ND-CP** (E-commerce, amended) | Enforced | 1 Jan 2022 |
| **E-Commerce Law 2025** | **Effective 1 Jul 2026** | **1 Jul 2026** |

## 1. Entity Type

| Type | LLC (TNHH) | JSC (Co phan) |
|------|------------|---------------|
| Members | 1-50 | Min 3 founders (no max) |
| Governance | Simpler | Board of Directors + Supervisory Board |
| Share issuance | No public offering | Can issue shares publicly |
| Best for | Early-stage startup | Fundraising / Series A+ |
| Conversion | Can convert to JSC later | — |

**Recommendation**: LLC for early stage. Convert to JSC when preparing for Series A.

### Registration
- **Timeline**: 3-5 business days for ERC (Enterprise Registration Certificate)
- **Cost**: ~5-15 million VND through legal service (including govt fees)
- **Portal**: dangkykinhdoanh.gov.vn (online registration)
- **Required documents**: application form, company charter, member list with ID/passport copies, registered office lease

### Legal Representative
- At least one required
- Must be **resident in Vietnam** (or appoint authorized person when abroad >30 days)

### Company Seal
- Enterprise Law 2020 made physical seal **optional** by law
- In practice: banks, government agencies, business partners still commonly require it
- **Recommendation**: get BOTH physical seal (~200-500k VND) AND digital signature (VNPT-CA, Viettel-CA, FPT-CA)

## 2. Foreign Ownership

### Critical: Sector classification determines ownership limits

| Classification | Foreign ownership | Basis |
|---------------|-------------------|-------|
| **Technology services** | Up to **100%** | WTO commitments |
| **Transport services** | Capped **49-51%** | WTO conditional sector |
| **E-commerce/distribution** | Up to **100%** (certain categories) | WTO commitments |

### If foreign-invested enterprise (FIE)
1. **Investment Registration Certificate (IRC)** required from provincial DPI BEFORE ERC
2. IRC review: 15-day standard, may take longer for conditional sectors
3. Then: Enterprise Registration Certificate (ERC) from DPI

### Grab Vietnam precedent
Registered under technology/IT service categories. 100% foreign ownership. Operates transport-adjacent platform without transport license.

## 3. VSIC Code Strategy

**Critical decision at registration.** VSIC codes determine which regulatory conditions apply.

| Code category | Select? | Rationale |
|--------------|---------|-----------|
| Technology/software/IT services | **YES** | Core business classification |
| E-commerce platform services | **YES** | Required for MOIT registration |
| Road transport business | **NO** | Would trigger transport license requirement |

Wrong VSIC codes → transport license required, foreign ownership capped, different ministry oversight.

## 4. Conditional Business Sectors

Vietnam maintains ~227 conditional business sectors (Appendix IV, Investment Law 2020).

Relevant conditional sectors for bus booking platform:
1. **E-commerce platform services** (Decree 85/2021) → conditions: MOIT registration, operator verification, dispute resolution
2. **Road passenger transport** (Decree 10/2020) → conditions: transport license, fleet, insurance

If platform is purely technology marketplace: **only e-commerce conditions apply.**

## 5. MOIT E-Commerce Registration

### Classification
| Type | Requirements | Our case |
|------|-------------|----------|
| E-commerce selling website | Notification to MOIT | No — we connect buyers and sellers |
| **E-commerce trading platform (san TMDT)** | **Registration with MOIT** | **Yes** — marketplace model |

### Registration requirements (Decree 85/2021)
- Company info (ERC, tax code, legal representative)
- Platform description and operational rules
- **Dispute resolution mechanism** — must be published
- **Privacy policy** — must comply with PDPL
- **User agreement / Terms of Service**
- **Operator verification process** — must verify identity and business registration
- All content on Online.gov.vn must be in Vietnamese

### Process
- Register via **Online.gov.vn**
- Timeline: **2-4 weeks** for review and approval
- Fines for unregistered platform: **40-60 million VND** (Decree 98/2020)

### Ongoing obligations
- **Annual reporting** to MOIT on: platform operations, transaction volumes, complaints, operator count
- Must **remove violating listings** when notified
- Must **cooperate with authorities** on investigations

## 6. E-Commerce Law 2025 (effective July 2026)

New obligations for platforms:
- Respond to consumer complaints within **24 hours**
- Remove illegal content promptly
- Mandatory tax withholding for individual/household sellers
- Enhanced operator verification requirements
- Platform liability for operator conduct

## Compliance Actions

| Action | Urgency | Detail |
|--------|---------|--------|
| Legal opinion on sector classification | First step | Determines everything downstream |
| Register LLC | First step | ERC + tax code + seal |
| IRC (if foreign ownership) | Before ERC | Investment Registration Certificate |
| VSIC code selection | At registration | Technology + e-commerce codes only |
| MOIT platform registration | Before launch | Online.gov.vn with all required documents |
| Prepare operational rules | Before MOIT registration | Dispute resolution, privacy policy, ToS |
| Operator verification process | Before launch | Business registration + tax code collection |
| Annual MOIT reporting setup | Before year-end | First report due after year 1 |

## Open Risks

1. Sector classification ambiguity for foreign ownership purposes
2. If platform adds fleet management/route optimization → may trigger transport VSIC codes
3. E-Commerce Law 2025 increases platform obligations significantly
4. Annual MOIT reporting creates ongoing compliance burden
5. MOIT e-commerce registration requires all documents ready upfront — any gap delays approval

## Cross-References

- Marketplace model detail and Vexere precedent → [payment.md](payment.md#2-marketplace-vs-merchant-model)
- Platform classification in transport law → [transport.md](transport.md#2-platform-classification)
- E-Commerce Law tax withholding detail → [einvoice-tax.md](einvoice-tax.md#4-withholding-tax-on-operators)
- Operator onboarding document checklist → [README.md](README.md#operator-onboarding--consolidated-document-requirements)

## Sources

- [Enterprise Law 2020](https://thuvienphapluat.vn/van-ban/Doanh-nghiep/Luat-Doanh-nghiep-2020-432828.aspx)
- [Decree 85/2021 (E-Commerce)](https://thuvienphapluat.vn/van-ban/Thuong-mai/Nghi-dinh-85-2021-ND-CP-sua-doi-Nghi-dinh-52-2013-ND-CP-thuong-mai-dien-tu-489762.aspx)
- [Vietnam Briefing — E-Commerce Law 2025](https://www.vietnam-briefing.com/news/vietnams-e-commerce-law-2025-key-provisions-and-business-implications.html/)
