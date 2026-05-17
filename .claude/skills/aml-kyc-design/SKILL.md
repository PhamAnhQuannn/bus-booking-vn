---
name: aml-kyc-design
description: AML/KYC pre-build scoping — 6th AML Directive, FinCEN, Travel Rule, sanctions, PEP screening, transaction monitoring, SAR. Outputs to `docs/inception/aml-kyc-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "AML", "KYC", "money laundering", "PEP", "Travel Rule", "MiCA", "/aml-kyc-design", or before fintech / crypto / payments launch.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /aml-kyc-design — AML/KYC Pre-build Design

## Why you'd care

Launching a money-movement product without a CDD/monitoring plan is how founders end up personally named in enforcement actions. Scope the regime, tiers, and SAR workflow before you write a single transaction route — retrofitting AML into a live ledger is brutal.

Invoke as `/aml-kyc-design`. Required for fintech, crypto, money services, real estate platforms, marketplaces with monetary value transfer. Maps regulatory regime → CDD tiers → transaction monitoring → SAR/STR filing.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S → SKIP (not handling regulated money flows)
2. Read `docs/inception/regulatory-<project>.md`.
3. Read `docs/inception/legal-entity-<project>.md`.
4. Read `docs/inception/pci-<project>.md` if payment cards.

## Inputs
- Business type (PSP, crypto exchange/wallet, neobank, marketplace, money transmitter, real estate).
- Jurisdiction (regulator differs: US FinCEN/state MTL, EU national FIUs + AMLA from 2026, UK FCA, Singapore MAS).
- Customer types (consumer, business, high-risk).
- Crypto involvement (Travel Rule + MiCA in EU).
- Volume thresholds (registration vs licensing).

## Process
1. **Regulatory regime selection**:
   - **US** — FinCEN (BSA/USA PATRIOT Act); state-level MTL (Money Transmitter License) per state; CFPB for consumer
   - **EU** — 6th AMLD (transposed nationally); AMLR (Regulation 2024/1624 directly applicable from 2027); AMLA (single supervisor from 2026); MiCA for crypto-asset service providers
   - **UK** — MLR 2017 + Proceeds of Crime Act 2002; FCA registration for crypto (5MLD transposed)
   - **Singapore** — MAS PSA 2019 + AMLA
   - **Travel Rule** — FATF Recommendation 16 → originator + beneficiary info on transfers ≥$1k/€1k for crypto (EU TFR Reg 2023/1113 from Dec 2024)
2. **Customer Due Diligence (CDD) tiers**:
   - **Simplified Due Diligence (SDD)** — low-risk; e.g., regulated counterparty
   - **Standard CDD** — identity + verification + purpose of relationship + ongoing monitoring
   - **Enhanced Due Diligence (EDD)** — high-risk: PEPs, high-risk geographies (FATF grey/black), complex ownership, large cash, correspondent banking
3. **KYC verification methods**:
   - Document: government ID + proof of address; OCR + liveness
   - Database: electoral roll, credit bureau (Experian, Equifax)
   - Biometric: liveness selfie + face match
   - Vendors: Onfido, Persona, Jumio, Sumsub, Veriff, Trulioo (~$1–$5/check)
4. **Beneficial Ownership (UBO)**:
   - 25% threshold typical (some MS lower)
   - PSC register UK / Transparency Register EU / FinCEN BOI Report (US Corporate Transparency Act effective 2024)
   - Source-of-funds + source-of-wealth for high-value
5. **Sanctions + PEP screening**:
   - Real-time at onboarding; daily batch re-screen
   - Lists: OFAC SDN + sectoral + 50% rule, EU consolidated, UN, UK OFSI, national lists
   - PEP definition: senior public official + family + close associate; 12-mo cool-off post-leaving
   - Adverse media: news/court records; risk-based
   - Vendors: ComplyAdvantage, Refinitiv World-Check, LexisNexis Bridger, Dow Jones (~$10k–$200k/yr)
6. **Transaction monitoring**:
   - Rules-based: structuring, velocity, geo, amount thresholds, peer-anomaly
   - ML/behavioral: baseline + drift detection
   - Vendors: Sardine, Unit21, Hummingbird, Sift, Alloy, ComplyAdvantage TM
   - Investigation case workflow + audit trail
7. **SAR/STR filing**:
   - **US**: SAR within 30 days of detection (60 if no suspect); FinCEN BSA E-Filing
   - **EU**: STR to national FIU "without delay"; e.g., Germany goAML
   - **UK**: SAR to NCA via SAR Online; consent regime for transactions over threshold
   - 5-yr record retention typical
   - Tipping-off offence — never tell customer
8. **Travel Rule (crypto)**:
   - Originator + beneficiary name, address, account/wallet for transfers ≥€1k (EU TFR)
   - VASP-to-VASP messaging via TRP (Travel Rule Protocol), Sygna Bridge, Notabene, Veriscope
   - Self-hosted wallet handling: enhanced verification for transfers >€1k
9. **MiCA** (EU crypto, applies June 2024 stablecoins / Dec 2024 CASPs):
   - Crypto-Asset Service Provider authorization
   - White paper + marketing rules
   - Custody segregation
   - Market abuse regime
   - Stablecoin reserve + redemption rules (ART/EMT)
10. **Risk-based approach** (all regimes):
    - Customer risk + product risk + geo risk + channel risk
    - Annual enterprise-wide risk assessment (EWRA)
    - Documented + Board-approved
11. **Compliance officer (MLRO)**:
    - Required by most regimes; Board-level reporting
    - UK: approved person under SMCR
    - EU: head of compliance + AML officer

## Output
Write `docs/inception/aml-kyc-<project>.md`:

```markdown
# AML/KYC Pre-build Design — <project>
**Date:** <YYYY-MM-DD>

## Business + regime
- Business type: <crypto exchange / neobank / marketplace / PSP>
- Jurisdiction: US (DE-incorp + state MTL roadmap) + EU (passporting from IE)
- Crypto involvement: yes — VASP under EU MiCA + US MSB registration
- Volume forecast Y1: $50M throughput

## Regulatory map
| Regime | Trigger | Status |
|---|---|---|
| US FinCEN MSB | money transmission | register day-1 |
| US state MTL | per-state thresholds | NY BitLicense first; tier rollout |
| EU MiCA CASP | crypto services | authorization filing 2026-Q2 |
| EU 6th AMLD / AMLR | money handling | apply via IE CBI |
| UK FCA registration | UK crypto users | 5MLD register if UK launch |
| Travel Rule (FATF/TFR) | crypto transfer ≥€1k | Notabene integration |

## CDD tiering
| Tier | Customer | Threshold | Verification | Monitoring |
|---|---|---|---|---|
| SDD | regulated counterparty | low | reduced | quarterly |
| Standard | retail consumer <€15k/mo | medium | doc + selfie + DB | rule-based |
| EDD | PEP / high-risk geo / >€15k/mo | high | + source of funds + UBO | ML + manual review |
| Reject | sanctioned / FATF black | n/a | block | n/a |

## Onboarding flow
1. Email + phone verification (anti-fraud)
2. Country selection → geo block enforcement
3. Identity collection (name, DOB, address, gov ID)
4. Document capture (Onfido / Persona)
5. Selfie + liveness
6. Sanctions + PEP screening (ComplyAdvantage)
7. UBO collection (business customers)
8. Source-of-funds questionnaire (above threshold)
9. CDD-tier assignment
10. Approve / EDD-route / reject

## Vendor stack
| Function | Vendor | Cost |
|---|---|--:|
| ID verification | Persona | $2/check, ~$50k Y1 |
| Sanctions/PEP/adverse media | ComplyAdvantage | $25k Y1 |
| Transaction monitoring | Sardine | $40k Y1 |
| Travel Rule messaging | Notabene | $30k Y1 |
| Case management | Unit21 | $35k Y1 |
| **Total Y1 vendor** | | **~$180k** |

## Transaction monitoring rules (initial)
| Rule | Threshold | Action |
|---|---|---|
| Structuring | 3+ transfers <$10k same day = $30k+ | flag for review |
| Velocity | >10 deposits in 1 hour | freeze + review |
| Geo anomaly | first transfer to FATF-grey country | EDD trigger |
| Round-trip | deposit immediately withdrawn | flag |
| Crypto / fiat ratio | crypto buy + immediate withdraw to self-hosted | enhanced log |
| Sanctions hit (post-onboard) | any | freeze + SAR |
| PEP elevation | new PEP designation post-onboard | EDD review |

## SAR/STR workflow
- Detection → triage (24 hr SLA) → investigation case opened → MLRO review → file decision
- US SAR: filed via FinCEN BSA E-Filing within 30 d
- EU STR: filed via national FIU portal (goAML / TRACFIN) "without delay"
- UK SAR: via NCA SAR Online; DAML consent regime where applicable
- Record retention: 5 yr post-relationship-end + 5 yr SAR record
- Tipping-off discipline trained

## MLRO
- Designated: <name> as MLRO + nominated officer
- Board reporting: quarterly + ad-hoc material risk
- Compliance committee: monthly
- External counsel on retainer: <firm>

## Enterprise-wide risk assessment (EWRA)
- Customer risk: retail (medium) / business (medium-high) / institutional (low)
- Product risk: fiat on/off-ramp (high) / crypto-to-crypto (medium) / custody (high)
- Geographic risk: per-country FATF rating
- Channel risk: web (medium) / API (high — partner KYC required) / mobile (medium)
- Annual review + Board approval

## Travel Rule implementation (crypto)
- TFR threshold: €1k EU; US BSA $3k
- Outbound: collect originator info, send via Notabene / Sygna
- Inbound: validate beneficiary info; reject if missing
- Self-hosted wallet: enhanced address verification + risk-scoring (TRM Labs / Chainalysis)
- Counterparty due-diligence on receiving VASPs

## MiCA-specific (if EU CASP)
- White paper for any token issuance
- Marketing communications rules (fair, clear, not misleading)
- Custody: client asset segregation; bankruptcy-remote
- Market abuse regime: insider list + STOR filings to ESMA
- Stablecoin reserves + redemption (if issuing ART/EMT)
- Authorization timeline: 6-12 mo

## Effort + cost
| Activity | Cost |
|---|--:|
| MLRO hire (FT) | $150k/yr |
| Compliance officer | $100k/yr |
| Vendor stack (above) | $180k/yr |
| Legal — license filings | $200k Y1 (NY BitLicense + EU CASP) |
| Audit (annual independent AML) | $50k/yr |
| Training (workforce) | $5k/yr |
| State MTL surety bonds | $500k–$2M total reserved capital |
| **Total Y1 ex-bond** | **~$685k** |

## Reporting obligations
- US: SAR (30 d) + CTR ($10k+ cash) + 314(a) info-share + Form 8300
- EU: STR (without delay) + EWRA + annual self-assessment to NCA
- UK: SAR + DAML + annual MLRO report
- MiCA: market abuse STORs + complaints + annual compliance report

## Sanctions screening cadence
| Stage | Cadence |
|---|---|
| Customer onboarding | real-time |
| Daily re-screen | overnight batch all customers |
| Transaction screening | per-transaction |
| Vendor/employee | per hire + annual |
| Beneficial owner | annual + on change |

## Risk if skipped
- US: FinCEN civil $25k–$57k per violation; criminal up to $1M / 30 yr (willful)
- EU: AMLR up to 10% group revenue
- UK: unlimited fines + criminal (LIBOR-style penalties)
- License revocation
- Personal liability for MLRO (criminal exposure)
- Bank de-risking — lose payment rails
- Customer lawsuits + class actions

## 90-day plan
1. Regulatory licensing roadmap + counsel engagement (week 1–2)
2. MLRO hire / external interim (week 1–4)
3. KYC vendor selection + integration POC (week 2–6)
4. Sanctions screening live (week 4–6)
5. Transaction monitoring rules v1 (week 6–8)
6. EWRA initial draft + Board approval (week 8–10)
7. SAR workflow + tabletop (week 10–12)
8. Travel Rule integration if crypto (week 8–12)

## Adjacent regimes
- **CFTC / SEC** for crypto derivatives or securities
- **MiCA** for EU crypto (parallel)
- **DORA** for EU financial sector ICT resilience (Jan 2025)
- **NIS2** for cyber security
- **Consumer Duty** UK (FCA)
- **Section 314(b)** US info-sharing safe harbor

## Verification
- Regulatory regime named per jurisdiction.
- CDD tiers defined with thresholds.
- Vendor stack costed.
- MLRO appointed.
- SAR/STR workflow named.
- Travel Rule covered if crypto.
- EWRA cadence set.
```

## Verification
- Regime per jurisdiction documented.
- CDD/EDD/SDD tiers defined.
- Sanctions/PEP screening cadence set.
- SAR/STR workflow + filing portal named.
- MLRO appointed (or external interim).
- Travel Rule + MiCA covered if crypto.
- EWRA cadence and Board approval named.
