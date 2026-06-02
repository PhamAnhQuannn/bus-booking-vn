---
name: investor-update
description: Investor update system — pick a cadence (monthly default / biweekly during a raise), then the recipient-tiered template (TL;DR + metrics + highlights + lowlights + asks + hiring + product), 80/20 good-to-bad discipline, asks playbook, tone calibration, open-rate tracking, and what NOT to include. Outputs to `docs/inception/investor-update-<project>.md`. Use when user says "investor update", "monthly investor update", "biweekly update", "investor email", "shareholder letter", "investor newsletter", "Lemkin update", "Suster update", "/investor-update", or post-first-check / post-raise cadence. Upstream: `/kpi-dashboard-investor-grade`, `/north-star-metric-pick`, `/investor-crm-setup`. Downstream: `/board-deck-template`, `/data-room-prep`, `/reference-call-prep`, `/diligence-checklist`. Distinct from `/board-deck-template` (quarterly board governance, not the monthly email).
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 3h
  XL: 4h
---

# /investor-update — The Cheapest Compounding Asset You Own

## Why you'd care

Founders who skip investor updates kill their option to ask for help later — investors disengage and the next bridge round becomes a cold pitch. The cadence keeps the door open without any new conversation. Network help, follow-on dollars, hiring intros all flow from steady cadence; skip it and you become a name on a stale list.

Mark Suster (Upfront): "the investor update is the single most leveraged piece of writing a founder does." Jason Lemkin (SaaStr): "if your update is one paragraph longer than necessary, you've wasted the entire month." Send fluff and you teach your investors to ignore you; bury the bad news and you surface it as "what are you hiding" at the next raise. Both kill you slowly.

## Pre-flight
- Run after the first investors have closed (or during an active raise for the pipeline list).
- Read `/kpi-dashboard-investor-grade` — the metrics block is sourced from there; don't redefine here.
- Read `/north-star-metric-pick` — your NSM headlines the TL;DR.
- Pairs with `/investor-crm-setup` for the distribution list.
- Confirm a delivery tool: Visible, Foundersuite, Pulse, Mailchimp, or plain BCC. (Plain BCC is fine; no open-rate tracking is the cost.)

## Inputs
- This period's metrics (ARR, MRR, growth, burn, runway, NDR, logos in/out).
- 1–3 wins (named customers, named hires, shipped product, press).
- 1–3 losses or hard problems (named, with what-we-learned).
- 1–3 specific asks (hiring intros, customer intros, advice, co-investor intros).
- Investor distribution list — split into **closed** (full detail) and **pipeline** (lighter, no financials).

## Process

1. **Pick the cadence.** Monthly is the default for seed/Series A. Switch to **biweekly during an active raise**. Send within the first 5 business days of the period. The Suster rule: a late update is worse than no update — late signals chaos. Calendar-block 90 minutes on the 1st, recurring, sacred.

2. **Segment recipients into tiers.** Same story, different depth:

   | Recipient | Cadence | Detail |
   |-----------|---------|--------|
   | Closed investors | Monthly | Full update + financials |
   | Advisors | Monthly | Same as closed |
   | In-pipeline (post-meeting, not yet closed) | Monthly (lighter) | No financials — traction + asks |
   | Customers (champions) | Quarterly | Wins + roadmap teaser |
   | Team | Weekly all-hands | Internal version |

   Confidential financials going to people who didn't write a check = leak risk.

3. **Lock the template shape — Lemkin / Suster canon.** Resist scope creep; extra sections train readers to skim. Suster: "your investor reads on their phone in 90 seconds."
   ```
   Subject: [Co] – <Period> Update
   TL;DR (3 bullets: NSM/ARR + #1 win + #1 ask)
   Metrics (table)
   Highlights / Good news (3 bullets)
   Lowlights / Bad news (1–3 bullets)
   Asks (numbered, specific)
   Hiring (open roles + recent hires)
   Product (1–2 lines)
   One customer quote
   Thanks (by name)
   ```

4. **TL;DR discipline.** Three bullets. One = the NSM with delta. One = a single concrete win (customer name, product ship, hire). One = the #1 ask. If you can't compress to three, you don't know what mattered this period.

5. **Metrics block — discipline over decoration.** Same metrics, same order, every period. Pull straight from `/kpi-dashboard-investor-grade`. Show prior-period and delta. If a metric stops appearing, that *is* the story — investors notice.
   - Default closed block: ARR (+MoM %), Net new ARR, Logos (new/churned/net), NDR, Cash on hand, Net burn, Runway (months).
   - Pre-revenue swap-in: WAU, WAU/MAU, activation rate, waitlist size.

6. **Highlights — named and specific.** "Closed Acme Corp ($48k ARR, 2-year)" beats "had a great month." Name the customer, dollar value, contract length. Name the hire and role. Link the press piece. Concrete = credible.

7. **Lowlights — the 80/20 honesty test.** Roughly 80% good / 20% bad is the calibrated mix; pure good news triggers the spin-detector and erodes trust faster than the bad news ever would. Lemkin: "investors smell BS in two updates." Format each bad item as **What broke / Why / Fix**:
   > "Lost Pied Piper ($24k ARR). Cause: integration failed during their migration, our side. Fix: shipped a re-attempt webhook + a migration runbook — Acme migrated successfully two weeks later."

8. **Asks — numbered, specific, actionable.** The #1 reason investors skip your update is vague asks ("any help appreciated!"). Three max.

   | Ask type | Phrasing | Why it works |
   |----------|---------|--------------|
   | Hire intro | "Know any <role> in <city>? Hiring." | Easy win — investors love it |
   | Customer intro | "Anyone at <named co> in <named team>?" | Specific = action |
   | Feedback | "Deciding between A and B — reply if you have a view" | Low-cost reply |
   | Press | "Beat reporter at <publication>?" | Reusable network |
   | Co-investor intro | "Closing an extension — any <stage> funds love SMB SaaS?" | Pre-raise warm-up |

   Never "any help?" → vague = ignored.

9. **Tone calibration.**

   | Style | When |
   |-------|------|
   | Confident + specific | Default — name numbers, name people |
   | Vulnerable | Lowlights only — don't over-share |
   | Promotional / hype | Never. Investors detect it. |
   | Apologetic | Never. State facts. |

10. **What NOT to include.** Be ruthless:
    - Product roadmap detail beyond 1–2 lines (invites backseat driving).
    - Org-chart drama, co-founder conflict, board politics (handle 1:1).
    - Cap-table changes without your lawyer's sign-off (securities-law disclosure risk).
    - Negative customer quotes (kept private).
    - Long forward-looking forecasts (you'll be held to them; investors price misses).
    - GIFs, memes, "vibes" copy. This is a financial document.
    - AI-written whole updates — investors can tell, and the asks go generic.

11. **The ask-response loop.** Every reply gets a 24-hour ack. Close the loop next period: "thanks for the intro — closed Acme this week, $48k ARR, your intro" in the Thanks-by-name block. Investors who see their asks turn into ARR write second checks.

12. **Track + archive.** Visible / Foundersuite track open rate (target 70%+ closed, 40%+ pipeline). Plain BCC = no tracking but works. Archive every update to `/investor-updates/YYYY-MM.md` — at the next raise you paste the last 12 into a doc and that *is* your traction narrative. Suster: "the founder with 18 monthly updates archived raises 30% faster."

## Output

Write `docs/inception/investor-update-<project>.md`:

```markdown
# Investor Update — <project>
**Cadence:** monthly (1st–5th business day) — switch to biweekly during an active raise
**Tool:** <Visible / Foundersuite / Mailchimp / BCC>
**Distribution:**
- Closed investors + advisors → full template (financials)
- In-pipeline (post-meeting) → lighter template (no financials)
- Customers (champions) → quarterly, wins + roadmap teaser
**Archive:** `/investor-updates/YYYY-MM.md`

## Closed-investor template (copy into mail tool)

\```
Subject: <Co> – <Period> Update

TL;DR
- <NSM/ARR> $<X> (+<Y>% MoM)
- <concrete win, named>
- <#1 ask, one line>

Metrics
| Metric | This period | Last period | Δ |
|---|---:|---:|---:|
| ARR | $<X> | $<Y> | +<Z>% |
| Net new ARR | $<X> | $<Y> | |
| New logos | <N> | <M> | |
| Churned logos | <N> | <M> | |
| NDR | <X>% | <Y>% | |
| Cash | $<X>M | $<Y>M | |
| Net burn | $<X>/mo | $<Y>/mo | |
| Runway | <N> months | <M> months | |

Highlights
- <win 1 — named customer + $ + length>
- <win 2 — named hire + role + start date>
- <win 3 — shipped product or press, with link>

Lowlights / hard problems
- <what broke>. Why: <one line>. Fix: <one line>.
- (1–3 items max — be honest, investors smell spin)

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
- <by name — investors who delivered intros, hires, or customers this period>

— <Founder>
\```

## Pipeline-investor template
Drop: Cash, Net burn, Runway, hiring detail (open roles only, no $).
Keep: ARR or growth %, customer wins, product shipped, asks.
Tone: "we're winning, here's why" — not detailed reporting.

## Cadence rules (sacred)
- Send by the 5th of the period. Late = chaos signal.
- 90-min calendar block, recurring.
- Skip a period = explicit trouble signal. Send even bad updates.
- 12-month archive = pre-built raise narrative.

## Good-to-bad balance
- ~80% good / ~20% bad. Pure good = spin-flag. Pure bad = panic-flag.
- Format bad as What broke / Why / Fix.

## Open-rate targets
- Closed list ≥70% (below 50% = re-personalize subject or list is stale).
- Pipeline list ≥40%.

## Pitfalls flagged
- [ ] Cadence picked + on calendar
- [ ] Two-list segmentation defined
- [ ] Same metrics, same order, every period
- [ ] Lowlights have Why + Fix
- [ ] Asks numbered + specific (never "any help?")
- [ ] Thanks-by-name section
- [ ] Archive path live
- [ ] Open rate tracked

## References
- Metrics: `/kpi-dashboard-investor-grade`
- Quarterly board version: `/board-deck-template`
- Diligence prep: `/data-room-prep`, `/diligence-checklist`
- Reference calls: `/reference-call-prep`
```

## Verification
- One canonical template lives in the doc; copy-pasted into the mail tool each period, not re-drafted.
- Cadence picked (monthly default / biweekly during raise) and on the calendar.
- Metrics block pulls definitions verbatim from the KPI dashboard skill — no drift.
- 80/20 good-to-bad balance present every period; pure-good periods flagged for review.
- Asks are numbered, specific, actionable — no "any help?" phrasing.
- Recipient-tier segmentation enforced (pipeline never gets cash / burn / runway).
- Archive folder `/investor-updates/YYYY-MM.md` exists and grows each period.
- 24-hour reply-ack discipline documented.
