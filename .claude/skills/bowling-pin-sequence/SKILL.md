---
name: bowling-pin-sequence
description: Bowling-pin segment expansion sequence — order of vertical/use-case expansion after the beachhead. Outputs to `docs/inception/bowling-pin-<project>.md`. Use when user says "bowling pin", "expansion order", "next segment", "/bowling-pin-sequence", or after `/beachhead-segment-pick`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /bowling-pin-sequence — Knock Down Adjacent Pins

## Why you'd care

Expansion to a non-adjacent segment burns your beachhead's references and forces you to rebuild distribution from zero. Sequencing by shared customers, channels, or product surface compounds your existing traction instead of resetting it.

After the beachhead, expand to pins that share customers, channels, or product surface. Order matters.

## Pre-flight
Run after `/beachhead-segment-pick`. Pairs with `/chasm-segment-map`.

## Inputs
- Beachhead segment.
- Persona of beachhead buyer + user.

## Process
1. **List 5-8 adjacent pins** — segments that share ≥ 1 attribute with beachhead (same buyer / same channel / same use-case / same vertical).
2. **Score each pin** on 4 axes 1-5:
   - **Shared buyer** (same person buys both? 5 = yes)
   - **Shared channel** (same distribution reach? 5 = yes)
   - **Product reuse** (same product solves? 5 = no new build)
   - **Pin size** (10× larger than beachhead? 5 = yes)
3. **Order** — pin 2 > pin 3 > pin 4 by score. Each pin should leverage prior pin's references and learnings.
4. **Per-pin entry test** — what one win signals you can target this pin? (e.g., "first non-beachhead customer in pin 2 within 30 days of attempt").
5. **Stop-at-pin rule** — if pin N fails entry test, don't jump to pin N+1; revisit positioning.

## Output
Write `docs/inception/bowling-pin-<project>.md`:

```markdown
# Bowling-Pin Sequence — <project>
**Date:** <YYYY-MM-DD>

## Beachhead (Pin 1)
<segment from `/beachhead-segment-pick`>

## Candidate pins (example: devtool beachhead = Rails background-job dashboards)
| Pin | Shared buyer | Shared channel | Product reuse | Pin size | Total | Order |
|-----|--------------|----------------|---------------|----------|-------|-------|
| Node.js queue dashboards | 3 | 4 | 5 | 4 | **16** | 2 |
| Cron / scheduled-job observability | 4 | 3 | 4 | 3 | 14 | 3 |
| Python Celery teams | 2 | 5 | 4 | 4 | 15 | 2 (tied) |
| Webhook reliability monitors | 3 | 4 | 3 | 5 | 15 | 2 (tied) |
| Embedded-device job runners | 1 | 2 | 2 | 3 | 8 | Skip |

## Sequence
1. **Pin 1 (beachhead):** Rails background-job teams — current focus
2. **Pin 2:** Node.js queue dashboards — shares buyer (eng lead) + channel (DevTools podcasts)
3. **Pin 3:** Python Celery teams — same channel; small protocol-adapter build
4. **Pin 4:** Cron / scheduled-job observability — different use-case, defer

## Per-pin entry test
| Pin | Entry signal | Deadline | Stop if |
|-----|-------------|----------|---------|
| 2 | 3 paid customers in 60 days | <date> | < 1 customer |
| 3 | Celery adapter open-sourced + 10 stars | <date> | No traction |
| 4 | TBD | TBD | TBD |

## Leverage chain
- Beachhead references unlock Pin 2 (peer trust in DevTools Twitter)
- Pin 2 case studies unlock Pin 3 (proves product handles polyglot stacks)
- Pin 3 adapters unlock enterprise polyglot accounts

## Risks
- If beachhead saturates before Pin 2 works → premature jump
- If Pin 2 entry test fails → re-examine, do not skip ahead

## Next
- Whole-product gaps per pin → `/chasm-segment-map`
- ICP per pin → `/ideal-customer-profile`
- Sales motion per pin → `/gtm-motion-pick`
```

## Verification
- ≥ 5 candidate pins scored.
- Sequence has 3+ pins ordered.
- Each pin has an entry test + deadline.
- Leverage chain explained (why this order, not random).
