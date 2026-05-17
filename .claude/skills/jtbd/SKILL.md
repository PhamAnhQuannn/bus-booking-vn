---
name: jtbd
description: Jobs-to-be-done canvas — what job are users hiring this product to do, with functional/emotional/social dimensions and outcome statements. Outputs to `docs/inception/jtbd-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "JTBD", "jobs to be done", "what job", "/jtbd", or before `/value-prop-canvas`.
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 2h
  XL: 4h
---

# /jtbd — Jobs-to-Be-Done Canvas

## Why you'd care

Building features for a 'persona' instead of a job-being-hired-for produces products that demo well but no one switches to. The JTBD canvas forces the question of what existing alternative this is actually displacing.

Invoke as `/jtbd`. Christensen-style hire/fire framing. Outcome > feature.

## Pre-flight
1. Read `docs/classify/<project>.md` — XS/S → SKIP.
2. Read `docs/inception/interview-log-<project>.md` — pull verbatim job statements.

## Inputs
- ≥5 interviews logged.
- Top 1–3 candidate jobs.

## Process
1. **Job statement** — "When <situation>, I want to <motivation>, so I can <outcome>."
2. **Job dimensions** — functional / emotional / social.
3. **Hire/fire criteria** — what makes user hire your product? fire current solution?
4. **Outcome metrics** — desired-outcome statements (Ulwick): "minimize time to X", "increase likelihood of Y".
5. **Competing jobs** — what else competes for this job slot (e.g. "spreadsheet + coffee").

## Output
Write `docs/inception/jtbd-<project>.md`:

```markdown
# Jobs-to-Be-Done — <project>
**Date:** <YYYY-MM-DD>

## Primary job
**Statement:** When <situation>, I want to <motivation>, so I can <outcome>.

| Dimension | Description |
|---|---|
| Functional | <task> |
| Emotional | <feeling> |
| Social | <how others perceive> |

## Hire criteria (what triggers switch to us)
- ...

## Fire criteria (what kills current solution)
- ...

## Desired outcomes (Ulwick)
| # | Outcome | Importance 1–5 | Satisfaction today 1–5 | Opportunity score |
|--:|---|--:|--:|--:|
| 1 | Minimize time to <X> | 5 | 2 | 8 |
| 2 | Increase likelihood of <Y> | 4 | 1 | 7 |

(Opportunity = Importance + max(Importance − Satisfaction, 0))

## Competing solutions for this job
- <competitor / workaround> — strength, weakness
- ...

## Anti-jobs (what user is NOT hiring us for)
- ...
```

## Verification
- Job statement uses canonical "When/I want to/so I can" form.
- ≥3 desired outcomes with importance+satisfaction scored.
- Competing solutions include non-software (spreadsheet, post-it, status quo).
- Anti-jobs explicit.
