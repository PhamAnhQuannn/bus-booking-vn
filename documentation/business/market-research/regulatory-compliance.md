# Regulatory Compliance — Vietnam Bus Booking Platform

## HALT-LEVEL — Must Resolve Before Go-Live

| # | Requirement | Governing Law | Risk if Non-Compliant | Action |
|---|---|---|---|---|
| 1 | **IPS license legal opinion** — determine whether BB's T+1 settlement constitutes "thu ho/chi ho" (collection and payment support) | Decree 52/2024/ND-CP | Operating unlicensed payment intermediary. Penalties include license revocation and fines. | Obtain formal legal opinion from Vietnamese law firm specializing in fintech/payments. If opinion says BB holds funds, restructure so VNPay/MoMo splits and settles directly to operators — BB never touches customer money. |
| 2 | **Data localization** — Vietnamese user PII must be stored on servers physically in Vietnam | Cybersecurity Law 2018 + Decree 53/2022 + Decree 147/2024 | Violation of data localization law. Enforcement increasing. | Add Vietnam-hosted PostgreSQL instance (Viettel IDC, VNPT, FPT Telecom) for PII storage. Vercel sin1 can serve the app; PII data must reside in-country. |

## HIGH PRIORITY — Before or At Launch

| # | Requirement | Governing Law | Action |
|---|---|---|---|
| 3 | MOIT e-commerce notification | Decree 85/2021 | Submit notification via online.gov.vn (simple filing, not a license) |
| 4 | Data Protection Officer appointment | Decree 13/2023 (PDPD) | Appoint and register DPO with Ministry of Public Security (triggered by processing financial/location data) |
| 5 | Data Protection Impact Assessment | Decree 13/2023 | Prepare and file DPIA |
| 6 | Cross-border data transfer dossier | Decree 13/2023 | Submit within 60 days of go-live if PII flows through any overseas server. **If fully hosted on FPT Cloud (Vietnam), CDTIA filing is NOT required** — see Data & Infrastructure Gap Option B below. |
| 7 | Standard-form contract registration | Law 19/2023 + Decree 55/2024 | Register BB's ticket booking T&Cs with MOIT (online ticket purchases are standard-form contracts) |
| 8 | Operator license verification at onboarding | Decree 158/2024 | Build onboarding flow to capture/verify each operator's transport license. Platform must retain booking/contract data for minimum 3 years. |
| 9 | Foreign Contractor Tax withholding | Circular 103/2014 + Circular 69/2025 | Withhold and remit FCT on Vercel/Resend/other foreign SaaS payments (5% CIT + 5-10% VAT component) within 10 days of payment |
| 10 | GDT e-invoice registration per operator | Decree 123/2020 + Circular 32/2025 | Confirm each operator is registered in GDT system for MISA integration |
| 11 | Consumer complaint mechanism | Law 19/2023 | Document and publish dispute resolution process with response timelines |

## MEDIUM PRIORITY — Within 3 Months of Launch

| # | Requirement | Action |
|---|---|---|
| 12 | Quarterly CIT advance payments | Standard rate 20%; assess IT/tech preferential rate eligibility (10% for 15 years) |
| 13 | **P0-HALT — OVERDUE**: E-commerce platform tax withholding for individual/household operators | Decree 117/2025 (effective July 1, 2025 — **already 12 months in force**). Tax withholding for individual/household operators must be implemented before any such operator is onboarded. Schema exists (TaxClassification enum, Payout.taxVat/taxPit/taxTotal columns); zero service functions implemented. |
| 14 | Data retention policy | Booking/contract data minimum 3 years; user PII during service + 6 months minimum |
| 15 | Promotional campaign registration | Register discount campaigns with MOIT/DIT before launching if they exceed value thresholds |
| 16 | Consent management | Per-purpose consent, silence is not consent, reproducible in writing (Decree 13/2023) |

## Data & Infrastructure Gap

**Current state (2026-06-19)**: FPT Cloud (Vietnam) chosen as primary production host. Vercel sin1 (Singapore) retained for staging/preview only. See ADR-020 D2/D7.

**Data localization requirement**: Decree 53/2022 requires Vietnamese user PII (account names, phone numbers, payment card details, email, IP addresses) stored on servers physically in Vietnam. Decree 147/2024 adds: at least one server must be in Vietnam for investigation/complaint purposes.

**~~Option A — hybrid, partial CDTIA~~ (SUPERSEDED 2026-06-19)**:
- ~~Keep Vercel sin1 for application serving; move PostgreSQL to Vietnam~~ — superseded by Option B. Retaining Vercel for production would require CDTIA filing for cross-border app hosting.

**Option B — full Vietnam, zero CDTIA ✅ CHOSEN (2026-06-19)**:
- Deploy entirely on **FPT Cloud** (Vietnam) — eliminates ALL cross-border transfer obligations
- FPT Cloud services matching full stack:
  - **FPT Database Engine for PostgreSQL** — managed DBaaS with HA, auto-failover, automated backup; DBProxy (PgBouncer-like) available; **PG16 version unconfirmed — verify in Console**
  - **FPT Database Engine for Redis** — managed, backup/restore, failover, hot-add scaling; **Redis 7 unconfirmed — verify in Console**
  - **FPT Object Storage** — S3-compatible (MinIO-based, `forcePathStyle: true` required); 2 regions (HN + HCM); 2TB = 3.5M VND/mo
  - **FPT Kubernetes Engine (FKE)** — managed K8s for Stage 2+ with auto-scaling workers
  - **FPT Cloud Server** — 2-16 vCPU, 4-32GB RAM for Stage 0 VPS deployment; Autoscale (VM cloning) available
- CDN/DNS/SSL via Cloudflare (edge cache only, no PII stored abroad); FPT is Cloudflare's sole VN distributor
- WAF: Cloudflare WAF (Pro $20/mo) for Stage 0-1; FPT Cloud WAF (CyRadar, 7.9M+ VND/mo) available for Stage 2
- Container images: GitHub Container Registry (free); FPT CR (16M VND/mo) skipped as cost-prohibitive
- Data centers: 4 Tier III facilities in Hanoi + HCMC (FPT Fornix HN01/HN02/HCM01/HCM02)
- Certifications: PCI DSS Level 1 (v4.0.1), ISO 27001/27017/27018, SOC 2
- Infrastructure-as-code: Terraform provider `fpt-corp/fptcloud` (v0.3.51) covers VPC, instances, DB, storage, K8s
- **No CDTIA filing needed** — no cross-border transfer occurs
- Provider-agnostic deployment contract (ADR-020 D8): migration to AWS/Vercel/Azure = DNS + connection strings, zero app code changes
- See ADR-020 D7 for staged architecture (VPS → multi-VM → FKE Kubernetes)
- Pricing: only Object Storage published; compute + DB require sales quotation
