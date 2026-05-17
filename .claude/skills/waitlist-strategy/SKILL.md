---
name: waitlist-strategy
description: Pre-launch waitlist design — capture, nurture, qualification, conversion at launch. Outputs to `docs/inception/waitlist-<project>.md`. Reads `/project-classify` to skip XS/XL. Use when user says "waitlist", "pre-launch", "/waitlist-strategy", or before public launch.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /waitlist-strategy — Pre-Launch Capture

Invoke as `/waitlist-strategy`. Waitlist ≠ vanity. Qualified + nurtured > big-number list.

## Why you'd care

A waitlist without a nurture sequence is a list of strangers by launch day. Strategic capture + qualification + conversion design is what turns the list into pipeline.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
   - XL → SKIP (sales-led, no waitlist)
2. Read `docs/inception/buyer-persona-<project>.md`.

## Inputs
- Launch date target.
- Founder distribution channels.
- Product wedge + clear "why care now".

## Process
1. **Landing page** — clear pain → solution → CTA → 1 form field (email).
2. **Qualification field** (optional 2nd field) — role/use-case dropdown to segment.
3. **Acquisition channels** (per `/distribution-advantage-audit`):
   - Founder audience push
   - Hunter/influencer outreach
   - SEO long-tail (if time)
   - Paid ads ($100–$500 test)
   - Content + community presence
4. **Nurture cadence** — weekly email, value-first (build-in-public, behind-scenes, problem-content).
5. **Engagement scoring** (per `/waitlist-conversion-bench`) — opens, clicks, replies, referrals.
6. **Pre-launch tier**:
   - Top 10% → early access, ask for testimonial
   - Mid 30% → standard launch invite
   - Bottom 60% → general blast
7. **Launch-day conversion path** — segment-specific messaging, scarcity (limited spots), discount only if ethical.

## Output
Write `docs/inception/waitlist-<project>.md`:

```markdown
# Waitlist Strategy — <project>
**Launch target:** <YYYY-MM-DD>

## Landing page
- URL: <X>
- Headline: <X>
- Sub: <X>
- CTA: "Join waitlist"
- Optional field: role dropdown (founder / IC / lead / manager)
- Tool: Carrd / Framer / custom

## Acquisition channels (pre-launch 12 wk)
| Channel | Owner | Cadence | Target signups |
|---|---|---|---|
| Founder Twitter | founder | 2 posts/wk | 200 |
| Newsletter X-promo | founder | 3 mentions | 150 |
| ProductHunt "Coming Soon" | founder | once | 100 |
| BetaList | founder | once | 80 |
| SEO post | founder | 5 posts | 50 |
| Paid ads test | founder | $300 | 100 |
| Total target | | | **680** |

## Nurture cadence
- Wk 1 (signup): welcome + what to expect
- Wk 2: behind-scenes problem story
- Wk 3: solution preview (no link)
- Wk 4: ask-for-input survey (segments)
- Wk 5–11: value-first content (1/wk)
- Wk 12 (T-1): "we launch tomorrow" + slot reservation

## Engagement segments
- Top 10% (open ≥80% + ≥1 referral) → priority early access
- Mid 30% (open ≥50%) → launch-day invite
- Bottom 60% → general blast

## Launch-day conversion
- Hour 0: top 10% gets unique link (limited 50 spots)
- Hour 6: mid 30% invited
- Hour 24: full list

## Success criteria
- Total list: ≥500
- Open rate ≥40% (else list quality bad)
- Launch-day signup→activate ≥10%
- Launch-day signup→paid ≥3%

## Anti-patterns
- ✗ Buying email list
- ✗ Fake-scarcity ("only 100 spots" when no constraint)
- ✗ Silent list (no nurture = no conversion)
- ✗ Vanity-only metric (size without engagement)
```

## Verification
- Landing page URL committed.
- Channel mix budgeted.
- Nurture cadence ≥12 wk pre-launch.
- Engagement scoring + segment-tier conversion plan.
- Anti-patterns explicit.
