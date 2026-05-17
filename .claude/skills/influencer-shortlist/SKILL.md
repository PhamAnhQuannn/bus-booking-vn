---
name: influencer-shortlist
description: Shortlist creators / influencers / operators for paid + organic collaborations — fit, reach, engagement, brief, deal terms. Outputs to `docs/inception/influencer-shortlist-<project>.md`. Use when user says "influencer", "creator partnership", "sponsorship", "newsletter sponsor", "/influencer-shortlist", or before any creator deal.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /influencer-shortlist — Pick Creators With Trust, Not Just Reach

## Why you'd care

Most creator deals are signed on vibes and produce no measurable lift because the audience-fit was never checked. The shortlist forces a proof-backed fit + reach + engagement filter before the brief goes out.

A 5k-follower operator with 30% engagement beats a 200k-follower lifestyle creator with 0.5%. Match audience, not size.

## Pre-flight
Run after `/gtm-motion-pick`, `/icp-and-buyer-personas`. Pairs with `/content-engine-plan`, `/paid-channel-plan`.

## Inputs
- ICP — where do they spend attention?
- Budget (paid sponsorships) + capacity (organic outreach).
- Format mix (newsletter / YouTube / podcast / Twitter / TikTok / LinkedIn).
- Goal: awareness / signups / pipeline / brand association.

## Process
1. **Format-fit by ICP:**
   - B2B operators → newsletter + LinkedIn + podcast
   - Devs → YouTube + Twitter/X + dev.to / Hacker News
   - Designers → Twitter + Dribbble + podcast
   - SMB owners → YouTube + TikTok + niche FB groups
   - Consumer → TikTok + Instagram + YouTube
2. **Source the list:**
   - Audit which creators your customers already mention
   - Search "<ICP role> + creator/newsletter/podcast"
   - Sparktoro / Modash / Upfluence (paid tools)
   - Hand-curate from podcasts you listen to
3. **Score each creator:**
   - Audience fit (does their audience = our ICP?)
   - Engagement rate (likes/comments/views vs follower count)
   - Authenticity (does sponsor content feel native?)
   - Sponsor cadence (heavy sponsor load = low impact per slot)
   - Past sponsor results (ask other founders)
4. **Tier:**
   - **Mega** — 500k+ — expensive, low conversion, brand only
   - **Macro** — 50k-500k — good for brand + some conversion
   - **Mid** — 10k-50k — sweet spot for B2B
   - **Micro** — 1k-10k — high engagement, low cost
5. **Don't chase mega for performance** — they sell awareness not action.
6. **Brief template** — what they say (and what they don't). Hand them talking points, not scripts.
7. **Deal terms:**
   - Flat fee vs CPM vs CPA
   - Usage rights (can we re-cut for ads?)
   - Exclusivity (no competitor for 90 days?)
   - Disclosure (#ad / #sponsored — required by FTC)
   - Approval rights (don't over-control, kills authenticity)
8. **Track with UTMs + promo codes** — only way to measure.
9. **Pilot small first** — 1 micro + 1 mid → measure → scale winners.

## Output
Write `docs/inception/influencer-shortlist-<project>.md`:

```markdown
# Influencer Shortlist — <project>
**Date:** <YYYY-MM-DD>
**Goal:** Pipeline + signups (not just awareness)
**Budget Q2:** $25k

## Format fit (ICP = B2B ops leaders)
| Format | Fit | Notes |
|--------|-----|-------|
| Newsletter sponsorship | ⭐⭐⭐⭐⭐ | ICP reads operator newsletters |
| Podcast sponsorship | ⭐⭐⭐⭐ | High trust, lower reach |
| LinkedIn creator | ⭐⭐⭐⭐ | Where buyers actually scroll |
| YouTube | ⭐⭐⭐ | Mid-fit, longer cycle |
| Twitter/X | ⭐⭐ | Distributed, harder to attribute |
| TikTok | ⭐ | Audience mismatch |

## Tier 1 — Mid-influence newsletters/podcasts (sweet spot)
| Creator | Format | Audience | Engagement | Sponsor cost | Fit notes |
|---------|--------|----------|------------|--------------|-----------|
| Lenny Rachitsky | Newsletter | 500k subs | High | $25k/issue | High but proven for B2B SaaS |
| Anne-Laure Le Cunff | Newsletter | 60k | Very high | $3k/issue | ICP-perfect |
| Conor Bronsdon (Latent Space) | Podcast | 30k DLs | Very high | $5k/ep | Tech-ops adjacent |
| Aakash Gupta | LinkedIn | 100k followers | Very high | $5k/post | PM/ops creator |
| Pat Walls (Starter Story) | Newsletter | 250k | Mid | $8k/issue | SMB founder leaning |

## Tier 2 — Micro creators (high-trust, low cost)
| Creator | Format | Audience | Cost | Notes |
|---------|--------|----------|------|-------|
| <Operator on LinkedIn> | LinkedIn | 8k | $500-1k | Real practitioner, our customer's peer |
| <Niche podcast> | Podcast | 5k DLs | $1k | Deep audience |
| <Newsletter B> | Newsletter | 12k | $1.5k | Sleeper, high open rate |
| <Newsletter C> | Newsletter | 7k | $800 | New voice, hungry |

## Tier 3 — Organic / barter
| Creator | Ask | Offer |
|---------|-----|-------|
| <Operator> | Guest podcast on theirs | Co-content + cross-promo |
| <Newsletter> | Mention in our newsletter | Trade |
| <LinkedIn op> | Quote them in case study | Featured in our content |

## Pilot — Q2
| Creator | Spend | Format | Track | Expected signups |
|---------|-------|--------|-------|------------------|
| Anne-Laure | $3k | Newsletter sponsorship | promo code + UTM | 200 |
| Latent Space pod | $5k | Mid-roll | UTM + landing page | 100 |
| Micro LinkedIn op | $750 | Sponsored post | UTM | 50 |
| 1 organic podcast | $0 | Founder guest | UTM | 30 |

Total Q2 pilot: **$8,750 → ~380 signups target → ~$23 CAC** (vs paid avg $50)

## Brief template (per sponsor)
**To <creator>:**
- **Audience we serve:** <1 sentence>
- **Product 1-liner:** <1 sentence>
- **Why your audience cares:** <2 sentences specific to them>
- **Talking points** (use as YOU see fit, not script):
  - Point 1
  - Point 2
  - Point 3
- **What to avoid:** <specific to brand voice>
- **Tracking link / promo code:** [link]
- **Sample line (optional):** <one sentence they can riff on>

## Deal terms (default)
- Flat fee preferred (CPM unpredictable at this stage)
- Usage rights: 90 days re-use across our own channels
- Exclusivity: 30 days no direct competitor (in same week ideally)
- Disclosure: #ad / #sponsored — non-negotiable (FTC + reputation)
- Approval: high-level only (talking points), no script approval
- Payment: 50% on signature, 50% on delivery

## Anti-patterns
- ❌ Paying $25k for a "shoutout" without integration
- ❌ Scripts that strip the creator's voice
- ❌ No tracking link → no measurement → no learning
- ❌ Going mega for performance (use mid/micro)
- ❌ Sponsor where the audience doesn't match (vanity)
- ❌ Hidden sponsorship (FTC violation, ban risk)

## Measurement
- UTM per sponsor
- Promo code per sponsor (e.g., LENNY-200OFF)
- Track 30 days post-publish (most conversions happen within 14)
- LTV by sponsor channel after 90 days

## Scale rule
- If pilot CAC < $40 → 2x spend with that creator next Q
- If CAC > $80 → drop
- If CAC $40-80 → run once more, decide

## Pitfalls flagged
- [ ] Audience fit > follower count
- [ ] Engagement rate inspected (not just follower count)
- [ ] Tier mix (mid + micro, no mega for performance)
- [ ] Brief leaves creator voice intact
- [ ] FTC disclosure required
- [ ] Tracking baked in (UTM + promo code)
- [ ] Scale rule before locking long-term deals

## Next
- Paid channel optimization → `/paid-channel-plan`
- Content sync → `/content-engine-plan`
- Press companion → `/press-list-build`
- Advocate program (turn customers into creators) → `/advocate-program-design`
```

## Verification
- Format fit explicitly tied to ICP.
- Each creator scored on fit + engagement (not just reach).
- Tier mix favors mid + micro.
- Brief template preserves creator voice.
- Deal terms with FTC disclosure + tracking.
- Pilot with measurement → scale rule.
