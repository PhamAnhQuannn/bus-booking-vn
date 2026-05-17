---
name: investor-update-monthly
description: Monthly investor email template — TL;DR + metrics + good news + bad news + asks; cadence discipline; 80/20 good-to-bad balance; what NOT to include. Outputs to `docs/inception/investor-update-monthly-<project>.md`. Use when user says "monthly investor update", "investor email", "shareholder letter", "investor newsletter monthly", "Lemkin update", "Suster update", "/investor-update-monthly", or post-first-check / monthly cadence. Upstream: `/kpi-dashboard-investor-grade`, `/north-star-metric-pick`. Downstream: `/board-deck-template`, `/data-room-prep`.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 3h
  XL: 4h
---

# /investor-update-monthly — The Cheapest Compounding Asset You Own

## Why you'd care

Bad-news-buried or no-update-at-all is how founders surprise their investors and lose the supportive bridge round when they need it most. The 80/20 good-to-bad template trains the discipline to over-communicate before you need the favor.

Why you'd care: investors who don't get monthly updates won't write your follow-on, won't make intros, and won't fight for your pro-rata when the next round prices. Mark Suster (Upfront): "the investor update is the single most leveraged piece of writing a founder does." Jason Lemkin (SaaStr): "if your update is one paragraph longer than necessary, you've wasted the entire month." Skip the cadence and you become a name on a stale list. Send fluff and you teach your investors to ignore you. Both kill you slowly.

## Pre-flight
- Read `/kpi-dashboard-investor-grade` — the metrics block is sourced from there; don't redefine here.
- Read `/north-star-metric-pick` — your NSM headlines the TL;DR.
- Confirm a delivery tool: Visible, Foundersuite, Pulse, Mailchimp, or plain BCC. (Plain BCC is fine; no open-rate tracking is the cost.)

## Inputs
- This month's metrics (ARR, MRR, growth, burn, runway, NDR, logos in/out).
- 1–3 wins (named customers, named hires, shipped product, press).
- 1–3 losses or hard problems (named, with what-we-learned).
- 1–3 specific asks (hiring intros, customer intros, advice, co-investor intros).
- Investor distribution list — split into **closed** (full detail) and **pipeline** (lighter, no financials).

## Process

1. **Lock the cadence on the calendar.** Monthly is the default for seed/Series A. Biweekly during an active raise. Send within the first 5 business days of the month. The Suster rule: late update is worse than no update — late signals chaos. Calendar-block 90 minutes on the 1st of every month, recurring, sacred.

2. **Pick the template shape — Lemkin / Suster canon.** The proven structure:
   ```
   Subject: [Co] – <Month YYYY> Update
   TL;DR (3 bullets, ARR + #1 win + #1 ask)
   Metrics (table)
   Good news (3 bullets)
   Bad news / hard problems (1–3 bullets)
   Asks (numbered, specific)
   Hiring (open roles + recent hires)
   Product (1–2 lines)
   One customer quote
   Thanks (by name)
   ```
   That's it. Resist scope creep — additional sections train readers to skim. Suster: "your investor reads on their phone in 90 seconds."

3. **TL;DR discipline.** Three bullets. One must be the NSM with delta. One must name a single concrete win (customer name, product ship, hire). One must be the #1 ask. If you can't compress to three, you don't know what mattered this month.

4. **Metrics block — discipline over decoration.** Same metrics, same order, every month. Pull straight from `/kpi-dashboard-investor-grade`. Show prior-month and MoM delta. If a metric stops appearing one month, that *is* the story — investors will notice.

   Default closed-investor block:
   - ARR (and MoM %)
   - Net new ARR
   - Logos: new / churned / net
   - NDR (net dollar retention)
   - Cash on hand
   - Net burn
   - Runway (months)

   Pre-revenue swap-in: WAU, WAU/MAU, activation rate, waitlist size.

5. **Good news, named and specific.** "Closed Acme Corp ($48k ARR, 2-year)" beats "had a great month." Name the customer, dollar value, contract length. Name the hire and the role. Link the press piece. Concrete = credible.

6. **Bad news — the 80/20 honesty test.** Roughly 80% good / 20% bad is the calibrated mix; pure good news triggers spin-detector and erodes trust faster than the bad news ever would. Lemkin: "investors smell BS in two updates." Format for each bad item:
   - What broke (one line).
   - Why (one line).
   - What we're doing about it (one line).

   Example bad: "Lost Pied Piper ($24k ARR). Cause: integration failed during their migration, our side. Fix: shipped a re-attempt webhook and added a runbook for migrations — Acme migrated successfully two weeks later."

7. **Asks — numbered, specific, actionable.** The #1 reason investors skip your update is because asks are vague ("any help appreciated!"). Replace with:
   - "**1. Hiring:** intros to senior PM (5+ yrs B2B SaaS) in SF/NYC."
   - "**2. Customer intros:** anyone with a warm path to the VP of Ops at Snowflake, Databricks, or Datadog?"
   - "**3. Advice:** we're choosing between PLG and sales-led for Q3 — reply if you've shipped this trade-off."

   Three asks max. Vague asks teach investors that replying changes nothing.

8. **Two distribution lists, two templates.**

   | List | Get | Don't get |
   |---|---|---|
   | Closed investors + advisors | Full template, financials, runway | — |
   | Pipeline investors (post-meeting, not yet closed) | TL;DR, growth %, customer wins, asks | Cash, burn, runway, full metrics |

   Confidential financials going to people who didn't write a check = leak risk. The pipeline version is the same story, lighter detail.

9. **What NOT to include.** Be ruthless:
   - Product roadmap detail beyond 1–2 lines (becomes a backseat-driving session).
   - Org-chart drama, co-founder conflict, board politics (handle 1:1).
   - Cap-table changes without your lawyer's sign-off (you might trip securities-law disclosure).
   - Negative customer quotes (kept private).
   - Long forward-looking forecasts (you'll be held to them; investors price misses).
   - GIFs, memes, "vibes" copy. This is a financial document.

10. **The ask-response loop.** Every reply gets a 24-hour ack. Closed-loop the ask: "thanks for the intro — closed Acme this week, $48k ARR, your intro" in next month's Thanks-by-name. Investors who see their asks turn into ARR write second checks.

11. **Tracked + archived.** Visible / Foundersuite track open rate (target 70%+ on closed list). Plain BCC = no tracking but works. Archive every update to `/investor-updates/YYYY-MM.md` — at the next raise you paste the last 12 into a doc and that *is* your traction narrative. Suster: "the founder with 18 monthly updates archived raises 30% faster than the one without."

12. **Anti-patterns to forbid:**
    - Skipping a month "because nothing happened" — silence reads as trouble.
    - Skipping a month after a bad month — guaranteed to surface as "what are you hiding" at the next raise.
    - Asking "any help?" — vague = no replies = list rot.
    - One-line "Q3 forecast: $1M ARR" with no methodology — you'll be measured against it.
    - Different metric definitions month-to-month — instant credibility kill.
    - Sending the closed-investor version to pipeline investors — leak risk.
    - Using AI to write the whole update — investors can tell, and the asks become generic.

## Output

Write `docs/inception/investor-update-monthly-<project>.md`:

```markdown
# Monthly Investor Update — <project>
**Cadence:** monthly, 1st–5th business day
**Tool:** <Visible / Foundersuite / Mailchimp / BCC>
**Distribution:**
- Closed investors + advisors → full template
- Pipeline investors (post-meeting, not yet closed) → lighter template
**Archive:** `/investor-updates/YYYY-MM.md`

## Closed-investor template (copy into mail tool)

```
Subject: <Co> – <Month YYYY> Update

TL;DR
- ARR $<X> (+<Y>% MoM)
- <concrete win, named>
- <#1 ask, one line>

Metrics
| Metric | This month | Last month | Δ |
|---|---:|---:|---:|
| ARR | $<X> | $<Y> | +<Z>% |
| Net new ARR | $<X> | $<Y> | |
| New logos | <N> | <M> | |
| Churned logos | <N> | <M> | |
| NDR | <X>% | <Y>% | |
| Cash | $<X>M | $<Y>M | |
| Net burn | $<X>/mo | $<Y>/mo | |
| Runway | <N> months | <M> months | |

Good news
- <win 1 — named customer + $ + length>
- <win 2 — named hire + role + start date>
- <win 3 — shipped product or press, with link>

Bad news / hard problems
- <what broke>. Why: <one line>. Fix: <one line>.
- (1–3 items max)

Asks (rank order)
1. Hiring: intros to <specific role + geography + level>
2. Customer intros: warm path to <named persona at named co type>
3. Advice: <specific decision; reply directly works>

Hiring
- Open: <role 1>, <role 2> — JD links: <links>
- Closed: <name + role + start date>

Product
- Shipped: <feature, one line>
- Next: <feature, one line>

Customer love
> "<verbatim quote>" — <name, title, company>

Thanks
- <by name — investors who delivered intros, hires, or customers this month>

— <Founder>
```

## Pipeline-investor template

Drop from above: Cash, Net burn, Runway, Hiring detail (open roles only, no $).
Keep: ARR or growth %, customer wins, product shipped, asks.

## Cadence rules (sacred)
- 1st–5th business day of month. Late = chaos signal.
- 90 min calendar block on the 1st, recurring.
- Skip a month = explicit signal of trouble. Send even bad updates.
- 12-month archive = pre-built raise narrative.

## Good-to-bad balance
- ~80% good news / ~20% bad news / hard problems.
- Pure good = spin-flag. Pure bad = panic-flag.
- Format bad as What broke / Why / Fix.

## Asks discipline
- 3 asks max, numbered, specific.
- Never "any help?"
- Close the loop next month: "Thanks for the intro — closed last month."

## What NOT to include
- ❌ Detailed roadmap (1–2 lines max)
- ❌ Co-founder / board drama
- ❌ Cap-table changes (lawyer first)
- ❌ Negative customer quotes
- ❌ Long forward-looking forecasts
- ❌ GIFs / memes / "vibes" copy
- ❌ Confidential financials to pipeline list

## Open-rate target
- Closed list: ≥70% open. Below 50% = re-personalize subject line or your list is stale.
- Pipeline list: ≥40% open.

## Reply discipline
- 24-hour ack on every reply.
- Asks that turn into ARR → named in next Thanks block.

## Pitfalls flagged
- [ ] Calendar block locked
- [ ] Two-list segmentation defined
- [ ] Same metrics, same order, every month
- [ ] Bad news section has Why + Fix
- [ ] Asks numbered + specific
- [ ] Archive path live
- [ ] Open rate tracked

## References
- Metrics: `/kpi-dashboard-investor-grade`
- Quarterly version: `/board-deck-template`
- Diligence prep: `/data-room-prep`
```

## Verification
- One canonical template lives in the doc; copy-pasted into mail tool each month, not re-drafted.
- Metrics block pulls definitions verbatim from `/kpi-dashboard-investor-grade` — no drift.
- 80/20 good-to-bad balance present every month; pure-good months are flagged for review.
- Asks are numbered, specific, actionable — no "any help?" phrasing.
- Two list segmentation enforced (pipeline never gets cash / burn / runway).
- Archive folder `/investor-updates/YYYY-MM.md` exists and grows monthly.
- 24-hour reply ack discipline documented.
