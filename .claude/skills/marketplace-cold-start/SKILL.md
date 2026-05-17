---
name: marketplace-cold-start
description: Chicken-and-egg solutions for two-sided / multi-sided marketplaces — single-sided seed, geographic scope-down, fake-supply, vertical-narrow, ghost-listings, hard-side-first prioritization. Outputs to `docs/inception/cold-start-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "marketplace", "two-sided", "platform", "supply-side", "demand-side", "chicken and egg", "cold start", "/marketplace-cold-start", or before launching a marketplace MVP.
output_size:
  XS: skip
  S: 1h
  M: 4h
  L: 6h
  XL: 8h
---

# /marketplace-cold-start — Chicken-and-Egg Solver

## Why you'd care

Marketplace cold-start failure is the modal outcome — without a deliberate seed strategy you have empty supply and empty demand looking at each other. The decision between fake-supply, single-side seed, and hard-side-first determines whether you get a flywheel.

Invoke as `/marketplace-cold-start`. Required for any two-sided / multi-sided marketplace before MVP build. Anchored on Sangeet Choudary's *Platform Scale* (hook/magnet/toolbox), Andrew Chen's "cold start problem" (atomic network), and Bill Gurley's marketplace essays.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP (single-sided products don't need this)
2. Read `docs/inception/business-model-canvas-deep-<project>.md` (if exists).
3. Read `docs/inception/jtbd-<project>.md` (if exists).
4. Read `docs/inception/ideal-customer-profile-<project>.md` (if exists).

## Inputs
- Which sides? (e.g., riders ↔ drivers; guests ↔ hosts; buyers ↔ sellers; patients ↔ clinicians)
- Which is the **hard side** (constrained, slow-to-recruit, picky)?
- Which is the **easy side** (acquirable with paid marketing or content)?
- Atomic-network definition: what's the smallest viable cluster? (geography? vertical? school? building?)
- Existing single-sided product or asset you can leverage?
- Budget for paid supply seeding ($)?

## Process
1. **Identify the hard side**: by Andrew Chen's framing — usually the side that produces value, takes time to onboard, has fewer instances. Examples:
   - Uber → drivers (hard) vs riders (easy)
   - Airbnb → hosts (hard) vs guests (easy)
   - DoorDash → restaurants (hard initially, then drivers became hard) vs eaters (easy)
   - Substack → writers (hard) vs readers (easy)
   - OnlyFans → creators (hard) vs subscribers (easy)
2. **Choose a cold-start tactic** (pick 1–3, not 5):
   - **Single-sided utility / "come for the tool, stay for the network"** (Choudary's toolbox): OpenTable started as a restaurant SaaS for reservations, then layered consumers on top. Dropbox = file sync first, sharing second. Pinterest = personal scrapbook first.
   - **Geographic scope-down (atomic network)**: Uber launched in SF only; Airbnb in NYC for the DNC; DoorDash in Palo Alto around Stanford. Pick a single zip/campus/hex/borough that satisfies liquidity locally.
   - **Vertical-narrow**: Fiverr started with $5 gigs; Etsy started with handmade craft; TaskRabbit started with errands in Boston. Niche so deep there's no other competitor.
   - **Fake supply / Wizard-of-Oz**: Reddit seeded with sockpuppet accounts for 6 months. Bumble seeded profiles. Match.com ran sockpuppets. Ethical line: must convert to real before paid users arrive.
   - **Ghost listings / scraped inventory**: Airbnb scraped Craigslist; Yelp scraped local newspapers; Indeed scraped job boards. Ethical risk + ToS risk.
   - **Subsidize the hard side** (incentives): Uber's driver guarantees ($30/hr regardless of rides early on). DoorDash paid restaurants directly to list. Substack paid advances to top writers. Burn rate increases.
   - **Demand commitment first (pre-sell)**: Kickstarter / waitlist demonstrates demand to recruit supply. Beachhead "we have 500 buyers waiting" pitch to suppliers.
   - **Big-bang launch via media** (rare; risky): Product Hunt / TechCrunch / Times piece. Only works if both sides can be activated same day (high friction = burnout).
3. **Pick liquidity target** (single number to obsess over):
   - Marketplace fitness = ratio of completed transactions to listing-attempts/search-attempts.
   - Target: ≥30–50% search → contact, ≥40–60% contact → booking within 24h, ≥70% bookings completed.
4. **Define atomic network**: smallest unit where both sides see value. Examples:
   - Tinder → single college campus (1k users)
   - Nextdoor → single neighborhood (~500 households)
   - Uber → single airport + downtown SF
   - Faire → 50 makers + 200 retailers in one region
5. **Decide subsidize direction**: usually subsidize the hard side. Track burn per acquired-and-retained supplier. Plan exit (when do subsidies sunset? at what GMV?).
6. **Anti-patterns to avoid**:
   - Subsidizing both sides indefinitely (Webvan, Homejoy, Sidecar)
   - Going national too early (DoorDash almost died this way before geo discipline)
   - Optimizing demand growth when supply is thin (creates fail rate, kills demand cohort)
   - Mistaking the easy side for the hard side (Quibi spent on creators when consumers were the gap)
7. **Liquidity tipping criteria** to expand to next atomic network:
   - ≥40% supply utilization weekly in current geo
   - ≥80% demand fill within 24h
   - ≥50% supplier 30-day retention
   - Organic word-of-mouth coefficient ≥0.4

## Output
Write `docs/inception/cold-start-<project>.md`:

```markdown
# Marketplace Cold-Start Plan — <project>
**Date:** 2026-05-13

## Marketplace shape
- **Sides:** <Side A> ↔ <Side B>
- **Multi-sided?** No (or: yes — add Side C role)
- **Transaction:** <what gets exchanged>
- **Unit of value:** <booking | message | order | session>

## Hard side analysis
| Side | Acquisition cost | Onboarding friction | Picky? | Verdict |
|---|--:|---|:--:|---|
| Hosts | $400 CAC est. | 3-day approval, photos, calendar | yes | **HARD** |
| Guests | $20 CAC paid | self-serve signup | no | easy |

**Hard side = Hosts.** Strategy must over-index on host recruitment 6–12 months.

## Atomic network definition
- **Geography:** ZIP 94110 (SF Mission) + 4 adjacent ZIPs
- **Vertical:** short-term stays for business travelers <$200/night
- **Minimum density:** 200 hosts + 1,000 guests in radius
- **Time-to-density target:** 90 days

## Chosen cold-start tactics (ranked)
1. **Geographic scope-down** — SF Mission only Q1; expand 1 borough/quarter.
2. **Subsidize hosts** — first 100 hosts get $500 onboarding bonus + 0% take rate for 90 days.
3. **Vertical narrow** — business travel only (not vacation, not long-stay) for first 6 months.

## Comparator playbook
| Company | Hard side | Atomic network | Cold-start tactic |
|---|---|---|---|
| Uber | drivers | SF airport + downtown | $30/hr driver guarantee |
| Airbnb | hosts | NYC during 2008 DNC | scraped Craigslist + pro photographers |
| DoorDash | restaurants → drivers | Palo Alto + Stanford | founder-delivered orders, paid restaurants directly |
| TaskRabbit | taskers | Boston errands | concierge MVP, founder did tasks |
| Etsy | sellers | handmade craft niche | community-led, no paid seller acq for years |
| OpenTable | restaurants | SF + NYC | SaaS tool first (toolbox), network later |
| Substack | writers | 10 hand-picked names | paid advances ($5k–$50k) to anchor writers |
| Fiverr | sellers | $5 micro-gigs | absurdly narrow vertical pricing |

## Liquidity targets (90-day)
| Metric | Target | Tripwire (kill or pivot) |
|---|--:|--:|
| Supply utilization (% supply units booked weekly) | ≥40% | <20% at d60 |
| Demand fill rate (% requests booked <24h) | ≥80% | <50% at d60 |
| Supplier 30-day retention | ≥50% | <30% |
| Buyer repeat rate (90-day) | ≥30% | <15% |
| Time-to-first-booking (new buyer) | <72h median | >7d |
| Time-to-first-booking (new supplier) | <14d median | >30d |
| Subsidy burn per active supplier | <$100/mo | >$300/mo |

## Subsidy economics
- Host bonus: $500 × 100 hosts = $50k cap
- Lost take-rate (90d, 0% vs 15% target): est. $30k forgone revenue
- Total cold-start subsidy budget: **$80k Q1**
- Exit trigger: when local utilization hits 40% for 2 consecutive weeks, sunset bonuses for new hosts in that ZIP

## Hard-side recruitment funnel
1. Source: BiggerPockets host community, local FB groups, real-estate meetups
2. Outreach: founder-led DMs first 50 hosts; then SDR for next 50
3. Activation: 1:1 onboarding call + pro photographer paid by us
4. Retention: weekly check-in calls until 5+ bookings completed

## Demand-side activation
- Channel: niche business-travel newsletters, corporate travel managers
- Hold demand back if supply <100 hosts (waitlist) — avoid fail rate

## Expansion gate
Do not expand to next ZIP until:
- [ ] All 7 liquidity targets green for 2 consecutive weeks
- [ ] Word-of-mouth coefficient ≥0.4 (≥40% of new hosts cite "a friend told me")
- [ ] Unit economics positive ex-subsidy (contribution margin >0)

## Anti-patterns we will NOT do
- Subsidize both sides simultaneously (Homejoy lesson)
- Launch in >1 city before atomic-network proof
- Buy hosts via paid acq when supply already exceeds demand
- Hide fail-rate from product metrics dashboard
- Use ghost listings (ToS risk; trust damage if discovered)

## References
- Sangeet Paul Choudary — *Platform Scale*: pick a hook, magnet, toolbox.
- Andrew Chen — *The Cold Start Problem*: atomic network, hard side, tipping point.
- Bill Gurley — "All Markets Are Not Created Equal: 10 Factors To Consider When Evaluating Digital Marketplaces" (above the crowd).
- Jackson Gates / a16z marketplace 100 — comparator benchmarks.

## 90-day execution plan
| Week | Hard-side milestone | Easy-side milestone |
|--:|---|---|
| 1–2 | Recruit first 25 hosts (founder-led) | — (hold) |
| 3–4 | 50 hosts onboarded, pro photos shot | Open waitlist |
| 5–6 | 100 hosts; 20 listings live | Invite first 200 from waitlist |
| 7–8 | First 50 completed bookings | Open public signup |
| 9–10 | Liquidity dashboard live; first retention cohort | Paid ads test ($5k) |
| 11–12 | Decision: expand ZIP or deepen current | Cohort analysis review |
```

## Verification
- Hard side identified and justified.
- Atomic network defined (geo + vertical + density).
- Cold-start tactics ranked (≤3 chosen, not all 7).
- Liquidity targets numeric, with tripwires.
- Subsidy budget capped with sunset trigger.
- Comparator table includes ≥5 real marketplaces.
- Anti-pattern section present.
- Expansion gate criteria explicit.
