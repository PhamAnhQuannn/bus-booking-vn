# ADR-004: Multi-Tenancy Design

## Status
ACCEPTED

## Date
2026-06-17 (reviewed and confirmed)

## Context

Bus-Booking is a multi-tenant marketplace where multiple bus operators (nhà xe) share a single platform while maintaining data isolation, independent branding, and separate financial accounting. Three distinct user groups — customers, operators, and platform admins — interact with the same product surface through different portals.

Key multi-tenancy constraints driving decisions (sourced from `documentation/business/`):

- **Operator isolation**: each operator's fleet, routes, trips, bookings, and financial data must be invisible to other operators. A single large operator leaving removes 30-50% of inventory. (stakeholder-map.md)
- **Cross-tenant search**: customers search across ALL operators simultaneously — data isolation cannot prevent cross-operator discovery. (bounded-contexts.md)
- **Vietnam regulatory**: marketplace model avoids SBV payment intermediary license (VND 50B capital requirement). Platform classification as technology/e-commerce (not transport) preserves 100% foreign ownership. (payment.md, legal-entity.md)
- **Operator diversity**: 60-70% of operators are micro (1-5 buses, paper ledger, cash-only); 5-10 are FUTA-scale ($50M-320M+ revenue, own IT teams). Multi-tenancy must serve both extremes. (operator-personas.md)
- **Financial integrity**: append-only ledger with per-operator balance derivation; platform fee as separate ledger entry; settlement delay per operator. (invariants-catalog.md)
- **E-invoice compliance**: platform issues e-invoices on behalf of operators using each operator's tax ID — tenant identity flows through to GDT. (einvoice-tax.md)
- **Brand ownership**: positioning as "Shopify for bus operators" — operator brand front-and-center, not platform brand. (competitive-advantages.md)

---

## Decisions

### 1. Platform Model — Marketplace

| Option | Description | Risk |
|--------|-------------|------|
| **Marketplace** | Customer → PSP → Operator. Platform acts as agent, not principal. Connects buyers and sellers. | Low — no IPS license needed |
| Merchant of Record | Customer → Platform (as principal) → Operator. Platform is the legal seller. | Medium — different tax basis, platform assumes liability |
| Hybrid/Pooling | Customer → Platform bank account → Operator. Platform pools and redistributes funds. | **High — likely requires SBV IPS license (VND 50B ~USD 2M capital)** |

**Choice**: Marketplace

**Reasons**:
- VeXeRe precedent: Vietnam's largest bus booking platform operates as marketplace/agent since 2013 without SBV IPS license — not on SBV's published list of 32+ licensed IPS providers (payment.md)
- Decree 52/2024 Article 3(17) defines "thu hộ chi hộ" (collection/payment support) — if platform touches funds, could be classified as unlicensed payment intermediary with shutdown risk (payment.md)
- Marketplace model means platform never holds operator funds — eliminates the IPS license question entirely (risk-matrix.md)
- Platform's commission flows as a separate B2B invoice (platform → operator), keeping the payment rail clean (einvoice-tax.md)

---

### 2. Payment Fund Flow — PSP Split-Settlement

| Option | Description | Trade-off |
|--------|-------------|-----------|
| **PSP split-settlement** | Each operator opens own VNPay/MoMo merchant account. Payment splits at source — operator share goes to operator, platform fee goes to platform. | Requires operators to open merchant accounts |
| Central collection then remit | Platform collects full amount, transfers operator share later | **Illegal without SBV license** — this IS "thu hộ chi hộ" |
| Licensed escrow provider | Third-party escrow holds funds, releases per rules | Adds cost, dependency, and settlement latency |

**Choice**: PSP split-settlement

**Reasons**:
- Eliminates custody of operator funds — platform never touches operator money at any point (vietnam-market-context.md)
- Eliminates SBV IPS license requirement — the single highest-severity risk in the risk matrix (risk-matrix.md)
- Eliminates T+N payout obligation from platform to operator — operator gets paid at PSP source (payment.md)
- Fallback to licensed escrow only if small operators (60-70% of market by count) cannot open their own merchant accounts (operator-personas.md)
- Fund flow matters more than contract label — even with a marketplace contract, if VNPay settles to platform's account first, the practical flow looks like thu hộ chi hộ (payment.md)

> **IMPLEMENTATION STATUS** (2026-06-18)
> - **Documented**: PSP split-settlement — each operator opens own VNPay/MoMo merchant account, payment splits at source
> - **Actual**: Central collection via single platform merchant account (one `tmnCode` for VNPay, one `partnerCode` for MoMo from env). All payments flow to platform's account; operator share tracked via internal software ledger. Zero per-operator merchant credentials, zero sub-merchant IDs, zero PSP-level split calls.
> - **Status**: `NOT_IMPLEMENTED`
> - **Tracking**: This is the single highest-severity gap. The implemented model matches the "Central collection then remit" row above — which this ADR itself labels **illegal without SBV license**. Resolution required before Issue 094 go-live. See also ADR-005 D1, ADR-010 D4, risk-register #1.

---

### 3. Brand Ownership — Operator-Branded ("Shopify Model")

| Option | Description | Precedent |
|--------|-------------|-----------|
| **Operator-branded** | Consumer sees operator's brand, not BB's. Operator owns customer relationship. | Shopify model |
| Platform-branded marketplace | Operator = supplier inside BB's consumer marketplace. BB owns customer relationship and brand impression. | VeXeRe / redBus model |
| White-label | Operator gets own app/site running on BB infrastructure. Operator brand is primary. | VeXeRe BMS white-label offering |

**Choice**: Operator-branded

**Reasons**:
- Brand control is the #1 concern operators reveal by behavior — FUTA (30M pax/year) and Thanh Buoi invested in proprietary apps specifically to escape VeXeRe dependency (operator-sentiment.md)
- VeXeRe BMS creates two-layer lock-in: distribution partners AND software customers — exiting distribution = losing software stack. Data portability not guaranteed. (operator-sentiment.md)
- "Shopify for bus operators" positioning: own your storefront, own your customer relationship, own your data — directly addresses operator pain point #1 (competitive-landscape.md, competitive-advantages.md)
- **Trade-off acknowledged**: no marketplace demand aggregation — operator must drive own traffic or rely on BB distribution partnerships (MoMo/ZaloPay, 12Go/Bookaway, SEO tools). If BB cannot solve operator distribution, this advantage becomes a liability. (competitive-advantages.md)

---

### 4. Commission/Pricing Model — Dual (Commission + SaaS)

| Option | Description | Target segment |
|--------|-------------|----------------|
| Commission-only | 0 VND/month subscription, 8-10% per booking | Low-volume operators testing platform |
| SaaS-only | Fixed monthly subscription, low per-booking % | High-volume operators wanting cost predictability |
| **Dual model** | Both options offered: commission (8-10%) OR SaaS (1-2M VND/month + 3-5%) | All segments |

**Choice**: Dual commission + SaaS

**Reasons**:
- Mirrors "Shopify Basic vs. Shopify Plus" pricing structure — validated by VeXeRe's dual BMS/commission model (business-model.md)
- 8-10% commission undercuts VeXeRe (~8-12% estimated) and redBus (10-20% confirmed by 4+ sources) (pricing-comparison.md)
- 5% introductory rate for operator acquisition (3-month free trial, then 5% intro) — no incumbent matches publicly (business-model.md, pricing-comparison.md)
- Floor 5%: below this, unit economics are negative after payment processing (1.5-2.5%) and support costs. Ceiling 15%: above this, operators bypass platform for direct bookings. (business-model.md)
- Unit economics at 10% on 400K VND avg ticket: ~16,000 VND net margin per booking (4.0% of ticket). Break-even at 50K-100K bookings/month. (business-model.md)

> **CORRECTION** (2026-06-18): ADR references "8-10%" as standard commission and "5% introductory" rate. Actual configured default is **6%** (`ratePpm=60000` in seed + `DEFAULT_PLATFORM_FEE_PCT=0.06` in calcPayout). Ceiling is **20%** (`MAX_FEE_OVERRIDE_PPM=200000`), not 15%. Rate is admin-configurable per operator via FeeConfig. SaaS subscription tier has no schema implementation.

---

### 5. Fee Configuration — Per-Operator Override with Effective-Dating

| Option | Description | Flexibility |
|--------|-------------|-------------|
| Global flat rate | Same percentage for all operators | None — cannot negotiate with large operators |
| **Per-operator override + effective-dating** | Global default rate + per-operator negotiated rate. Stored as `ratePpm` (parts-per-million). New FeeConfig row for rate changes, never in-place edits. | High — supports negotiation, introductory rates, phased increases |
| Volume-tiered | Automatic rate reduction based on booking count thresholds | Medium — transparent but inflexible for individual negotiation |

**Choice**: Per-operator override with effective-dating

**Reasons**:
- Large corporate operators (FUTA-scale) demand negotiable fees — a single large operator leaving removes 30-50% of inventory; fee negotiation is a non-negotiable retention tool (stakeholder-map.md)
- 3% pilot fee for initial corridor operators, 5% introductory, 8-10% standard — multiple rate tiers coexist across the operator base (business-model.md, vietnam-market-context.md)
- Effective-dating enables rate transitions without data loss — historical rates preserved for ledger reconciliation (invariants-catalog.md)
- `ratePpm` encoding (parts-per-million, e.g. 60000 = 6%) avoids floating-point representation in the database while supporting sub-percentage precision (invariants-catalog.md)

---

### 6. Tenant Data Isolation — Shared Database + Application-Level Scope

| Option | Description | Trade-off |
|--------|-------------|-----------|
| Database-per-tenant | Separate PostgreSQL instance per operator | Strongest isolation; expensive to manage; cross-tenant queries (search) require fan-out; 60-70% of tenants are micro operators with 1-5 buses |
| Schema-per-tenant | Separate PG schema per operator within one instance | Medium isolation; migration complexity multiplied by operator count; cross-schema joins needed for search |
| **Shared DB + application scope** | Single database. `operatorId` foreign key on all operator-scoped models. `withOperatorScope(tx, operatorId)` guard constrains every operator-side query to `WHERE operatorId = $operatorId`. | Simplest; cheapest; risk = scope leak if guard bypassed |

**Choice**: Shared database with application-level tenant scope via `withOperatorScope`

**Reasons**:
- Customer search queries ALL operators' trips simultaneously — cross-tenant read is a core product requirement, not an edge case (bounded-contexts.md)
- `Place` registry is global and shared across the platform (not operator-scoped) — DB-per-tenant would require duplicating or federating the Place table (ubiquitous-language.md)
- Admin reporting requires cross-operator aggregation (payout queue, ledger view, revenue reports, moderation queue) — single DB makes this trivial (bounded-contexts.md)
- 60-70% of operators are micro (1-5 buses) — DB-per-tenant is wildly over-provisioned for the long tail (operator-personas.md)
- `withOperatorScope` in `lib/core/db/tenantScope.ts` is the ACL boundary — every operator-side query passes through it (bounded-contexts.md)
- **Risk mitigation**: `eslint-plugin-boundaries` enforces that operator-scoped service modules always receive `operatorId` from the auth guard, not from request body — prevents tenant ID spoofing at the API layer

---

### 7. Auth Realm Separation — Three Separate Realms

| Option | Description | Complexity |
|--------|-------------|------------|
| Shared auth (single user model + roles) | One User table with `role: customer | operator | admin`. Single session model. | Simpler schema; but different login methods (phone OTP vs username/password vs TOTP) must coexist in one flow |
| **Three separate realms** | Customer, Operator, Admin — each has own user model, session model, OTP model, auth service, and guard middleware | Three parallel auth stacks; but each is clean and purpose-built |

**Choice**: Three separate auth realms, never mixed

**Reasons**:
- Login methods are fundamentally different: customers login by phone OTP; operators login by username (format `BRAND_ACRONYM-last4phone`) + password; admins login by password + TOTP step-up. No shared credential model. (bounded-contexts.md)
- Session security requirements differ: customer sessions are long-lived (convenience); operator sessions carry tenant-scoped JWT claims (`operatorId`, `requiresPasswordChange`); admin sessions require step-up for finance actions (bounded-contexts.md)
- OperatorUser is NOT a Customer — entirely distinct identity model with different fields (`contactPhone`, `notificationPhone`, `role: admin | staff`) (ubiquitous-language.md)
- Admin realm is invite-only with TOTP — mixing it with customer self-registration would weaken the admin security boundary (bounded-contexts.md)
- Operator JWT encodes `operatorId` claim — this is the tenant identity that flows through to `withOperatorScope` for all downstream queries (invariants-catalog.md)

---

### 8. E-Invoice Issuer Role — Platform Issues on Behalf of Operator

| Option | Description | Feasibility |
|--------|-------------|-------------|
| Operator issues directly | Each operator integrates MISA themselves, manages own digital signature | Impractical for micro operators (60-70% of market); many haven't implemented e-invoicing at all |
| **Platform issues on behalf** | Platform authorized by operator via formal agreement. Invoice shows operator as seller with operator's tax ID (MST). Platform integrates MISA once for all operators. | Requires authorization agreement + GDT notification per operator |
| Platform as principal issuer | Platform issues under own tax code as the seller | Legally wrong — platform is agent, not seller of transport service |

**Choice**: Platform issues on behalf of operator (third-party authorization)

**Reasons**:
- Decree 123 Art. 17 (expanded by Decree 70/2025) explicitly allows third-party e-invoice authorization — now available to business households and individual businesses, not just enterprises (einvoice-tax.md)
- Industry standard: VeXeRe, Ve Xe Nhanh, and most VN booking platforms take the authorization approach (einvoice-tax.md)
- MISA meInvoice integration already built (#74) — platform integrates once, all operators benefit (competitive-advantages.md)
- "Compliant e-invoicing from day one" is the lead operator acquisition pitch — a concrete, fear-driven value proposition that small operators understand (competitive-advantages.md)
- Many small operators haven't implemented e-invoicing — platform becomes compliance enabler, not just a booking channel (einvoice-tax.md, operator-personas.md)

---

### 9. Tax Withholding — Split by Operator Entity Type

| Option | Description | Basis |
|--------|-------------|-------|
| No withholding | All operators self-file | Non-compliant after E-Commerce Law July 2026 |
| Universal withholding | Withhold from all operators | Over-withholds from companies (who self-declare CIT) |
| **Split by entity type** | Companies = self-file (no platform withholding). Individual/household = platform withholds VAT ~3% + PIT ~1.5%. | E-Commerce Law 2025 mandate |

**Choice**: Split by entity type

**Reasons**:
- E-Commerce Law 2025 (effective July 2026) mandates platform withholding for individual/household sellers — legal requirement, not optional (einvoice-tax.md)
- Incorporated companies self-declare CIT — platform withholding would be incorrect and create reconciliation burden (einvoice-tax.md)
- Operator model already carries `taxClassification: company | individual_household` to support this determination (ubiquitous-language.md)
- `tax_withheld` ledger entry type already exists in the entry type enum — the financial accounting is built for this split (invariants-catalog.md)
- Many small VN bus operators are sole proprietors or family businesses — operator entity type determination at onboarding is the operational challenge (einvoice-tax.md, operator-personas.md)

---

### 10. Legal Entity Type — LLC (TNHH), Convert to JSC Later

| Option | Governance | Best for |
|--------|-----------|----------|
| **LLC (TNHH)** | 1-50 members, simpler governance, no public share offering | Early-stage startup |
| JSC (Cổ phần) | Min 3 founders, Board of Directors + Supervisory Board, can issue shares publicly | Series A fundraising and beyond |

**Choice**: LLC initially, convert to JSC when preparing for Series A

**Reasons**:
- Simpler governance: no Board of Directors or Supervisory Board required — appropriate for pre-product-market-fit stage (legal-entity.md)
- Faster registration: 3-5 business days for ERC (Enterprise Registration Certificate) vs. longer JSC setup (legal-entity.md)
- Lower cost: ~5-15M VND through legal service including government fees (legal-entity.md)
- Conversion path exists: Enterprise Law 2020 allows LLC → JSC conversion when preparing for fundraising (legal-entity.md)
- JSC overhead (board governance, supervisory board, shareholder reporting) is premature until Series A metrics proven: $500K-2M GMV/month target (investor-kpis.md)

---

### 11. VSIC Code Classification — Technology + E-Commerce Only

| Option | Foreign ownership | Regulatory consequence |
|--------|-------------------|----------------------|
| **Technology/software/IT + E-commerce platform** | Up to 100% (WTO commitments) | Only e-commerce conditions apply: MOIT registration, operator verification, dispute resolution |
| Include road transport codes | Capped 49-51% (WTO conditional sector) | Transport license required; different ministry oversight (Ministry of Transport, not MOIT) |

**Choice**: Technology + e-commerce VSIC codes only. Exclude road transport.

**Reasons**:
- Grab Vietnam precedent: registered under technology/IT service categories, 100% foreign ownership, operates transport-adjacent platform without transport license (legal-entity.md)
- Wrong VSIC codes trigger transport license requirement + foreign ownership cap + Ministry of Transport oversight — fundamentally changes the regulatory landscape (legal-entity.md)
- Platform does not own or operate buses — it connects buyers (customers) and sellers (operators). This is technology intermediation, not transport service. (payment.md, competitive-landscape.md)
- E-commerce platform registration at Online.gov.vn has lighter conditions: company info, platform rules, dispute mechanism, privacy policy, operator verification process (legal-entity.md)
- **Risk acknowledged**: if platform adds fleet management features or route optimization, MoT could argue transport VSIC codes apply — feature scope must be monitored (legal-entity.md)

---

### 12. Settlement Timing — T+1 in Code, T+3 Marketed

| Option | Buffer | Competitive position |
|--------|--------|---------------------|
| T+0 (instant) | No dispute/chargeback buffer | Only viable with split-settlement where PSP pays operator at source |
| **T+1 (code implementation)** | 1-day buffer for disputes, chargebacks, oversold-race refunds | Fastest coded settlement in market |
| T+3 (marketed) | Published as headline differentiator | No competitor publishes settlement terms |
| T+7 to T+14 | VeXeRe estimated default (not published) | Industry norm (inferred) |

**Choice**: T+1 in code (`SETTLEMENT_DELAY_DAYS = 1`), marketed as T+1

**Reasons**:
- 1-day buffer provides time for dispute resolution, chargebacks, and oversold-race refunds before funds become withdrawable — without it, an operator could complete a trip and immediately withdraw before disputes are processed (invariants-catalog.md)
- "T+1 fast settlement" is the fastest published settlement term in the Vietnam bus booking market — no competitor publishes their terms at all (competitive-advantages.md, pricing-comparison.md)
- VeXeRe advertises "direct bank account deposits" as a BMS selling point, implying their baseline experience involves delays — BB's published T+1 is a concrete, verifiable trust advantage (operator-sentiment.md)

> **CORRECTION** (2026-06-18): Original ADR said "marketed as T+3." User confirmed T+1 is the canonical marketing term. All business docs updated to T+1. Code already implements T+1 (`SETTLEMENT_DELAY_DAYS=1`).
- Fast payout is meaningful to small operators with tight cash flow, especially during Tet when revenue is lumpy (competitive-advantages.md)
- **Regulatory caveat**: T+3 model has risk under Decree 52/2024 — must be structured so PSP holds funds, not BB. Platform never takes custody. (competitive-advantages.md)

---

### 13. Place/Location Model — Global Registry + Operator-Scoped Pickup Areas

| Option | Description | Search impact |
|--------|-------------|---------------|
| Operator-scoped places | Each operator defines own location names | Customer search fragmented — "Da Lat" has N different spellings across N operators |
| **Global shared registry + operator pickup areas** | `Place` = global canonical registry with aliases and diacritics-normalized search. `OperatorPickupArea` = operator-specific pickup/dropoff points scoped by `operatorId`. | Unified search across all operators; operator-specific boarding details |
| Fully global (no operator scoping) | All locations shared, including pickup points | Operators cannot define their own pickup/dropoff points |

**Choice**: Hybrid — global Place registry + operator-scoped pickup areas

**Reasons**:
- Customer search must work across operators: customer searches "Đà Lạt" and sees all operators' trips — requires a canonical, shared place registry (bounded-contexts.md)
- `Place` supports alias merging (the `aliases` string array) and diacritics-normalized search via `unaccent_immutable ILIKE` — handles "Da Lat" / "Đà Lạt" / "TP. Đà Lạt" consistently (ubiquitous-language.md)
- But pickup points are operator-specific: different operators pick up at different locations, some offer door-to-door ("đón tận nơi"). `OperatorPickupArea` carries `pickupPlaceKind: station | pickup` per operator. (ubiquitous-language.md)
- Three `PickupKind` values (`station`, `point`, `custom`) allow progressive specificity — from bus terminal defaults to operator-defined points to free-text custom addresses (ubiquitous-language.md)

---

### 14. Operator Onboarding Gate — Admin-Gated KYB

| Option | Description | Risk level |
|--------|-------------|------------|
| Self-service (open) | Any operator can list immediately after registration | **High** — unlicensed operators create regulatory liability |
| **Admin-gated KYB** | `PENDING_REVIEW → UNDER_REVIEW → APPROVED | REJECTED`. Only APPROVED operators visible in search and bookable. Transport license required as KYB document. | Low — compliance-first |
| Invite-only | Platform hand-selects operators | Too restrictive for scale; blocks long-tail supply |

**Choice**: Admin-gated KYB with approval lifecycle

**Reasons**:
- Ministry of Transport can shut the platform down entirely if an unlicensed operator is onboarded — this is the #2 make-or-break stakeholder risk (stakeholder-map.md)
- ~20-30% of inter-provincial trips operate informally (unlicensed). Admitting them creates regulatory liability; rejecting them is correct but shrinks addressable supply side. (stakeholder-map.md)
- KYB license gate is both legal requirement AND competitive moat vs. unlicensed informal channels (stakeholder-map.md)
- Transport license (Giấy phép kinh doanh vận tải) required as KYB document, with license expiry field and 60-day-before-expiry cron alert (risk-matrix.md)
- KYB document types: `business_license`, `identity`, `payout_account` — files stored in object storage with keys in `KybDocument` model (ubiquitous-language.md)
- Payout account verification is a separate sub-gate: any edit to bank account fields resets `verifiedAt` to null, blocking withdrawals until admin re-verifies — prevents post-onboarding fraudulent account changes (invariants-catalog.md)

---

### 15. Beachhead Corridor Strategy — Labor Migration (Thanh Hóa ↔ TPHCM)

| Option | Avg ticket price | Competition | Customer profile |
|--------|-----------------|-------------|------------------|
| Tourist corridors (HCMC-Đà Lạt, Hà Nội-Sa Pa) | 200-500K VND | High OTA competition (VeXeRe, redBus, 12Go) | Tech-savvy, English-capable, multiple payment methods |
| **Labor migration (Thanh Hóa ↔ TPHCM)** | 875K-1,750K VND | Lower OTA competition | Budget domestic persona ("Chị Lan"); price-sensitive 5/5; MoMo primary; 4-8 trips/year |
| Provincial short-haul | 50-150K VND | Low | Cash-dominant, low smartphone, hard to digitize |

**Choice**: Thanh Hóa ↔ TPHCM as single-corridor proof

**Reasons**:
- Highest average ticket price (875K-1,750K VND) maximizes commission revenue per booking — at 10% commission, each booking yields 87K-175K VND vs. 20-50K VND on tourist corridors (vietnam-market-context.md)
- Massive Tet demand — Thanh Hóa is peak labor migration corridor (strongest Tet spike in country). Tet is the make-or-break season with 260% booking spike. (vietnam-market-context.md, risk-matrix.md)
- Lower OTA competition than tourist corridors — VeXeRe and redBus concentrate on tourist routes with higher foreign tourist visibility (vietnam-market-context.md)
- Core demographic = migrant workers / laborers from Thanh Hóa working in TPHCM — maps to "Chị Lan" budget domestic persona (customer-personas.md)
- 30-day kill-switch: if 3 LOIs (Thư bày tỏ ý định hợp tác) do not materialize in 30 days, product-market fit hypothesis invalidated — pivot before further investment (vietnam-market-context.md)
- Two payment rails (bank transfer + cash) cover launch needs on this corridor; MoMo + VNPay added Phase 2. Vietnamese UI only — no English needed for beachhead. (vietnam-market-context.md)

---

## Consequences

### Positive
- Marketplace + PSP split-settlement eliminates SBV IPS license risk — the single highest-severity regulatory blocker
- Shared DB with application-level tenant scope enables cross-operator search, admin reporting, and global Place registry without fan-out queries
- Operator-branded positioning directly addresses the #1 operator pain point (brand control) and differentiates from VeXeRe's platform-first model
- Dual commission + SaaS model with per-operator fee override captures both micro operators (commission) and FUTA-scale operators (negotiated SaaS)
- Three separate auth realms keep each portal's security model clean — operator JWT carries `operatorId` claim that flows through to `withOperatorScope` for all downstream queries
- Platform-issued e-invoices on behalf of operators make compliance a feature, not a burden — strongest operator acquisition lever for the 60-70% who haven't implemented e-invoicing
- Admin-gated KYB is both legal compliance and competitive moat against unlicensed informal operators

### Negative
- Shared database means a `withOperatorScope` bypass = cross-tenant data leak. The isolation boundary is application-enforced, not database-enforced.
- Operator-branded model has no marketplace demand aggregation — operators must drive own traffic. If BB fails to solve distribution (MoMo/ZaloPay/12Go partnerships, SEO), the brand-ownership advantage becomes a liability.
- PSP split-settlement requires every operator to open their own VNPay/MoMo merchant account — micro operators (60-70% by count, "Bác Tâm" persona) may not have the capacity or documentation to do this.
- Three separate auth realms = three parallel stacks to maintain (three user models, three session models, three OTP models, three auth services).
- Platform-issued e-invoicing requires formal authorization agreement + GDT notification per operator — onboarding friction.
- Beachhead on a single labor migration corridor is high-conviction / high-risk: if Thanh Hóa ↔ TPHCM operators don't convert, no fallback demand from tourists or provincial travelers.

### Mitigations
- **Tenant scope leak**: `eslint-plugin-boundaries` enforces cross-domain barrel imports; operator-scoped services always receive `operatorId` from auth guard, never from request body. Lint rule prevents bypassing `withOperatorScope`.
- **Distribution gap**: phased market entry — beachhead corridor operators drive own traffic via existing Facebook/Zalo channels (near-zero CAC); MoMo/ZaloPay distribution partnerships planned for Phase 4 (Month 12+).
- **Merchant account gap**: fallback to licensed escrow provider if split-settlement infeasible for micro operators. White-glove onboarding for first 10 operators includes merchant account setup assistance.
- **Auth maintenance cost**: each realm is purpose-built and shares cross-cutting modules (`jwt.ts`, `password.ts`, `csrf.ts`, `refreshToken.ts`). The three realms share infrastructure but diverge on login method and session semantics.
- **E-invoice onboarding friction**: authorization agreement template standardized; platform handles GDT notification on operator's behalf as part of white-glove onboarding.
- **Corridor risk**: 30-day LOI kill-switch. If 3 operator LOIs don't materialize, pivot to tourist corridor (HCMC-Đà Lạt) before further investment.

---

## Source Documents

All decisions sourced exclusively from `documentation/business/`:

| Document | Decisions informed |
|----------|-------------------|
| regulatory/payment.md | 1, 2, 11 |
| regulatory/legal-entity.md | 10, 11 |
| regulatory/einvoice-tax.md | 8, 9 |
| market-research/business-model.md | 4, 5 |
| market-research/competitive-advantages.md | 3, 8, 12 |
| market-research/competitive-landscape.md | 3, 11 |
| competitor-benchmark/pricing-comparison.md | 4, 12 |
| competitor-benchmark/operator-sentiment.md | 3, 12 |
| domain-model/bounded-contexts.md | 6, 7, 13 |
| domain-model/invariants-catalog.md | 5, 6, 7, 12, 14 |
| domain-model/ubiquitous-language.md | 7, 9, 13, 14 |
| personas/operator-personas.md | 2, 6, 8, 9, 15 |
| stakeholder-map.md | 5, 14 |
| risk-matrix.md | 1, 2, 14, 15 |
| vietnam-market-context.md | 2, 15 |
| competitor-benchmark/feature-parity-matrix.md | (context only) |
| personas/customer-personas.md | 15 |
| personas/investor-kpis.md | 10 |
