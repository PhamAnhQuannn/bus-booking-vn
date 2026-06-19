# ADR-006: Pricing & Currency

## Status
ACCEPTED

## Date
2026-06-17 (reviewed and confirmed)

## Context

Bus-Booking's pricing model defines what the platform charges operators, how ticket prices are set, and how currency, fees, and tax obligations are encoded. ADR-005 covers the payment *infrastructure* (PSP selection, webhook verification, ledger design, BigInt math, refund strategy). ADR-006 covers the upstream **business pricing decisions** that feed into that infrastructure: commission structure, price authority, fee propagation, tax withholding, e-invoice fields, and revenue diversification.

Key business constraints driving pricing decisions (sourced from `documentation/business/`):

- **Competitor commission landscape**: VeXeRe ~8-12% estimated (MEDIUM confidence, inferred from affiliate floor 7%), redBus 10-20% confirmed (HIGH confidence, 4+ independent sources), FUTA 0% (vertically integrated). No competitor publishes commission rates. (competitor-benchmark/pricing-comparison.md)
- **Operator churn triggers**: Ranked (1) brand control, (2) settlement speed/cash flow, (3) commission rate, (4) tech support/BMS. Operators accept 8-12% given reach; threshold ~15% triggers bypass to direct bookings. (competitor-benchmark/operator-sentiment.md)
- **Unit economics floor**: At 5% commission on 400K VND average ticket = 20,000 VND; minus 8,000 VND payment processing (2%), minus 1,000 VND notifications, minus 3,000 VND support = 8,000 VND net. Below 5%, net margin goes negative. (market-research/business-model.md)
- **Operator spectrum**: 60-70% micro (1-5 buses, "Bác Tám" persona, VND 500M-2B revenue, zero tech budget), 25-30% mid-size regional, 5-10% large fleet or limousine. Pricing must serve all segments without excluding the long tail. (personas/operator-personas.md)
- **Market-determined pricing**: Bus ticket prices in Vietnam are market-determined (Law on Pricing 2023, effective Jul 2024). Exception: Tet guidance caps increases at 40-60% above normal. (regulatory/transport.md)
- **VND integer currency**: Vietnam Dong has no minor unit (no cents). All amounts are integer VND. (domain-model/ubiquitous-language.md)
- **Tax withholding mandate**: E-Commerce Law 2025 (effective July 2026) requires platforms to withhold VAT ~3% + PIT ~1.5% from individual/household operators. Incorporated companies self-file. (regulatory/einvoice-tax.md)
- **E-invoice authorization**: Platform can issue e-invoices on behalf of operators via third-party authorization (Decree 123 Art. 17, expanded by Decree 70/2025). Invoice shows operator as seller with operator's MST. (regulatory/einvoice-tax.md)
- **Price integrity invariant (I7)**: Customer-facing endpoints never accept price from the request body. Price is derived from Trip.price × ticketCount. Operator-side endpoints are I7-exempt — the operator IS the price authority. (domain-model/invariants-catalog.md)

Cross-reference: ADR-005 covers BigInt arithmetic (D6), ledger entry types including `platform_fee` and `tax_withheld` (D5), and settlement timing T+1 (D3). ADR-006 covers the business rationale for what rates are charged and how they propagate. ADR-004 established the dual pricing model (D4) and per-operator fee override (D5) at summary level; ADR-006 deepens the rationale and covers adjacent decisions not addressed there.

---

## Decisions

### 1. Commission Rate Structure — Market-Matching Band

| Option | Pros | Cons |
|--------|------|------|
| Flat rate (8-10%) | Simple to communicate; predictable for platform and operator; easy to implement in FeeConfig | No flexibility for large operator negotiation; cannot accommodate introductory discounts without special-casing; may be too high for micro operators with thin margins, too low for tourist corridors with higher AOV |
| Tiered by volume (auto-graduated) | Transparent; rewards growth; self-serve (no sales negotiation); aligns incentives (more bookings = lower rate) | Cliff effects at tier boundaries; gaming risk (operators split inventory to stay in lower tier); complex to implement in effective-dated FeeConfig; many operators too small to ever graduate |
| Negotiated per-operator (bespoke) | Maximum flexibility; retains large operators who demand custom terms; standard B2B SaaS practice | Does not scale past 50 operators without dedicated sales team; opaque pricing erodes trust (operators compare notes); no public rate to market against competitors |
| **Market-matching band (8-10% standard, 5% floor, 15% ceiling, 5% introductory)** | Competitive positioning below VeXeRe (~8-12%) and redBus (10-20%); floor protects unit economics; ceiling matches churn trigger threshold; introductory rate enables acquisition; publishable for trust advantage | Requires per-operator FeeConfig override for intro rates and negotiated deals; band commitment limits future rate increases; 5% floor may be tight for small-ticket provincial routes |

**Choice**: Market-matching band (8-10% standard, 5% floor, 15% ceiling, 5% introductory)

**Reasons**:
- 8-10% standard rate is competitively below VeXeRe's estimated ~8-12% blended rate and redBus's confirmed 10-20%. The 5% introductory rate is a genuine undercut no incumbent matches publicly (competitor-benchmark/pricing-comparison.md)
- Floor of 5% preserves unit economics: at 5% on 400K VND average ticket = 20,000 VND commission, minus ~12,000 VND costs (payment + notifications + support) = 8,000 VND net margin (2.0% of ticket). Below 5%, net margin goes negative (market-research/business-model.md)
- Ceiling of 15% matches the empirically-observed churn trigger threshold: "above this, operators bypass platform for direct bookings." FUTA at 0% (vertically integrated) sets the structural ceiling on what any OTA can charge scaled operators (competitor-benchmark/operator-sentiment.md, competitor-benchmark/pricing-comparison.md)
- Publishing commission rates transparently is itself a differentiator — no competitor does this. VCC (Vietnam Competition Commission) tightening oversight of OTA platforms creates regulatory tailwind for transparency (competitor-benchmark/operator-sentiment.md)
- Unit economics at 10% on 400K VND average ticket: ~16,000 VND net margin per booking (4.0% of ticket). Break-even at 50,000-100,000 bookings/month with 100-200 active operators averaging 15-30 daily bookings each (market-research/business-model.md)
- FeeConfig `ratePpm` encoding supports the full band: 50000 (5% intro), 80000 (8% standard), 100000 (10% standard), 150000 (15% ceiling). Per-operator override with effective-dating enables smooth transitions without data loss (domain-model/ubiquitous-language.md, domain-model/bounded-contexts.md)
- Cross-ref ADR-005 D5: `platform_fee` ledger entry type encodes the deducted commission at the accounting level

---

### 2. Commission Visibility — Operator-Absorbed (Invisible to Customer)

| Option | Pros | Cons |
|--------|------|------|
| **Operator-absorbed (invisible to customer)** | Customer sees ticket price = total price; no "surprise fee" at checkout; matches VAT-inclusive pricing norm in Vietnam; operator absorbs commission from their margin | Operator margin compressed; micro operators (thin margins, VND 500M-2B revenue) feel the squeeze most; commission is a hidden cost that breeds resentment if operators compare direct vs. platform |
| Customer surcharge (visible booking fee) | Operator margin preserved; transparent to customer where the fee goes; standard in some Western OTAs | Any visible booking fee drives price-sensitive Vietnamese users to call operator directly. Vietnamese consumers are 5/5 price-sensitive. Creates price comparison disadvantage vs. direct booking (market-research/business-model.md) |
| Split (partial operator absorption + partial customer fee) | Shares cost burden; can position as "small service fee"; reduces operator compression | Complex communication; customer still sees a surcharge; Vietnamese consumer behavior is binary (any extra fee = call directly) |
| Dynamic (customer surcharge during peak, operator-absorbed off-peak) | Optimizes revenue per season; higher margin during Tet when operators have pricing power | Implementation complexity; consumer confusion; Tet pricing already subject to government guidance (40-60% cap); regulatory risk of opaque pricing (regulatory/transport.md) |

**Choice**: Operator-absorbed (invisible to customer)

**Reasons**:
- "Commission absorbed by operator, invisible to customer" — core design principle. Any visible booking fee drives price-sensitive Vietnamese users to call operator directly (market-research/business-model.md)
- Customer price = ticket price with zero additions. Eliminates the #1 checkout abandonment trigger for Vietnamese domestic travelers ("Chị Lan" persona: price-sensitive 5/5, MoMo primary, 20-45yo migrant worker) (personas/customer-personas.md)
- Vietnamese pricing norm is VAT-inclusive. Consumer Protection Law 2023 requires: "total price must be displayed upfront including all fees." A separate booking fee violates this cultural and regulatory expectation (regulatory/consumer-protection.md, regulatory/transport.md)
- Operator's published ticket price on the platform matches what they charge at the station counter. No price discrepancy for customers to arbitrage (market-research/business-model.md)
- The operator sees their net revenue after commission deduction in the operator console (revenue report, payout statement). Commission appears as a separate B2B invoice (platform to operator) for service fee with 10% VAT (regulatory/einvoice-tax.md)
- Cross-ref ADR-005 D5: ledger records `booking_credit` (+gross) and `platform_fee` (−fee) as separate entries. Operator's available balance is the net. I7 invariant: `Booking.totalVnd = Trip.price × ticketCount` — price read from Trip, never from client (domain-model/invariants-catalog.md)

---

### 3. Ticket Price Authority — Operator-Set

| Option | Pros | Cons |
|--------|------|------|
| **Operator-set (operator is price authority)** | Matches Vietnamese market reality (market-determined pricing); respects operator autonomy; operator knows local demand/competition; aligns with "Shopify model" positioning; simplest implementation (Trip.price = operator input) | Platform cannot optimize pricing for conversion; no dynamic pricing to maximize GMV; operator may underprice (lost commission) or overprice (lost bookings); Tet surge pricing may need guidance |
| Platform dynamic pricing (platform overrides operator) | Maximizes platform GMV; can implement demand-based surge pricing; A/B test pricing for conversion optimization | Removes operator control — #1 churn trigger is brand/pricing control. "OTA flash sales or dynamic pricing that undercuts the operator's own advertised price" is an explicit churn trigger (competitor-benchmark/operator-sentiment.md) |
| Platform-suggested with operator override | Best of both: platform provides data-driven recommendations; operator retains final authority; can gradually increase platform pricing influence as trust builds | Implementation complexity (suggestion engine + override UX); operators may ignore suggestions; creates expectation that platform "knows the right price" which erodes trust if suggestions are wrong |
| Fixed-price catalog (routes have base prices, operators adjust within bands) | Standardizes pricing across operators on same route; reduces price dispersion for customers; simplifies comparison | Many Vietnamese operators run the same route at wildly different price points (coach vs. limousine vs. sleeper); a band system cannot accommodate this diversity; cooperatives on subsidized routes have government-set fares (personas/operator-personas.md) |

**Choice**: Operator-set (operator is the price authority)

**Reasons**:
- Bus ticket prices in Vietnam are "market-determined" (Law on Pricing 2023, effective Jul 2024). No government price caps except Tet guidance (40-60% above normal). The regulatory environment supports operator pricing autonomy (regulatory/transport.md)
- I7 invariant applies to customer-facing endpoints only. "Operator-side trip creation is a different threat model — the operator IS the authoritative price source for their trips." Operator endpoints are I7-exempt (domain-model/invariants-catalog.md)
- "OTA flash sales or dynamic pricing that undercuts the operator's own advertised price" is the #2 churn trigger after direct commission rate increases. Operators who discover the platform is manipulating their prices will leave (competitor-benchmark/operator-sentiment.md)
- Route model carries `durationMinutes` but deliberately does NOT carry a `basePrice`. Route is a line definition; pricing lives at the Trip level because the same route can have different prices for different departure times, bus types, or seasons (domain-model/ubiquitous-language.md)
- Cooperative/government-linked operators ("HTX Xe Khách" persona, 10-60 member-owned buses) may have fixed regulated fares — no dynamic pricing flexibility. Platform must support flat pricing without pressure to change (personas/operator-personas.md)
- "Shopify for bus operators" positioning: operators own brand, pricing, customer relationship. Platform provides infrastructure, not pricing authority (competitor-benchmark/operator-sentiment.md, market-research/business-model.md)
- Future dynamic/surge pricing deferred to v2+ and requires anti-gaming rules (maxPriceVnd on FeeConfig, anti-cancel-relist policy) before activation (risk-matrix.md)

---

### 4. Dual Pricing Model — Commission + SaaS Hybrid

| Option | Pros | Cons |
|--------|------|------|
| Commission-only (8-10%) | Zero barrier to entry; micro operators start free (no subscription); simplest mental model; revenue scales with platform usage | No recurring revenue during seasonal troughs; operator's platform cost is pure variable; no incentive for platform to build tools beyond booking channel |
| SaaS subscription only (1-2M VND/month, no per-booking fee) | Predictable recurring revenue; aligns platform incentive with building better tools; operators know exact monthly cost | Excludes micro operators who cannot commit monthly; zero-booking months still incur cost (operator resentment); no revenue alignment with GMV growth |
| **Dual model: commission (0 VND/month + 8-10%) OR SaaS (1-2M VND/month + 3-5%)** | Captures both segments: micro operators choose commission (zero upfront), large operators choose SaaS (lower variable cost, predictable); mirrors "Shopify Basic vs. Shopify Plus" (validated model); operator self-selects by volume; builds recurring revenue base while maintaining growth alignment | Two pricing tiers to maintain and explain; operator may game tier selection (high-volume operator stays on commission if 8% < subscription-equivalent); switchover threshold must be clear; FeeConfig must support both models |
| Tiered plans (3+ tiers: Free/Starter/Pro/Enterprise) | Granular segmentation; upsell path; feature gating per tier | Over-engineered for launch; confuses micro operators with too many choices; each tier needs distinct feature gating; sales overhead increases |

**Choice**: Dual model — commission (0 VND/month + 8-10%) OR SaaS (1-2M VND/month + 3-5%)

**Reasons**:
- "Mirrors 'Shopify Basic vs. Shopify Plus' structure. Validated by VeXeRe's dual BMS/commission model" (market-research/business-model.md)
- Commission model (0 VND/month, 8-10%) is "best for low-volume operators testing the platform." Micro operators ("Bác Tám" persona: 60-70% by count, VND 500M-2B revenue) need zero-upfront-cost entry (market-research/business-model.md, personas/operator-personas.md)
- SaaS model (1-2M VND/month, 3-5%) is "best for higher-volume operators who want lower variable costs." Mid-size regional operators (6-30 buses, VND 5B-30B revenue) and limousine operators prefer cost predictability (market-research/business-model.md, personas/operator-personas.md)
- Crossover point: an operator booking ~100-200 tickets/month at 400K VND avg ticket. At 10% commission = 4-8M VND/month platform cost. At SaaS (1.5M VND/month + 4% commission) = 1.5M + 1.6-3.2M = 3.1-4.7M VND/month. SaaS becomes advantageous above ~100 bookings/month (derived from market-research/business-model.md unit economics)
- VeXeRe operates a dual model: BMS subscription for enhanced tools + commission on marketplace bookings. Operators who use BMS-only (no marketplace listing) pay subscription without commission (competitor-benchmark/pricing-comparison.md)
- FeeConfig `ratePpm` supports both models: commission-only operators get `ratePpm = 80000-100000` (8-10%); SaaS operators get `ratePpm = 30000-50000` (3-5%) with subscription tracked separately. Subscription billing is a future implementation; FeeConfig handles the per-booking rate today (domain-model/bounded-contexts.md)
- Additional revenue stream #1 ranked HIGH feasibility: "Operator SaaS subscription (console) — 500K-2M VND/month per operator, available at Launch" (market-research/business-model.md)
- Cross-ref ADR-004 D4: established at summary level; ADR-006 provides the detailed economics and crossover analysis

---

### 5. Currency Representation — VND Integer Storage

| Option | Pros | Cons |
|--------|------|------|
| IEEE 754 Number column (`DOUBLE PRECISION` / `FLOAT`) | Native JS type; familiar; no special handling | Representation drift: `200000 * 0.06 = 11999.999...` not 12000 in many cases; rounding accumulates across thousands of bookings; unsuitable for financial data (domain-model/invariants-catalog.md) |
| `DECIMAL` / `NUMERIC` column | Arbitrary precision; no representation drift; database-level safety | VND has no fractional units — decimal precision is wasted; Prisma `Decimal` type requires explicit handling; adds complexity for zero gain (VND is always integer) |
| **Integer column (`Int`)** | VND is integer currency with no minor unit — column type matches domain reality; no representation drift for storage; Prisma maps to native `number` for values up to 2^31 (2.1B VND); most efficient storage type | Aggregate sums (operator lifetime revenue, platform GMV) can exceed 2^31 (2.1B VND ≈ $84K) — a single busy operator exceeds this in months; requires `BigInt` at computation time for aggregates |
| String column | Can represent any magnitude; no overflow risk; human-readable in raw DB queries | No arithmetic at DB level; every operation requires parse/format; no index ordering; absurd overhead for a numeric domain |

**Choice**: Integer column (`Int` for per-record amounts, with BigInt arithmetic at computation time)

**Reasons**:
- "VND has no minor unit (no cents). All amounts are integer VND." Per-booking amounts are always whole VND integers (domain-model/ubiquitous-language.md)
- Per-record VND values in this domain: ticket prices 100K-2M VND, booking totals up to ~10M VND (group booking), payout amounts up to ~100M VND (large trip). All within 32-bit signed integer range (max 2,147,483,647 ≈ 2.1B VND) (market-research/business-model.md)
- `DECIMAL`/`NUMERIC` rejected: VND has no fractional part. Using a decimal type for a non-decimal currency adds complexity with zero precision gain (domain-model/ubiquitous-language.md)
- Aggregate computations (operator balance, platform GMV) use raw SQL with BigInt in application code — the database SUM result may exceed `Int` but is handled at the application layer (domain-model/bounded-contexts.md, domain-model/event-flows.md)
- Cross-ref ADR-005 D6: BigInt computation is the complement to integer storage. ADR-005 covers how arithmetic is performed; ADR-006 covers why integer storage is correct for VND. `ratePpm` (parts-per-million) encoding in FeeConfig is also integer: 60000 = 6% (domain-model/ubiquitous-language.md)
- String rejected: no database-level arithmetic, no ordering, no indexing semantics for a fundamentally numeric domain

---

### 6. Fee Configuration Model — Effective-Dated Rows

| Option | Pros | Cons |
|--------|------|------|
| Mutable column on Operator | Simplest: one column, one UPDATE; no historical state to manage | Rate changes destroy history; cannot reconstruct what rate applied to a booking made 6 months ago; ledger reconciliation breaks if rate at time of booking differs from current rate; no audit trail for rate negotiations |
| **Effective-dated rows (FeeConfig model)** | Full history: every rate change is a new row with `effectiveFrom`/`effectiveTo`; per-operator override + global default; never edit in place; historical rates available for reconciliation; supports intro rate → standard rate transitions via date | More complex queries (resolve override-then-global for effective date); must close prior row's `effectiveTo` when inserting new row; rows accumulate (but are the audit trail) |
| Versioned config file (JSON/env) | Simple to read; can be version-controlled in git; deployment-time changes | Not per-operator; requires redeploy for rate changes; no DB-level audit trail; cannot vary rates across operators without code changes |
| Feature flag per operator | Reuses existing FeatureFlag model; admin can toggle in UI | FeatureFlag is boolean/string, not numeric; not designed for temporal effective-dating; no global-default-then-override resolution; mutable flag changes violate append-only principle for financial config |

**Choice**: Effective-dated rows (FeeConfig model)

**Reasons**:
- FeeConfig model uses `ratePpm` encoding (parts-per-million): 60000 = 6%, 80000 = 8%, 100000 = 10%, 50000 = 5%. Avoids floating-point representation in the database while supporting sub-percentage precision (domain-model/ubiquitous-language.md)
- "New row per rate change, never in-place edits" — matches the immutability pattern used by LedgerEntry and AdminAuditLog. Rate changes are auditable (domain-model/bounded-contexts.md)
- Resolution logic: `getEffectiveFeeRate(operatorId, atTime)` resolves per-operator override first, falls back to global default. Supports simultaneous coexistence of 3% pilot fee, 5% introductory rate, 8-10% standard, and bespoke negotiated rates (domain-model/bounded-contexts.md)
- Introductory rate mechanics: create FeeConfig row with `ratePpm = 50000` (5%), `effectiveFrom = operator onboard date`, `effectiveTo = onboard date + 3 months`. When `effectiveTo` passes, resolution falls through to global default (8-10%). No cron needed; date resolution handles transitions automatically
- Admin functions `setGlobalFee` and `setOperatorFeeOverride` create new effective-dated rows; old rows retained for audit (domain-model/bounded-contexts.md)
- Cross-ref ADR-005 D5: `platform_fee` ledger entry type is computed from the effective FeeConfig rate at booking time. Cross-ref ADR-005 D6: `calcPlatformFeeMinor` reads `ratePpm` and performs BigInt arithmetic
- Mutable column rejected: a rate change that destroys the historical rate makes it impossible to verify whether past ledger entries were computed correctly — breaks the reconciliation guarantee that the append-only ledger provides (domain-model/invariants-catalog.md)

---

### 7. Tax Withholding Design — Split by Entity Type

| Option | Pros | Cons |
|--------|------|------|
| No platform withholding (all operators self-file) | Simplest; no tax computation in platform; no withholding certificate generation | Non-compliant after E-Commerce Law July 2026 for individual/household operators; platform liable for failure to withhold; penalty exposure |
| Universal withholding (withhold from all operators) | Simplest uniform implementation; no entity-type determination needed; conservative compliance posture | Over-withholds from incorporated companies who self-declare CIT; creates reconciliation burden for companies; operators must apply for refund of over-withheld amounts; damages relationship with sophisticated operators |
| **Split by entity type (company = self-file, individual/household = platform withholds)** | Legally correct: E-Commerce Law mandates this exact split; no over-withholding; clear determination criteria (business registration certificate type) | Requires entity-type determination at onboarding (error-prone for small operators with ambiguous documentation); withholding rate may vary by service category; withholding certificate generation adds administrative burden; July 2026 deadline |
| Hybrid (platform withholds for all, refunds companies) | Maximum safety; eliminates entity-type determination error risk | Creates cash-flow drag on companies; refund process adds administrative overhead; over-withholding damages trust with sophisticated operators who know it's incorrect |

**Choice**: Split by entity type (company = self-file, individual/household = platform withholds VAT ~3% + PIT ~1.5%)

**Reasons**:
- E-Commerce Law 2025 (effective July 2026) mandates: platforms must withhold and remit VAT + PIT on behalf of individual/household operators. This is a legal requirement, not a design choice (regulatory/einvoice-tax.md, regulatory/payment.md)
- "Incorporated operators (companies): No platform withholding — they self-declare CIT. Platform collects their MST (tax code) for e-invoicing" (regulatory/einvoice-tax.md)
- "Individual/household operators: Platform must withhold VAT ~3% + PIT ~1.5% (transport services estimated rates). Must issue withholding certificates. File periodic withholding returns to GDT" (regulatory/einvoice-tax.md)
- Operator model carries `taxClassification` with enum values `company | individual_household`. This field drives the withholding determination at payout time (domain-model/bounded-contexts.md)
- `tax_withheld` is an existing ledger entry type. Payout model carries `taxVat`, `taxPit`, `taxTotal` columns — infrastructure for withholding amounts is in place (domain-model/ubiquitous-language.md)
- "Many small VN bus operators are sole proprietors or family businesses" — entity-type determination at onboarding is the operational challenge. Platform must collect business registration certificate or household business certificate (regulatory/einvoice-tax.md, personas/operator-personas.md)
- Entity-type determination error is explicitly identified as a risk: "withholding on wrong type creates liability" (regulatory/einvoice-tax.md)
- Cross-ref ADR-005 D5: `tax_withheld` ledger entry type is one of the 9 defined entry types

---

### 8. E-Invoice Pricing Fields — Platform Issues on Behalf of Operator

| Option | Pros | Cons |
|--------|------|------|
| Platform issues as its own seller | Simplest single-entity invoicing; platform has one tax code, one MISA integration | Legally incorrect: platform is agent, not seller of transport service; misrepresents business model; VAT obligation falls on platform for gross amount, not just commission; GDT audit risk |
| **Platform issues on behalf of operator (authorized third-party)** | Legally correct per Decree 123 Art. 17 + Decree 70/2025; invoice shows operator as seller with operator's MST; platform integrates MISA once for all operators; industry standard (VeXeRe uses this model) | Requires formal authorization agreement per operator + GDT notification before arrangement begins; operator's tax code must be valid and current; operator is liable for VAT on ticket price |
| Operator issues own e-invoices | No platform liability; operator has full tax control; simplest for platform (no MISA integration needed) | Impractical for micro operators (60-70% of market) — many haven't implemented e-invoicing at all; defeats "compliant e-invoicing from day one" value proposition; each operator would need own MISA/VNPT integration |

**Choice**: Platform issues on behalf of operator (authorized third-party)

**Reasons**:
- "Operators can formally authorize platform to issue e-invoices on their behalf (Decree 123 Art. 17, expanded by Decree 70/2025). Authorization requires: formal written agreement + notification to tax authority before arrangement begins" (regulatory/einvoice-tax.md)
- "Invoice must show operator as seller (with operator's tax ID/MST), not platform." The ticket invoice is a transport service invoice; the operator is the service provider (regulatory/einvoice-tax.md)
- Two distinct invoice types flow through the system:
  - **Ticket invoice**: bus operator (shown) is seller to passenger. Contains: ticket price (VAT-inclusive at 10%), route information, vehicle license plate number (Decree 70/2025 transport requirement), departure/destination (regulatory/einvoice-tax.md)
  - **Commission invoice**: platform is seller to bus operator. Contains: service fee amount, 10% VAT on service fee. Issued monthly as B2B invoice (regulatory/einvoice-tax.md)
- "Most VN booking platforms (VeXeRe, Ve Xe Nhanh) take the authorization approach." Industry standard reduces regulatory novelty risk (regulatory/einvoice-tax.md)
- MISA meInvoice integration (GDT-certified provider, ~500-2,000 VND per invoice) built as a shared service — platform integrates once, all operators benefit. "Compliant e-invoicing from day one" is the lead operator acquisition pitch (regulatory/einvoice-tax.md, competitor-benchmark/feature-parity-matrix.md)
- Decree 70/2025 expanded authorization right to "business households and individual businesses (previously enterprises only)" — covers the micro operator segment (60-70% of market) (regulatory/einvoice-tax.md)
- Transport-specific invoice fields required per Decree 70/2025: vehicle license plate number and route information (departure + destination). These fields are available from Bus.licensePlate, Route.origin, Route.destination (regulatory/einvoice-tax.md)

---

### 9. Introductory Pricing Mechanics — 5% Flat for 3 Months

| Option | Pros | Cons |
|--------|------|------|
| Time-limited discount (5% for 3 months, then standard) | Clear, simple, time-bounded; self-expiring via FeeConfig `effectiveTo`; no volume tracking needed; creates urgency ("sign up now for lower rate") | Cliff effect at month 3 (operator may churn when rate doubles); does not reward high-volume operators who bring more GMV; time-based, not value-based |
| Volume-based graduation (5% until 500 bookings, then 8%, then 10%) | Rewards growth; no cliff effect (rate increases correlate with operator's own revenue growth); aligns incentives | Complex to implement (need booking counter per operator per rate tier); counter resets (lifetime? rolling?); gaming risk; micro operators may never graduate |
| **Flat introductory period (5% for first 3 months)** | Matches business docs specification exactly; simplest to implement via FeeConfig effective-dating; predictable for both platform and operator | Does not differentiate high-value vs. low-value operators during intro period; no volume incentive; pure time-based cutoff |
| No introductory rate (standard from day 1) | Simplest; no rate transition management; revenue from first booking | Removes acquisition lever; 8-10% from day 1 is equivalent to what VeXeRe charges; no differentiation; operator acquisition playbook is built around introductory pricing |

**Choice**: Flat introductory period (5% for first 3 months, then standard 8-10%)

**Reasons**:
- "Introductory rate: 5% for first 3 months — standard operator acquisition tactic. VeXeRe offers free BMS trials to lock in operators" (market-research/business-model.md)
- Operator acquisition playbook Phase 1 (Month 0-3): "3-month free trial (0% commission), then 5% introductory rate." The 0% pilot is for the first 10 operators on the beachhead corridor; 5% intro is for operators 11+ (market-research/business-model.md)
- Vietnam market entry context: "3% introductory fee (vs. VeXeRe estimated 8-12%)" for initial corridor operators, suggesting the 5% rate may be further discounted for beachhead (vietnam-market-context.md)
- Implementation via FeeConfig effective-dating: at operator onboarding, create per-operator FeeConfig row with `ratePpm = 50000` (5%), `effectiveFrom = onboard date`, `effectiveTo = onboard date + 3 months`. When `effectiveTo` passes, `getEffectiveFeeRate` falls through to global default. No cron, no manual intervention
- For beachhead pilot operators (first 10): FeeConfig row with `ratePpm = 0` (0%) or `ratePpm = 30000` (3%), `effectiveTo = onboard date + 3 months`, then transition to 5% intro row followed by standard
- Rate ramp encoded as FeeConfig rows per operator: Row 1 (pilot): 0%, months 0-3. Row 2 (intro): 5%, months 3-6. Row 3 (standard): no per-operator row, falls through to global 8-10% default
- "The 5% introductory rate is a genuine undercut that no incumbent matches publicly" (competitor-benchmark/pricing-comparison.md)
- Cross-ref ADR-006 D1: introductory rate is within the 5% floor. Cross-ref ADR-006 D6: FeeConfig effective-dating handles the mechanics

---

### 10. Additional Revenue Streams — Multi-Stream, Phased by Feasibility

| Option | Pros | Cons |
|--------|------|------|
| Commission-only (single revenue stream) | Simplest; all revenue is booking-derived; easy to forecast based on GMV; no feature gating needed | Revenue = zero when bookings are zero (seasonal troughs); no diversification; platform's economic fate tied entirely to booking volume; limits incentive to build non-booking features |
| **Multi-stream (commission + SaaS + promoted listings + insurance + analytics)** | Diversified revenue; SaaS provides recurring base; promoted listings monetize operator demand; insurance adds per-booking ancillary; each stream has different margin profile; reduces seasonal volatility | Each stream requires separate implementation; promoted listings need search ranking changes (conflict of interest with organic results); insurance requires partner; analytics is long-term; dilutes focus |
| Advertising-supported (third-party ads on customer-facing pages) | Revenue from non-operator sources; no direct operator cost increase; scales with traffic | Degrades customer experience; conflicts with operator-branded positioning; low CPM for Vietnamese market; ads on a booking flow increase abandonment |

**Choice**: Multi-stream, phased by feasibility and timeline

**Reasons**:
- Business documentation ranks 6 additional revenue streams by feasibility (market-research/business-model.md):

| # | Stream | Feasibility | Revenue Potential | Timeline |
|---|--------|-------------|-------------------|----------|
| 1 | Operator SaaS subscription (console) | HIGH | 500K-2M VND/month per operator | Launch |
| 2 | Promoted/featured listings | HIGH | 1-5M VND/month per operator | Month 3-6 |
| 3 | Travel insurance add-on (Bảo Việt) | MEDIUM | 6,000-8,000 VND per conversion (30-40% of ~20K VND premium) | Month 6-12 |
| 4 | Promo/voucher co-funding | MEDIUM | Variable | Month 3-6 |
| 5 | Agent/reseller network (AMS) | LOW near-term | CPS commission 2-8% | Month 12+ |
| 6 | Data/analytics products | LOW near-term | Premium SaaS tier | Month 12+ |

- Stream #1 (SaaS subscription) is the dual-model complement to commission (see D4): "HIGH feasibility — product already built." The operator console IS the SaaS product (market-research/business-model.md)
- Stream #2 (promoted listings) is standard marketplace monetization — HIGH feasibility, no new infrastructure beyond search ranking weight. 1-5M VND/month per operator (market-research/business-model.md)
- Stream #3 (travel insurance) requires insurance partner (Bảo Việt). Per-policy margin of 6,000-8,000 VND at 30-40% commission on ~20K VND premium. Month 6-12 timeline (market-research/business-model.md)
- Streams #5-6 explicitly "LOW near-term" and deferred to Month 12+ (market-research/business-model.md)
- "Compete with VeXeRe's BMS/AMS subscriptions, flash sale placement, insurance" — VeXeRe already operates multi-stream (competitor-benchmark/pricing-comparison.md)
- No stream beyond commission + SaaS before Phase 1 corridor proof. "Building for multi-operator scale before proving single-corridor viability" is in the STOP list (vietnam-market-context.md)

---

## Consequences

### Positive
- Published commission band (8-10%, 5% intro, 5% floor, 15% ceiling) is the only transparent pricing in the Vietnamese bus booking market — directly addresses operator trust deficit (competitor-benchmark/operator-sentiment.md)
- Operator-absorbed commission with no visible customer fee eliminates checkout abandonment for price-sensitive domestic travelers (personas/customer-personas.md)
- Operator-as-price-authority matches regulatory reality (market-determined pricing) and avoids the #2 operator churn trigger (competitor-benchmark/operator-sentiment.md)
- Dual commission + SaaS model captures the full operator spectrum from micro (zero upfront) to FUTA-scale (predictable cost) without pricing anyone out (personas/operator-personas.md)
- Integer VND storage with BigInt computation matches the domain reality of a no-minor-unit currency while preventing representation drift at the arithmetic layer (domain-model/invariants-catalog.md)
- Effective-dated FeeConfig enables smooth rate transitions (pilot → intro → standard) without manual intervention, data loss, or reconciliation gaps (domain-model/bounded-contexts.md)
- Tax withholding split by entity type is legally correct under E-Commerce Law 2025 and is structurally supported by existing schema fields (regulatory/einvoice-tax.md)
- E-invoice authorization model makes compliance a product feature ("compliant from day one"), not a burden — strongest acquisition lever for 60-70% of operators who haven't implemented e-invoicing (regulatory/einvoice-tax.md, personas/operator-personas.md)
- Multi-stream revenue plan with clear phasing provides diversification path without diluting pre-PMF focus (market-research/business-model.md)

### Negative
- Operator-absorbed commission compresses operator margins, especially for micro operators on thin-margin provincial routes (VND 500M-2B revenue, average ticket under 200K VND) (personas/operator-personas.md)
- 5% floor may be unsustainable for very-low-ticket routes (under 150K VND) where payment processing alone consumes 2.5% and commission of 5% leaves less than 2.5% for platform operations (market-research/business-model.md)
- Entity-type determination for tax withholding is error-prone: "withholding on wrong type creates liability" (regulatory/einvoice-tax.md)
- E-invoice authorization requires per-operator formal agreement + GDT notification — onboarding friction that scales linearly with operator count (regulatory/einvoice-tax.md)
- Introductory rate creates a cliff effect at month 3 when rates double from 5% to 8-10% — potential churn trigger at exactly the point where operators have enough booking history to evaluate alternatives (market-research/business-model.md)
- Multi-stream revenue could dilute engineering focus if pursued before single-corridor PMF is proven (vietnam-market-context.md)

### Mitigations
- Operator margin compression: routes below 150K VND may need SaaS model (flat monthly, lower per-booking %) to remain viable. Unit economics show 4.0% net margin at 10% on 400K VND avg ticket — within viable range for higher-value routes (market-research/business-model.md)
- Entity-type determination: collect business registration certificate or household business certificate at onboarding (KYB document requirement). Admin reviews certificate type during approval. Mismatch detection: operator's MST on GDT registry shows entity type, enabling cross-check (regulatory/einvoice-tax.md)
- E-invoice onboarding friction: authorization agreement template standardized; platform handles GDT notification as part of white-glove onboarding for first 10-20 operators (vietnam-market-context.md)
- Intro rate cliff: communicate rate transition at onboarding (operator knows from day 1 what the post-intro rate will be); FeeConfig effective-dating enables graduated transitions (5% months 0-3, 6% months 3-6, 8% standard) if churn data warrants softening the cliff
- Multi-stream dilution: revenue streams #2-6 are phased by explicit month timeline. "Building for multi-operator scale before proving single-corridor viability" is in the STOP list. No stream beyond commission + SaaS before Phase 1 corridor proof (vietnam-market-context.md)

---

## References

All decisions sourced exclusively from `documentation/business/`:

| Document | Cited In |
|----------|----------|
| market-research/business-model.md | D1, D2, D3, D4, D5, D9, D10 |
| competitor-benchmark/pricing-comparison.md | D1, D4, D9, D10 |
| competitor-benchmark/operator-sentiment.md | D1, D2, D3 |
| competitor-benchmark/feature-parity-matrix.md | D8 |
| regulatory/transport.md | D2, D3 |
| regulatory/einvoice-tax.md | D2, D7, D8 |
| regulatory/payment.md | D7 |
| regulatory/consumer-protection.md | D2 |
| domain-model/invariants-catalog.md | D1, D2, D3, D5, D6 |
| domain-model/ubiquitous-language.md | D3, D5, D6 |
| domain-model/bounded-contexts.md | D1, D4, D6, D7 |
| domain-model/event-flows.md | D5 |
| personas/operator-personas.md | D1, D3, D4, D7, D8 |
| personas/customer-personas.md | D2 |
| risk-matrix.md | D3, D10 |
| vietnam-market-context.md | D9, D10 |
| ADR-004 (Multi-Tenancy) | D1, D4, D6, D7 |
| ADR-005 (Payment Architecture) | D1, D2, D5, D6, D7 |
