---
name: forum-listening-pass
description: Scan Reddit/HN/Discord/Stack/X for unprompted user complaints in target domain — passive demand evidence vs interview bias. Outputs to `docs/inception/forum-listening-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "forum scan", "reddit scan", "what are people complaining about", "/forum-listening-pass", or before `/customer-interview-script`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /forum-listening-pass — Passive Demand Signal

## Why you'd care

Customer interviews are biased by who agrees to take the call and what they think you want to hear; forum scraping shows you what people complain about when no one's asking. If the pain doesn't surface unprompted online, the market probably isn't there.

Invoke as `/forum-listening-pass`. Listen, don't ask. Verbatim complaints > leading questions.

## Pre-flight
1. Read `docs/classify/<project>.md` — XS → SKIP.
2. Read `docs/inception/idea-<slug>.md` for domain.

## Inputs
- 3–5 keywords/phrases for problem.
- Forums to scan (default: reddit subs, HN, Indie Hackers, Discord servers, Stack Overflow, X).

## Process
1. **Search per forum** — exact + variant phrases, last 12 mo.
2. **Capture verbatim** — top 20 posts/comments with URL + date + score.
3. **Tag** PAIN / WORKAROUND-USED / WOULD-PAY / NO-ONE-HELPED / ASKED-AND-NO-ANSWER.
4. **Frequency map** — same complaint repeating? what wording recurs?
5. **Existing solutions mentioned** — what do they currently use? complain about?

## Output
Write `docs/inception/forum-listening-<project>.md`:

```markdown
# Forum Listening — <project>
**Date:** <YYYY-MM-DD> | **Keywords:** <list>

## Sources scanned
| Forum | Query | Hits | Top date |
|---|---|--:|---|
| r/<sub> | "<phrase>" | N | <date> |
| HN | "<phrase>" | N | <date> |

## Verbatim quotes (top 20)
| # | Source | Date | Score | Tag | Quote (verbatim, ≤200 char) | URL |
|--:|---|---|--:|---|---|---|
| 1 | r/<sub> | <date> | 234 | PAIN | "I waste 2 hrs/week on..." | <link> |

## Recurring complaints
- "<phrase>" — N occurrences
- "<phrase>" — N

## Existing solutions named (with complaints)
- <Tool A> — "too expensive / clunky / missing X"
- <Tool B> — "...

## Verdict
**SIGNAL-STRONG / SIGNAL-WEAK / NO-SIGNAL**

## Next
- STRONG → /customer-interview-script (target the most-vocal users)
- WEAK → reposition keywords + retry
- NO-SIGNAL → /idea-kill-list (reason: NO_DEMAND)
```

## Verification
- ≥20 verbatim quotes (paraphrase = bias).
- URL + date for each (must be re-traceable).
- ≥3 forums scanned (single-channel = noise).
- Tag distribution shown (don't cherry-pick PAIN-only).
