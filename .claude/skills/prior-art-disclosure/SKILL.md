---
name: prior-art-disclosure
description: Founder prior-art inventory — patents, papers, OSS, blog posts, prior employer code — that touches the new product. Outputs to `docs/inception/prior-art-<project>.md`. Use when user says "prior art", "patent prior art", "prior IP", "/prior-art-disclosure", before `/ip-assignment-agreement` or patent filing.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /prior-art-disclosure — Prior Art Inventory

List everything you've published or built that touches the product. Avoid invalidation and ownership fights.

## Why you'd care

Undisclosed prior art is how patents get invalidated, IP-assignment agreements get challenged, and prior employers get standing to sue. Inventory it on day zero, not when a subpoena arrives.

## Pre-flight
None. Pairs with `/conflict-of-interest-disclosure`.

## Inputs
- Last 10 years of work (rough OK).

## Process
1. **Patents** — granted, pending, abandoned. Title, number, status, ownership (employer/yours).
2. **Papers/talks** — conference, journal, blog, video. URL + abstract. Disclosed inventions are prior art.
3. **OSS contributions** — repos you authored or committed to. License (MIT/Apache/GPL).
4. **Prior employer code** — anything you wrote on the clock. Even tangentially related triggers inventions-assignment clauses.
5. **Trade secrets** — anything an employer would call confidential. Listed only as "covered area," not contents.
6. **Cross-check vs product** — for each prior-art item, mark: USED, ADJACENT, UNRELATED.
7. **Ownership map** — who owns what. Carve-outs needed in founders' agreement.

## Output
Write `docs/inception/prior-art-<project>.md`:

```markdown
# Prior Art — <project>
**Date:** <YYYY-MM-DD>

## Patents
| Title | Number | Status | Owner | Relevance |
|---|---|---|---|---|
| ... | ... | ... | ... | USED/ADJACENT/UNRELATED |

## Papers / talks / posts
| Title | Venue | Year | URL | Relevance |
|---|---|---|---|---|

## OSS contributions
| Repo | Role | License | Relevance |
|---|---|---|---|

## Prior employer code
| Project | Employer | Years | Confidential? | Relevance |
|---|---|---|---|---|

## Trade-secret-covered areas (no contents)
- ...

## Ownership map
| Item | Owner | Carve-out needed? |
|---|---|---|

## Next
- USED-relevant prior employer code → counsel review
- Carve-outs → embed in `/ip-assignment-agreement`
- Patent strategy → `/ip-strategy`
```

## Verification
- All 5 categories surveyed (NONE acceptable).
- Relevance tag on each item.
- Ownership map matches founders' agreement carve-outs.
