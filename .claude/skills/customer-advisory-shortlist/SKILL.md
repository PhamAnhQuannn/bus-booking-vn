---
name: customer-advisory-shortlist
description: Build shortlist of 5-10 customers to recruit as design partners / advisors during inception. Pre-CAB. Outputs to `docs/inception/cab-shortlist-<project>.md`. Use when user says "advisory shortlist", "design partners", "customer advisors", "early adopter list", "/customer-advisory-shortlist", or before `/customer-advisory-board`.
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 2h
  XL: 4h
---

# /customer-advisory-shortlist — Recruit Five Customers Who Will Shape The Product

## Why you'd care

A pre-PMF founder running a formal Customer Advisory Board is using a hammer when the job needs tweezers — there's no roadmap yet to advise on, and quarterly meetings produce nothing actionable when the product changes weekly. Five to seven design partners trading feedback for influence and weekly access is what surfaces the JTBD nuance and pricing willingness in time to still change the wedge, before the architecture and onboarding flow are concrete enough to make pivots expensive.

A formal Customer Advisory Board is overkill at inception. Start with a shortlist of 5-10 who'll talk to you weekly, accept rough product, and trade feedback for influence.

## Pre-flight
None. Feeds `/customer-advisory-board`, `/early-design-partner-plan`.

## Inputs
- ICP + beachhead segment.
- Network: founder contacts, intros, warm leads.

## Process
1. **Target count** — 8-12 names on shortlist; recruit 5-7 actives.
2. **Selection criteria** — each must be:
   - In beachhead segment
   - Feels pain top-3
   - Has authority to use product (not blocked by IT)
   - Articulate (will give signal, not noise)
   - Has reach (peers will copy them)
   - Not a competitor or competitor's investor
3. **List candidates** — name, company, title, source of intro, current pain signal, why they'd say yes.
4. **Diversity** — span industry sub-segments and company sizes within beachhead. Not all clones.
5. **Recruit ask** — single sentence: "We're building <X>. Would you commit to <30 min/2wks> for <6 months> in exchange for <early access + naming credit + lifetime founder pricing>?"
6. **Tracking** — outreach sent, response, status, next step per name.
7. **Cadence plan** — 30 min biweekly call + Slack channel + monthly product preview.

## Output
Write `docs/inception/cab-shortlist-<project>.md`:

```markdown
# Customer Advisory Shortlist — <project>
**Date:** <YYYY-MM-DD>
**Target active count:** 5-7

## Selection criteria
- [ ] In beachhead segment
- [ ] Pain rated top-3 by them
- [ ] Authority to adopt
- [ ] Articulate communicator
- [ ] Peer reach (their network copies them)
- [ ] Not a competitor

## Shortlist
| # | Name | Title | Company | Intro source | Pain signal | Status |
|---|------|-------|---------|--------------|-------------|--------|
| 1 | ... | GM | Bistro A | Warm intro via X | "lost $2k last Sat" | Asked, awaiting |
| 2 | ... | Owner | Bistro B | LinkedIn cold | "no-show rate 15%" | Booked call |
| 3 | ... | ... | ... | ... | ... | ... |
| 4 | ... | ... | ... | ... | ... | ... |
| 5 | ... | ... | ... | ... | ... | ... |
| 6 | ... | ... | ... | ... | ... | ... |
| 7 | ... | ... | ... | ... | ... | ... |
| 8 | ... | ... | ... | ... | ... | ... |

## Diversity check
- Industry sub-segments covered: <list>
- Company sizes covered: <small / medium / large within beachhead>
- Geographies: <list>
- ❌ Over-represented: <flag if all clones>

## Recruit ask template
> Subject: <name>, would you shape this with us?
>
> Hi <name> — building <one-line product>. Looking for <N> design partners who'll commit to:
> - 30 min call every 2 weeks for 6 months
> - Honest feedback on rough builds
> - Optional Slack channel
>
> In return: free use for life of founder tier, naming credit, first dibs on features.
>
> Worth a 15-min intro call this week?

## Outreach log
| Name | Sent date | Response | Booked? | Next step |
|------|-----------|----------|---------|-----------|
| ... | ... | ... | ... | ... |

## Cadence (once active)
- Biweekly 30-min 1:1
- Slack channel for async
- Monthly group preview demo
- Quarterly survey

## What we'll ask for / give
**Ask:** honest reactions, real workflow walk-throughs, intros to peers
**Give:** founder pricing for life, naming credit on launch, equity-or-nothing decision deferred to 6 months in

## Next
- Formal CAB once 5+ active → `/customer-advisory-board`
- Per-partner concierge program → `/early-design-partner-plan`
- Interview cadence → `/mom-test-protocol`
```

## Verification
- 8+ names on shortlist.
- Each has intro source + pain signal.
- Diversity check explicit (not all clones).
- Recruit ask template < 100 words.
- Outreach tracking columns ready to fill.
