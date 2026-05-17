---
name: cold-outreach-test
description: Cold email/DM test to validate ICP + messaging + conversion path. Outputs to `docs/inception/cold-outreach-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "cold email", "outbound", "DM test", "/cold-outreach-test", or before sales hire.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /cold-outreach-test — Outbound Validation

## Why you'd care

Hiring a sales rep before validating that ICP + message + offer works in cold outbound is how you burn $20-30k/month for a quarter and learn nothing useful. A 100-send, 3-sequence test answers in two weeks whether the motion is fixable or fundamentally broken.

Invoke as `/cold-outreach-test`. 100 sends, 3 sequences. Reply rate ≥10% = signal.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/buyer-persona-<project>.md`.

## Inputs
- ICP (firmographic + persona).
- Channel: email / LinkedIn DM / Twitter DM / Reddit DM.
- Offer: discovery call / free trial / paid pilot.

## Process
1. **Build list 100 contacts** — verified emails (Apollo/Hunter/RocketReach) or handles.
2. **Write 3 sequences** — 2 follow-ups each, vary hook (problem / curiosity / proof / referral).
3. **Send** — 30/wk per sender (avoid spam). Track open/reply/positive-reply/booked.
4. **Reply triage** — book call within 24h.
5. **Discovery calls** — Mom-Test interview script (no pitch).
6. **Close-loop** — proposal / pilot / pass.
7. **Decision metrics**:
   - Open rate ≥40% (else subject broken)
   - Reply rate ≥10% (else ICP/hook wrong)
   - Positive-reply ≥3% (else offer wrong)
   - Booked-call ≥2% (else CTA wrong)

## Output
Write `docs/inception/cold-outreach-<project>.md`:

```markdown
# Cold Outreach Test — <project>
**Date:** <YYYY-MM-DD> | **Channel:** <email/LI/etc>

## ICP filter
- <criterion 1> (e.g. SaaS 50–500 employees)
- <criterion 2> (e.g. uses Postgres + Stripe)

## Sequences tested (3)
### Seq A — Problem hook
> Subject: <X>
> Hi {name}, ... (full body)

### Seq B — Curiosity hook
> ...

### Seq C — Proof hook
> ...

## Results
| Seq | Sent | Open % | Reply % | Pos-reply % | Booked |
|---|--:|--:|--:|--:|--:|
| A | 33 | 48% | 12% | 6% | 2 |
| B | 33 | 41% | 8% | 2% | 1 |
| C | 34 | 52% | 18% | 9% | 4 |

## Discovery-call findings
- N=7 calls
- Confirmed pain: <X>
- Disconfirmed: <Y>
- New objection: <Z>

## Verdict
**STRONG (≥10% reply) / WEAK (3–10%) / DEAD (<3%)**

## Next
- Scale Seq C (winner)
- Iterate ICP filter to <revised>
- Build sales playbook
```

## Verification
- ≥100 contacts sent.
- 3 sequences A/B/C tested.
- Pos-reply ≥3% (else offer broken not channel).
- Mom-Test discovery scripts used (no pitching on call).
