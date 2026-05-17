---
name: distribution-advantage-audit
description: Audit founder's existing distribution edge — audience, network, niche credibility. Outputs to `docs/inception/distro-advantage-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "distribution advantage", "unfair distribution", "/distribution-advantage-audit", or before channel commit.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /distribution-advantage-audit — Unfair Distribution

## Why you'd care

Two founders ship near-identical products and one hits $10k MRR in month two while the other gives up at month nine — the difference is almost always distribution edge, not feature quality. Auditing the audience / network / niche-credibility the founder already has before committing to a channel strategy is what surfaces the unfair advantage (or its absence), and "we have no edge here" is a finding that should change which product gets built, not a hurdle to paper over with paid acquisition.

Invoke as `/distribution-advantage-audit`. No distro = no business. Founder edge usually = audience, network, or niche-cred.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP

## Inputs
- Founder's social handles + follower counts.
- Email list size + engagement (open/click rate).
- Communities founder has standing in.
- Network: angels/customers/influencers reachable.

## Process
1. **Inventory existing distribution** — quantify, don't estimate:
   - Twitter/X followers + median post engagement
   - LinkedIn connections + post reach
   - Newsletter subs + open rate
   - YouTube/Podcast audience
   - GitHub stars / OSS reputation
   - Speaking history (conferences, podcasts)
   - Insider access (mod / admin / advisor in communities)
2. **Reach math** — how many ICP-buyers can founder reach in 1 message?
3. **Trust premium** — does audience trust founder's recommendation? (proven by past launches/sales)
4. **Gap to "100 paying users"** — do you have reach to convert 100 from existing audience?
5. **Build plan if no edge** — 6–12 mo audience build before launch, OR pivot to channel that bypasses (paid ads, sales).

## Output
Write `docs/inception/distro-advantage-<project>.md`:

```markdown
# Distribution Advantage Audit — <project>
**Date:** <YYYY-MM-DD>

## Existing distribution inventory
| Channel | Reach | Engagement | ICP overlap % | Trust |
|---|--:|--:|--:|---|
| Twitter | 4200 | 2% median | 30% | high |
| Newsletter | 1800 | 42% open | 70% | very high |
| LinkedIn | 1200 | low | 20% | low |
| GitHub OSS | 800 stars | n/a | 50% | high |
| Podcast appearances | 6 | n/a | 60% | med |

## Total reach math
- Direct reachable ICP = ~1500 contacts
- 1-degree network ICP = ~5000 (warm intros)

## Past launch / sale evidence
- 2024 product X: 60 paid customers from audience in 30 days
- 2025 newsletter sponsorship: 28% click on referenced product

## Gap to launch goal
- Goal: 100 paid users at launch
- Current direct reach × historical 4% conversion = 60 paid
- **Gap: 40 paid users**
- Plug: PH + HN + cold outreach to close gap

## Verdict
**STRONG (existing edge gets to 100 paid alone) / PARTIAL (need supplementation) / NONE (must build audience first)**

## If NONE: 6-mo build plan
- Twitter: 1 thread/wk, target 5k → 10k
- Newsletter: weekly, target 500 → 2000
- 6 podcast appearances
- 1 conference talk
- Re-audit after 6 mo
```

## Verification
- Reach quantified (no "lots of followers" — actual numbers).
- ICP overlap % estimated per channel.
- Past launch evidence cited (or "never launched" admitted).
- Gap math vs concrete launch goal.
- NONE verdict triggers explicit build plan, not aspirational hand-wave.
