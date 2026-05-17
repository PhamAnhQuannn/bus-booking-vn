---
name: investor-update-cadence
description: Investor update cadence — biweekly/monthly update template, highlights/metrics/asks/lowlights structure, open-rate tracking. Outputs to `docs/inception/investor-update-cadence-<project>.md`. Use when user says "investor update", "monthly update", "investor newsletter", "/investor-update-cadence", or post-raise.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /investor-update-cadence — Investors Who Know You Win. Silent Founders Die.

## Why you'd care

Founders who skip investor updates kill their option to ask for help later — investors disengage and the next bridge round becomes a cold pitch. The cadence keeps the door open without any new conversation.

Investor update = #1 leverage tool. Network help, follow-on dollars, hiring intros — all flow from steady cadence. Skip it = invisible at next raise.

## Pre-flight
Run after first investors closed. Pairs with `/kpi-dashboard-investors`, `/investor-crm-setup`.

## Inputs
- Closed investors + in-pipeline investors.
- KPI dashboard (MRR, growth, burn, runway).
- Current asks (hiring, intros, problems).
- Wins + losses since last update.

## Process
1. **Pick cadence:** monthly (default seed) or biweekly (during raise).
2. **Two lists:** closed (deep detail) + in-pipeline (lighter, no financials).
3. **Standard structure:** TL;DR → Metrics → Highlights → Lowlights → Asks → Hiring → Runway.
4. **Asks section = mandatory** — never skip, this is the leverage.
5. **Send via tool** — Visible / Foundersuite / Mailchimp / plain BCC. Track open rate.
6. **Reply to every response** within 24 hr.
7. **Archive** — searchable record for next raise narrative.

## Output
Write `docs/inception/investor-update-cadence-<project>.md`:

```markdown
# Investor Update Cadence — <project>
**Cadence:** monthly (1st of month)
**Tool:** <Visible / Foundersuite / Mailchimp / BCC>
**Distribution:** closed investors + advisors (deep), in-pipeline (lighter), team leads (FYI)

## Why bother
- Network effect: 30 investors × monthly ask = 30 free recruiters/intros/advisors
- Follow-on signal: investors fund momentum, hear it monthly
- Next-raise narrative: 12 months of updates = your raise deck pre-built
- Accountability: forced reflection sharpens prioritization

## Frequency tiers
| Recipient | Cadence | Detail |
|-----------|---------|--------|
| Closed investors | Monthly | Full update + financials |
| Advisors | Monthly | Same as closed |
| In-pipeline (post-meeting) | Monthly (lighter) | No financials, traction + asks |
| Customers (champions) | Quarterly | Wins + roadmap teaser |
| Team | Weekly all-hands | Internal version |

## Update template (closed investors)

```
Subject: <Co name> — <Month YYYY> Update

TL;DR (3 bullets max)
- ARR: $X (+Y% MoM)
- Closed <key win>
- Need help with <#1 ask>

Metrics
- ARR: $X (prev $Y, +Z%)
- MRR: $X
- New logos: N (prev M)
- Logo churn: N (prev M)
- NRR: X%
- Cash: $X
- Burn (net): $X/mo
- Runway: N months

Highlights
- <win 1 — be specific, name customers, quote numbers>
- <win 2>
- <win 3>

Lowlights (be honest — investors smell spin)
- <loss / missed target / hard problem>
- <what we learned + fix>

Asks (rank order — make easy to act on)
1. Intros to <specific persona> at <specific co type> — we're hiring <role>
2. Customer intro to <named company / persona>
3. Feedback on <specific decision> — replying directly works

Hiring
- Open: <role 1>, <role 2>
- Closed: <hire name + role + start date>
- JD links: <links>

Product (1-2 lines)
- Shipped: <feature>
- Next: <feature>

Customer love (1 quote)
> "<verbatim customer quote>" — <name, title, company>

Press / mentions
- <link 1>

Thanks
- <by name — investors who delivered intros / hires / customers this month>

— <Founder name>
```

## Update template (in-pipeline / not-yet-invested)
Drop: financials, burn, runway, cash, hiring detail.
Keep: ARR (or growth %), customer wins, product shipped, asks.
Tone: "we're winning, here's why" — not detailed reporting.

## Asks playbook
| Ask type | Phrasing | Why it works |
|----------|---------|--------------|
| Hire intro | "Know any <role> in <city>? Hiring." | Investors LOVE this — easy win |
| Customer intro | "Anyone at <named co> in <named team>?" | Specific = action |
| Feedback | "We're deciding between A and B — reply if you have a view" | Low-cost reply |
| Press | "Beat reporter at <publication>?" | Reusable network |
| Co-investor intro | "Closing extension — any <stage> funds love SMB SaaS?" | Pre-raise warm-up |

Never ask: "any help?" → vague = ignored.

## Lowlights handling
- Honest > spin. Investors respect blunt.
- Format: "What broke. Why. What we're doing."
- Bad lowlight: "had a rough month."
- Good lowlight: "Lost <Customer X> ($30k ARR). Cause: onboarding failure. Fix: shipped new onboarding, churned in cohort drops 40%."

## Open-rate tracking
| Tool | Tracks | Target open rate |
|------|--------|----------------|
| Visible | Yes | 70%+ |
| Foundersuite | Yes | 70%+ |
| Mailchimp | Yes | 60%+ |
| Plain BCC | No | — |

Low open rate = signal you're losing mindshare. Re-personalize subject line.

## Tone calibration
| Style | When |
|-------|------|
| Confident + specific | Default — name numbers, name people |
| Vulnerable | Lowlights only — don't over-share |
| Promotional / hype | Never. Investors detect. |
| Apologetic | Never. State facts. |

## Cadence discipline
- Send by 5th of month. Late = signal of disorganization.
- Skip a month = signal of trouble. Even bad updates beat silence.
- 12-month streak = top-decile founder behavior.

## Archive
- Save every update in `/investor-updates/YYYY-MM.md`
- Pre-raise: paste last 12 → instant traction narrative

## Pitfalls flagged
- [ ] Cadence picked + on calendar
- [ ] Two lists (closed vs in-pipeline)
- [ ] Asks section every update
- [ ] Lowlights honest
- [ ] Open-rate tracked
- [ ] Thanks-by-name section
- [ ] Archive folder live

## Anti-patterns
- ❌ Skipping months when news bad
- ❌ Vague asks ("any help?")
- ❌ No lowlights (suspicious)
- ❌ No customer quote (suspicious)
- ❌ No metrics (impossible to track momentum)
- ❌ Hype tone
- ❌ Sending pipeline investors confidential financials

## Next
- KPI dashboard → `/kpi-dashboard-investors`
- Reference prep → `/reference-call-prep`
- Diligence checklist → `/diligence-checklist`
```

## Verification
- Cadence picked.
- Two-list segmentation defined.
- Template covers metrics + asks + lowlights.
- Asks playbook concrete.
- Open-rate target set.
- Archive convention defined.
