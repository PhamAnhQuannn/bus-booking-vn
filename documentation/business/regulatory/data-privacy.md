# Data Residency & Personal Data Protection — Vietnam

> Domains 1-2 of [regulatory scan](README.md). See [consolidated checklist](README.md#consolidated-pre-launch-compliance-checklist) for cross-domain view.
> Last researched: June 2026.

## Regulatory Stack

| Law/Decree | Status | Effective |
|------------|--------|-----------|
| Cybersecurity Law 2018 (No. 24/2018/QH14) | Enforced, superseded July 2026 | 1 Jan 2019 |
| Decree 53/2022/ND-CP (Cybersecurity implementation) | Enforced | 1 Oct 2022 |
| Decree 13/2023/ND-CP (Personal Data Protection) | Replaced by PDPL | 1 Jul 2023 |
| **Law on Cybersecurity No. 116/2025/QH15** | **New** | **1 Jul 2026** |
| **PDPL No. 91/2025/QH15** (Personal Data Protection Law) | **New** | **1 Jan 2026** |
| **Decree 356/2025/ND-CP** (PDPL implementation) | **New** | **1 Jan 2026** |
| Law on Data No. 60/2024/QH15 | Enforced | 1 Jul 2025 |
| Decree 147/2024/ND-CP (Internet services) | Enforced | 25 Dec 2024 |

## 1. Data Localization

### Requirements
- **Domestic enterprises** (including foreign-invested companies registered in Vietnam) must store three data categories in Vietnam:
  1. Personal information of service users
  2. Data on user relationships (contacts, groups)
  3. User-generated data: account names, service usage time, payment info, IP addresses
- **No triggering condition** — applies automatically from 1 Oct 2022 per Decree 53
- Minimum retention: **24 months** after user stops using the service
- Decree 53 is silent on whether domestic enterprises may simultaneously store data overseas (persistent ambiguity)
- Law 116/2025 (effective 1 Jul 2026) retains localization mandate verbatim

### Singapore Hosting Assessment
- Hosting on Supabase/Neon/AWS ap-southeast-1 constitutes a **cross-border transfer** under all three frameworks
- Decree 356/2025 expressly categorizes use of foreign cloud services as cross-border transfer regardless of physical server location
- Singapore hosting alone does NOT satisfy Vietnam's data localization requirement
- **CDTIA exemption** exists for "cross-border transportation, logistics, payments, travel" but likely does NOT cover domestic-only bus routes

### Practical Risk
- No enforcement action against Vietnamese startups for Singapore hosting reported as of June 2026
- Enforcement has targeted foreign social media platforms
- Draft sanctions decree (CASD, May 2024) proposes up to **5% of annual VN revenue** for violations affecting 5M+ citizens
- Many startups use hybrid: VNG Cloud/FPT Cloud for regulated data, AWS Singapore for non-regulated workloads

### VN Cloud Providers
| Provider | Notes |
|----------|-------|
| Viettel Cloud (IDC) | ~24% VN DC market; managed PG (VDB), managed K8s (VKS), S3 storage; more transparent pricing |
| **FPT Cloud** | **~23% VN DC market; managed PG, managed Redis, S3-compatible storage, managed K8s (FKE); PCI DSS L1, ISO 27001/27017/27018; 4 Tier III DCs (Hanoi + HCMC)** |
| VNG Cloud | Multi-region (HCM + Hanoi, June 2024) |
| CMC Cloud | ~10% market; USD 1B deal with Samsung C&T (Dec 2024); competitive pricing for smaller workloads |
| VNPT Cloud | Government-affiliated |

FPT + Viettel + VNPT = ~70% of Vietnam data center market (GlobeNewsWire 2024).

### FPT Cloud — Verified Service Catalog (as of 2026-06-19)

| Service | FPT Product | Details |
|---------|-------------|---------|
| PostgreSQL | FPT Database Engine for PostgreSQL | Managed DBaaS: HA with auto-failover, automated backup/restore, vertical scaling |
| Redis | FPT Database Engine for Redis | Managed: backup/restore, failover, hot-add resource expansion |
| Object Storage | FPT Object Storage | S3-compatible (AWS SDK); 2 regions (HN + HCM); auto cross-region sync; 2TB = 3.5M VND/mo, 5TB = 6M VND/mo, 10TB = 10M VND/mo |
| Kubernetes | FPT Kubernetes Engine (FKE) | Managed or Dedicated; auto-scaling workers; Container Registry included |
| Compute | FPT Cloud Server | 2-16 vCPU, 4-32GB RAM, 40-500GB SSD; L4 Firewall + Basic LB included |
| Data Centers | FPT Fornix HN01, HN02, HCM01, HCM02 | Tier III certified; HCM02 = 10,000 m², 3,600 racks |

Pricing: only Object Storage has published prices. Compute + managed databases require sales quotation.

Certifications (verified): PCI DSS Level 1 (v4.0.1), ISO 27001, ISO 27017, ISO 27018. SOC 2 claim was adversarially refuted — treat as unverified. Certifications are facility/entity-specific.

> Research basis: 105 claims from 22 sources, 25 adversarially verified (3-vote), 20 confirmed, 5 killed.

## 2. Personal Data Protection Law (PDPL 2025)

### Consent
- Must be voluntary, specific, informed, purpose-specific
- Pre-ticked boxes and default consent **prohibited**
- Separate consent per processing purpose
- **Per-instance consent** for each cross-border transfer (not blanket consent)
- Organization bears burden of proof for verifiable consent

### DPIA
- Required for all controllers and processors
- Submit to A05 (MPS) within **60 days** of starting processing
- **15-day** MPS review period (pass/fail)
- 30-day remediation if incomplete
- Update every **6 months** or within 10 days of material change
- Decree 356/2025 provides prescribed forms

### Cross-Border Transfer (CDTIA)
- Required for ANY transfer outside Vietnam, including foreign cloud services
- Submit to A05 within **60 days** of first transfer
- Requires: explicit consent, binding contracts with recipients, documentation of data categories/retention/security
- MPS may inspect once per year and order cessation
- Exemptions: journalism, emergencies, publicly disclosed data, internal HR, cross-border transport/logistics/payments

### Breach Notification
- Report to A05 within **72 hours** of detecting breach
- Reduced to **24 hours** for cybersecurity attacks affecting consumer info
- Notify affected individuals for biometric or financial sector breaches
- Retain breach records **5 years**

### Data Subject Rights
| Right | Response deadline |
|-------|-------------------|
| Access | 10 days |
| Correction | 10 days |
| Deletion | 20 days |
| Withdrawal of consent | 15 days |
| Objection to processing | (not specified) |

### DPO Appointment
- Required for all in-scope entities
- Can be outsourced; minimum 2 years relevant experience
- **Startup exemption**: 5-year grace period to 2031 UNLESS:
  - Processing sensitive personal data (payment card data qualifies)
  - Processing data of 100,000+ data subjects
  - Providing data processing services
- **Bus booking platform likely does NOT qualify for exemption** (processes payment data = sensitive)

### Sensitive Data
Stricter rules apply to: biometric data, national ID/passport, **financial data**, health data, **location data**

Bus booking platform collects: name, phone, date of birth, **payment card details**, **travel routes** — at least payment data is sensitive.

### Penalties
- Up to **5% of prior-year VN annual revenue** for unauthorized cross-border transfers
- Up to **10x illicit gains** (minimum VND 3 billion / ~USD 114,500) for unlawful data trading

## 3. Law on Data (No. 60/2024)

Classifies ALL digital data (not just personal data) by importance:
- **Core data**: national defense/security/foreign affairs impact. Unlikely for bus platform.
- **Important data**: financial data, large-scale location/travel patterns could qualify at scale.
- **Other data**: standard category.

Cross-border transfer of important data requires separate impact assessment to cybersecurity authority within 15 days.

## Compliance Actions

| Action | Urgency | Detail |
|--------|---------|--------|
| Submit CDTIA to A05 | **Immediate** | If using Singapore hosting, 60-day deadline from processing start has likely passed |
| Submit DPIA to A05 | **Immediate** | 60-day deadline from processing start |
| Explicit consent UI | Before launch | Separate per-purpose consent, not ToS checkbox |
| Data subject rights portal | Before launch | Access/correct/delete. Manual process OK initially |
| DPAs with all processors | Before launch | VNPay, MoMo, eSMS, MISA, hosting, analytics |
| Appoint DPO | Before launch | Likely cannot use startup exemption (processes payment data) |
| ~~Migration plan to VN cloud~~ | **DECIDED (2026-06-19)** | FPT Cloud **chosen as primary host**. See ADR-020 D7/D8/D9/D10, DS-017. Docker Compose on FPT Cloud Server with cron sidecar, Nginx + Let's Encrypt, Cloudflare CDN. Eliminates CDTIA for hosting entirely. Contact FPT sales for pricing quotes. |
| Define retention schedules | Before launch | Booking data, payment data, OTP logs |

### CDTIA Filing Status (as of 2026-06-19)

> **2026-06-19 UPDATE:** FPT Cloud (Vietnam) chosen as primary host. Items 1 and 2 below are **eliminated** by this decision.

**NOT FILED** for remaining cross-border processors. ~~Deadline has likely passed per PDPL 2025 Art. 25.~~

Cross-border processors:

1. ~~**Vercel** (Singapore) — application hosting~~ **ELIMINATED** — migrating to FPT Cloud (Vietnam). See ADR-020 D7.
2. ~~**Upstash Redis** (Singapore/US) — rate-limit counters~~ **ELIMINATED** — switching to `REDIS_PROVIDER=ioredis` with FPT Managed Redis (Vietnam). See ADR-020 D8.
3. **Resend** (US) — email delivery with customer email addresses. **Still requires CDTIA** unless replaced with Vietnam-hosted email (Postal/Mailtrain on FPT VM or eSMS email add-on).
4. ~~**Neon** (if applicable) — database hosting~~ **ELIMINATED** — FPT Managed PostgreSQL (Vietnam).

**ACTION:** Evaluate whether Resend (item 3) requires CDTIA filing. If yes, file for Resend only. Alternative: self-host email on FPT Cloud to reach zero cross-border processors.

### CDTIA Elimination via Full Vietnam Hosting

**If the platform migrates entirely to FPT Cloud (or another Vietnamese provider), CDTIA filing for hosting is NOT required** — no cross-border transfer of personal data occurs when all compute and storage reside physically in Vietnam.

Migration to FPT Cloud eliminates CDTIA obligation for items 1 (Vercel) and 2 (Upstash Redis) above:
- **Vercel → FPT Cloud Server** (Next.js on VPS or FKE Kubernetes)
- **Upstash Redis → FPT Database Engine for Redis** (managed, Vietnam-hosted)

Remaining cross-border processors after FPT migration:
- **Resend** (US) — still requires CDTIA if retained. Alternative: self-hosted email on FPT VM (Postal/Mailtrain) or eSMS email add-on
- **Cloudflare** (if used for CDN/DNS) — edge caching of static assets does NOT constitute personal data transfer; origin responses stay on FPT. However, if Cloudflare processes request headers containing PII (IP addresses, cookies), a conservative reading may still require CDTIA coverage

**Net effect:** FPT Cloud migration reduces CDTIA scope from 4 processors to 0-2, and can reach zero if email is also self-hosted in Vietnam.

See ADR-020 D7 for full FPT Cloud service mapping and staged architecture.

## Open Risks

1. **CDTIA not submitted** — if platform uses overseas hosting and hasn't filed, it is in breach since July 2023
2. **Per-instance consent** for overseas transfers creates UX friction for thousands of daily bookings
3. **Sanctions decree (CASD)** when finalized could trigger retroactive compliance audits
4. **Law 116/2025** implementing decree still pending — may add new requirements before July 2026
5. **MPS as enforcer** (not independent DPA) — can order immediate cessation on national security grounds

## Cross-References

- VN cloud migration plan → [README.md](README.md) Priority Matrix item #17
- Operator data processing agreements → [README.md](README.md#operator-onboarding--consolidated-document-requirements)
- Consent UI requirements → [consumer-protection.md](consumer-protection.md#1-consumer-protection-law-2023--major-changes)

## Sources

- [Tilleke & Gibbins — Data Localization](https://www.tilleke.com/insights/what-do-vietnams-new-data-localization-requirements-mean-for-domestic-enterprises/)
- [DFDL — PDPL 2026 Guide](https://www.dfdl.com/insights/legal-and-tax-updates/vietnam-personal-data-protection-2026-what-foreign-organizations-need-to-know/)
- [Decree 356/2025 Analysis](https://vietnam-business-law.info/blog/2026/2/2/key-points-under-decree-3562025-guiding-the-personal-data-protection-law-pdpl-2025)
- [Rajah & Tann — Cybersecurity Law 2025](https://www.rajahtannasia.com/viewpoints/law-on-cybersecurity-comes-into-operation-on-1-july-2026/)
- [ITIF — Data Localization Regulation](https://itif.org/publications/2025/03/07/vietnam-data-localization-regulation/)
- [Vietnam Briefing — PDPL Decree 356](https://www.vietnam-briefing.com/news/vietnam-personal-data-protection-regulation-decree-356.html/)
