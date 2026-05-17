---
name: sequoia-deck-skeleton
description: Build pitch deck on Sequoia's 10-slide template — company purpose, problem, solution, why now, market size, competition, product, business model, team, financials. Outputs to `docs/inception/sequoia-deck-skeleton-<project>.md`. Use when user says "Sequoia deck", "pitch deck skeleton", "10-slide deck", "investor deck", "/sequoia-deck-skeleton", or pre-raise.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /sequoia-deck-skeleton — The 10-Slide Template That Actually Works

Sequoia's template survived because each slide answers exactly one investor question. Skip a slide → investor asks it anyway.

## Why you'd care

Investors expect to see 10 slides in roughly Sequoia's order — deviation costs cognitive load and signals "first-time founder." The skeleton meets the expectation so the content can break it.

## Pre-flight
Run after `/north-star-metric-pick`, `/tam-sam-som`, `/ltv-cac-model`. Pairs with `/pitch-deck-narrative`, `/one-pager-teaser`.

## Inputs
- Mission + 1-line product.
- Validated problem (customer interviews).
- TAM/SAM/SOM numbers.
- Traction (revenue / users / engagement).
- Team backgrounds.
- Use of funds + 18-mo plan.

## Process
1. **One slide = one question.** No combining. No exception slides for "context."
2. **Slide 1 — Company purpose.** One sentence, plain English. "We help X do Y so they can Z."
3. **Slide 2 — Problem.** The pain, not your product. Quantify ("companies lose $X/yr to this").
4. **Slide 3 — Solution.** What you built. One paragraph + screenshot.
5. **Slide 4 — Why now.** Why didn't this exist 5 years ago? Tech/market/regulatory shift.
6. **Slide 5 — Market size.** TAM/SAM/SOM bottom-up (not "1% of $Xbn TAM").
7. **Slide 6 — Competition.** 2x2 or grid. Honest. Show where you're weak too.
8. **Slide 7 — Product.** Demo screenshots, not feature list.
9. **Slide 8 — Business model.** Pricing, ACV, LTV:CAC, expansion.
10. **Slide 9 — Team.** Why you'll win — relevant unfair advantage.
11. **Slide 10 — Financials + ask.** Last 12mo / next 18mo / ask amount + use of funds.
12. **Appendix** — cohort retention curves, detailed competitive analysis, technical architecture.

## Output
Write `docs/inception/sequoia-deck-skeleton-<project>.md`:

```markdown
# Sequoia Deck Skeleton — <project>
**Date:** <YYYY-MM-DD>
**Round:** Pre-seed / Seed / Series A
**Ask:** $<amount> on $<post-money> cap

## Slide 1 — Company Purpose
**One sentence:** We help <ICP> <do X> so they can <outcome Y>.

Example: "We help SMB ecommerce ops teams automate returns so they can recover 30% more revenue."

## Slide 2 — Problem
**Headline:** <Pain in one line>

- Companies lose $<amount>/yr to <pain>
- Current solutions fail because <reason>
- Quote from customer: "<verbatim>"

## Slide 3 — Solution
**Headline:** <What we built in one line>

[Screenshot / hero image]

One paragraph: how it works, what makes it work.

## Slide 4 — Why Now
**Headline:** <What changed>

Three forces converging:
1. <Tech shift — e.g., LLMs got cheap>
2. <Market shift — e.g., remote-first ops>
3. <Regulatory / behavioral shift>

5 years ago = impossible. 5 years from now = obvious. Now = window.

## Slide 5 — Market Size
**Headline:** $<SOM> reachable in 3 years

| Layer | Size | How calculated |
|-------|------|----------------|
| TAM | $X bn | All <ICP segment> globally |
| SAM | $Y bn | English-speaking + cloud-native |
| SOM | $Z m | <obtainable in 3yr> |

Bottom-up math: <X companies> × <Y$ ACV> = $Z m

## Slide 6 — Competition
**Headline:** Why we win

| | Us | Competitor A | Competitor B | Incumbent |
|---|----|---|---|---|
| Speed to value | 1 day | 2 weeks | 1 month | 3 months |
| Pricing | $X | $5X | $10X | $50X |
| Self-serve | ✓ | ✗ | ✗ | ✗ |
| Best-in-class <feature> | ✓ | ✗ | ✓ | ✗ |

**Honest weakness:** <where we're behind>. **Why it doesn't matter yet:** <reason>.

## Slide 7 — Product
**Headline:** <Tag line>

- Screenshot 1: <main flow>
- Screenshot 2: <key differentiator>
- Screenshot 3: <wow moment>

(Demo video link in appendix)

## Slide 8 — Business Model
**Headline:** How we make money

- Pricing: $<X>/mo per seat OR % of GMV OR usage
- ACV: $<Y>
- LTV: $<Z>
- CAC: $<W>
- LTV:CAC: <ratio>
- Payback: <months>
- Gross margin: <X>%
- NDR: <X>% (if applicable)

## Slide 9 — Team
**Headline:** Why us

| Founder | Background | Unfair advantage |
|---------|-----------|------------------|
| <A> | <prior role> | <relevant edge> |
| <B> | <prior role> | <relevant edge> |

Advisors: <name>, <name>

## Slide 10 — Financials + Ask
**Headline:** Raise $<amount> to <unlock milestone>

**Last 12 months:** $<X> ARR, <Y> customers, growing <Z>% MoM
**Next 18 months:** $<X→Y> ARR plan, hit <key metric>
**Ask:** $<amount> at $<cap>

**Use of funds:**
- <X>% Engineering (2 hires)
- <Y>% Sales (1 hire)
- <Z>% Marketing
- <W>% Runway buffer

**Next milestone:** <what this round buys us — e.g., "$2M ARR + ready for Series A">

## Appendix (3-5 backup slides)
- Cohort retention curves (real screenshot)
- Detailed competitive feature matrix
- Technical architecture diagram
- Pricing rationale
- Customer testimonials (logos + quotes)

## Anti-patterns avoided
- ❌ Top-down TAM ("1% of $50bn market")
- ❌ Feature dump on solution slide
- ❌ Hiding weaknesses on competition slide
- ❌ Hockey-stick projections with no basis
- ❌ More than 10 main slides (use appendix)

## Pitfalls flagged
- [ ] One slide per question (no combining)
- [ ] Bottom-up TAM math
- [ ] Honest competition slide
- [ ] Real screenshots not mockups
- [ ] LTV:CAC + payback explicit
- [ ] Use of funds tied to milestone
- [ ] ≤ 10 main slides + appendix

## Next
- Narrative arc tightening → `/pitch-deck-narrative`
- One-page teaser → `/one-pager-teaser`
- Data room → `/data-room-bootstrap`
- Target investor list → `/investor-target-list`
```

## Verification
- 10 main slides (no more).
- Each slide answers one investor question.
- TAM bottom-up not top-down.
- Competition slide honest.
- Use of funds tied to next milestone.
- Appendix has cohort data + architecture.
