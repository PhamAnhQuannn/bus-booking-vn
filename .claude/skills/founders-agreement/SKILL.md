---
name: founders-agreement
description: Founders agreement — equity split, vesting, roles, IP, departure (good/bad leaver), deadlock, drag/tag/ROFR, spouse waiver. Outputs to `docs/inception/founders-agreement-<project>.md`. Use when user says "founders agreement", "co-founder agreement", "equity split", "founder vesting", "/founders-agreement", or before first dollar of work between co-founders.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /founders-agreement — Handshake Equity Is The Most Expensive Mistake In Startup Law. Sign Before You Build.

## Why you'd care

Equity splits done on a napkin become the single largest source of co-founder lawsuits, and unvested cap-table chaos is fatal to any future raise. The agreement is cheap before the first dollar of work and ruinously expensive after.

The founders agreement isn't legal theater — it's the document that decides what happens when one of you leaves, dies, divorces, or sues. Sign it before you write code together, before you take a dollar of outside money, before the relationship has any value to fight over. Every week you delay raises the cost of the conversation.

## Pre-flight
Run within 30 days of co-founder commitment. Must be signed before incorporation OR concurrently with formation docs. Pairs with `/jurisdiction-pick`, `/vesting-schedule`, `/ip-assignment-agreement`, `/co-founder-prenup`, `/co-founder-fit-assessment`.

## Inputs
- Number of co-founders + role each.
- Time commitment per co-founder (full-time / part-time / nights+weekends).
- Capital contribution per co-founder (cash / equipment / pre-existing IP).
- Geography of each co-founder (jurisdiction-specific enforceability).
- Marital status + community property state (CA / WA / TX / AZ / NV / ID / LA / NM / WI).
- Pre-existing IP each co-founder brings.
- Outside obligations (current employer + IP-assignment clauses).

## Process
1. **Equity split** — pick model (equal / slicing-pie / negotiated / dynamic), document reasoning.
2. **Vesting** — 4-year with 1-year cliff baseline (see `/vesting-schedule`).
3. **Roles + titles + decision authority** — who decides what, what needs unanimity.
4. **IP assignment** — every co-founder assigns pre-existing + ongoing IP (see `/ip-assignment-agreement`).
5. **Departure scenarios** — good-leaver / bad-leaver / death / disability / termination.
6. **Buy-sell mechanics** — valuation method + payment terms for departing founder shares.
7. **Drag-along + tag-along + ROFR** — exit + transfer mechanics.
8. **Deadlock resolution** — Texas shootout / Russian roulette / mediation→arbitration.
9. **Spouse waiver** — community property states require spouse sign-off.
10. **Confidentiality + non-compete + non-solicit** — jurisdiction-aware scope.
11. **Future fundraise covenants** — agreement to negotiate in good faith on standard term sheets.
12. **Counsel review** — each founder ideally has separate counsel for adversarial review.

## Output
Write `docs/inception/founders-agreement-<project>.md`:

```markdown
# Founders Agreement — <project>
**Date:** <YYYY-MM-DD>
**Status:** draft / counsel-reviewed / signed
**Jurisdiction:** <DE C-corp / UK Ltd / etc.>
**Counsel:** <firm / solo lawyer / pro bono clinic>

## Parties
| Founder | Role | Title | FTE % | Cash in | Pre-existing IP |
|---------|------|-------|-------|---------|------------------|
| <name> | <CEO / CTO / etc.> | <title> | <100%> | <$X> | <list or "none"> |
| <name> | <role> | <title> | <%> | <$> | <list> |

## Why this exists pre-incorporation
- Equity disputes are the #1 startup-killer after no-market
- 1 day of delay = harder conversation; 1 week = lawyer needed; 1 year = lawsuit
- Vesting protects company from dead-equity founder departure
- Handshake equity has zero legal force when one founder leaves
- Spouse claim on shares is real risk in community-property states
- Verbal "we'll figure it out later" loses 100% of the time

## Equity split

### Model picked: <equal / slicing-pie / negotiated / dynamic>

**Final split:**
| Founder | Common shares | % |
|---------|---------------|---|
| <name> | <N> | <%> |
| <name> | <N> | <%> |
| Option pool | <N> | <%> |
| **Total** | <N> | 100% |

**Reasoning (1-2 paragraphs):**
<Cover: time commitment / domain expertise / capital / idea origin / risk taken / prior contribution. Why this split and not equal. What happens if reality diverges from assumptions.>

**Adjustment trigger:** <e.g., "if any co-founder drops below 80% FTE in first 12 mo, equity rebalances per slicing-pie formula" OR "no adjustment, locked at signing">

### Equity split decision frameworks (pick one + document)

| Model | How | Pros | Cons |
|-------|-----|------|------|
| **Equal** | 50/50 or 33/33/33 | Avoids friction now | Hides asymmetry; bad if commitment diverges |
| **Slicing-pie** | Dynamic based on cash + time + risk inputs | Self-correcting | Complex; needs trust to run honestly |
| **Negotiated** | Hard conversation: idea / domain / time / capital / risk weighted | Reflects reality | Painful negotiation; resentment risk |
| **Dynamic** | Initial split + re-vest at funding events | Adapts | Complex; investor confusion |

Default for 2-3 co-founders shipping together: **negotiated, with explicit reasoning written**.

## Vesting
- Standard: 4-year vest, 1-year cliff, monthly thereafter
- Cliff: 0% before 12 mo, 25% at 12 mo
- Acceleration: <none / single-trigger / double-trigger on change of control>
- Recommended: **double-trigger acceleration** (change of control + termination without cause within 12 mo)
- See `/vesting-schedule` for full mechanics

## Roles + titles + decision authority

| Decision class | Authority |
|----------------|-----------|
| Day-to-day operations | Role owner (CEO ops, CTO eng, etc.) |
| Hires up to $X salary | Role owner |
| Hires above $X salary | All founders consent |
| Fundraise terms | All founders consent |
| Product strategy | CEO with CTO consent for tech feasibility |
| Pricing changes | CEO + 1 co-founder |
| Selling the company | Unanimous founders + board if applicable |
| Issuing new equity | Board + unanimous founders |
| Taking on debt | Unanimous founders |
| Firing a co-founder | Board + remaining founders unanimous (excluding subject) |

**Tie-breaker for 2-founder co:** <CEO has casting vote / coin flip / mediator / dissolve> — pick one explicitly.

**Tie-breaker for 3+ founder co:** majority vote of founders.

## IP assignment
- Every founder signs separate IP assignment (see `/ip-assignment-agreement`)
- Pre-existing IP listed in Schedule A (carved out or assigned)
- Future IP during tenure auto-assigned to company
- Side projects: <permitted with disclosure / prohibited>
- Open source contributions: permitted but no company-confidential code

## Departure scenarios

### Good-leaver (resignation with notice / mutual termination / death / permanent disability)
- Vested shares retained
- Unvested shares forfeit
- 90-day exercise window for vested options (or extended per company policy)
- Company ROFR on vested shares at fair-market value
- Reasonable separation pay if mutually agreed

### Bad-leaver (termination for cause / breach / criminal conduct / failure to perform)
- Vested shares: company has 90-day buyback right at lower of cost or FMV
- Unvested shares: forfeit
- No accelerated vesting
- Definition of "cause":
  - Material breach of agreement
  - Conviction of felony / dishonesty crime
  - Gross negligence or willful misconduct
  - Repeated failure to perform after written notice + 30-day cure
  - Material violation of company policy
  - **Not** cause: poor performance alone, disagreement on strategy

### Death / disability
- Vested shares to estate / heir
- Unvested shares forfeit
- Company ROFR on shares at FMV (key-person insurance funds buyback — see `/insurance-policy-pick`)
- Continued health benefits for surviving spouse per policy

### Resignation without cause within first 12 mo
- Cliff means 0% vested → all shares forfeit
- Pre-cliff voluntary departure = strongest founder protection

### Founder fired without cause
- Vesting accelerates per agreement (double-trigger or single-trigger if defined)
- Vested shares retained
- Severance per separation policy
- ROFR on vested shares at FMV

## Buy-sell mechanics

### Valuation method (pick one)
- **Last 409A valuation** (default if recent)
- **Independent third-party appraisal** at company expense
- **Formula-based** (e.g., 5× trailing ARR) — flexibility limited
- **Negotiated in good faith with mediator backstop**

### Payment terms
- Cash at close: <%, e.g., 25%>
- Promissory note for balance: <3-year / 5-year> at <prime + 2%>
- Acceleration on company exit event
- Default remedies: shares revert if note defaulted

### ROFR (Right of First Refusal)
- Company has ROFR on any founder share transfer
- 30-day notice + 30-day exercise window
- If company declines, other founders have second ROFR
- If both decline, transfer permitted to third party at offered terms

## Drag-along
- Trigger: ≥<%, e.g., 60%> of common holders + board approve sale
- All founders obligated to vote in favor + sell on same terms
- Carve-outs: no personal liability beyond pro-rata escrow, no non-compete beyond mutual scope, no representations beyond ownership

## Tag-along
- If any founder sells to third party, other founders may tag pro-rata on same terms
- Protects minority from being squeezed out at majority's exit

## Deadlock resolution (2-founder companies critical)

### Tier 1: Cool-down + mediation
- 30-day cool-down before formal escalation
- Mediator (mutual selection or AAA) for 60 days
- Mediator non-binding recommendation

### Tier 2: Buy-sell shotgun (Texas shootout)
- Either founder names price + role (buyer or seller) at that price
- Other founder picks: buy at named price OR sell at named price
- Forces honest pricing
- 30-day execution

### Alternative: Russian roulette
- One founder offers to buy other at $X
- Other founder must accept OR buy offering founder at $X
- Forces same honesty, different psychology

### Tier 3: Binding arbitration
- AAA / JAMS commercial rules
- Single arbitrator
- Decision binding + non-appealable

### Tier 4: Dissolution
- Last resort: wind down + distribute assets pro-rata
- Both founders bound to non-compete for 12 mo post-dissolution

## Spouse waiver / community property
- Required in: CA, WA, TX, AZ, NV, ID, LA, NM, WI
- Each married founder's spouse signs waiver acknowledging:
  - Shares are separate property of founder (where law permits)
  - Spouse will not claim community interest in shares
  - On divorce, spouse retains right to economic value but not control
- Spouse counsel acknowledgment line
- Re-sign on re-marriage during tenure

## Confidentiality
- Indefinite obligation for trade secrets
- 5-year obligation for general confidential info
- Survives termination
- Carve-outs: publicly available, independently developed, lawful disclosure (subpoena)

## Non-compete (jurisdiction-aware)

| Jurisdiction | Enforceability |
|--------------|----------------|
| CA | Generally unenforceable (Bus & Prof Code §16600). Use non-solicit only. |
| FTC US (2024 rule) | Largely unenforceable nationwide for employees; founder/equity-holder carve-out may survive on sale. |
| UK | Enforceable if reasonable scope (≤12 mo + narrow geo) |
| DE | Enforceable if reasonable + supported by consideration |
| EU | Varies; generally requires comp during restriction |

**Approach:** narrow non-compete tied to sale-of-business carve-out (which remains enforceable post-FTC rule) + strong non-solicit + strong confidentiality. Don't rely on non-compete as primary protection.

## Non-solicit
- 12-month post-departure
- No solicitation of employees + customers + investors
- Generally enforceable across jurisdictions

## Future fundraise covenants
- All founders agree to negotiate in good faith on industry-standard term sheets (NVCA model docs as reference)
- No founder unilateral block on standard terms
- Drag-along covers acquisition exit
- Founder protective provisions: <list any minority protections>

## Pre-existing IP carve-outs (Schedule A)
| Founder | IP item | Description | Carved out OR assigned to company |
|---------|---------|-------------|-----------------------------------|
| <name> | <repo / patent / design> | <desc> | <choice> |

Default: carve out for clear pre-existing personal projects; assign anything used in or relevant to company business.

## Outside obligations disclosure
- Each founder discloses: current employer + employer IP-assignment clauses + non-compete + non-solicit + consulting clients + advisory roles
- Founder warrants no breach of prior obligations by joining company
- If current employer has broad IP-assignment, get written release before starting

## Anti-patterns
- ❌ Handshake equity without paper
- ❌ Equal split because "fairness" without acknowledging asymmetry
- ❌ No vesting → founder leaves day 90 with 25% of co
- ❌ No cliff → founder leaves day 30 with vested shares
- ❌ No buy-sell → ex-founder ghost shareholder forever
- ❌ No deadlock mechanism → 50/50 deadlock kills co
- ❌ "Bad-leaver" undefined → litigation theater
- ❌ No spouse waiver in community property state → divorce splits shares
- ❌ Non-compete written for CA → unenforceable
- ❌ No counsel review → unenforceable clauses everywhere
- ❌ Signing same lawyer for all founders → conflict of interest
- ❌ Delaying signing past first hire / first dollar of revenue

## Counsel review
- Each founder ideally retains separate counsel (or signed conflict waiver after independent review opportunity)
- Pro bono: incubator/accelerator legal clinics, Cooley GO, Wilson Sonsini Term Sheet Generator
- Paid: $3-10K for solid co-founder package (agreement + IP assignment + vesting + spouse waiver)
- Skipping counsel = single largest source of founder dispute litigation

## Signing logistics
- DocuSign / similar e-sign with KBA
- All founders + spouses (where applicable) sign same day
- Counterparts permitted
- Original PDF retained in data room (see `/data-room-bootstrap`)
- Re-execute if any material term renegotiated

## Updates
- Annual review: still reflects reality? Equity split still right?
- Update on: new founder added, founder departure, fundraise, exit prep
- Material amendments require unanimous founder + board consent

## Next
- Vesting → `/vesting-schedule`
- IP assignment → `/ip-assignment-agreement`
- Co-founder prenup (relational layer) → `/co-founder-prenup`
- Equity philosophy for hires → `/equity-comp-philosophy`
- Insurance for key-person buy-sell funding → `/insurance-policy-pick`
```

## Verification
- Equity split with written reasoning.
- Vesting + cliff + acceleration defined.
- Roles + decision authority matrix.
- Good-leaver + bad-leaver + death + disability + fired-without-cause covered.
- Buy-sell mechanics + valuation + payment terms.
- Drag + tag + ROFR mechanics.
- Deadlock resolution tiered (mediation → shootout → arbitration → dissolution).
- Spouse waiver in community property states.
- Non-compete jurisdiction-aware.
- Pre-existing IP carve-outs documented.
- Outside obligations disclosed.
- Counsel review (separate counsel per founder ideal).
