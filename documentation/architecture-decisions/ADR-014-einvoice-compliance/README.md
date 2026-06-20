# ADR-014: E-Invoice & Compliance

## Status
ACCEPTED

## Date
2026-06-17 (reviewed and confirmed)

## Context

Bus-Booking operates as a marketplace connecting Vietnamese bus operators (nhà xe) with travelers. The platform must comply with Vietnam's evolving e-invoice, data residency, tax, and privacy regulations while maintaining its "Shopify for bus operators" positioning — operators own their brand, customer relationship, and data.

Key business constraints driving compliance decisions (sourced from `documentation/business/`):

- **E-invoice mandate (Decree 123/2020 + Decree 70/2025)**: All commercial transactions require electronic invoices registered with GDT (General Department of Taxation). Transport invoices have additional requirements: vehicle license plate, departure, and destination must appear on the invoice. Operators with annual revenue ≥ VND 1B must use POS cash registers connected to GDT. (regulatory/einvoice-tax.md)
- **MISA e-invoice as competitive advantage**: No competitor offers built-in e-invoice automation. "Sign up and you're compliant with Decree 158/2024 from day one" is the leading sales message, targeting fear-driven value proposition that small operators understand. (market-research/competitive-advantages.md, competitor-benchmark/feature-parity-matrix.md)
- **Data residency (Decree 53/2022 + Decree 147/2024)**: Vietnamese user PII must be stored on servers physically in Vietnam. Current Vercel sin1 (Singapore) hosting for application compute does not satisfy this for database-level PII. MPS (Ministry of Public Security) can request localization at any time. (regulatory/data-privacy.md, market-research/regulatory-compliance.md)
- **PDPL 2025 (Decree 13/2023 + Decree 356/2025)**: Personal Data Protection Law requires DPO appointment, DPIA filing within 60 days of first processing, per-purpose consent, cross-border transfer dossier (CDTIA) within 60 days, and 72-hour breach notification. Platform collects sensitive data (payment, location, government ID) — SME exemptions do not apply. (regulatory/data-privacy.md, regulatory/dpia-checklist.md)
- **Tax withholding obligations**: E-Commerce Law 2025 (effective July 2026) creates new platform obligation to withhold VAT ~3% + PIT ~1.5% on individual/household operators. Companies self-declare CIT. Many small VN bus operators are sole proprietors or family businesses. (regulatory/einvoice-tax.md, regulatory/payment.md)
- **Foreign Contractor Tax (FCT)**: Payments from Vietnamese entity to foreign contractors (Vercel, Resend, AWS) trigger 5% VAT + 5% CIT withholding per Circular 103/2014 + Circular 69/2025. (regulatory/payment.md, regulatory/einvoice-tax.md)
- **Operator persona diversity**: 60-70% of operators are micro (1-5 buses, sole proprietor); 25-30% are mid-size (6-30, LLC/JSC). Tax treatment, invoice authority, and compliance burden differ fundamentally between these segments. (personas/operator-personas.md)
- **Finance/Accounting Manager admin persona**: Requires "payout queue, ledger reconciliation view, MISA push status, refund approval, tax export" — all compliance features must integrate with the admin console. (personas/admin-personas.md)

---

## Decisions

### 1. E-Invoice Issuer Model — Platform Issues on Behalf of Operator

| Option | Pros | Cons |
|--------|------|------|
| Each operator issues own invoices | Simplest legal model (operator = seller = invoicer); no platform liability for invoice accuracy; operator retains full control | Micro operators (60-70% of market) lack technical capability; invoice delays destroy customer trust; no automation = no competitive advantage; operator must have own MISA/VNPT setup |
| Platform issues all invoices as seller | Simplest integration (single invoicing entity); full platform control over timing and format; single MISA account | Misrepresents business model — platform is not the seller; VAT obligation falls on platform for gross ticket amount (not commission); regulatory reclassification risk as merchant-of-record |
| **Platform issues on behalf of operator (authorized)** | Invoice shows operator as seller with operator's MST/tax ID; platform automates timing + format + GDT submission; Decree 123 Art. 17 + Decree 70/2025 explicitly allow third-party authorization; single MISA integration serves all operators; "compliant from day one" sales message | Requires authorization agreement per operator (onboarding step); platform bears operational liability for invoice accuracy; each operator must be registered in GDT system; authorization agreement must be filed with local tax authority |

**Choice**: Platform issues on behalf of operator with authorization agreement

**Reasons**:
- Decree 123 Art. 17 + Decree 70/2025 explicitly allow third-party e-invoice issuance with an authorization agreement — the legal mechanism exists and is well-established (regulatory/einvoice-tax.md)
- Invoice shows the operator as seller (with operator's MST/tax ID), not the platform — this preserves the marketplace model and avoids merchant-of-record reclassification (regulatory/einvoice-tax.md)
- VeXeRe and Ve Xe Nhanh follow the same industry practice, confirming regulatory acceptance of the model (regulatory/einvoice-tax.md)
- Micro operators ("Bac Tam" persona, 60-70% of market) lack technical capability to run their own e-invoice system — platform automation removes this barrier to onboarding (personas/operator-personas.md)
- The "sign up and you're compliant" value proposition requires the platform to handle issuance — if operators must do it themselves, the competitive advantage evaporates (market-research/competitive-advantages.md)
- Authorization agreement becomes a standard onboarding document alongside transport license and bank account verification — no additional friction beyond existing KYB (regulatory/compliance-timeline.md)
- Transport-specific invoice requirements (vehicle plate number, departure, destination per Decree 70/2025) are fields the platform already captures at trip creation — automation is straightforward (regulatory/einvoice-tax.md)

> **IMPLEMENTATION STATUS** (2026-06-18)
> - **Documented**: Platform issues invoices on behalf of operator with transport-specific fields (vehicle plate, departure, destination, operator MST).
> - **Actual**: MISA meInvoice integration exists (Issue #74). However, transport-specific fields (vehiclePlate, departure city, destination city, operator MST/tax ID) are not mapped into MISA invoice payload. Current integration issues generic commercial invoices, not transport-compliant invoices per Decree 70/2025.
> - **Status**: `PARTIALLY_IMPLEMENTED`
> - **Tracking**: Map transport fields into MISA payload before go-live. Authorization agreement template not yet created.

---

### 2. E-Invoice Provider — MISA meInvoice

| Option | Pros | Cons |
|--------|------|------|
| VNPT-Invoice (gov-affiliated) | Government-affiliated credibility; direct GDT integration; established provider | Less popular with SMEs; API documentation less accessible; enterprise-oriented pricing model |
| **MISA meInvoice** | Most popular for Vietnamese SMEs; GDT-certified; private API per customer; mandatory XML + digital signature support; 10-year archival in original electronic form; already integrated (Issue #74); strongest brand recognition among target operator segment | Single-provider dependency; MISA API changes require adaptation; per-invoice cost structure |
| Build in-house | Full control; no vendor dependency; custom features | Requires GDT certification (months of process); XML + digital signature compliance is complex; 10-year archival obligation; regulatory risk if implementation has gaps; massive engineering effort for a solved problem |
| Multiple providers (MISA + VNPT) | Redundancy; operator choice; no single-vendor lock-in | Double integration effort; double maintenance; operator confusion; unnecessary complexity when one provider covers the market |

**Choice**: MISA meInvoice (single provider)

**Reasons**:
- MISA is the most popular e-invoice provider for Vietnamese SMEs — the exact segment BB targets. Operator familiarity reduces onboarding friction ("we already use MISA for accounting") (regulatory/einvoice-tax.md)
- GDT-certified with mandatory XML + digital signature support — compliance requirements are handled at the provider level, not the platform level (regulatory/einvoice-tax.md)
- 10-year archival in original electronic form is a legal requirement (Decree 123/2020) — MISA handles this obligation as part of the service (regulatory/einvoice-tax.md)
- "Sign up and you're compliant with Decree 158/2024 e-invoicing from day one" is the leading competitive advantage — unique vs. all competitors (VeXeRe, redBus, FUTA). Fear-driven value proposition that small operators understand immediately (market-research/competitive-advantages.md)
- No competitor offers built-in e-invoice automation at the platform level — VeXeRe's BMS is "bolted on" as a separate subscription product (competitor-benchmark/feature-parity-matrix.md)
- Finance/Accounting Manager persona requires "MISA push status" visibility in admin console — already scoped as a core admin feature (personas/admin-personas.md)
- Build-in-house rejected: GDT certification process is months long, XML + digital signature compliance is non-trivial, and the platform's competitive advantage is automation speed, not invoice infrastructure ownership (regulatory/einvoice-tax.md)

---

### 3. Data Residency Architecture — Vietnam-Hosted PostgreSQL, Vercel sin1 for Compute

| Option | Pros | Cons |
|--------|------|------|
| All in Singapore (Vercel sin1) | Current architecture; zero migration effort; Vercel auto-scaling; edge network; CDN | PII stored outside Vietnam violates Decree 53/2022; MPS can request localization at any time; forced emergency migration risk; no VeXeRe precedent protection (VeXeRe was founded pre-decree) |
| All in Vietnam | Full compliance; zero cross-border data transfer; no CDTIA filing needed; simplest legal position | Vercel has no Vietnam edge region; lose auto-scaling, CDN, edge functions; Vietnam cloud providers (Viettel/VNPT/FPT) have less mature serverless offerings; higher ops burden |
| **Hybrid: PII in VN, compute in SG** | PII in Vietnam-hosted PostgreSQL satisfies Decree 53/2022 data residency for personal data; Vercel sin1 retains auto-scaling, CDN, edge functions for application serving; 5-15ms latency acceptable for web app; Prisma `directUrl` PgBouncer config already exists | Cross-border transfer still occurs (app in SG reads PII from VN DB); requires CDTIA filing; more complex infrastructure; latency overhead vs. co-located DB |
| File CDTIA + defer migration | Minimal immediate effort; CDTIA filing satisfies filing obligation; migration planned within 6 months | MPS enforcement is selective but real; forced emergency migration risk remains; filing alone does not guarantee acceptance; weaker compliance posture than hosting in-country |

**Choice**: Hybrid — PII in Vietnam-hosted PostgreSQL (Viettel IDC / VNPT Technology / FPT Telecom IDC), Vercel sin1 for application serving

**Reasons**:
- Decree 53/2022 + Decree 147/2024 require Vietnamese user PII stored on servers physically in Vietnam — Singapore hosting for PII is non-compliant regardless of CDTIA filing (regulatory/data-privacy.md, market-research/regulatory-compliance.md)
- Data localization violation is rated CRITICAL severity in risk matrix — "Decree 53/2022 violation" with CEO + DPO ownership (risk-matrix.md)
- Vercel has no Vietnam edge region, so full migration to Vietnam would sacrifice auto-scaling, CDN, and edge functions that the platform depends on for Tet traffic spikes (5-10x normal). Vietnam cloud providers have less mature serverless offerings (market-research/risk-register.md)
- Hybrid architecture preserves Vercel's compute advantages while satisfying the core regulatory requirement: PII at rest is in Vietnam (regulatory/data-privacy.md)
- Expected latency for Vietnam DB ↔ Singapore compute: ~5-15ms — acceptable for a web application with P95 target of 500ms (market-research/regulatory-compliance.md)
- Prisma `directUrl` PgBouncer configuration already exists in the codebase (Issue #68/#67) — the connection topology supports a remote DB without architectural changes (vietnam-market-context.md)
- CDTIA filing is still required (Decree 356/2025) because application code in Singapore reads PII from Vietnam DB — this is a cross-border transfer. Filing deadline: within 60 days of first processing (regulatory/data-privacy.md, regulatory/compliance-timeline.md)
- Redis: if sessions contain PII, must also be Vietnam-hosted; if only non-PII data (rate limits, cache), Singapore-hosted acceptable (market-research/regulatory-compliance.md)

---

### 4. Tax Withholding — Differentiated by Operator Entity Type

| Option | Pros | Cons |
|--------|------|------|
| **Differentiated: companies exempt, individuals ~3% VAT + ~1.5% PIT** | Correct legal treatment per operator type; companies self-declare CIT (standard 20%); matches E-Commerce Law 2025 platform obligations; operator type determined at onboarding via business registration cert | More complex onboarding (must classify operator entity type); withholding calculation varies per operator; reconciliation with GDT required; some operators may resist disclosure of entity type |
| Uniform rate for all operators | Simpler implementation; single withholding calculation; no classification needed | Overwithholds from companies (who self-declare); underwitholds from individuals (who expect platform to withhold); regulatory non-compliance; operator complaints from incorrect withholding |
| Operators self-declare (no platform withholding) | Zero platform tax administration burden; operators handle own tax | E-Commerce Law 2025 (effective July 2026) explicitly creates platform withholding obligation; non-compliance = direct regulatory liability; individual/household operators may not self-declare (tax leakage = government enforcement against platform) |

**Choice**: Differentiated by operator entity type — companies exempt from platform withholding (self-declare CIT), individual/household operators withhold ~3% VAT + ~1.5% PIT

**Reasons**:
- E-Commerce Law 2025 (effective July 1, 2026) creates a new explicit platform obligation to withhold VAT + PIT for non-incorporated sellers. This is not optional — failure to withhold makes the platform liable (regulatory/einvoice-tax.md, regulatory/payment.md)
- Operator entity type is determinable at onboarding: business registration certificate (Giấy chứng nhận ĐKKD) for companies vs. household business certificate (Giấy chứng nhận ĐKHKD) for sole proprietors — this is already part of the KYB document collection flow (regulatory/einvoice-tax.md)
- Many small Vietnamese bus operators are sole proprietors or family businesses ("Bac Tam" persona: 1-5 buses, family operation, 60-70% of market by count) — these are the operators that trigger individual withholding (personas/operator-personas.md, regulatory/einvoice-tax.md)
- Companies (mid-size "Cong Ty" persona, 25-30%; large fleet 50+ buses) self-declare CIT at standard 20% rate — platform withholding on companies would be incorrect and generate disputes (personas/operator-personas.md)
- Withholding rates sourced from regulatory docs: VAT ~3% + PIT ~1.5% for individual/household operators. Exact rates depend on business type and revenue tier per Circular 40/2021 (regulatory/payment.md)
- Tax preferential rate eligibility: platform itself may qualify for 10% CIT for 15 years if classified as IT/technology business (vs. standard 20%) — assess at quarterly CIT filing (market-research/regulatory-compliance.md)

---

### 5. Foreign Contractor Tax (FCT) — Apply to Outbound Foreign SaaS Payments

| Option | Pros | Cons |
|--------|------|------|
| Apply FCT to all service payments | Over-compliant; no risk of missing an applicable payment | Incorrect — FCT does not apply to domestic Vietnamese vendors (VNPay, MoMo, eSMS); overwithholding creates vendor disputes and incorrect tax reporting |
| **Apply only to payments to foreign contractors** | Correct legal scope: 5% VAT + 5% CIT on payments FROM Vietnamese entity TO foreign contractors; covers Vercel, Resend, AWS, foreign parent management fees; excludes domestic PSPs | Must classify each vendor as domestic or foreign; withholding and remittance within 10 days per payment; transfer pricing documentation if foreign ownership >25% |
| Ignore FCT obligations | Zero administration burden | Direct regulatory violation of Circular 103/2014 + Circular 69/2025; GDT audit risk; back-taxes + penalties; 10% effective leakage on foreign SaaS spend |

**Choice**: Apply FCT to outbound payments to foreign contractors only

**Reasons**:
- FCT applies to payments FROM a Vietnamese entity TO foreign contractors — this is the legal definition per Circular 103/2014 + Circular 69/2025. It is NOT a tax on foreign-owned Vietnamese companies and NOT a tax on payments to domestic Vietnamese vendors (regulatory/payment.md)
- Applicable payments: Vercel (hosting), Resend (email), AWS/GCP (if used), any foreign SaaS subscription, foreign parent company management fees. Rate: 5% VAT + 5% CIT = 10% total on payment amount (regulatory/einvoice-tax.md)
- NOT applicable: VNPay (Vietnamese), MoMo (Vietnamese), eSMS (Vietnamese), MISA (Vietnamese) — these are domestic service providers, not foreign contractors (regulatory/payment.md)
- Withholding and remittance deadline: within 10 days of each payment — must be operationalized in accounting workflow (regulatory/einvoice-tax.md)
- Transfer pricing documentation (Master File + Local File per Decree 132/2020) is separately required if platform has >25% direct/indirect foreign ownership — Vietnam tax authorities increasingly aggressive on TP audits since 2022 (regulatory/einvoice-tax.md)

---

### 6. DPO Appointment & DPIA Filing — At Launch, No Deferral

| Option | Pros | Cons |
|--------|------|------|
| Defer using SME exemption (5 years) | Zero compliance burden at launch; focus on product; cheaper | PDPL 2025 SME exemption ONLY applies if: <100k records AND no sensitive data AND not providing processing services. Platform collects payment data (sensitive) — exemption does not apply. Deferral = regulatory violation from day one |
| **Appoint DPO + file DPIA at launch** | Full compliance from day one; DPO registered with MPS; DPIA filed within 60-day deadline; CDTIA filed within 60 days if offshore transfer; documented defense in case of audit | Upfront cost (DPO appointment, DPIA preparation); 15-day MPS review for DPIA; administrative burden during launch |
| Use external DPO service provider | Lower cost than full-time hire; specialized expertise; meets regulatory requirement | Less control; response time for data subject requests may be slower; still requires DPIA filing separately |

**Choice**: Appoint DPO + file DPIA at launch (no deferral)

**Reasons**:
- Platform collects payment card data (financial), location data (GPS coordinates), and government ID (CCCD/CMND) — all classified as sensitive personal data under PDPL 2025 Decree 356 Annex. The SME exemption explicitly does not apply when processing sensitive data (regulatory/data-privacy.md, regulatory/dpia-checklist.md)
- DPIA filing is mandatory within 60 days of first processing (Decree 356/2025), with a 15-day MPS review period. This is a non-negotiable regulatory deadline — missing it creates documented non-compliance before the platform has any users (regulatory/data-privacy.md, regulatory/compliance-timeline.md)
- CDTIA (Cross-Border Data Transfer Impact Assessment) filing is also mandatory within 60 days if PII flows through overseas servers (Vercel Singapore). Decree 356/2025 expressly categorizes foreign cloud services as cross-border transfer regardless of physical server location (regulatory/data-privacy.md)
- DPO appointment is mandatory from January 1, 2026 under PDPL 2025 for organizations processing sensitive data — cannot be deferred (regulatory/dpia-checklist.md)
- Compliance Officer admin persona requires "DSAR response within 30-day SLA, ConsentRecord immutability, PII access audit log" — these features depend on having an appointed DPO to own the process (personas/admin-personas.md)
- 30-day DSAR (Data Subject Access Request) response SLA is a legal requirement under PDPL 2025 — operational process must exist at launch, not retroactively (regulatory/dpia-checklist.md)
- Breach notification timeline: standard 72 hours, reduced to 24 hours for cybersecurity attacks affecting consumer financial data. DPO must own this process (regulatory/dpia-checklist.md)

---

### 7. Consent Model — Per-Purpose Granular Consent

| Option | Pros | Cons |
|--------|------|------|
| Pre-ticked consent | Highest opt-in rate; simplest UX; fewer friction points | Explicitly prohibited by PDPL 2025 Art. 9; silence or inaction is NOT consent; pre-ticked = no verifiable consent; regulatory violation |
| Bundled consent (service + marketing) | Simpler UX than granular; single consent action | PDPL 2025 requires consent per processing purpose; bundling service-essential processing with marketing violates purpose limitation; user cannot consent to service without also consenting to marketing |
| **Per-purpose granular consent with no pre-ticked boxes** | Full PDPL 2025 compliance; verifiable consent per purpose; user controls each purpose independently; consent log (timestamp + policy version + purpose) creates documented audit trail; org bears burden of proof — this meets it | More complex UX; lower marketing opt-in rates; consent management UI/database required; per-instance consent needed for each cross-border transfer |

**Choice**: Per-purpose granular consent with no pre-ticked boxes

**Reasons**:
- PDPL 2025 Art. 9 requires consent to be: explicit, per processing purpose, not pre-ticked, and verifiable in writing. The organization bears the burden of proof for consent — bundled or pre-ticked consent fails this test (regulatory/data-privacy.md)
- Per-instance consent is required for each cross-border data transfer (Decree 356/2025). If PII flows through Singapore servers (Vercel), each data subject must have consented specifically to that transfer — bundled consent cannot cover this (regulatory/data-privacy.md, regulatory/dpia-checklist.md)
- Consent logging must record: timestamp, policy version, user ID, and purpose for each consent event. ConsentRecord uses the same append-only immutability pattern as LedgerEntry (PostgreSQL BEFORE UPDATE/DELETE trigger) — consent records cannot be retroactively altered (regulatory/dpia-checklist.md)
- Children under 16 require parental consent (PDPL Decree 356 enhanced protection) — granular consent model supports this as an additional purpose/gate without restructuring (regulatory/dpia-checklist.md)
- Transactional communications (OTP, booking confirmations, departure reminders) are exempt from consent requirements per Decree 91/2020 — only marketing communications require opt-in + DNC (Do-Not-Call) registry check. The granular model cleanly separates these categories (regulatory/telecom-sms.md)
- Lower marketing opt-in rate is an accepted trade-off — the alternative (non-compliance) carries fines and operational shutdown risk. Marketing reach gap is mitigated by Zalo OA (primary channel, 85% Vietnamese penetration) where users explicitly follow the account (market-research/user-insights.md)

---

## Known Gaps (as of 2026-06-18)

- **Data residency CDTIA status**: Vercel sin1 (Singapore) hosting constitutes cross-border data transfer under Decree 53/2022. CDTIA (Cross-Border Data Transfer Impact Assessment) filing status is unknown — required within 60 days of processing start. See ADR-001 D4.
- **DSAR response workflow**: E-invoice records contain operator PII (MST, name, address). PDPL 2025 data subject rights apply. No deletion/anonymization workflow for e-invoice records exists (10-year GDT retention requirement conflicts with PDPL deletion rights — resolution not documented).

---

## Consequences

### Positive
- Platform-issued e-invoices on behalf of operators make "compliant from day one" a real competitive advantage — no competitor offers this, and it targets the fear-driven value proposition that resonates with small operators facing Decree 158/2024
- MISA meInvoice integration automates the full invoice lifecycle (creation, digital signature, GDT submission, 10-year archival) — removes the #1 administrative burden for mid-size operators who currently manage invoicing manually
- Hybrid data residency (VN database + SG compute) satisfies Decree 53/2022 while preserving Vercel's auto-scaling for Tet traffic spikes (5-10x normal) — avoids both regulatory violation and infrastructure regression
- Differentiated tax withholding correctly treats the two operator segments: sole proprietors get compliant withholding (they may not self-declare otherwise), companies are not over-withheld (preventing disputes)
- DPO + DPIA at launch creates documented compliance posture from day one — stronger than VeXeRe's grandfather position (founded pre-PDPL) and provides audit defense
- Per-purpose consent with immutable ConsentRecord provides verifiable audit trail that meets PDPL 2025 burden-of-proof requirement — the strongest available legal position

### Negative
- Authorization agreement per operator adds onboarding friction — each operator must sign an e-invoice authorization document and be verified in the GDT system before their first booking can generate an invoice
- MISA single-provider dependency — if MISA has API downtime, invoice generation is blocked for all operators. No fallback provider integrated
- Hybrid data residency increases infrastructure complexity — two hosting environments, cross-border latency, CDTIA filing obligation, and Redis PII determination needed
- Differentiated withholding requires entity-type classification at onboarding — some operators may resist disclosing whether they are sole proprietors vs. companies, especially if it affects their withholding rate
- FCT compliance adds accounting workflow complexity — each foreign vendor payment requires separate withholding calculation and 10-day remittance deadline
- Per-purpose consent reduces marketing opt-in rates compared to bundled consent — marketing reach via platform channels will be lower

### Mitigations
- E-invoice authorization friction: incorporate authorization agreement into existing KYB onboarding flow — same step as transport license upload and bank account verification. Admin Operations Manager persona already handles document review (personas/admin-personas.md, regulatory/compliance-timeline.md)
- MISA downtime: queue failed invoice submissions for retry; invoice can be issued within next business day per Decree 123/2020 — same-day issuance is best practice, not a legal hard deadline. Monitor MISA push status in Finance admin panel (personas/admin-personas.md)
- Infrastructure complexity: Prisma `directUrl` PgBouncer config already handles remote DB topology. Vietnam DB providers (Viettel IDC, VNPT Technology, FPT Telecom IDC) offer managed PostgreSQL with SLAs. Redis determination: audit session data for PII presence — if sessions only contain token references (not PII), Singapore Redis is acceptable (market-research/regulatory-compliance.md)
- Operator entity classification resistance: frame classification as "correct tax treatment that benefits you" — sole proprietors pay lower effective rates than company CIT. Onboarding UX explains the two paths clearly (personas/operator-personas.md)
- FCT accounting workflow: automate withholding calculation in accounting dashboard; surface upcoming 10-day deadlines; FCT applies to a small, known set of vendors (Vercel, Resend, etc.) — not a per-transaction burden (regulatory/einvoice-tax.md)
- Marketing opt-in gap: Zalo OA (explicit follow = implicit interest), shareable booking links (operator-driven traffic, near-zero CAC), and Tet-seasonal demand spikes reduce dependence on platform-pushed marketing. Promo code engine (Month 1-3) targets users who have already opted in (market-research/user-insights.md, market-research/strategic-roadmap.md)

---

## References

All decisions sourced exclusively from `documentation/business/`:

| Document | Cited In |
|----------|----------|
| regulatory/einvoice-tax.md | D1, D2, D4, D5, Mitigations |
| regulatory/data-privacy.md | D3, D6, D7 |
| regulatory/dpia-checklist.md | D6, D7 |
| regulatory/payment.md | D4, D5 |
| regulatory/telecom-sms.md | D7 |
| regulatory/compliance-timeline.md | D1, D3, D6, Mitigations |
| market-research/competitive-advantages.md | D1, D2 |
| market-research/regulatory-compliance.md | D3, D4, Mitigations |
| market-research/user-insights.md | D7, Mitigations |
| market-research/strategic-roadmap.md | Mitigations |
| market-research/risk-register.md | D3 |
| competitor-benchmark/feature-parity-matrix.md | D2 |
| personas/operator-personas.md | D1, D4, Mitigations |
| personas/admin-personas.md | D2, D6, Mitigations |
| risk-matrix.md | D3 |
| vietnam-market-context.md | D3 |
