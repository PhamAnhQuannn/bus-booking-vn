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
| 6 | Cross-border data transfer dossier | Decree 13/2023 | Submit within 60 days of go-live if PII flows through any overseas server |
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

**Current state**: Next.js on Vercel (sin1 — Singapore), PostgreSQL, Redis.

**Data localization gap**: Decree 53/2022 requires Vietnamese user PII (account names, phone numbers, payment card details, email, IP addresses) stored on servers physically in Vietnam. Vercel sin1 does not satisfy this. Decree 147/2024 adds: at least one server must be in Vietnam for investigation/complaint purposes.

**Recommended architecture change**:
- Keep Vercel sin1 for application serving (edge functions, static assets, CDN)
- Move PostgreSQL to Vietnam-hosted provider (Viettel IDC, VNPT Technology, FPT Telecom IDC) for all PII data
- Redis can remain in Singapore if only non-PII data (rate limits, sessions without PII); if sessions contain PII, Redis must also be Vietnam-hosted
- Prisma `directUrl` PgBouncer config already exists in codebase
- Extra latency: ~5-15ms (Vercel sin1 to Vietnam), acceptable for web application
