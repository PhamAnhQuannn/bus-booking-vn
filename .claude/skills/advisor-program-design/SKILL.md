---
name: advisor-program-design
description: Advisor program design — pick 3-5 advisors, define expectations, equity, cadence, kill clauses. Outputs to `docs/inception/advisor-program-design-<project>.md`. Use when user says "advisor program", "pick advisors", "advisor agreement", "FAST agreement", "advisor equity", "/advisor-program-design", or pre-seed.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /advisor-program-design — Advisors Without Asks Are Decoration. Pick 3, Use Them Weekly.

## Why you'd care

Advisor equity given without a usage plan is dilution for nothing. A designed program — cadence, scoped asks, kill clauses — turns 0.25-1.0% into actual customer intros and recruiting leverage instead of a pretty deck slide.

Most advisors are name-on-deck only. The 1-2 who actually help compound your odds. Design the program for usage, not vanity.

## Pre-flight
Run pre-seed or right after first investors close. Pairs with `/advisor-equity-grid`, `/mentor-circle-bootstrap`.

## Inputs
- Top 3 unknowns / gaps (sales motion / product / hiring / fundraise / domain).
- Names you already know who fit each gap.
- Stage + cap table headroom.

## Process
1. **Define 3-5 advisor roles** matching your top gaps (not "general advice").
2. **Source candidates** — operators > investors > academics.
3. **Trial 60-90 days** before formal agreement.
4. **Sign FAST or short-form advisor agreement** with vesting + kill clause.
5. **Set cadence per advisor** (monthly call / Slack on-demand / quarterly).
6. **Track value delivered** — intros made, calls taken, decisions changed.
7. **Cut non-performers at 6 months** — equity vests against contribution.

## Output
Write `docs/inception/advisor-program-design-<project>.md`:

```markdown
# Advisor Program Design — <project>
**Stage:** <pre-seed / seed / Series A>
**Advisor slots:** 3-5
**Equity budget:** 0.5-1.5% total

## Why advisors fail (and how to fix it)
| Failure | Fix |
|---------|-----|
| "General advice" — vague help | Define specific role + ask per advisor |
| Quarterly call, never used | Monthly ping + on-demand Slack |
| Equity vested for name on deck | Vesting against deliverables |
| 12 advisors, none lean in | 3-5 max, hand-picked |
| No expectations doc | 1-pager per advisor at signing |

## Role-driven slot map
Define gaps before names. Pick 1 per gap.

| Gap | Advisor type | Ask cadence |
|-----|--------------|-------------|
| Sales / GTM | Repeat VP Sales who scaled $0→$10M | Monthly call + deal review |
| Product / domain | Domain operator (ex-customer side) | Bi-weekly product call |
| Hiring | Repeat founder w/ network in your city | On-demand intros |
| Fundraise | Operator who raised your next round | Quarterly deck review |
| Technical / R&D | Senior eng at scale-up in your stack | On-demand Slack |

If a slot has no obvious gap, leave it unfilled. Empty slot > vanity advisor.

## Source funnel (in order)
1. **First-degree customers** — ones who get it best
2. **Repeat-founder peers** — same stage, 2 yrs ahead
3. **Ex-managers / ex-bosses** — already invested in you
4. **YC / accelerator network** — warm by default
5. **Cold ask via mutual** — only after 1-4 exhausted

Skip: investors-as-advisors (conflict + biased), big-name-only-on-deck.

## Trial period (60-90 days)
Before any equity grant:
- 3 working sessions
- 1 intro delivered
- 1 hard problem advised on
- They opt in, you opt in

Trial agreement = email memo, no equity, mutual right to walk.

## Formal agreement (FAST template)
Use the Founder Institute FAST template (Founder/Advisor Standard Template) — free, vetted.

Standard terms:
| Term | Value |
|------|-------|
| Equity | 0.1% - 0.5% per advisor |
| Vesting | 2 yr monthly, no cliff (or 1 yr cliff if pre-seed) |
| Acceleration | None (or single-trigger CoC for senior advisors) |
| Termination | Either party, 30 days, unvested forfeits |
| Confidentiality | Mutual NDA |
| IP | Anything created for co = co owns |
| Time commitment | 2-5 hrs/month |
| Term | 2 years renewable |

Levels by FAST grid (`/advisor-equity-grid`):
| Level | Time | Equity (idea) | Equity (startup) | Equity (growth) |
|-------|------|--------------|------------------|-----------------|
| Standard | <2 hr/mo | 0.25% | 0.20% | 0.15% |
| Strategic | 2-5 hr/mo | 0.50% | 0.40% | 0.30% |
| Expert | 5+ hr/mo | 1.00% | 0.80% | 0.60% |

## Per-advisor 1-pager (at signing)
```
# Advisor brief: <name>

## Why we picked you
- <gap they fill>
- <specific superpower>

## Role
- <e.g. GTM advisor — sales-led motion to first $1M ARR>

## Expectations
- Call cadence: <monthly / bi-weekly>
- Channel: <Slack + email>
- Response time: <48 hr>
- Sample asks: <intros, hire-screening, deal-review>

## Out of scope
- <e.g. day-to-day product calls>
- <e.g. fundraise — separate advisor for that>

## How we measure value
- 1+ intro / month
- 1+ decision changed / quarter
- Quarterly check-in: "is this working for both of us"

## Equity + agreement
- <0.25% / 0.50% / 1.00%>
- FAST 2-year monthly vesting
- 30-day mutual termination

## Communication
- Slack channel: #advisor-<name>
- Monthly recap email
- Quarterly metrics share
```

## Cadence template (per advisor)
| Cadence | What |
|---------|------|
| Slack | Async, on-demand |
| Monthly call | 30 min, agenda 24 hr ahead |
| Quarterly review | 60 min, metrics + asks |
| Annual offsite (optional) | Cohort dinner if multiple advisors |

## Tracking sheet
| Advisor | Joined | Equity | Cadence | Intros | Calls taken | Decisions changed | Vesting % | Status |
|---------|--------|--------|---------|--------|-------------|------------------|-----------|--------|
| <A> | 2026-02 | 0.25% | Monthly | 5 | 8 | 2 | 12% | Active |
| <B> | 2026-03 | 0.50% | Bi-weekly | 0 | 1 | 0 | 8% | At risk |

## Kill criteria (at 6-mo check)
- < 1 intro / quarter
- < 1 call / quarter
- No decision moved
- Not responsive on Slack
- Bad reference vibes

If 2+ of above → end agreement, unvested forfeits. Hard conversation, but mandatory.

## Advisor renewal
At 12 months:
- Working → 1-year extension, optional small top-up
- Not working → end, thank them, move on
- Default: end. Renew is opt-in not opt-out.

## Common pitfalls
- ❌ Big-name advisor who never responds
- ❌ Investor as advisor (conflict on next round)
- ❌ 8 advisors at 0.1% each = no one leans in
- ❌ No agreement (handshake fails at exit diligence)
- ❌ Vesting cliff longer than the trial period
- ❌ Equity without time commitment doc

## When NOT to add advisors
- Pre-product (idea stage): mentor circle instead, no equity
- Bootstrapped: pay cash for time, no equity
- Single domain: founders often need 1 advisor not 5

## Pitfalls flagged
- [ ] Role-driven slot map
- [ ] Trial before formal grant
- [ ] FAST agreement
- [ ] Cadence per advisor
- [ ] 1-pager brief per advisor
- [ ] Tracking sheet live
- [ ] Kill criteria defined

## Anti-patterns
- ❌ Decorative advisor (name only)
- ❌ Vague role
- ❌ No vesting
- ❌ No kill clause
- ❌ 10+ advisors
- ❌ Investors as advisors
- ❌ Equity grant before trial

## Next
- Equity grid → `/advisor-equity-grid`
- Mentor circle → `/mentor-circle-bootstrap`
- Customer advisory → `/customer-advisory-board`
```

## Verification
- 3-5 roles defined by gap.
- Trial-before-grant rule.
- FAST template referenced.
- Per-advisor 1-pager.
- Cadence + tracking sheet.
- Kill criteria.
