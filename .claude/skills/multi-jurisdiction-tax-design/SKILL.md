---
name: multi-jurisdiction-tax-design
description: Multi-jurisdiction sales-tax/VAT/GST computation design — US SALT post-Wayfair, EU VAT MOSS/OSS/IOSS, UK VAT, AU GST, CA GST/PST/HST, JP consumption tax, marketplace facilitator rules, digital-services rules; Avalara AvaTax vs Vertex O Series vs TaxJar vs Stripe Tax tradeoffs; nexus determination engine; reverse-charge rules. Disambiguation: this skill covers buyer-side transaction taxes (sales tax / VAT / GST). For customs-duty / HS-code classification on cross-border physical goods see `/export-tariff-classification`. Outputs to `docs/design/multi-jurisdiction-tax-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "sales tax", "VAT", "GST", "tax engine", "Avalara", "Vertex", "TaxJar", "Stripe Tax", "nexus", "MOSS", "OSS", "IOSS", "reverse charge", "marketplace facilitator", "Wayfair", "/multi-jurisdiction-tax-design", or before first cross-border sale / first state crossing economic-nexus threshold. Pairs with `/ledger-invariants` (tax-payable account), `/payment-processor-pick` (Stripe Tax interplay), `/export-tariff-classification` (customs duty on physical goods).
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 6h
---

# /multi-jurisdiction-tax-design — Sales-Tax/VAT/GST Computation Architecture

Invoke as `/multi-jurisdiction-tax-design`. Tax is a derivative of: (buyer location, seller location, product taxability, transaction type, accumulated nexus footprint, marketplace-facilitator status). Getting any of those wrong by even one transaction line creates a multi-year audit liability that compounds at 5-9% per year plus penalties.

## Why you'd care
A single missed state nexus (US) or VAT registration threshold (EU/UK) silently accrues unremitted tax liability at 5-9% of revenue per year, often with personal officer liability for unpaid sales tax. South Dakota v. Wayfair (2018) blew up "physical presence" — every US state now has economic-nexus thresholds (typically $100k or 200 transactions). EU OSS/IOSS demands real-time per-buyer-jurisdiction VAT rates with quarterly returns. UK post-Brexit added a parallel UK VAT regime. The "Stripe Tax handles it" answer covers the smallest 30% of cases; for the other 70%, you need an architecture decision.

## Effort caveat — registrar + auditor timelines dominate
- **US state sales-tax registration:** 2-6 weeks per state; 45 states + DC + local jurisdictions = 12-18 months for full footprint
- **EU VAT OSS registration:** member state of identification ~4-8 weeks; non-EU sellers register via "Union scheme" or "Non-Union scheme"
- **IOSS (Import One Stop Shop) for ≤€150 imports:** ~6 weeks via intermediary; mandatory for non-EU sellers shipping low-value goods to EU consumers
- **State sales-tax audit:** triggered by Wayfair-threshold-crossing-without-registration; lookback 3-7 years; settle typically 60-90% face value with VDA (Voluntary Disclosure Agreement)
- **VAT audit (HMRC, German Finanzamt):** lookback 4-6 years; fines 30-100% of unpaid + interest
- **Tax-engine vendor onboarding:** Avalara/Vertex enterprise contracts 6-12 weeks; mid-market 4-8 weeks; Stripe Tax instant but limited

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP (until first cross-border or first $50k state revenue). S → minimal (single-jurisdiction only).
2. Read `docs/design/ledger-invariants-<project>.md` — tax-payable accounts must exist before this skill posts entries.
3. Read `docs/design/data-residency-design-<project>.md` if multi-region — tax engine + customer data jurisdiction interplay.
4. Confirm: physical goods, digital goods, SaaS, services, marketplace facilitator, or mix? Drives entirely different rule sets.
5. Confirm: B2C, B2B, or both? Reverse-charge rules differ.

## Inputs
- Products sold: physical goods (HS-code-classifiable) / digital goods / SaaS / professional services / mixed
- Buyer geography: countries + states/provinces sold to (current + planned 12mo)
- Seller geography: legal entity location(s), employee/contractor locations, inventory/warehouse locations, server locations (some jurisdictions count this as nexus)
- Revenue projection per jurisdiction: needed for nexus-threshold modeling
- B2B vs B2C mix per region — VAT reverse-charge applies to B2B EU intra-community; US states differ on resale-certificate handling
- Marketplace involvement: are you a facilitator (Etsy, Amazon-style) or a seller on a marketplace? — completely different obligations
- Existing tax-engine relationships (Avalara, Vertex, TaxJar, Stripe Tax, Anrok, Sovos, Quaderno)

## Process

1. **Classify your tax profile** — this gates all downstream design:

   | Profile | Tax surface | Default engine pick |
   |---|---|---|
   | US-only SaaS, <$1M ARR, <5 states | Sales tax in nexus states only | Stripe Tax or TaxJar starter |
   | US-only SaaS, scaling | Sales tax nationwide (digital-tax states), use tax | Anrok (SaaS-native) or Avalara AvaTax |
   | US + EU/UK SaaS | + VAT MOSS/OSS, UK VAT | Anrok + Stripe Tax, OR Avalara |
   | Global SaaS | + AU GST, CA GST/PST, JP/SG/IN GST, ZA VAT, etc. | Avalara AvaTax or Vertex O Series |
   | Physical-goods e-commerce US+intl | Sales tax + customs duty + IOSS + EU VAT | Avalara + customs (TradeBeyond / Hurricane) |
   | Marketplace facilitator (multi-vendor) | MFR rules, 1099-K, vendor settlement tax | Vertex or Avalara enterprise + custom |
   | OTC swaps / regulated financial | FTT (Italy, France, Spain), stamp duty (UK, HK, SG) | Custom + vendor (Sovos, Thomson Reuters ONESOURCE) |

2. **Nexus determination — US SALT post-Wayfair**:
   - **Physical nexus** (always triggers): employee, contractor, inventory (Amazon FBA in state = nexus), property, server (some states), trade-show presence beyond N days
   - **Economic nexus** (Wayfair-style, every state has one): typical thresholds — `$100k revenue OR 200 transactions in prior or current calendar year`. Variants:
     - California, Texas, New York: `$500k`
     - Kansas: `$100k revenue` (no transaction count)
     - Massachusetts: `$100k AND 100 transactions`
     - Some states removed transaction count entirely 2022-2024 (Wisconsin, Iowa, Washington, Arizona, North Dakota, South Dakota, Maine, etc.)
   - **Local-jurisdiction nexus** (Colorado, Louisiana, Alabama, Alaska): home-rule cities require separate registration even within state
   - **Marketplace-facilitator laws**: in nearly all states, marketplace collects + remits on behalf of marketplace sellers; the seller's economic-nexus threshold often excludes marketplace sales (but check — TX, AZ, IL count them)
   - **Decision module:** running tally of (rolling 12-month revenue, rolling 12-month transaction count) per state; alert at 80% of each threshold; auto-trigger registration workflow at 100%

3. **EU VAT scheme decision tree**:

   | Scenario | Scheme | Threshold | Rate |
   |---|---|---|---|
   | EU-established seller, B2C digital, intra-EU sales | OSS Union scheme | €10k pan-EU (TOMS-MOSS distance-sales) | Buyer's country rate |
   | EU-established seller, B2C digital, intra-EU under €10k | Home-country VAT | <€10k | Seller's home rate |
   | Non-EU seller, B2C digital to EU consumer | OSS Non-Union scheme | €0 (immediate) | Buyer's country rate |
   | Any seller, B2C physical goods imported ≤€150 | IOSS (Import OSS) | €0 immediate, €150/shipment cap | Buyer's country rate (collected at sale) |
   | Any seller, B2C physical goods imported >€150 | DDP via customs broker | n/a | Buyer pays at import OR DDP at checkout |
   | B2B intra-EU | Reverse charge | n/a | Buyer self-accounts; seller validates VAT ID via VIES |
   | UK consumer purchase from non-UK seller | UK VAT registration | £0 immediate for digital; £135/shipment threshold for goods | UK 20% |

   - **VIES (VAT Information Exchange System)** B2B VAT ID validation MANDATORY at checkout for reverse-charge eligibility; cache valid IDs but re-validate every 30-90d
   - **OSS quarterly return** filed in member state of identification; consolidates all destination-country VAT
   - **IOSS monthly return**; intermediary required for non-EU sellers
   - **Brexit**: UK now separate from EU OSS; UK VAT registered separately at HMRC

4. **Other major regions to design for**:
   - **UK VAT:** £85k registration threshold (UK-established); £0 for non-UK digital + low-value goods; Making Tax Digital (MTD) APIs mandatory for return filing
   - **Australia GST:** AUD $75k registration threshold; 10% rate; LVIG (Low-Value Imported Goods) tax on imports ≤AUD $1k collected by foreign sellers/platforms
   - **Canada:** federal GST 5% + provincial PST/QST 7-9.975% + harmonized HST 13-15% in some provinces; Quebec QST is separately administered (Revenu Québec)
   - **Japan consumption tax (JCT):** 10% standard, 8% reduced (food); reduced-rate accounting required; qualified invoice system (Oct 2023) requires registration
   - **Singapore GST:** SGD $1M threshold; 9% (2024+); Overseas Vendor Registration (OVR) for digital services
   - **India GST:** dual structure (CGST + SGST or IGST); place-of-supply rules complex; OIDAR for foreign digital sellers
   - **Switzerland VAT:** CHF 100k threshold; 8.1% (2024+); IS scheme for distance sellers
   - **Norway VOEC:** NOK 50k threshold; VAT on e-commerce simplified scheme
   - **Mexico IVA:** 16%; foreign digital service providers must register

5. **Pick the tax engine** — the build-vs-buy decision (this is one of the few "always buy" calls):

   | Engine | Sweet spot | Coverage | Pricing | Notable weaknesses |
   |---|---|---|---|---|
   | **Stripe Tax** | Stripe-native SaaS, simple products | US, EU, UK, AU, CA, NO, NZ + ~50 | 0.5-0.7% of transaction | No address validation, limited B2B reverse-charge nuance, no use-tax accruals, no exempt-cert mgmt |
   | **TaxJar (Stripe subsidiary)** | US-focused e-commerce | US + a few intl | Per-transaction or subscription | EU coverage shallow; sold to Stripe 2021, roadmap merged with Stripe Tax |
   | **Anrok** | US SaaS post-Wayfair, mid-market | US-heavy, growing EU | Subscription + per-txn | Newer vendor; not all jurisdictions; built for SaaS not e-commerce |
   | **Avalara AvaTax** | Mid-to-large enterprise, multi-channel | Global, ~12k jurisdictions | Enterprise contract | Implementation 6-12 weeks; expensive; AvaTax outages have hit (2020) — design fallback |
   | **Vertex O Series** | Large enterprise, complex B2B | Global, deepest US local-jurisdiction coverage | Enterprise contract (often higher than Avalara) | Heaviest integration lift; powerful but slow to onboard |
   | **Sovos** | Multinational, regulatory reporting + tax | Global, strongest in EU + LatAm e-invoicing | Enterprise contract | Less SaaS-friendly; strong in physical goods + regulated reporting |
   | **Quaderno** | EU-focused indie SaaS + digital products | EU VAT-heavy + US basics | Tier subscription | Smaller US footprint than Anrok/Avalara |

   **Decision frame:**
   - <$5M ARR + SaaS + US-heavy → Stripe Tax OR Anrok (Anrok if you expect to outgrow Stripe Tax in 18 months)
   - $5-50M ARR + multi-region SaaS → Anrok or Avalara
   - $50M+ ARR or enterprise B2B or physical goods → Avalara or Vertex
   - Indie EU-focused → Quaderno
   - Multinational physical goods + e-invoicing mandates → Sovos

6. **Tax-engine integration pattern** — the architecture:
   - **Quote stage** (cart calculation): synchronous call to engine with `(items, buyer_address, seller_address, customer_tax_id, exemption_certs, transaction_date)` → returns `tax_lines[]` (amount, rate, jurisdiction, taxability)
   - **Commit stage** (post-payment): asynchronous call to engine `Commit` API with final transaction → engine records for filing
   - **Reversal/refund**: explicit `Adjustment`/`Void` call; never silent
   - **Idempotency**: every API call carries `idempotency_key`; engine dedupes
   - **Caching**: rate tables can be cached (Stripe Tax caches per-locale); jurisdiction lookups can be cached; **never cache the commit** (jurisdiction-specific deductions, tax holidays, sale-day rates can shift mid-day)
   - **Fallback design**: when engine is down → reject checkout (DO NOT charge customer with no tax), OR queue + apply estimated tax + reconcile on engine recovery. Most products choose reject + alert.
   - **Address validation**: engine handles or you bolt on (Smarty / Lob / USPS) — ZIP+4 vs ZIP alone changes tax by city/county

7. **Marketplace facilitator design** (if you operate a multi-vendor marketplace):
   - **Marketplace facilitator laws** (US): in nearly all states, the marketplace collects + remits tax on behalf of its sellers. You become tax-of-record for the marketplace sales.
   - **EU**: deemed-supplier rules (Art 14a VAT Directive) — for non-EU sellers + imports ≤€150 OR for any sale via interface that "facilitates", the marketplace is the deemed supplier
   - **UK**: similar marketplace rules post-Brexit
   - **Architecture**: separate "MFR-mode" code path; tax registration in MFR-only states; consolidated remittance; 1099-K issuance to US sellers above thresholds ($600 from 2024 per ARPA — though phased delays); seller-payable accrual differs from gross sale
   - **Vendor settlement**: gross sale → tax to state → net to vendor; reconciliation per-vendor monthly statements

8. **Reverse-charge + B2B handling**:
   - **EU intra-community B2B**: seller collects 0%, buyer self-accounts via reverse charge; mandatory VAT ID validation (VIES); must appear on invoice as "Reverse charge — Article 196 VAT Directive 2006/112/EC"
   - **US**: equivalent is resale certificate (state-specific forms — Multi-State Tax Commission MTC Uniform Sales & Use Tax Resale Certificate covers ~37 states); exempt certificate management is non-trivial
   - **Certificate-management vendor**: Avalara CertCapture, Vertex Returns, manage solicitation + storage + expiration
   - **Audit**: maintain valid-cert-on-file for every exempt transaction OR pay the tax + penalties retrospectively

9. **Compliance returns + remittance**:
   - **US**: monthly/quarterly/annual filing per state (frequency depends on collected amount); prepayment requirements in CA, NY, IL, etc. for large filers
   - **EU OSS**: quarterly via member state of identification
   - **IOSS**: monthly
   - **UK VAT**: quarterly via MTD APIs
   - **Avalara/Vertex Returns** automate filing; review-and-approve workflow recommended
   - **Liability tracking in GL**: tax-payable account (per `/ledger-invariants` 2400 range) accrues at sale, debits at remit; reconcile monthly to engine reports

10. **Anti-patterns** — the real disasters:
    - **"We'll register later"**: every unregistered transaction in a nexus state is accruing liability; states audit retroactively. Penalty + interest 25-100% of tax.
    - **"Stripe handles it"** when your product is physical goods, B2B, or in 30+ jurisdictions: Stripe Tax has real gaps. Read their coverage matrix per quarter.
    - **Caching commits**: jurisdictions issue mid-day tax holidays (e.g., back-to-school weekends); a cached rate from morning is wrong by afternoon.
    - **Skipping VIES validation** on EU B2B reverse-charge: invalid customer VAT ID → you owe the VAT, not them.
    - **Missing the marketplace-facilitator-vs-seller distinction**: charging tax twice (once by marketplace, once by you) → customer chargeback + bad reviews.
    - **Letting customer self-declare exempt without certificate**: audit-proof requires actual signed certificate on file with expiration tracking.
    - **Single-currency tax math**: VAT at buyer's-currency rate; book in your reporting currency at pinned FX (per `/ledger-invariants` I8).
    - **No tax-engine failure mode**: engine outage = $0 collected = liability accrual. Define + test the fallback.
    - **Ignoring Quebec, Alaska local, Colorado home-rule**: these are separate from state-level filings; common rookie miss.
    - **Treating digital goods as universally non-taxable**: 30+ US states tax digital goods/SaaS (TX, NY, OH, PA, WA, etc. — list grows yearly).

11. **Monitoring + nexus dashboard**:
    - Real-time per-jurisdiction (rolling 12mo revenue, rolling 12mo txn count, % of threshold, status)
    - Alert at 80% of threshold → file registration workflow at 100%
    - Quarterly review with tax counsel
    - Reconciliation: tax engine report vs GL vs bank-remit; aging differences > $0 triggered

12. **Document the carve-outs explicitly** — what you intentionally don't do:
    - Products explicitly out-of-scope (e.g., legacy plans not in OSS scheme)
    - Jurisdictions deferred until $X threshold
    - Manual processes (e.g., resale-cert review by Controller weekly)
    - Vendor outages handled by halting checkout (not silently committing tax-less)

## Output

Write `docs/design/multi-jurisdiction-tax-<project>.md`:

```markdown
# Multi-Jurisdiction Tax Design — <project>
**Date:** <YYYY-MM-DD> | **Owner:** Controller + Finance Eng | **Approved:** CFO + Outside Tax Counsel <date>

## Tax profile
- Product type: <SaaS / digital goods / physical goods / services / mixed>
- B2C / B2B split: <%>
- Marketplace facilitator: <yes / no>
- Seller entities + locations: <list>
- Active jurisdictions: <list of states/countries currently registered>
- 12-month planned: <list of states/countries to register>

## Nexus engine
- US SALT thresholds tracked: physical + economic + marketplace per state
- Running tallies per state: rolling 12-mo revenue + transactions
- Alert thresholds: 80% → file workflow; 100% → halt new tx in that state until registration
- Local jurisdictions tracked: Colorado home-rule, Louisiana parishes, Alabama local, AK boroughs
- Stored in: <table / Anrok dashboard / Avalara Compliance Cloud>

## EU/UK VAT
- Scheme: <OSS Union / OSS Non-Union / IOSS / UK domestic>
- Member state of identification (if applicable): <country>
- Intermediary (IOSS): <vendor name>
- VIES validation: required for B2B reverse-charge; cached 30d; re-validated on renewal
- Reverse-charge invoice clause: "Reverse charge — Article 196 VAT Directive 2006/112/EC"

## Other-region coverage
| Region | Threshold | Rate | Scheme | Status |
|---|---|---|---|---|
| AU GST | AUD $75k | 10% | LVIG for goods | <registered / planned> |
| CA GST/HST | CAD $30k | 5%-15% | + QST separately | <> |
| JP JCT | JPY 10M | 10%/8% | Qualified Invoice (2023) | <> |
| SG GST | SGD $1M | 9% | OVR digital | <> |
| Norway VOEC | NOK 50k | 25% | Simplified | <> |

## Tax engine pick
- Primary: <Stripe Tax / Anrok / Avalara AvaTax / Vertex O / Sovos / Quaderno>
- Decision rationale: <fit, ARR scale, coverage, integration cost>
- Fallback engine: <secondary or manual>
- Exempt-cert management: <CertCapture / Vertex Returns / manual>
- Returns filing: <vendor auto / Controller review-and-approve>

## Integration pattern
- Quote API: synchronous at cart; address-validated; cached rate, never cached commit
- Commit API: async post-payment; idempotency key per txn
- Refund/Adjust API: explicit; never silent
- Failure mode: <reject checkout + alert / queue + estimate + reconcile>
- Address validation: <engine-bundled / Smarty / Lob / USPS>

## Marketplace facilitator (if applicable)
- MFR states registered: <list>
- 1099-K threshold tracking per seller; issuance January each year
- Vendor settlement flow: gross → tax to state → net to vendor
- Per-vendor monthly reconciliation statement

## GL coupling
- Tax-payable accounts: 2400-<jurisdiction-code> per `/ledger-invariants`
- Posting at sale: DR 1100 (gross) / CR 4xxx (net revenue) / CR 2400-<j> (tax)
- Posting at remit: DR 2400-<j> / CR 1100
- Monthly reconciliation: engine report vs 2400 balances vs bank remit; tolerance $0

## Filing cadence
| Region | Frequency | Filer | Due day |
|---|---|---|---|
| US states (>$1M tax/yr) | Monthly | <engine + review> | varies, mostly 20th |
| US states (small) | Quarterly | <engine> | 20th after quarter |
| EU OSS | Quarterly | <engine> | end of next month |
| IOSS | Monthly | <intermediary> | end of next month |
| UK VAT (MTD) | Quarterly | <engine via MTD API> | 1 month + 7 days |

## Anti-patterns avoided (declared)
- No "register later" — alerting + workflow at 80% nexus
- No commit-caching
- No skipping VIES validation
- No customer-self-declared exempt without on-file cert
- No single-currency tax math
- No silent tax-engine fallback (halt + alert)

## Monitoring
- Nexus dashboard refreshed nightly; reviewed monthly by Controller + counsel quarterly
- Engine availability monitored; outages page on-call
- Reconciliation breaks aged + escalated per `/ledger-invariants` policy
```

## Verification
1. Tax profile classified; engine pick justified against profile (no "Stripe handles it" hand-waving on physical goods or 30+ jurisdictions).
2. Nexus engine tracks per-state rolling 12-mo revenue + transactions; alerts at 80%; halts at 100% pre-registration.
3. EU VAT scheme(s) explicitly named (OSS Union / Non-Union / IOSS / UK separate) with member state of identification.
4. Tax-engine integration covers Quote (sync), Commit (async), Refund (explicit) with idempotency keys; failure mode is reject-not-silent.
5. Marketplace-facilitator path designed if applicable; vendor-settlement flow + 1099-K issuance covered.
6. GL coupling: 2400-jurisdiction accounts + post-at-sale and post-at-remit + monthly recon to engine + bank.
7. Filing cadence table covers every registered jurisdiction with frequency, filer, due date.
