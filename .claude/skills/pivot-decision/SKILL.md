---
name: pivot-decision
description: Quarterly kill / persist / pivot framework against pre-committed metrics so sunk cost doesn't drive product decisions. Outputs to `docs/inception/pivot-<project>-<date>.md`. Reads `/project-classify` to skip XS and `/kill-criteria` for trigger thresholds. Use when user says "pivot or persist", "should we kill this", "quarterly review", "/pivot-decision", or 90 days post-launch.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /pivot-decision — Kill / Persist / Pivot Quarterly

Invoke as `/pivot-decision`. Anti-zombie skill. Forces honest review against pre-set thresholds.

## Why you'd care

Sunk-cost bias keeps founders pouring effort into dead products for years. A pre-committed quarterly review against trigger metrics replaces "I feel it's working" with a number you agreed to before you got emotionally entangled.

## Pre-flight
1. Read `docs/classify/<project>.md` — XS → SKIP.
2. Read `docs/inception/kill-criteria-<project>.md` if exists — pull thresholds.
3. Read `docs/inception/nsm-<project>.md` if exists — pull North Star Metric current value.

## Inputs
- Last quarter's metrics: NSM, MRR/users, retention, CAC, runway months remaining.
- Original kill-criteria thresholds (from `/kill-criteria`).
- Founder gut answer (yes/no): "If you were starting today, would you build this?"

## Process
1. **Metric vs threshold table** — does any kill-criteria trigger?
2. **Trend lines** — last 3 quarters: improving / flat / declining per metric.
3. **Customer evidence** — 3–5 customer quotes on value / pain. If <3 customers exist → strong kill signal.
4. **Founder energy check** — honest 1–10 score on motivation. Sustained <5 for 2 quarters = kill flag.
5. **Verdict** — KILL / PERSIST / PIVOT-NARROW / PIVOT-WIDE.

## Output
Write `docs/inception/pivot-<project>-<YYYY-Q>.md`:

```markdown
# Pivot Decision — <project> <YYYY-Q>
**Date:** <YYYY-MM-DD> | **Verdict:** KILL / PERSIST / PIVOT-NARROW / PIVOT-WIDE

## Kill-criteria check
| Threshold | Target | Actual | Trigger? |
|-----------|--------|--------|:--------:|
| ... | ... | ... | ✓/✗ |

## Trend (last 3 quarters)
| Metric | Q-2 | Q-1 | Q-0 | Trend |
|--------|----:|----:|----:|-------|
| NSM | ... | ... | ... | ↑↓→ |
| MRR | ... | ... | ... | ↑↓→ |
| Retention | ... | ... | ... | ↑↓→ |

## Customer voice (3–5 quotes)
> "..."

## Founder energy: X/10

## Verdict rationale
<2–3 sentences>

## Next 90 days
- KILL → wind-down checklist, free runway
- PERSIST → double down on <area>
- PIVOT-NARROW → drop <feature/segment>, focus on <wedge>
- PIVOT-WIDE → reframe to <new problem>, re-run /problem-validation
```

## Verification
- Kill-criteria checked numerically (not vibes).
- Customer quotes are real, dated, attributed.
- Verdict ties to evidence, not gut.
