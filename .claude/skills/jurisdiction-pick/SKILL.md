---
name: jurisdiction-pick
description: Pre-incorporation jurisdiction pick — Delaware C-corp vs LLC vs S-corp vs UK Ltd vs Singapore Pte vs Estonia OÜ. Tax, investor preference, founder location, future fundraise plans. Outputs to `docs/inception/jurisdiction-pick-<project>.md`. Use when user says "incorporate", "Delaware", "C-corp", "LLC", "where to register", "jurisdiction", "/jurisdiction-pick", or before first formation.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /jurisdiction-pick — Wrong Jurisdiction = Tax Hit + Investor Friction + Six-Figure Cleanup. Pick Once, Pick Right.

## Why you'd care

Incorporating in the wrong state or country locks you into a tax structure and investor-friendliness regime that's expensive to unwind — Delaware-flip from an LLC two years in costs $20–50k and weeks. Pick once, before the first equity event.

Jurisdiction ≠ "where I live". Jurisdiction = where your company is incorporated, where it pays tax, what law governs disputes, and which investors will fund it. Picking wrong (LLC when raising VC, Delaware when bootstrapping cash-flow) costs $10K-100K+ to undo and weeks of legal time.

## Pre-flight
Run BEFORE incorporation. Pairs with `/legal-entity`, `/founders-agreement`, `/vesting-schedule`, `/bootstrap-vs-vc-decision`, `/tax-residency-design`.

## Inputs
- Founder location(s) — citizenship, tax residency, where work happens.
- Co-founder locations.
- Funding plan: bootstrap / angels / VC / family-office.
- Geography of customers (US-only / EU / global).
- Investor preferences (US VCs strongly prefer Delaware C-corp).
- Tax sensitivity (LLC pass-through vs C-corp double-taxation matters at exit).
- IP location and transfer (cross-border IP assignment = expensive).
- Time horizon (acquisition in 3-5 yr vs hold).

## Process
1. **Eliminate by funding plan** — VC-track narrows fast to Delaware C-corp.
2. **Eliminate by founder geography** — local-only operations rarely benefit from offshore.
3. **Compare top 3 candidates** — Delaware C-corp, LLC, founder's home country.
4. **Tax-modeling pass** — pass-through vs corporate vs treaty network.
5. **Investor preference check** — talk to 2-3 target investors before deciding.
6. **Counsel review** — international tax + corporate counsel for cross-border setups.
7. **Bank-account viability** — some jurisdictions = bank account hell (Delaware C-corp for non-US founders is a known pain).
8. **Document + commit.**

## Output
Write `docs/inception/jurisdiction-pick-<project>.md`:

```markdown
# Jurisdiction Pick — <project>
**Founder(s):** <names + locations>
**Date:** <YYYY-MM-DD>
**Counsel:** <name + jurisdiction expertise>

## Why this exists pre-incorporation
- Wrong-entity-type cleanup = $10K-100K + 3-6 mo of legal time
- Delaware C-corp is the de-facto US VC standard — anything else loses 80% of US VC checks
- LLCs pass through losses to founders (useful pre-revenue, painful after)
- Cross-border IP transfer triggers tax events
- Bank-account, payment-processor, and Stripe access varies wildly by jurisdiction
- "We'll fix it later" = death-by-tax-event

## Top contenders + when

| Jurisdiction | Entity type | Pick if |
|--------------|-------------|---------|
| **Delaware (US)** | C-corp | Raising VC. Period. Default for any startup planning institutional capital. |
| **Delaware (US)** | LLC | Bootstrapping, single founder, want pass-through, no VC. Convert to C-corp at $1-2M ARR or when raising. |
| **Wyoming (US)** | LLC | Bootstrapping with privacy / asset protection emphasis. Lower fees than DE. |
| **Home state (US)** | LLC/Corp | Pre-revenue, local services business, no out-of-state customers. |
| **UK Ltd** | private limited | UK-based founder + UK customer base + UK angels/EIS/SEIS. |
| **Singapore Pte Ltd** | private limited | SEA market, Singaporean founder, hub for ASEAN expansion, attractive tax. |
| **Estonia OÜ** | private limited | EU access + e-Residency + remote-first + tax deferred until distribution. |
| **Cayman / BVI** | exempt | Crypto / fund vehicles / specialized — high complexity, not for typical SaaS. |
| **Ireland / Netherlands** | Ltd / BV | IP-heavy + EU + treaty network — sophisticated tax planning. |

## Decision matrix

| Factor | Weight | Delaware C-corp | Delaware LLC | UK Ltd | Singapore Pte | Estonia OÜ |
|--------|--------|-----------------|--------------|--------|---------------|------------|
| US VC fundability | <high?> | 10 | 5 (convert needed) | 3 | 3 | 2 |
| Founder ease of access | | <> | <> | <> | <> | <> |
| Tax efficiency (pass-through / deferred) | | 3 | 9 | 5 | 7 | 9 (deferred) |
| Bank account / Stripe / processor | | 9 | 9 | 8 | 7 | 7 |
| Cost to form + maintain | | 7 | 9 | 6 | 5 | 8 |
| Exit-friendly | | 10 | 5 | 7 | 7 | 6 |
| Investor familiarity | | 10 | 7 | 7 | 6 | 4 |

Multiply weights × scores, pick top.

## Founder geography decision tree

**1 US-resident founder + raising VC:** Delaware C-corp. End of analysis.

**Multi-country founders + raising VC:** Delaware C-corp + worldwide IP assignment + counsel for tax-residency of holding co.

**1 non-US founder + bootstrapping:** home-country entity (UK Ltd / Sg Pte / Estonia OÜ / etc). Only flip to US C-corp when raising US VC.

**1 non-US founder + planning US VC:** Delaware C-corp via "Flip" — common path. Counsel mandatory. Tax-event risk for IP transfer.

**Solo founder, services biz, no fundraising:** home-state LLC or sole proprietorship until revenue justifies.

## Delaware C-corp pros / cons

**Pros:**
- US VC standard (90%+ of VC-backed startups)
- Court of Chancery — fast, expert corporate-law judges
- Well-trodden documents (SAFE, NVCA term sheet)
- Stripe Atlas / Clerky / Carta automate formation
- 83(b) election available for founder stock + early employees
- QSBS (Qualified Small Business Stock) exclusion up to $10M gain (US founders, hold 5+ yr)

**Cons:**
- Double-taxation (corporate tax + dividends) — irrelevant if no dividends
- Franchise tax: $400-200K/yr based on shares × asset value (use assumed par value method to minimize)
- Foreign founders: bank account is painful (Mercury / Brex / Wise help)
- Operating-out-of-California or other states requires foreign qualification + state tax

**Setup cost:** $500-2000 (Stripe Atlas $500, Clerky $1000, full-service law firm $2-5K)

## Delaware LLC pros / cons

**Pros:**
- Pass-through taxation (founder pays personal tax on income, no corporate layer)
- Operational flexibility (operating agreement freeform)
- Lower compliance than C-corp
- Better than C-corp for cash-flowing bootstrap businesses

**Cons:**
- VCs generally won't invest in LLCs (need pass-through losses, not what VCs want)
- Conversion to C-corp later = taxable event in some cases
- No QSBS
- Self-employment tax on member earnings (15.3% on top of income tax)
- Multi-member LLC = more complex tax filings (K-1s)

## UK Ltd pros / cons

**Pros:**
- SEIS / EIS scheme — UK angels get 50% / 30% income-tax relief, drives angel ecosystem
- Companies House = transparent, fast (24 hr formation)
- £40K SEIS limit per investee, £150K total — designed for early stage
- Strong tech ecosystem in London + Cambridge + Edinburgh

**Cons:**
- US VCs hesitant — flip-to-DE for Series A common (taxable)
- Director duties under Companies Act stricter than DE
- PAYE / National Insurance for employees adds admin

## Singapore Pte Ltd pros / cons

**Pros:**
- Corporate tax 17% (with exemptions, effective rate often < 10% in early years)
- Strong treaty network for cross-border
- Hub for SEA expansion (Indonesia, Vietnam, Philippines)
- IP-friendly + R&D tax credits

**Cons:**
- Resident director requirement (locals + nominee services exist)
- Audit threshold lower than US — annual audit can be needed
- US VCs less familiar (but Y Combinator + Sequoia SEA opens this)

## Estonia OÜ pros / cons

**Pros:**
- e-Residency — fully remote formation
- Corporate tax 0% on retained earnings (20% only on distributions)
- EU passporting for EU customers
- Low formation + maintenance cost

**Cons:**
- US VC totally unfamiliar; flip required for major fundraise
- Banking thin (LHV, Wise) — Stripe access limited
- Best as IP/holding entity, not operating co

## Tax considerations

### Double-taxation (C-corp specific)
- C-corp pays 21% federal + state (varies, DE has none for non-DE operations)
- Distributions taxed at shareholder's level (20% LTCG max for qualified dividends)
- Mitigation: don't distribute. Pay reasonable salary, retain earnings.
- Exit: capital gains on stock sale, QSBS exclusion up to $10M

### QSBS (Section 1202) — US C-corp only
- Hold C-corp stock 5+ years → exclude up to $10M OR 10× basis from federal tax
- Founders + early employees can qualify
- LOST if you flip from LLC to C-corp (clock restarts on flip)
- Strategy: form as C-corp from day 1 if planning long hold + exit

### Pass-through (LLC / S-corp)
- All profit/loss flows to owners' personal returns
- Early-stage losses offset other income (valuable pre-revenue)
- No corporate tax layer
- Self-employment tax adds 15.3% — S-corp election can save this

### S-corp election (US LLC + corp)
- Pass-through + can split income to "salary" (SE tax) + "distribution" (no SE tax)
- Limits: < 100 shareholders, US persons only, one class of stock
- INCOMPATIBLE with VC (VCs are LLCs / partnerships → not eligible S-corp shareholders)
- Use only for bootstrapping consultancies / cash-cow businesses

## Banking + payment access by jurisdiction

| Jurisdiction | Mercury | Brex | Wise | Stripe | Stripe Atlas formation |
|--------------|---------|------|------|--------|------------------------|
| Delaware (US founder) | ✅ | ✅ | ✅ | ✅ | N/A (already US) |
| Delaware (non-US founder) | ✅ | ⚠️ (depends) | ✅ | ✅ (post-EIN) | ✅ |
| UK Ltd | — | — | ✅ | ✅ | — |
| Singapore Pte | — | — | ✅ | ✅ | — |
| Estonia OÜ | — | — | ✅ | ⚠️ (limited) | — |
| Wyoming LLC | ✅ | ⚠️ | ✅ | ✅ | — |

**Critical:** if non-US founder, EIN takes 4-12 weeks. Mercury opens with EIN-in-progress; most US banks won't.

## State of operation vs state of incorporation (US-specific)

- Delaware incorporation does NOT mean you operate in Delaware
- If you have employees / office in CA / NY / TX → must register as "foreign corp" in operating state
- Operating state = where you pay state income tax + sales tax + employment tax
- Tax burden = operating state, not Delaware
- Delaware = corporate-law venue, not tax haven for operating cos

## Foreign qualification cost (US)
- $50-300 per state, annual
- Required if: employees / office / "doing business" in state
- "Doing business" varies — sales alone usually not enough (Wayfair changes this for sales tax)

## Common founder mistakes
1. **LLC for VC track** — VCs walk. Convert costs $5-20K + tax event.
2. **Forming in Wyoming for "privacy"** — privacy doesn't matter at $0 revenue. Pick fundraise-friendly.
3. **Foreign holding co without need** — IP-holding cos in Cayman / Bermuda only useful at scale + with specific tax-planning logic.
4. **Operating in CA but incorporated DE → not registering as foreign corp** — CA Franchise Tax Board catches you, $800/yr + penalties.
5. **C-corp from day 1 when no revenue + bootstrapping for 3 years** — pay $400/yr franchise tax + miss pass-through losses.
6. **Choosing based on Google search instead of talking to investors** — investor preference is the highest-signal input.

## Our pick

**Recommendation:** <Delaware C-corp / LLC / UK Ltd / etc>
**Why:**
- <factor 1>
- <factor 2>
- <factor 3>

**Counsel sign-off:** <name + date>
**Founder sign-off:** <names + date>

## Formation plan

**Steps:**
1. Reserve name (uniqueness check, trademark scan via `/trademark-pre-screen`)
2. Pick registered agent (Stripe Atlas / Northwest / Clerky / personal address NOT recommended)
3. File articles / certificate of incorporation
4. EIN application (US: SS-4 form, 4-12 weeks for non-residents)
5. Operating agreement (LLC) or Bylaws + initial board consent (corp)
6. Founder stock issuance + 83(b) election within 30 days (C-corp)
7. Vesting schedule per `/vesting-schedule`
8. IP assignment per `/ip-assignment-agreement`
9. Bank account
10. Payment processor onboarding

## Conversion paths (when current pick is wrong)

- LLC → C-corp: statutory conversion (DE supports) or merger; possible tax event; $5-15K legal
- UK Ltd → DE C-corp ("Flip"): share-for-share exchange; UK tax considerations + US 351 planning; $30-100K with counsel
- C-corp → LLC: rare, often F-reorganization; tax-complex; $20-50K
- Add holding co (e.g. Cayman parent of DE operating co): structural planning, $50K+

## Anti-patterns
- ❌ Forming before talking to target investors
- ❌ LLC when pursuing VC
- ❌ Wyoming "for privacy" with no privacy threat
- ❌ Skipping 83(b) election (founder stock = ordinary income event later, painful)
- ❌ Forming without operating agreement / bylaws
- ❌ Personal address as registered agent
- ❌ Not registering as foreign corp in operating state
- ❌ Forming in offshore jurisdiction without specific tax-planning reason
- ❌ Two co-founders = two entities (no — single co with cap table)
- ❌ Forming under spouse's name "for tax reasons" — fraud risk

## Pre-formation checklist
- [ ] Counsel engaged
- [ ] Investor preferences confirmed (2-3 target investors)
- [ ] Tax model run for top 2 options
- [ ] Bank-account viability confirmed for pick
- [ ] Registered agent chosen
- [ ] Name available (corp registry + trademark)
- [ ] Operating state registrations planned
- [ ] 83(b) election plan if C-corp
- [ ] Founder vesting drafted (`/vesting-schedule`)
- [ ] IP assignment drafted (`/ip-assignment-agreement`)

## Annual review
- Operating geography expanded? → new foreign qualifications?
- Tax rules changed? (TCJA-style shifts every few years in US)
- Funding plan changed? → convert?
- Founder location changed? → tax residency?

## Next
- Entity formation → `/legal-entity`
- Founders agreement → `/founders-agreement`
- Vesting schedule → `/vesting-schedule`
- IP assignment → `/ip-assignment-agreement`
- 409A → `/409a-precheck`
- Bank account → `/bank-account-setup`
```

## Verification
- Top 2-3 candidates evaluated against decision matrix.
- Investor preference confirmed.
- Tax model run.
- Counsel engaged.
- Banking viability confirmed.
- Conversion path documented if pick is interim.
- Formation plan complete with 83(b), IP, vesting placeholders.
