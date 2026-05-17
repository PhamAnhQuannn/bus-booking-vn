---
name: community-building-plan
description: Plan a community channel — platform pick, seed members, rituals, moderation, monetization path. Outputs to `docs/inception/community-plan-<project>.md`. Use when user says "community", "Discord", "Slack community", "user group", "/community-building-plan", or before launching a community channel.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /community-building-plan — Community Is A Channel, Not A Hobby

## Why you'd care

A community started without rituals, moderation rules, and a seed cohort dies in six weeks of crickets — and once it's a ghost town, you can't restart it under the same brand. Designing the channel before launching it is what makes the 12-18 month compounding payoff actually arrive.

Communities take 12-18 months to compound and 6 weeks to die from neglect. Plan rituals and moderation upfront.

## Pre-flight
Run after `/gtm-motion-pick`. Pairs with `/content-engine-plan`, `/customer-advisory-board`.

## Inputs
- Target audience + their existing watering holes.
- Why our community > existing options (the gap).
- Founder time available (community needs founder-presence early).
- Goal: top-of-funnel? retention? product feedback? all three?

## Process
1. **Platform pick:**
   - **Discord** — gamer/creator-friendly, real-time, casual
   - **Slack** — B2B / professional, but $$ at scale + threading pain
   - **Circle** — paid SaaS, professional, slow-burn discussions
   - **Reddit** — public discovery, low moderation control
   - **In-app** — full control, but no discovery
2. **Decision rule:**
   - B2C / creator / dev → Discord
   - B2B / ops / professional → Slack or Circle
   - SEO/discovery important → Reddit (or both Reddit + private)
3. **Seed before scale** — 50 hand-picked members > 5,000 randoms. Personally invite top 50.
4. **Rituals** (must have ≥ 3):
   - Weekly office hours (founder live)
   - Monthly AMA with guest
   - Show-and-tell channel (members share work)
   - Win-of-the-week thread
   - Onboarding bot greeting
5. **Moderation policy** — written code of conduct, 2-strike rule, banhammer reserved for spam/harassment.
6. **Channel structure** — start with 5 channels max. Don't over-architect.
7. **Growth loop** — content drives signups → signups drive community → community produces UGC → UGC drives content.
8. **Monetization path** — free forever / paid tier (Circle / Discord premium) / customer-only / advocate program.
9. **Kill rule** — 3 months in, < 30 weekly active members → pivot or close.

## Output
Write `docs/inception/community-plan-<project>.md`:

```markdown
# Community Plan — <project>
**Date:** <YYYY-MM-DD>
**Audience:** B2B ops leaders, 50-500 person co
**Goal (primary):** Product feedback + retention
**Goal (secondary):** Top-of-funnel discovery

## Platform pick
| Platform | Fit | Cost | Picked |
|----------|-----|------|--------|
| Slack | High (B2B audience lives here) | $$ at 250+ | ⭐ |
| Circle | High (paid model = serious members) | $89/mo + | — |
| Discord | Low (audience won't show up) | Free | — |
| Reddit | Medium (discovery only) | Free | — |

**Picked:** Slack (with Slack Connect for guest channels)
**Why:** Audience already lives in Slack daily; lowest friction

## Seed 50 (named list, not "we'll find them")
- 10 current customers
- 10 pilot users
- 10 founder network (operators in ICP)
- 10 from podcast network
- 10 referrals from above

## Rituals
| Ritual | Cadence | Owner | Time cost |
|--------|---------|-------|-----------|
| Founder office hours | Weekly Tues 11am | Founder B | 1 hr/wk |
| Monthly AMA w/ guest | First Thurs | Founder A + guest | 2 hr/mo |
| #wins-of-week thread | Weekly Fri auto | Bot + Founder A | 30 min/wk |
| Onboarding DM | On-join trigger | Bot | 0 |
| Roadmap-vote channel | Always-on | Founder A | 1 hr/wk |

## Channel structure (start)
1. #welcome (rules, intro template)
2. #general (catch-all)
3. #show-and-tell (UGC)
4. #feedback (feature requests + bugs)
5. #help (peer-to-peer support)

**Forbidden Week 1:** sub-channels by industry, region, role — premature

## Moderation
- Code of conduct: respect, no spam, no recruiting, no off-topic promo
- 2 strikes → kick
- Spam/harassment → instant ban
- 2 mods (founder + early advocate)
- Spam bot: Slackbot rules + manual sweep weekly

## Growth loop
```
Newsletter signup → community invite (50% conversion)
   ↓
Community member → UGC posts (Show-and-Tell)
   ↓
UGC → public content (with permission)
   ↓
Public content → newsletter signups
```

## Monetization path (12mo)
- Months 1-6: Free, all welcome
- Months 6-12: Customer-only deep channels (paid tier of platform)
- Month 12+: Optional paid community ($25/mo for masterclasses + private channel)

## Measurement
| Metric | M1 | M3 | M6 |
|--------|----|----|-----|
| Members | 50 | 200 | 500 |
| Weekly active | 30 | 80 | 150 |
| Posts/week | 20 | 80 | 250 |
| Demos sourced from community | 0 | 5 | 15 |
| Customers from community | 0 | 1 | 5 |

## Kill rule
- M3 < 30 WAU → close, redirect effort
- M6 < 80 WAU → consider downgrade (newsletter-only)

## Pitfalls flagged
- [ ] Platform matches audience (not founder preference)
- [ ] Seeded with 50 named humans (not "we'll find them")
- [ ] Rituals on calendar (not aspirational)
- [ ] Moderation policy written before launch
- [ ] Channel count ≤ 5 at start
- [ ] Founder time-budget honest (5-8 hrs/week minimum)
- [ ] Kill rule explicit

## Next
- Content feeds community → `/content-engine-plan`
- Customer advisory layer → `/customer-advisory-board`
- Advocate program → `/advocate-program-design`
```

## Verification
- Platform picked with rationale.
- Seed list of 50 named humans.
- ≥ 3 rituals on calendar.
- Moderation policy + 2 mods named.
- Growth loop diagrammed.
- Measurement + kill rule explicit.
