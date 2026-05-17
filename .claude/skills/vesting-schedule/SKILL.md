---
name: vesting-schedule
description: Vesting schedule design — 4-year + 1-year cliff baseline, acceleration (single/double trigger), 83(b) election, repurchase mechanics, founder vs employee variance. Outputs to `docs/inception/vesting-schedule-<project>.md`. Use when user says "vesting", "vesting schedule", "cliff", "83(b)", "acceleration", "vest", "/vesting-schedule", or before issuing first founder/employee equity.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /vesting-schedule — Vesting Is The Adult Conversation Founders Skip. Skip It Once, Pay For 10 Years.

Vesting transforms equity from a handshake into a structure that survives departure, conflict, divorce, and acquisition. No vesting = founder leaves day 90 holding 25% of the company forever. Standard is 4-year + 1-year cliff because investors will reset to that anyway — pre-empt the conversation and pre-empt the resentment.

## Why you'd care

Founders without vesting schedules end up in cap-table fights when one leaves early — the leaver takes the equity with them and the remaining founders dilute themselves to replace the work. Vesting is the prenup that prevents the divorce.

## Pre-flight
Run concurrently with `/founders-agreement` + `/jurisdiction-pick`. Must complete BEFORE issuing first stock grant. 83(b) election has a hard 30-day clock from grant date — miss it and pay tax on each vest tranche at then-FMV (potentially catastrophic).

## Inputs
- Founder count + capital structure.
- Expected first-priced-round timing (vesting reset risk).
- Founder tenure already served (credit for pre-incorporation work).
- Acquisition probability over next 5 years.
- Jurisdiction (US vs non-US treatment differs).

## Process
1. **Pick baseline schedule** — 4-year + 1-year cliff (default) vs variations.
2. **Pre-incorporation credit** — months of work before formation; common to credit up to 12 mo against cliff.
3. **Acceleration trigger** — single vs double on change-of-control.
4. **Repurchase right** — company option to buy back unvested shares on departure.
5. **83(b) election** — every founder files within 30 days of grant.
6. **Documentation** — Restricted Stock Purchase Agreement (RSPA) + 83(b) filing.
7. **Employee schedule** — typically same as founders (4-yr + 1-yr cliff).
8. **Refresh grants** — annual or milestone-based for retention.
9. **Departure mechanics** — coordinate with `/founders-agreement` good/bad-leaver.

## Output
Write `docs/inception/vesting-schedule-<project>.md`:

```markdown
# Vesting Schedule — <project>
**Date:** <YYYY-MM-DD>
**Owner:** counsel / founder
**Applies to:** founders + employees + advisors (separate sections)

## Why vesting before first grant
- No vesting → founder leaves with full equity → dead equity on cap table forever
- No cliff → 1-month-tenure founder takes 2% of co
- Investors will REQUIRE vesting at priced round → reset to 4-yr clock on top of work already done if unvested
- 83(b) miss → ordinary income tax on every vest tranche at FMV (death by tax)
- Acceleration terms decide outcome on acquisition — silence = standard = single trigger? Define it.
- Repurchase right gives the company a remedy when bad-leaver happens

## Founder vesting

### Baseline schedule
- **Total term:** 48 months
- **Cliff:** 12 months (no vesting before; 25% vests at month 12)
- **Post-cliff:** monthly vesting of remaining 75% over months 13-48 (1/48 per month after cliff)
- **Acceleration:** double-trigger (see below)
- **Repurchase right:** company has 90-day option to repurchase unvested shares at original purchase price on departure

### Variations + when to use

| Variation | Detail | When to use |
|-----------|--------|-------------|
| 4-yr + 1-yr cliff (default) | 25% at month 12, monthly thereafter | Default; what investors expect |
| 4-yr + 6-mo cliff | 12.5% at month 6, monthly thereafter | If high pre-incorporation trust + want faster ramp |
| 5-yr + 1-yr cliff | 20% at month 12, monthly thereafter | More patient capital; less common |
| 3-yr + no cliff | 1/36 monthly from day 1 | Rare; only for late-joining co-founder with proven track record |
| 4-yr + 1-yr cliff + 12-mo pre-incorp credit | Pre-incorp work counted toward cliff | Default if founders worked 6-12+ mo before formation |

**Pre-incorporation credit:** if founder worked N months before formation, credit min(N, 12) months against cliff. Example: 8-month pre-incorp work → cliff hit at month 4 post-incorporation.

**Our schedule:** <pick>
**Pre-incorp credit per founder:**
| Founder | Pre-incorp months credited |
|---------|---------------------------|
| <name> | <N> |

### Acceleration triggers

| Type | Definition | Recommendation |
|------|-----------|----------------|
| **None** | All unvested forfeit on acquisition | Founder-hostile; rare |
| **Single trigger** | All unvested accelerate on change of control | Investor-hostile; acquirers discount price |
| **Double trigger** | Accelerates on change-of-control + termination without cause within 12 mo of close | **Standard. Recommended.** |
| **Modified single trigger** | 25-50% accelerate on change-of-control, rest on termination | Compromise; sometimes used |

**Our acceleration:** double-trigger.

**Double-trigger mechanics:**
- Trigger 1: change of control (acquisition / IPO / merger)
- Trigger 2: founder terminated without cause OR resigns for good reason within 12 mo of trigger 1
- "Good reason" = material role demotion / >10% comp cut / forced relocation >50 mi
- Result: 100% of unvested accelerates immediately

### 83(b) election (US founders only — critical)

**What it is:** election under IRC §83(b) to pay tax NOW on the FMV of restricted stock at grant, rather than as it vests.

**Why mandatory:**
- At founding, stock FMV is ~$0 (or pennies)
- Founder pays tax on $0 today
- All future appreciation taxed as long-term capital gain (15-20%) on sale, not ordinary income (37%+) on vest
- Without 83(b): every vest tranche taxed as ordinary income at then-FMV. If company raises at $50M, founder vesting 25% gets a tax bill on $12.5M of "income" with no liquidity to pay it.

**Mechanics:**
1. Grant date = day of Restricted Stock Purchase Agreement signing.
2. File 83(b) within **30 calendar days** of grant date. NO extensions. NO grace period.
3. File method: certified mail with return receipt to IRS service center for founder's address.
4. File copy: founder's tax return for grant year (attach paper return OR include with e-filed via Form 8453).
5. File copy: company keeps in stock records.
6. Spouse signature required in community property states.

**Anti-pattern:** "I'll do it next week." Set calendar reminder day 1. Counsel files it. Day 30 = absolute deadline.

**If missed:** ordinary income tax on each vest tranche at then-FMV. Death by tax for any successful startup. No remedy except IRS late-filing relief which is rarely granted.

### Restricted Stock Purchase Agreement (RSPA)
- Founder "purchases" shares at par value ($0.0001-$0.00001 typical) on day 1
- Company has repurchase right on unvested portion at original purchase price
- Right lapses as shares vest
- Triggered by termination of service relationship

### Repurchase mechanics
- Company has 90-day option to repurchase unvested shares on founder departure
- Repurchase price = original purchase price (i.e., the par value the founder paid)
- Vested shares retained by founder (subject to ROFR + buy-sell in `/founders-agreement`)
- Treasury shares OR cancelled — typically cancelled to preserve option pool

## Employee vesting

### Baseline schedule (same as founders)
- 48-month vest
- 12-month cliff
- Monthly thereafter

### Differences from founders
- No pre-incorp credit (employees don't pre-exist company)
- Acceleration: **single-trigger acceleration uncommon for rank-and-file**; double-trigger for execs
- Refresh grants: typical at 18-24 months tenure (smaller, separate 4-yr clock starts)
- Departure handling per option plan + grant agreement

### Exercise window post-termination
- Standard: 90 days to exercise vested options
- Founder-friendly extension: 10 years (post-termination exercise) — gaining traction for ICs in 2020s
- Trade-off: ISO → NSO conversion if exercise window > 90 days (tax implications)
- Recommended: 90 days default + extension for >2 yr tenure

### Strike price + 409A
- Strike price for options = FMV at grant per 409A valuation
- See `/409a-precheck` — annual refresh OR on material event
- Mispriced strike = tax disaster for grantee + employer

## Advisor vesting

### Baseline
- 24-month vest
- 6-month cliff
- Monthly thereafter
- Acceleration: change-of-control single-trigger common (advisor not employee)
- Termination: vesting stops; vested portion retained
- Typical grant: 0.1-1% per advisor (see `/advisor-equity-grid`)

## Special situations

### Late-joining co-founder (post-incorporation)
- New 48-month clock from join date
- Cliff applies
- Possibly catch-up grant if joining within first 12 mo
- Coordinate with `/founders-agreement` amendment

### Founder departure during vest

| Scenario | Vested | Unvested |
|----------|--------|----------|
| Voluntary resignation pre-cliff | 0 | Forfeit |
| Voluntary resignation post-cliff | Retained | Forfeit |
| Fired for cause | Retained (subject to bad-leaver buyback at lower of cost/FMV) | Forfeit |
| Fired without cause | Retained + possibly accelerated | Per acceleration terms |
| Death / disability | To estate | Forfeit (life insurance funds gap — see `/insurance-policy-pick`) |
| Change of control + termination | Accelerated | Accelerated (double-trigger) |

### Vesting reset at first priced round
- Investors may require founder vesting reset to fresh 48-mo clock if founders are 1-2 yr in
- Or partial reset (e.g., 25% credited, 75% new vest)
- Pre-empt by having vesting in place from day 1 — strong negotiation position
- If reset proposed: insist on credit for tenure served + double-trigger acceleration

### Co-founder with full-time job elsewhere
- Vesting starts on full-time commitment, NOT on legal grant
- OR: lower equity at first, top-up grant when full-time
- Document clearly to avoid dispute

### Vesting + parental / medical leave
- Vesting CONTINUES during legally protected leave (FMLA, parental, disability)
- Pauses only for unpaid extended sabbatical or unrelated leave
- Document in plan + grant agreement

## Tax structure summary (US)

| Event | Tax treatment with 83(b) | Without 83(b) |
|-------|--------------------------|---------------|
| Grant | Ordinary income on (FMV − purchase price). Usually ~$0. | No tax event. |
| Vest | No tax event. | Ordinary income on (FMV at vest − purchase price). |
| Sale | Long-term cap gain if held >1 yr from grant. QSBS exclusion if §1202 conditions met. | Long-term cap gain if held >1 yr from vest. |

**QSBS (§1202) preservation:**
- Hold ≥5 years from grant (NOT vest)
- C-corp at grant
- Gross assets ≤$50M at grant
- Active business
- Exclusion up to $10M OR 10× basis, whichever greater
- Per-issuer + per-taxpayer
- See `/jurisdiction-pick` for context

## Non-US considerations

| Jurisdiction | Mechanism |
|--------------|-----------|
| UK | EMI options (favorable tax). Founder restricted stock similar via 431 election (file within 14 days). |
| Singapore | Stock options + ESOP common; no equivalent 83(b); tax on exercise. |
| Estonia | Stock options recognized; tax deferred to disposal if >3 yr hold from grant. |
| Canada | Stock option benefit taxed at exercise; 50% deduction if conditions met. |
| Germany | Phantom stock common due to tax complexity; real stock = exit-time taxable. |

**Engage local counsel for non-US founders/employees.**

## Documentation checklist
- [ ] Restricted Stock Purchase Agreement signed (founder grant)
- [ ] Stock certificate (electronic or paper) issued
- [ ] 83(b) election filed within 30 days (with proof: certified mail receipt + IRS-stamped return copy)
- [ ] Spouse signature on RSPA + 83(b) (community property states)
- [ ] Vesting schedule reflected in cap table tool (Carta / Pulley / AngelList Stack)
- [ ] Repurchase right documented in RSPA
- [ ] Acceleration terms documented in RSPA OR separate employment agreement
- [ ] Stock plan adopted by board (if applicable)
- [ ] First 409A valuation if granting options (see `/409a-precheck`)

## Cap table tool wiring
- Update Carta / Pulley / AngelList Stack with each grant
- Vesting schedule auto-tracked
- 83(b) status flagged per grant
- Acceleration terms in grant record
- Departure event triggers repurchase calc

## Anti-patterns
- ❌ No vesting on founder shares
- ❌ No cliff — founder leaves month 3 with 18.75% vested
- ❌ Missing 83(b) deadline (30 days, hard)
- ❌ "We'll fix it at first funding" — investors won't credit your tenure
- ❌ Single-trigger acceleration without acquirer carve-back — kills deals
- ❌ No repurchase right on departure — dead equity forever
- ❌ Vesting clock starts on join but no documentation — disputes
- ❌ Employee schedule diverges per hire without rationale
- ❌ Strike price set without 409A — IRS §409A penalty risk
- ❌ Vesting pauses during protected leave — legal risk
- ❌ Spouse signature missing in community property state

## Pre-launch checklist
- [ ] Founder schedule defined (48/12 default)
- [ ] Pre-incorp credit calculated
- [ ] Acceleration trigger picked (double-trigger default)
- [ ] Repurchase right written
- [ ] 83(b) filed by every founder within 30 days of grant
- [ ] Spouse signatures collected
- [ ] Cap table tool reflects schedule
- [ ] Employee schedule template ready
- [ ] Advisor schedule template ready
- [ ] Counsel reviewed

## Anti-patterns flagged
- ❌ Skip vesting / cliff / 83(b)
- ❌ Single trigger without carve-back
- ❌ Reset at first round without credit
- ❌ Repurchase right omitted
- ❌ Strike price without 409A

## Next
- Founders agreement (sits on top) → `/founders-agreement`
- 409A for option strike → `/409a-precheck`
- Cap table design → `/cap-table-design`
- Option pool sizing → `/option-pool-sizing`
- Equity philosophy for hires → `/equity-comp-philosophy`
```

## Verification
- Schedule + cliff defined.
- Pre-incorp credit per founder.
- Acceleration trigger picked (recommend double).
- 83(b) filed within 30 days (proof retained).
- Spouse signatures in community property states.
- Repurchase right documented.
- Cap table tool reflects schedule.
- Employee + advisor schedules templated.
- Counsel reviewed.
