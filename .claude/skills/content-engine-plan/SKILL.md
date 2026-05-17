---
name: content-engine-plan
description: Design a sustainable content engine — pillars, cadence, channels, repurposing, SEO baseline. Outputs to `docs/inception/content-engine-<project>.md`. Use when user says "content marketing", "blog strategy", "SEO plan", "content calendar", "/content-engine-plan", or before committing to content as a channel.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /content-engine-plan — Compounding Distribution Or Nothing

## Why you'd care

A founder who publishes 40 random posts in their first year has 40 random posts; one who runs an actual engine has a compounding asset that sources pipeline at near-zero marginal cost. Pillars + cadence + repurposing is what separates a content channel from a content hobby — and the difference shows up in month 12, not month 2.

Content marketing is a 12-month bet. Random posts compound to nothing. Pillars + cadence + repurposing compound.

## Pre-flight
Run after `/gtm-motion-pick`, `/icp-and-buyer-personas`. Pairs with `/community-building-plan`, `/seo-keyword-baseline`.

## Inputs
- ICP (who reads).
- Buyer journey stages (awareness / consideration / decision).
- Existing content (audit before building).
- Team capacity (hours/week for content).
- Topic authority (what we can credibly write).

## Process
1. **Pick 3-5 content pillars** — themes tied to ICP pain. Not "marketing tips," but "B2B SaaS onboarding flows that convert."
2. **Pillar test:** each pillar must (a) have 50+ keyword volume, (b) tie to a paid feature, (c) be credibly owned by founders.
3. **Format mix:**
   - **Hero pieces** — 1-2/month, 2,000+ words, original research/data, ranks long-term
   - **Bread-and-butter** — weekly tactical posts, 800-1,500 words
   - **Atomic** — daily social posts repurposed from hero
4. **Cadence calendar** — month view, pillar-tagged, with owner + due date.
5. **Repurposing chain:** 1 hero → 1 LinkedIn article → 5 tweets → 1 newsletter → 1 YouTube short → 1 podcast clip.
6. **SEO baseline** — keyword research (Ahrefs/Semrush/free Google), pick 20 keywords, map to hero pieces.
7. **Distribution** — publish ≠ distribute. Each piece needs 3 channels (LinkedIn, newsletter, communities).
8. **Measurement** — leading: organic traffic, email signups from content. Lagging: pipeline sourced from content.
9. **Kill rule** — if 6 months in, organic traffic < 1,000/mo or 0 pipeline sourced, kill or pivot.

## Output
Write `docs/inception/content-engine-<project>.md`:

```markdown
# Content Engine Plan — <project>
**Date:** <YYYY-MM-DD>
**ICP:** <e.g., B2B ops leaders, 50-500 person co>
**Team capacity:** 10 hrs/week for content

## Content pillars
| Pillar | ICP pain solved | Paid feature tie | Keyword volume |
|--------|-----------------|------------------|----------------|
| Onboarding automation | New hire ramp time | Workflow templates | 2,400/mo |
| Async ops playbooks | Meeting overload | Async modules | 1,800/mo |
| Cross-functional rituals | Silos & handoffs | Cross-team views | 900/mo |

## Format mix
- 2 hero pieces/month (research, 2,000w+)
- 4 bread-and-butter/month (tactical, 1,000w)
- ~20 atomic/month (social repurposed)

## Q1 calendar
| Week | Hero | Bread-and-butter | Owner |
|------|------|------------------|-------|
| W1 | "State of onboarding 2026" (research) | "5 onboarding mistakes" | Founder A |
| W2 | — | "Async standup templates" | Founder B |
| W3 | — | "Manager checklist week 1" | Founder A |
| W4 | "Cross-team handoff teardown" | — | Founder B |

## Repurposing chain (per hero piece)
1. Hero blog post (2,000w) → published Day 0
2. LinkedIn article (excerpt) → Day 2
3. 5-tweet thread → Day 3
4. Newsletter (with PDF download) → Day 7
5. YouTube short (data visualized) → Day 10
6. Podcast guest pitch using same data → Day 14

## SEO baseline
- 20 target keywords mapped to hero pieces
- Each hero: ≥ 1 primary keyword + 3-5 supporting
- Internal link map: hero → bread-and-butter → product pages
- Page-speed budget: < 2s LCP

## Distribution per piece (always-on)
- Twitter / LinkedIn (founder personal + company)
- Newsletter (own list)
- 2 niche communities (relevant subreddit / Slack / Discord)
- 1 cross-post (Medium / dev.to / Indie Hackers — varies by piece)

## Measurement (90-day check)
| Metric | Baseline | Target |
|--------|----------|--------|
| Organic search visits | 0 | 1,500/mo |
| Email signups from content | 0 | 100/mo |
| Pipeline sourced (SQL) | 0 | 5/mo |
| Content-led demos booked | 0 | 3/mo |

## Kill rule
- 6 months in: < 1,000 organic visits/mo OR 0 pipeline → kill content as primary channel
- Pivot to community / paid / outbound (see `/gtm-motion-pick`)

## Pitfalls flagged
- [ ] Pillars tied to paid features (not vanity topics)
- [ ] Repurposing chain locked in (not ad hoc)
- [ ] Distribution ≥ creation time (50/50 split)
- [ ] Keyword research done (not just guessing)
- [ ] Kill rule explicit
- [ ] Founder voice retained (not generic SEO slop)

## Next
- Community pairing → `/community-building-plan`
- SEO depth → `/seo-keyword-baseline`
- Newsletter strategy → `/newsletter-plan`
```

## Verification
- 3-5 pillars tied to ICP + paid features.
- Format mix specified (hero / bread / atomic).
- Repurposing chain mapped.
- Distribution channels per piece.
- Measurement targets + kill rule.
