---
name: export-tariff-classification
description: Cross-border physical-goods tariff classification — WCO HS nomenclature (6-digit), US HTS (10-digit) + Schedule B (Census), EU TARIC (10-digit), UK Trade Tariff; FTA preferential treatment (USMCA, CPTPP, EU FTAs, UK FTAs); rules-of-origin documentation; certificate-of-origin Form A / EUR.1 / USMCA cert; ACE filing; duty drawback; tariff engineering (legal HS-code structuring). Outputs to `docs/design/export-tariff-classification-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "HS code", "HTS code", "Schedule B", "tariff classification", "customs duty", "USMCA", "rules of origin", "certificate of origin", "duty drawback", "ACE filing", "tariff engineering", "/export-tariff-classification", or before any cross-border physical-goods shipment / Section 301 exposure review. Pairs with `/multi-jurisdiction-tariff-design` (sales-tax/VAT side), `/export-control-screen` (EAR/ITAR licensing).
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 6h
---

# /export-tariff-classification — HS/HTS/Schedule B Classification + FTA Origin

Invoke as `/export-tariff-classification`. The 10 digits of the HS/HTS code determine: (1) the duty rate the importer pays (0% to 350%+), (2) whether your shipment is subject to AD/CVD, Section 232, Section 301, or quota, (3) whether it qualifies for FTA preferential treatment, (4) what export-control-list lookups apply. A single misclassification carries 4× duty penalty + interest plus criminal liability for willful misclassification.

## Why you'd care
Misclassification is the most common customs violation. Real examples: Ford Transit Connect "chicken-tax case" (Ford added seats + windows to import passenger vans at 2.5% car duty, then stripped them post-import for 25% truck duty — CBP litigated 6 years, Ford eventually paid hundreds of millions). Companies routinely overpay 5-15% in duty by using broad HS codes when narrower ones exist; conversely, willful misclassification triggers Section 592 penalties up to 4× the duty + fraud referral. Get classification + origin documentation right and you save 6-7 figures per year on volume; get it wrong and CBP holds shipments, audits 5 years back, and refers to DOJ.

## Effort caveat — customs + agency timelines dominate
- **CBP Binding Ruling Letter (BRL):** 30-day standard response via CROSS database; complex rulings 60-120 days
- **HTS classification disagreement → protest:** 180 days to file from liquidation; CBP then 2 years to decide
- **CBP Focused Assessment audit:** triggered by risk-score; lookback 5 years; 3-6 months from notice to settlement
- **USMCA verification audit (origin):** CBP 12-month lookback typical; respond 30 days or lose preferential treatment
- **Duty drawback claim:** file within 5 years of import; CBP processing 18-36 months
- **First Sale for Export valuation reviews:** CBP scrutiny intensified 2021+; documentation must be contemporaneous

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP (no cross-border physical goods).
2. Read `docs/design/multi-jurisdiction-tax-<project>.md` if it exists — IOSS/sales-tax side.
3. Read `docs/compliance/export-control-screen-<project>.md` for EAR/ITAR/sanctioned-end-user screening (parallel obligation).
4. Confirm: import to US, export from US, import to EU, export from EU, UK, or all? Each has its own tariff schedule.
5. Confirm: physical goods only (this skill applies) vs software/services (out of scope, see export-control-screen for EAR dual-use).

## Inputs
- Product catalog: SKUs with physical descriptions, materials, functions, end use
- Country pairs: origin → destination for each lane (origin per substantial-transformation rules, NOT just shipping country)
- Bill of materials per SKU: component countries-of-origin, value contributions
- Existing classifications (if any) and CBP rulings on file
- Annual volume + value per lane: drives ROI on FTA documentation effort
- Importer of Record per lane (you, customer, or 3PL/broker)
- FTA programs potentially in scope (USMCA, CPTPP, EU FTAs, UK FTAs, GSP-equivalent, etc.)

## Process

1. **Understand the HS nomenclature hierarchy** — the international structure:
   - **WCO HS (Harmonized System) 6-digit:** internationally identical across 200+ countries (WCO Council updates every 5 years; HS 2022 current; HS 2027 in committee)
   - **First 2 digits:** Chapter (e.g., 85 = electrical machinery)
   - **Digits 3-4:** Heading (e.g., 8517 = telephone sets, transmission apparatus)
   - **Digits 5-6:** Subheading (e.g., 8517.13 = smartphones)
   - **Digits 7-10:** Country-specific extensions:
     - US HTS (Harmonized Tariff Schedule of the US, USITC): 10-digit (e.g., 8517.13.0040)
     - US Schedule B (Census, for exports only): 10-digit, broadly aligned with HTS but not always identical
     - EU TARIC (Tarif Intégré Communautaire): 10-digit
     - UK Trade Tariff: 10-digit
     - Canada Customs Tariff: 10-digit
   - **GRI (General Rules of Interpretation 1-6):** the legal hierarchy for resolving ambiguous classifications

2. **Apply GRI in order** — this is the legal method, not "what feels right":
   - **GRI 1:** Classify by the terms of the heading + relative Section/Chapter notes. Most goods stop here.
   - **GRI 2(a):** Incomplete/unfinished article classified as finished if it has the essential character.
   - **GRI 2(b):** Mixtures and composites → classify by the material/component giving essential character.
   - **GRI 3(a):** Most specific description prevails over more general.
   - **GRI 3(b):** Composite goods classified by essential character.
   - **GRI 3(c):** When (a) and (b) fail, the heading appearing last in numerical order.
   - **GRI 4:** Goods that cannot be classified otherwise → most akin classification.
   - **GRI 5:** Containers/packaging classification rules.
   - **GRI 6:** Apply GRIs to subheadings mutatis mutandis.
   - Document the GRI path for every non-obvious classification — this is your audit defense.

3. **Use authoritative sources** — never freelance classifications:
   - **WCO Explanatory Notes (ENs):** authoritative interpretive guide for HS at 6-digit level
   - **CBP CROSS database:** searchable archive of US Binding Ruling Letters (NY rulings + HQ rulings); precedent for similar goods
   - **CBP Informed Compliance Publications (ICPs):** topic-specific guidance (textiles, footwear, electronics, etc.)
   - **EU CN Explanatory Notes** + EU BTI (Binding Tariff Information) database
   - **US Court of International Trade (CIT) decisions:** the legal precedent layer
   - **WCO HS Database (HS Online):** subscription tool for cross-country comparison
   - **Vendor tools:** Descartes CustomsInfo, 3CE, Avalara Cross-Border, Hurricane Modular Commerce

4. **Get binding rulings on close calls** — the cheapest insurance:
   - **US CBP Binding Ruling Letter (BRL):** submit via e-Ruling Template to NY Customs Information Exchange; ~30 days for routine, 60-120d for complex; legally binds CBP for that exact product
   - **EU BTI (Binding Tariff Information):** valid 3 years across all EU member states; per Customs Code Art. 33
   - **UK Advance Tariff Ruling (ATaR):** post-Brexit equivalent
   - **When to request:** classification ambiguous between two HS codes with materially different duty rates; new product line; pre-investment in tariff engineering
   - **Risk of NOT having one:** if CBP disagrees at port, shipment held; if disagreement post-import, retroactive duty + penalty

5. **Schedule B vs HTS** — the export/import asymmetry:
   - **Schedule B** (US Census Bureau): for exports OUT of the US; statistical-collection focus; mandatory on EEI filing in AES (Automated Export System) when value > $2,500 per Schedule B per destination
   - **HTS** (USITC): for imports INTO the US; revenue + trade-policy focus
   - Both start with identical 6-digit HS; diverge at 7-10
   - **Export classification can use HTS** for AES filing (CBP accepts), but Schedule B is the formally correct lookup
   - **Common mistake:** using same code both ways without verifying — they sometimes diverge enough to matter for FTA origin claims

6. **Duty calculation** — what actually gets paid:
   - **Customs value:** typically transaction value (price paid) + freight to first US port if not included + insurance + assists + selling commissions + royalties + proceeds of subsequent resale. CBP scrutinizes "First Sale for Export" valuations heavily.
   - **Duty = customs value × ad valorem rate** + specific duties (per unit) + compound duties + + Section 301 (China) + Section 232 (steel, aluminum, autos) + AD/CVD if applicable
   - **Section 301 (China):** Lists 1, 2, 3, 4A/4B/exclusions; rates 7.5%-25%+; many products + many exclusions/expirations to track; check Office of USTR notices monthly
   - **Section 232:** steel 25%, aluminum 10% (with country-specific exemptions + quotas)
   - **AD/CVD (Antidumping/Countervailing Duty):** product + country specific; can exceed 300%; published in Federal Register
   - **MPF (Merchandise Processing Fee):** 0.3464% (min $32.71 / max $634.62 per entry as of 2025)
   - **HMF (Harbor Maintenance Fee):** 0.125% sea imports

7. **FTA preferential treatment** — the upside lever:

   | FTA | Applies to | Origin rule type | Cert form |
   |---|---|---|---|
   | **USMCA** (US-Mexico-Canada, 2020) | NA-origin goods | Tariff shift + RVC for auto; product-specific | USMCA Certification of Origin (no specific form; data elements per Annex 5-A) |
   | **CPTPP** (Pacific Rim, 11 countries) | Cross-Pacific | Tariff shift + RVC; product-specific | Self-certification with required data elements |
   | **EU FTAs** (Korea, Canada CETA, Japan EPA, UK TCA, etc.) | EU bilateral | Product-specific list (PSR); some EUR.1 / EUR-MED, some self-cert | EUR.1 movement certificate OR REX-registered self-cert OR statement on origin |
   | **UK FTAs** (UK-Australia, UK-Japan, CPTPP UK accession) | UK bilateral post-Brexit | Per FTA | Per FTA |
   | **GSP (US, expired Dec 2020)** | Developing-country goods | "Substantial transformation" + 35% value-content | Form A (Generalized System of Preferences) |
   | **GSP+ (EU)** | Vulnerable developing | Origin per protocol | REX self-cert |
   | **AGOA** (US-Africa) | Sub-Saharan | Product-specific | AGOA textile cert |
   | **CBI / CBTPA** (US-Caribbean) | Caribbean Basin | Substantial transformation | Per program |

   - **Rules of origin (ROO)** are the gate. Types:
     - **Wholly obtained** (raw mat from one country)
     - **Tariff shift** (e.g., raw → finished moves HS chapter)
     - **Regional value content (RVC):** typically build-up (originating value / transaction value) ≥ 60% or build-down ≥ 50%; net cost method for autos
     - **Specific process rule** (textiles: "yarn-forward" or "fabric-forward")
   - **USMCA Article 4.2** is the ROO core; Annex 4-B has Product-Specific Rules per HS code
   - **Audit defense:** maintain BOM with component origins + values + per-component HS codes + supporting supplier statements; reconstruction at audit time is too late

8. **Certificate of origin discipline**:
   - **USMCA:** no prescribed form; required data elements in Annex 5-A; can be on commercial invoice or separate cert; valid 12 months; importer claims preference at entry
   - **EUR.1:** stamped by exporter's customs authority; per shipment OR REX (Registered Exporter) self-cert for shipments < €6,000
   - **Form A (GSP):** stamped by issuing authority in beneficiary country
   - **Self-certification trend:** modern FTAs (USMCA, CPTPP) push self-certification with audit verification; recordkeeping 5 years
   - **Recordkeeping:** every cert ties to BOM + supplier origin statements + production records; CBP/EU customs can request at any time within 5 years

9. **Tariff engineering — legal HS-code structuring**:
   - **Definition:** designing the product (form, function, components, assembly location) so that the legally correct HS classification falls in a lower-duty heading. This is LEGAL when product changes are real and the classification follows law; FRAUDULENT when product is unchanged and only paperwork shifts.
   - **Ford Transit Connect chicken-tax case (2003-2013):** Ford imported vans from Turkey with rear seats + windows (passenger vehicle, 2.5% duty under 8703); post-import Ford removed seats + replaced rear windows with metal panels (cargo van, 25% duty under 8704). CBP challenged; tried to reclassify retroactively. CIT initially sided with Ford (2013); Federal Circuit reversed (2019) — held that the goods at time of importation were classified correctly as passenger vehicles, but expressed concern about substance. Ultimately Ford had to redesign. Lesson: tariff engineering must be substantive at time of import.
   - **Legitimate tariff engineering examples:**
     - **Footwear with textile uppers (~20% duty) vs leather uppers (~8.5%-37.5%):** changing material composition changes heading
     - **Apparel chapter rules** (Chapter 61/62): garment cut/sewn in FTA country qualifies; subtle assembly-location decisions change duty
     - **"Set" classifications:** packaging together can change essential-character classification under GRI 3(b)
   - **Documentation requirement:** if you engineer, document the engineering decision, the engineering is real at import, and you have a binding ruling. Without all three, CBP treats it as misclassification.

10. **ACE (Automated Commercial Environment) filing** — the operational pipe:
    - **ACE** is CBP's single-window for trade data — entry summary, AES (export), in-bond movements, partner government agency (PGA) filings (FDA, EPA, USDA, FCC, etc.)
    - **Importer of Record (IOR)** responsibility for classification + valuation + admissibility
    - **Customs broker** (licensed) typically files on IOR's behalf; IOR retains legal liability
    - **Entry Type 01 (formal):** value > $2,500
    - **Entry Type 11 (informal):** value ≤ $2,500 (raised from $800 with §321 — duty-free de minimis for low-value imports)
    - **§321 de minimis:** ≤$800 per person per day duty-free; Trump-era and Biden-era proposals to restrict (China-origin especially); subject to ongoing rulemaking
    - **Export AES filing:** EEI (Electronic Export Information) required if value > $2,500 per Schedule B or if license required; failure = fine
    - **PGA holds:** FDA holds pharmaceutical/medical-device imports; FCC holds RF devices; EPA holds chemicals; USDA holds food/ag — each has separate registration

11. **Duty drawback** — the recovery lever (often missed):
    - **Drawback = refund of duties paid on imports that are subsequently exported** (or destroyed under CBP supervision)
    - Types:
      - **Unused merchandise drawback (1313(j)):** exported within 3 years in same condition
      - **Manufacturing drawback (1313(a)):** imported component used in exported manufactured good
      - **Substitution drawback (1313(b)):** allows substituting similar domestic goods
      - **Rejected merchandise drawback (1313(c)):** non-conforming imports returned
    - **Recovery rate:** 99% of duties paid + 99% of Section 301 + MPF/HMF
    - **TFTEA modernization (2018):** simpler filing, fewer documentary requirements, but 5-year filing window
    - **ROI:** for cross-border manufacturers, drawback can recover $100k-$10M+/year; specialist consultants (KPMG, Sandler Travis, J.M. Rodgers) typically take 20-25% contingency

12. **Anti-patterns** — the reliable wallet-emptiers:
    - **"We've always used HS 8517.99"** (or any catchall): catchalls are highest-scrutiny at audit; CBP's risk-targeting flags broad codes
    - **Classifying based on marketing description**: "smart vacuum" is not an HS term; legal description matters
    - **Single classification for product lines** with materially different components / functions: each variant needs its own analysis
    - **Skipping the BOM trace for FTA origin**: claiming USMCA preference without component-level documentation = audit failure
    - **First-Sale-for-Export valuation without contemporaneous documentation**: 3-tier sale structures need real arms-length pricing + transfer documentation
    - **Letting customs broker classify without review**: brokers are licensed but you (IOR) are liable; broker error is your penalty
    - **Ignoring Section 301 list expirations + exclusions**: exclusion lists shift; products move on/off lists; quarterly review minimum
    - **Treating Schedule B === HTS**: they diverge; verify especially for FTA-relevant codes
    - **Self-certifying USMCA without 5-year recordkeeping**: cert without records = no preference at audit
    - **Importing without HS classification documented before shipment**: port hold + demurrage + missed delivery

## Output

Write `docs/design/export-tariff-classification-<project>.md`:

```markdown
# Export/Import Tariff Classification — <project>
**Date:** <YYYY-MM-DD> | **Owner:** Trade Compliance + Supply Chain | **Approved:** General Counsel + CFO <date>

## Scope
- Product lines covered: <list>
- Trade lanes (origin → destination): <list>
- Importer of Record per lane: <list>
- Annual import value: $<>; annual export value: $<>
- FTAs in scope: <USMCA / CPTPP / EU bilateral / UK bilateral / GSP+ / AGOA / etc.>

## Classification register
| SKU | Description | HS6 (intl) | HTS10 (US import) | Sched B (US export) | EU CN10 / UK | Country-specific notes |
|---|---|---|---|---|---|---|
| <sku> | <legal description> | <6-digit> | <10-digit> | <10-digit> | <10-digit per dest> | <e.g., Sec 301 List 3> |

## GRI rationale per SKU
- For each non-obvious classification: GRI path applied, ENs/CROSS rulings cited, BRL # if held
- Maintained in: <classification database / CustomsInfo / Avalara CrossBorder>

## Binding rulings on file
| Country | Authority | Ruling # | SKU | Issued | Expiry / status |
|---|---|---|---|---|---|
| US | CBP NY | <NYNxxxxxx> | <sku> | <date> | <indefinite / superseded> |
| EU | <member state> | BTI <#> | <sku> | <date> | 3-year valid |
| UK | HMRC | ATaR <#> | <sku> | <date> | 3-year valid |

## Duty exposure
| Lane | HTS | Base duty | Sec 301 | Sec 232 | AD/CVD | MPF/HMF | Effective rate |
|---|---|---|---|---|---|---|---|
| CN→US | 8517.13.00 | 0% | 25% (List 3) | n/a | n/a | + | 25.46% |
| MX→US (USMCA) | 8703.23.01 | 0% (USMCA) | n/a | n/a | n/a | + | 0.35% |
| US→EU | <> | per EU CN | n/a | EU steel/alu | n/a | + | <> |

## FTA preferential treatment
- USMCA: applies to lanes <list>; ROO rule type <tariff shift / RVC build-up>; cert format <USMCA data elements>; recordkeeping 5y
- CPTPP / EU-Japan EPA / etc.: <as applicable>
- Self-certification template + supplier origin statement templates stored at <path>

## Tariff engineering decisions
| Decision | Rationale | Substance change | Binding ruling | Audit defense |
|---|---|---|---|---|
| <e.g., add textile lining to shift from 8703 to 8704> | duty 25%→2.5% | <real product change> | <ruling #> | <documentation path> |

## ACE / filing operation
- Customs broker: <name>; license #
- IOR: <entity>
- §321 de minimis policy: <use / don't use; volume rationale>
- AES filer: <broker / in-house>
- PGA filings required: <FDA / FCC / EPA / USDA per SKU>

## Duty drawback program
- Eligibility: <unused / manufacturing / substitution / rejected>
- Annual recovery target: $<>
- Filer: <broker / specialist consultant>
- Recordkeeping system: <ERP module / drawback software>

## Recordkeeping
- HS classification rationale per SKU: <path>
- BOMs with component origins + HS codes + values: <path>
- Supplier origin statements: <path>
- Commercial invoices, packing lists, BoLs: <path>
- 5-year retention from import/export date

## Monitoring + maintenance
- Quarterly review: Section 301/232 list changes, USTR exclusions
- Annual review: HS schedule updates (WCO every 5y; HTS/CN updates annual)
- Pre-launch review for every new SKU
- Pre-launch review for every new lane / FTA opportunity
- Trade compliance owner: <name>; counsel: <firm>

## Anti-patterns avoided (declared)
- No catchall HS codes
- No marketing-description classification
- No FTA preference without BOM-level origin documentation
- No First-Sale valuation without contemporaneous records
- No unreviewed broker classification (broker error = our liability)
- No Schedule B == HTS assumption
- No port-of-entry classification surprises (pre-shipment HS confirmed)
```

## Verification
1. Classification register exists with HS6 + destination-specific 10-digit codes per SKU.
2. GRI rationale documented for every non-obvious classification with EN/CROSS/CIT citations.
3. Binding rulings (CBP BRL / EU BTI / UK ATaR) obtained for every classification with material duty-rate ambiguity.
4. Duty exposure table includes Section 301/232/AD-CVD/MPF/HMF where applicable, with effective rate.
5. FTA preferential treatment claims backed by BOM-level origin documentation + cert templates + 5-year recordkeeping.
6. Tariff engineering decisions (if any) documented with substance change + binding ruling + audit-defense path.
7. ACE filing operation named (broker, IOR, PGA filings, AES filer) and §321 de minimis policy explicit.
