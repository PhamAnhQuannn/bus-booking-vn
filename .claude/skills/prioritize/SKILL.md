---
name: prioritize
description: Score and rank open issues using MoSCoW (Must / Should / Could / Won't) and RICE (Reach × Impact × Confidence ÷ Effort). Annotates each `issues/*.md` frontmatter with a priority tier and RICE score, emits a sorted top-list to `docs/qa/priority-list.md`. Use when user says "prioritize", "what should I build first", "MoSCoW", "RICE", "/prioritize", or after `/prd-to-issues` decomposes a PRD into issue files.
output_size:
  XS: skip
  S:  30m
  M:  1h
  L:  2h
  XL: 3h
---

# /prioritize — MoSCoW + RICE issue ranker

Invoke as `/prioritize`. Read open issues. Score each. Annotate frontmatter. Emit ranked list.

## Why you'd care

A solo dev with 40 open issues and no priority field will work the most recent one, not the most valuable one. MoSCoW alone gives a coarse bucket — RICE breaks ties inside the Must / Should buckets so the top-of-list is the actual highest-leverage next ticket, not "whatever's at the top of the file listing".

## Pre-flight

1. Read `docs/classify/<project>.md`.
   - XS → SKIP (single-issue projects don't need ranking).
   - S → MoSCoW only, skip RICE.
   - M/L/XL → both.
2. Read `issues/*.md` glob — fail-soft if directory empty (recommend `/prd-to-issues` or `/idea-capture` first).
3. Read `docs/inception/risk-register-<project>.md` if present — Red-tier risks feed into Impact scoring.

## Inputs

- All `issues/*.md` files with at least `title` + body.
- Optional risk register (boosts Impact for risk-mitigating issues).
- Optional `docs/inception/lean-canvas-<project>.md` (Reach numbers come from user-segment size if present).

## Process

1. **Read every issue.** Skip files already marked `status: closed` or `status: done`.
2. **MoSCoW classify** — assign one of:
   - **Must** — without this the release does not ship / product does not work.
   - **Should** — important but a workaround exists.
   - **Could** — nice to have, defer if time pressure.
   - **Won't** — explicitly out of scope this release (kept for next cycle).
3. **RICE score** each non-Won't issue:
   - **Reach** (1–10) — users / week affected. 1 = single power user, 10 = every user every session.
   - **Impact** (0.25, 0.5, 1, 2, 3) — Massive=3, High=2, Medium=1, Low=0.5, Minimal=0.25.
   - **Confidence** (50% / 80% / 100%) — gut-feel certainty in Reach × Impact.
   - **Effort** (person-weeks, ≥0.25). Solo-dev calendar weeks; ≤0.25 if half-day.
   - **Score = (R × I × C) ÷ E.**
4. **Rank within each MoSCoW bucket** by RICE descending.
5. **Annotate** each `issues/<id>.md` frontmatter:
   ```yaml
   priority: must|should|could|wont
   rice: 12.5
   reach: 8
   impact: 2
   confidence: 0.8
   effort: 1
   ```
6. **Emit** `docs/qa/priority-list.md` (Output Format below).
7. **Flag top-3 anomalies** — any Could ranked above any Should by RICE → ask user if MoSCoW is miscalibrated.

## Output Format

```markdown
# Priority list — <project>
**Generated:** <YYYY-MM-DD> · **Open issues:** <N> · **Method:** MoSCoW + RICE

## Must (ship-block)
| Rank | Issue | Title | RICE | R | I | C | E |
|-----:|-------|-------|-----:|--:|--:|--:|--:|
| 1 | 003 | Stripe webhook handler | 32.0 | 8 | 2 | 1.0 | 0.5 |
| 2 | 001 | Auth flow login | 24.0 | 10 | 3 | 0.8 | 1.0 |
| ... | | | | | | | |

## Should
| Rank | Issue | Title | RICE | R | I | C | E |
|-----:|-------|-------|-----:|--:|--:|--:|--:|
| 1 | 008 | Refund admin UI | 12.0 | 4 | 1 | 1.0 | 0.33 |
| ... | | | | | | | |

## Could
...

## Won't (this release)
| Issue | Title | Reason deferred |
|-------|-------|-----------------|
| 014 | Dark mode | Not blocking launch; cycle 2. |

## Anomalies / re-check
- 011 (Could, RICE=18) outranks 008 (Should, RICE=12). Confirm 011 isn't actually Should.
```

## Verification

- Every open `issues/*.md` has `priority:` frontmatter after run.
- Every non-Won't issue has all 5 RICE fields populated.
- Top-of-list **Must** is the highest RICE inside the Must bucket — not a Could.
- Anomalies section either empty or each row resolved with user.

## Cross-skill references

- **Upstream:** `/prd-to-issues` (creates issue files), `/idea-capture` (seed list), `/risk-register` (Red risks boost Impact).
- **Downstream:** `/acceptance-criteria` (Must-tier first), `/traceability-matrix` (consumes priority + AC), `/lead` (picks top-Must to slice).

## When to re-run

- After every `/prd-to-issues` or `/scope-creep-check`.
- Weekly during building stage.
- Before any release-cut.
- When stuck-rec escalation surfaces "what's the next ticket" ambiguity.
