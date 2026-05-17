---
name: export-control-screen
description: Export control screening — EAR / ITAR / EU Dual-Use / sanctions screening for software, crypto, AI. Outputs to `docs/inception/export-control-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "export control", "EAR", "ITAR", "sanctions", "OFAC", "/export-control-screen", or before international sales / open-sourcing crypto.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /export-control-screen — Export Control Screening

## Why you'd care

Crypto, AI, dual-use software, and certain analytics products are export-controlled by default under EAR/ITAR/EU 2021/821 — and the founder who open-sources a strong-crypto library or sells to a sanctioned-jurisdiction customer without screening can rack up six-figure civil penalties per transaction and, in ITAR cases, criminal exposure. Pre-screen the product's classification (ECCN), the customer (OFAC SDN), and the deployment country before the first international sale; retrofitting export compliance after a Commerce subpoena is the most expensive class of legal work a startup can buy.

Invoke as `/export-control-screen`. US EAR, ITAR, EU Dual-Use 2021/821, UK Strategic Export Controls, sanctions (OFAC/EU/UN/UK).

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S → SKIP
2. Read `docs/inception/regulatory-<project>.md`.

## Inputs
- Product type (software, crypto, AI/ML, encryption, surveillance).
- Customer geography (sanctioned countries: Iran, Cuba, North Korea, Syria, Russia, Belarus, Crimea, DNR/LNR).
- End-use (commercial, military, dual-use, government).
- Open-source intent (encryption open-source = TSU exception in US).
- Founder citizenship (deemed export risk).

## Process
1. **Jurisdiction**:
   - **EAR** (US Export Administration Regulations, 15 CFR 730–774) — commercial dual-use; BIS administers
   - **ITAR** (US International Traffic in Arms, 22 CFR 120–130) — defense articles on USML; DDTC administers
   - **EU Dual-Use Regulation 2021/821** — Annex I list; recast 2021 includes cyber-surveillance
   - **UK Strategic Export Control Lists** — UK Strategic Export Control Lists; ECJU
   - **Wassenaar Arrangement** — multilateral basis for many lists
2. **Classification (US EAR)**:
   - **EAR99** — most commercial software not on CCL; license rarely required
   - **5D002** — encryption software (commonly applies to SaaS with crypto)
   - **5A002** — encryption hardware
   - **3D001** — semiconductor manufacturing software
   - **0Y521** — temporary new ECCN (often AI/ML)
   - File self-classification → ECCN
3. **Encryption rules (Category 5 Part 2)**:
   - Mass-market crypto (>64-bit symmetric, >768-bit asymmetric, >128-bit elliptic) → 5D992 (Note 3 mass-market)
   - Above thresholds → 5D002, requires either license exception ENC or license
   - **One-time encryption registration** with BIS (was annual self-classification report — relaxed 2021)
   - **TSU exception §740.13(e)** — publicly available open-source encryption (notification to BIS + NSA at posting)
4. **AI/ML controls** (October 2022 + October 2023 updates):
   - Advanced computing chips (3A090, 4A090) for "21 listed countries"
   - Semiconductor manufacturing equipment
   - AI training compute thresholds (proposed)
   - Deemed export to nationals of restricted countries
5. **Cyber-surveillance (EU recast 2021/821)**:
   - Dual-use list expanded for facial recognition, location tracking, intercepting comms
   - Catch-all for unlisted items if for internal repression / human rights abuse
6. **Sanctions screening** (each customer/employee):
   - **OFAC SDN list** + sectoral lists (CAPTA, NS-MBS, SSI)
   - **OFAC 50% rule** — entities owned ≥50% by SDN are sanctioned even if not listed
   - **EU consolidated list**
   - **UN Security Council list**
   - **UK OFSI consolidated list**
   - Tooling: ComplyAdvantage, Refinitiv World-Check, Sanctions.io (~$5–50k/yr)
7. **Country embargoes**:
   - **Comprehensive**: Iran, Cuba, North Korea, Syria, Crimea, DNR/LNR
   - **Russia + Belarus**: extensive sectoral + Annex VII (advanced tech, dual-use)
   - **China**: entity list + military end-user (MEU) restrictions
8. **Deemed exports**:
   - Releasing controlled tech to foreign national in US = export to their country
   - Affects hiring, contractors, cloud access, GitHub commits
   - Particularly relevant to Russian/Chinese/Iranian nationals working on encryption
9. **License exceptions**:
   - **ENC** — encryption (most common for SaaS)
   - **TSU** — open-source publication
   - **CIV / GBS / TSR** — civilian / Group B countries / tech-sales restrictions
   - **STA** — strategic trade authorization

## Output
Write `docs/inception/export-control-<project>.md`:

```markdown
# Export Control Screening — <project>
**Date:** <YYYY-MM-DD>

## Jurisdiction
- Primary: US EAR (we incorporate in DE, US-headquartered)
- Secondary: EU Dual-Use 2021/821 (sales to EU)
- Customer countries: <list>
- Sanctioned countries (zero-tolerance): Iran, Cuba, NK, Syria, Crimea, DNR/LNR
- Restricted (case-by-case): Russia, Belarus, China

## Product classification
| Component | ECCN candidate | Rationale |
|---|---|---|
| Web app (no crypto) | EAR99 | commercial software, no special control |
| End-to-end encryption (libsignal) | 5D002 | symmetric >64-bit |
| Mobile SDK | 5D002 | embeds crypto |
| Marketing site | EAR99 | static content |
| AI inference (Llama fine-tune) | EAR99 | model itself not on CCL (yet) |
| AI training pipeline (>10^25 FLOPs) | watch | proposed compute thresholds |

## Encryption obligations
- One-time BIS encryption registration: **filed YYYY-MM-DD** (or **TODO**)
- License exception used: **ENC §740.17(b)(1)** (publicly available source code) OR **ENC §740.17(b)(2)** (mass market)
- Registration form: SNAP-R online filing
- Open-source posting (if applicable): TSU §740.13(e) email notification to crypt@bis.doc.gov + enc@nsa.gov
- Annual self-classification report: removed 2021

## ITAR check
- USML categories: NONE applicable
- No defense articles, no satellite/space tech, no cryptanalytic tech (vs cryptographic — different USML XI)
- Verdict: **ITAR n/a**

## EU Dual-Use
- Annex I check: 5D002 mirror = Cat 5 Part 2 EU
- Cyber-surveillance items (recast): NONE
- Catch-all clause: monitor for human-rights end-use risk

## Sanctions screening workflow
| Stage | Tool | Cadence |
|---|---|---|
| Customer signup | ComplyAdvantage API | real-time |
| Re-screen existing | quarterly batch | quarterly |
| Employee/contractor onboarding | manual + ComplyAdvantage | per hire |
| Vendor/payment recipient | manual + tool | per payment |
| Ownership (50% rule) | KYC questionnaire | per customer |

## Geo-blocking
- IP geo-block (Cloudflare WAF rules): IR, CU, KP, SY, RU/Crimea, etc.
- Stripe/payment also enforces; defense in depth
- Notice on signup: "Service unavailable in [country]"
- Logged + reported quarterly

## Deemed export risk
- Foreign national engineers: <count> Russian-citizen on encryption code
- Mitigation: legal review of role + specific code access
- Cloud access tokens scoped per project
- GitHub repo access reviewed quarterly

## Effort + cost
| Activity | Cost | Cadence |
|---|--:|---|
| Encryption legal classification | $5k legal | one-time |
| BIS encryption registration | $0 (free filing) | one-time |
| Sanctions screening API | $5k–$15k/yr | continuous |
| Geo-blocking infra | included | continuous |
| Annual export compliance review | $5k legal | annual |
| Deemed-export employee review | $2k legal | per hire |
| **Total Y1** | **~$25k** | |

## Reporting obligations
- BIS one-time encryption registration: filed
- ENC §740.17(e) annual self-classification report: removed 2021 (n/a)
- BIS BAA (Boycott Anti-boycott): if doing biz with Arab League boycott of Israel — file quarterly
- AES (Automated Export System) filing: electronic > $2,500 export per SCH B
- Russia / Belarus reports if Annex VII items

## Risk if skip
- US criminal: up to $1M / 20 years per violation
- US civil: up to $328k or 2x value per violation
- EU: per Member State; up to ~€500k–€1M
- Denied parties listing
- Banking de-risk

## Adjacent regimes
- **CFIUS** — foreign investment review (if raising from non-US)
- **FOCI** — Foreign Ownership/Control/Influence (defense customers)
- **Commerce 232 / 301 tariffs** — different from export control
- **State Dept PM/DDTC** — ITAR commodity jurisdiction

## 90-day plan
1. Self-classification of all software components (week 1–2)
2. BIS encryption registration if 5D002 (week 2)
3. Engage sanctions screening vendor (week 2–4)
4. Geo-block deployment (week 3–4)
5. Customer KYC questionnaire (week 4–6)
6. Deemed-export legal review for foreign national engineers (week 6–8)
7. Annual compliance calendar drafted (week 8)
```

## Verification
- ECCN per software component declared.
- Encryption registration filed (if 5D002).
- Sanctions screening operational.
- Geo-blocking + payment-block layered.
- Deemed-export risk addressed for foreign nationals.
