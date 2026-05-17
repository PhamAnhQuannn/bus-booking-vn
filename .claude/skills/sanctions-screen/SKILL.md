---
name: sanctions-screen
description: Sanctions screening pre-flight — OFAC SDN + EU + UK + UN lists, 50%-rule, fuzzy matching, ongoing cadence, blocked-property reporting, recordkeeping. Outputs to `docs/inception/sanctions-screen-<project>.md`. Use when user says "sanctions", "OFAC", "SDN list", "KYC", "blocked person", "denied party", "/sanctions-screen", or before first customer / first payment / first hire.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /sanctions-screen — One Sanctioned Counterparty = $X Million Fine + Criminal Exposure. Screen Before You Transact.

Sanctions screening ≠ compliance theater. Sanctions screening = mandatory legal screen against government lists of blocked persons, entities, and jurisdictions. Hit a match and transact anyway = OFAC penalty + DOJ criminal referral. Build the screen before first customer, not after the subpoena.

## Why you'd care

Onboarding an OFAC-sanctioned customer is a strict-liability violation — $10k+ per transaction, regardless of whether you knew. Screening at signup is the only defensible posture.

## Pre-flight
Run before first customer / first vendor payment / first hire / pre-investment diligence. Pairs with `/aml-kyc-design`, `/export-control-screen`, `/jurisdiction-pick`, `/payment-processor-pick`.

## Inputs
- Product type (does it touch payments / financial services / dual-use tech / regulated industries).
- Customer geography (US only / EU / global / sanctioned-adjacent regions).
- Counterparty types (consumers / businesses / contractors / investors).
- Transaction volume + average value (informs tool tier).

## Process
1. **Determine applicability** — US-touching = OFAC mandatory; check EU/UK/UN per jurisdiction.
2. **Enumerate trigger events** — when must we screen (customer onboarding / payment out / hire / investor).
3. **Pick list sources** — OFAC SDN + sectoral + EU + UK OFSI + UN + local.
4. **Pick tooling** — free OFAC search vs commercial (ComplyAdvantage / Sayari / Refinitiv / Sanctions.io / Chainalysis for crypto).
5. **50%-rule logic** — beneficial ownership aggregation.
6. **Fuzzy matching + false positive handling** — tune threshold, document.
7. **Ongoing screening cadence** — re-screen existing counterparties as lists update.
8. **Blocked-property reporting** — what to do on a hit.
9. **Recordkeeping** — 5-year retention minimum.
10. **Train + document.**

## Output
Write `docs/inception/sanctions-screen-<project>.md`:

```markdown
# Sanctions Screening Pre-flight — <project>
**Owner:** founder / compliance lead / legal
**Date:** <YYYY-MM-DD>
**Jurisdiction(s):** <US / EU / UK / global>
**Tool:** <pick>

## Why this exists
- OFAC + EU + UK sanctions are strict liability — no "we didn't know" defense
- OFAC civil penalties: up to $356K per violation OR 2× transaction value (2024 figures, indexed)
- Criminal: up to $1M + 20 years for willful violation
- Banks, payment processors, and platforms terminate accounts on a single hit
- Reputational damage from a sanctioned counterparty = months of cleanup
- Investor diligence asks "show me your sanctions screening" — no answer = no check

## Applicability
**OFAC (US):** applies to all "US persons" — US citizens, US residents, US-incorporated entities, anyone in the US, AND any non-US person transacting in USD or through US financial system.

**EU:** EU consolidated list applies to all EU persons + transactions touching EU.

**UK:** OFSI consolidated list applies to UK persons + UK-nexus transactions.

**UN:** Security Council resolutions — most countries implement.

**Test:**
- Are we US-incorporated? → OFAC applies.
- Do we touch USD / SWIFT / US correspondent banks? → OFAC applies (even if non-US).
- EU customers / EU entity? → EU list applies.
- UK customers / UK entity? → UK list applies.
- Global SaaS taking payment from any country? → all three apply de facto.

**Our applicability:** <list>

## List sources

| List | Source | Update frequency | Free? |
|------|--------|------------------|-------|
| **OFAC SDN** (Specially Designated Nationals) | treasury.gov/ofac/downloads | Daily | Yes |
| **OFAC Consolidated** (CAPTA, FSE, NS-PLC, PLC, SSI) | treasury.gov | Daily | Yes |
| **OFAC sectoral (SSI)** | treasury.gov | As issued | Yes |
| **EU consolidated** | sanctionsmap.eu | Daily | Yes |
| **UK OFSI** | gov.uk/government/publications/financial-sanctions-consolidated-list-of-targets | Daily | Yes |
| **UN SC** | un.org/securitycouncil/sanctions | As issued | Yes |
| **BIS Entity List** (export controls) | bis.doc.gov | Periodic | Yes |
| **BIS Denied Persons** | bis.doc.gov | Periodic | Yes |
| **State Dept DDTC** (defense trade) | pmddtc.state.gov | Periodic | Yes |
| **FBI Most Wanted** | fbi.gov | Periodic | Yes |
| **PEP lists** (politically exposed persons) | commercial only | — | No |
| **Adverse media** | commercial only | — | No |

**Our list set:** <minimum: OFAC SDN + Consolidated + EU + UK + UN. Add BIS if exporting tech.>

## Comprehensive sanctions programs (country-level — full embargo)
Currently blocked jurisdictions where transactions are categorically prohibited (verify current at transaction time):
- Cuba
- Iran
- North Korea
- Syria
- Crimea / Donetsk / Luhansk / Zaporizhzhia / Kherson regions of Ukraine
- (Russia: not full embargo but heavily sectoral — treat with care)

**Action:** geo-block these jurisdictions at signup. IP-block is insufficient (VPN evasion) — also block by billing address, payment instrument country, declared country of residence.

## Trigger events (when to screen)

| Event | Screen what | Lists |
|-------|------------|-------|
| Customer onboarding | Name + email + billing address + IP country | OFAC + EU + UK + UN |
| Business customer | Entity name + UBO (>25%) + officers + director | OFAC + EU + UK + UN + BIS Entity if relevant |
| Vendor payment (first) | Vendor entity + UBO + bank country | OFAC + EU + UK + UN |
| Hire (employee / contractor) | Name + country of residence | OFAC + EU + UK + UN |
| Investor (cap table) | Entity + GPs + LPs (if disclosed) + UBO | OFAC + EU + UK + UN |
| Wire transfer recipient | Beneficiary + bank + jurisdiction | OFAC + EU + UK + UN |
| Crypto deposit / withdrawal | Wallet address | Chainalysis / TRM Labs |

## 50%-Rule (critical and often missed)
OFAC: any entity owned **50% or more** (directly or indirectly, individually or in aggregate) by 1+ SDN-listed person is itself blocked, **even if not separately listed.**

Example: SDN-listed person owns 30% of CompanyA + 25% of CompanyB. CompanyA is NOT blocked (only 30%). CompanyB is NOT blocked (only 25%). BUT if CompanyA owns 30% of CompanyB → SDN owns 25% direct + 30%×30% indirect = ~34% → still not blocked.

Different example: 2 SDN persons each own 30% of CompanyC → aggregate 60% → CompanyC IS blocked.

**Action:**
- For any business counterparty: collect beneficial ownership data (anyone >25%)
- Screen each UBO against SDN
- Aggregate ownership by listed persons → if ≥50% combined → block

EU 50%-rule: similar but additionally covers "control" (board / voting rights) even at <50% ownership.

## Tooling

| Tool | Best for | Cost | Notes |
|------|----------|------|-------|
| **OFAC Sanctions Search (free)** | Pre-revenue, low volume | $0 | Manual, one-at-a-time. Acceptable < 50 checks/month. |
| **Sanctions.io API** | Indie / startup | $50-500/mo | API access to consolidated lists. |
| **ComplyAdvantage** | Mid-stage SaaS | $1K-5K/mo | API + dashboard, PEP + adverse media. |
| **Sayari** | Complex UBO mapping | $$$ | Beneficial ownership intelligence. |
| **Refinitiv World-Check** | Enterprise / fintech | $$$$ | Industry standard, deep coverage. |
| **Thomson Reuters CLEAR** | Investigations | $$$$ | Adjacent to World-Check. |
| **Chainalysis / TRM Labs** | Crypto-touching | $$$ | Wallet-level screening. |
| **Persona / Alloy / Sumsub / Veriff** | Embedded KYC + sanctions | varies | All-in-one identity + screening. |

**Our pick:** <tool + tier>
**Failover:** if tool down, manual OFAC search until restored. Document downtime.

## Fuzzy matching + false positives

**Threshold:** start at 85% match score. Below = ignore. Above = manual review.

**Common false positives:**
- Common names (John Smith / Mohammed Ali)
- Different person with same/similar name (DOB mismatch + country mismatch = clear)
- Transliteration variants (Mohammed vs Muhammad vs Mohamed)
- Aliases / AKA matches

**False positive resolution log (per match):**
- Match details (which list, score, alias matched)
- Subject identifiers (DOB, nationality, address)
- SDN identifiers (DOB, nationality)
- Conclusion (clear / escalate / block)
- Reviewer name + date
- Retain 5 years minimum

**Hit on full match (high confidence) → STOP. Do not transact. Escalate.**

## Workflow

### New customer signup
1. Capture: full legal name + DOB (if collected) + address + country
2. API call to screening tool
3. No hit (< threshold) → continue onboarding
4. Possible hit (>= threshold) → freeze account, manual review within 1 business day
5. Confirmed hit → block, document, report (see below)

### New vendor / contractor
1. Capture entity + UBO (>25%) + officers
2. Screen entity + each UBO + officers
3. Same threshold / review / block logic

### Ongoing re-screening
- Re-screen all active customers + vendors weekly against fresh list updates
- New addition to SDN affecting existing customer → freeze account immediately + investigate

## Confirmed hit playbook
1. **Stop transaction** — do not release funds, do not provide service
2. **Block / reject** in system; do not communicate reason to subject (tipping-off)
3. **Notify legal counsel immediately** — sanctions counsel if available
4. **OFAC report** — within 10 business days for blocked property (form TD F 90-22.50 / OFAC Reporting Form)
5. **Annual report** — OFAC requires annual blocked property report by Sep 30
6. **Document** — full chain of facts, reviewer notes, decision

**Critical:** rejected (no nexus) ≠ blocked (must hold property). Counsel decides which.

## Payment-processor coordination
- Stripe / Adyen / Checkout.com run their own screening but **do not exempt you from your own obligations**
- If processor flags a transaction, you must also screen + decide
- Tell processor about your screening — they may require evidence

## Crypto-specific
- Wallet address screening (Chainalysis Reactor, TRM, Elliptic)
- Tornado Cash + other mixer addresses on SDN
- High-risk jurisdiction inbound = additional review
- DeFi smart contract addresses can be sanctioned (e.g. Tornado Cash 2022)

## Recordkeeping
**Retention:** 5 years minimum (OFAC); longer if other regulations apply.

**Records to keep:**
- Every screening event (subject, timestamp, lists searched, result)
- False positive resolutions
- Confirmed hits + reporting evidence
- Tool audit logs
- Annual blocked property reports
- Training records

## Training
- Anyone onboarding customers / paying vendors / hiring = trained
- Refresher annually
- New addition to sanctions program → notify team within 1 week
- Tabletop: simulate a hit, run the playbook

## Coordination with other regimes
- **AML/KYC** → see `/aml-kyc-design`. Sanctions screening is one component of KYC.
- **Export controls** → see `/export-control-screen`. BIS Entity List + DDTC overlap.
- **CFIUS** (US foreign investment review) → relevant for funding rounds with non-US investors in sensitive sectors.
- **State / municipal lists** → some states (NY, CA) have additional lists.

## Penalty exposure
- OFAC civil: up to $356,579 per violation OR 2× transaction (2024 indexed)
- OFAC criminal: up to $1M + 20 years for willful
- EU: varies by member state; UK up to £1M / 7 years
- Reputational: account terminations from banks / processors / partners
- Settlement examples: BitGo $98K (2020), BitPay $507K (2021), ExxonMobil $2M (2017), Standard Chartered $1.1B (2019)

## Anti-patterns
- ❌ One-time check at signup, never re-screen
- ❌ No fuzzy matching → miss transliteration variants
- ❌ Skipping 50%-rule → miss owned-but-not-listed entities
- ❌ Screening name only, no DOB / country = false positive flood OR missed match
- ❌ Tipping off subject (telling them they're blocked)
- ❌ Free OFAC search at scale (manual = error-prone past 50 checks/mo)
- ❌ No audit trail — can't prove screening happened
- ❌ Trusting payment processor alone — your obligation stands
- ❌ Ignoring annual blocked property report
- ❌ Geo-block by IP only (VPN bypass) → block billing address + payment country too
- ❌ Crypto without wallet screening
- ❌ No counsel for first confirmed hit

## Pre-launch checklist
- [ ] Applicability determined (US / EU / UK / global)
- [ ] List sources subscribed (OFAC SDN + Consolidated + EU + UK + UN minimum)
- [ ] Trigger events mapped (signup / payment / hire / vendor / investor)
- [ ] Tool picked + integrated (or manual procedure documented if pre-revenue)
- [ ] 50%-rule logic implemented for business counterparties
- [ ] Fuzzy match threshold set
- [ ] False positive resolution log built
- [ ] Confirmed hit playbook written
- [ ] Re-screening cadence scheduled (weekly minimum)
- [ ] Geo-blocking for embargo jurisdictions
- [ ] Recordkeeping plan (5-year retention)
- [ ] Counsel contact for hit escalation
- [ ] Team trained
- [ ] Annual blocked property report calendar reminder (Sep 30)

## Annual refresh
- Penalty caps reindex (OFAC adjusts annually)
- New programs (e.g. cyber, Russia tranches, China sectoral)
- Tool capability review
- Sample audit (pull 20 random screenings, verify quality)
- Update this doc

## Next
- AML/KYC design → `/aml-kyc-design`
- Export controls → `/export-control-screen`
- Jurisdiction setup → `/jurisdiction-pick`
- Payment processor → `/payment-processor-pick`
- Privacy policy → `/privacy-policy-pre`
```

## Verification
- Applicability test run + jurisdictions noted.
- List sources subscribed.
- Trigger events mapped.
- Tool picked + integration plan.
- 50%-rule logic for businesses.
- Fuzzy threshold + false positive log.
- Confirmed-hit playbook + counsel contact.
- Re-screening cadence.
- Geo-block for embargoes.
- 5-year recordkeeping.
- Annual blocked property report calendared.
