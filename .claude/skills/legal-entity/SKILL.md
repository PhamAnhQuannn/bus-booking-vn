---
name: legal-entity
description: Pick legal entity — sole-prop / LLC / S-Corp / C-Corp / Ltd / B-Corp. Geo + funding-path driven. Outputs to `docs/inception/legal-entity-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "LLC", "C-Corp", "incorporate", "legal entity", "/legal-entity", or before contracts/funding.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /legal-entity — Entity Decision

## Why you'd care

Wrong entity choice (sole-prop for a fund-raising play, S-corp blocking foreign investors) is fatal to whichever path you wanted next. Geo + funding-path-driven choice up front avoids the conversion fees and timing pain later.

Invoke as `/legal-entity`. Wrong entity = tax pain or VC-blocked. Get right at start.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP (sole-prop default OK)
2. Read `docs/inception/funding-<project>.md` if exists.

## Inputs
- Geo (US state / UK / EU / other).
- Founder count.
- Funding path (per `/funding-strategy`).
- Liability exposure (B2B / B2C / regulated).

## Process
1. **Entity type matrix (US)**:
   - **Sole proprietor** — solo, no liability shield, pass-through tax. OK XS.
   - **LLC (single-member)** — solo, liability shield, pass-through. OK S/M.
   - **LLC (multi-member)** — partnership tax, complex if VC.
   - **S-Corp** — pass-through with payroll tax savings; ≤100 shareholders, US-only, no preferred stock.
   - **C-Corp (Delaware default)** — required for VC, double-taxed unless net-loss.
   - **B-Corp (benefit corp)** — for-profit + social mission, marketing benefit, similar tax to C/S-corp.
   - **PBC (Public Benefit Corp)** — Delaware version of B-Corp.
2. **Entity type (UK / EU)**:
   - UK: **Ltd** (private limited) — standard SaaS startup
   - UK: **LLP** — partnerships
   - DE: **GmbH** (€25k min capital), **UG** (€1 min)
   - EE: **OÜ** — popular for digital nomads (e-Residency)
3. **Decision triggers**:
   - VC-fund needed? → DE C-Corp (US) / Ltd (UK) / GmbH (DE)
   - Solo + lifestyle? → LLC / Ltd / OÜ
   - Multi-founder + bootstrap? → LLC + operating agreement
   - Mission-driven? → B-Corp / PBC variant
4. **Tax considerations**:
   - LLC → self-employment tax on all profit
   - S-Corp → split salary (FICA) + distribution (no FICA) — savings >$50k profit
   - C-Corp → 21% federal corporate + dividend tax (double tax) but losses flow upstream investors
5. **Geo / state choice**:
   - US: Delaware (most common for VC), Wyoming (privacy), home state (no tax difference if no DE office)
   - Foreign founder + remote: Stripe Atlas (DE), Estonia e-Residency (OÜ)
6. **Compliance overhead per entity** — annual filings, franchise tax, registered agent, 409A if options.
7. **Conversion path** — LLC → C-Corp later possible but tax-event if assets >threshold.

## Output
Write `docs/inception/legal-entity-<project>.md`:

```markdown
# Legal Entity — <project>
**Date:** <YYYY-MM-DD>

## Inputs
- Geo: <US / UK / EU / X>
- Founder count: <N>
- Funding path: <bootstrap / angel / VC>
- Liability exposure: <low / med / high>

## Entity comparison
| Entity | Liability | Tax | VC-ready | Setup cost | Annual cost |
|---|---|---|---|--:|--:|
| Sole prop | none | pass-through | no | $0 | $0 |
| LLC single-member | yes | pass-through | weak | $300 | $300 |
| S-Corp | yes | pass-through + payroll | no | $500 | $1500 (payroll +tax) |
| C-Corp (DE) | yes | corporate + double-tax | YES | $500 | $1000 (DE franchise + agent) |
| B-Corp / PBC (DE) | yes | corporate | yes (mission lens) | $700 | $1500 |

## Chosen entity
**<DE C-Corp / LLC / etc>**

## Rationale
- Geo: <X>
- Funding: <Y>
- Tax: <Z trade-off>
- Founder count: <N>

## Setup plan
- Service: <Stripe Atlas / Clerky / direct>
- State: <DE / WY / home>
- Cost: $<X>
- Timeline: <2 weeks>

## Post-incorp checklist
- ✓ EIN (US tax ID) — IRS, free, immediate
- ✓ Bank account (Mercury / Brex / Relay)
- ✓ Operating agreement / bylaws
- ✓ Stock issuance to founders (with 83(b) election within 30 days!)
- ✓ Cap table software (Carta / Pulley)
- ✓ Registered agent
- ✓ Annual filing calendar
- ✓ State foreign qualification (if doing business outside formation state)
- ✓ Sales tax registration (if applicable)

## 83(b) election (CRITICAL US C-Corp)
- File within 30 days of stock grant
- Sends notice to IRS that you choose to be taxed at grant (FMV ~$0) not vest
- Miss = pay tax on gains as shares vest = expensive

## Annual compliance calendar
| Item | When | Cost |
|---|---|--:|
| DE franchise tax | Mar 1 | $400 (assumed value method) |
| Annual report | Mar 1 | included |
| Federal tax return (1120) | Apr 15 | $1500 (CPA) |
| State income tax | varies | varies |
| 409A valuation (if options) | annually | $2000 |

## Conversion path (if change later)
- LLC → C-Corp: possible at fundraise (F-reorg or asset sale, tax-event >$X)
- S-Corp → C-Corp: file Form 8832
- Best: get right at start to avoid

## Anti-patterns
- ✗ LLC for VC fundraise (most VCs require C-Corp)
- ✗ Sole prop with B2B contracts (no liability shield)
- ✗ Forgot 83(b) (huge tax hit later)
- ✗ Home state when remote-first (no tax benefit, more compliance)
```

## Verification
- Entity matches funding path.
- 83(b) flagged for US C-Corp founder grants.
- Setup checklist complete.
- Annual calendar with costs.
- Anti-patterns explicit.
