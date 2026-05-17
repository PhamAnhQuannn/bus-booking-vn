---
name: existing-workaround-audit
description: Catalog the duct-tape stack users currently use to solve the problem — strong workaround = strong demand signal. Outputs to `docs/inception/workaround-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "what do they do today", "current workaround", "/existing-workaround-audit", or after `/customer-interview-script` saturation.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /existing-workaround-audit — Duct Tape Catalog

## Why you'd care

The pain is real and acute exactly when users have rigged a five-step duct-tape solution to cope — spreadsheets glued to Zapier glued to a Slack channel glued to a manual Tuesday-morning review. Catalogue the workarounds and you find the shape of the actual product, the urgency of the pain (people don't build Rube Goldberg for fun), and the strongest sales hook: "you can throw away the spreadsheet." Conversely, no workaround usually means no demand — and shipping into that void is the most common silent failure mode.

Invoke as `/existing-workaround-audit`. People building Rube-Goldberg = real pain.

## Pre-flight
1. Read `docs/classify/<project>.md` — XS → SKIP.
2. Read `docs/inception/interview-log-<project>.md` — pull workaround mentions.

## Inputs
- ≥5 interviews where workaround discussed.
- Forum-listening data if available.

## Process
1. **Per user, list workaround stack** — tools, manual steps, scripts.
2. **Time/$ cost per stack** — hr/wk + tool cost.
3. **Switching cost analysis** — what would they have to give up to switch?
4. **Strength signal** — paid SaaS workaround = strong; free script = medium; "I just deal with it" = weak.

## Output
Write `docs/inception/workaround-<project>.md`:

```markdown
# Existing Workaround Audit — <project>
**Date:** <YYYY-MM-DD> | **N users:** N

## Workaround stacks
| User | Tools used | Manual steps | Time/wk | $/mo | Strength |
|---|---|---|--:|--:|---|
| <U1> | Excel + Zapier + cron | 4 | 6 hr | $40 | STRONG |
| <U2> | "I just deal with it" | 0 | 1 hr | $0 | WEAK |

## Common patterns
- N/N use spreadsheet + manual paste
- N/N pay for <ToolX> partially
- N/N built internal script

## Switching cost (if we replace stack)
- Data migration: <effort>
- Habit change: <effort>
- Org buy-in: <effort>

## Strength distribution
- STRONG: N
- MEDIUM: N
- WEAK: N

## Verdict
**STRONG-DEMAND / MIXED / WEAK-DEMAND**

(Strong-demand: ≥50% pay $/build script. Weak: ≥50% "deal with it".)

## Next
- STRONG → /value-prop-canvas (your wedge = remove duct tape)
- WEAK → /pain-severity-rubric re-score; likely VITAMIN
```

## Verification
- Specific tools named (not "they use software").
- $/wk + hr/wk quantified per user.
- Switching cost ≠ zero (zero = nothing to switch from = no real workaround).
