---
name: seo-keyword-recon
description: SEO keyword discovery + difficulty + intent mapping for organic-traction wedge. Outputs to `docs/inception/seo-recon-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "SEO", "keywords", "organic traffic", "/seo-keyword-recon", or before content plan.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /seo-keyword-recon — Keyword Recon

Invoke as `/seo-keyword-recon`. Wedge keywords = low-DR, transactional intent, founder can write authoritatively.

## Why you'd care

Picking content topics without keyword data is how you spend a year writing posts nobody searches for. Recon up-front means every piece you publish has a known intent and a measurable difficulty.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/buyer-persona-<project>.md`.

## Inputs
- Product category + ICP pain language.
- Domain age + DR (free check: ahrefs.com/website-authority-checker).
- Competitors' top-ranking pages.

## Process
1. **Seed list** — 20 phrases buyers actually type (from interviews, support tickets, Reddit).
2. **Expand** — Ahrefs/Semrush/Ubersuggest/Google Suggest/People-Also-Ask.
3. **Score per keyword** — Volume × KD (difficulty 0–100) × Intent (Info/Nav/Trans/Comm).
4. **Filter wedge keywords** — KD ≤30 + Volume ≥100/mo + Intent Trans/Comm + you can write authoritatively.
5. **Cluster by topic** — pillar + supporting page architecture.
6. **Quick-win list** — top 10 wedge keywords for first 90 days.

## Output
Write `docs/inception/seo-recon-<project>.md`:

```markdown
# SEO Keyword Recon — <project>
**Date:** <YYYY-MM-DD> | **Domain DR:** <X>

## Wedge keywords (top 10)
| Keyword | Vol/mo | KD | Intent | Top-rank URL | Why we win |
|---|--:|--:|---|---|---|
| best <X> for solo dev | 320 | 18 | Trans | competitor blog | deeper how-to |
| <X> vs <Y> | 180 | 22 | Comm | weak comparison | side-by-side table |
| ... | ... | ... | ... | ... | ... |

## Topic clusters
- **Pillar: <topic>** → 5 supporting pages
- **Pillar: <topic>** → 4 supporting pages

## 90-day content plan
| Wk | URL slug | Target keyword | Author | Status |
|---|---|---|---|---|
| 1 | /best-x-for-y | best <X> for <Y> | founder | draft |
| ... | ... | ... | ... | ... |

## Long-game keywords (12+ mo)
| Keyword | Vol | KD | Why later |
|---|--:|--:|---|
| <head term> | 12000 | 78 | DR too low now |

## Verdict
**SEO-VIABLE / SLOW / NOT-A-FIT** (NOT-A-FIT if no wedge keywords KD ≤30)
```

## Verification
- ≥10 wedge keywords KD ≤30 + Vol ≥100.
- Each top keyword has Intent classified (filter Info-only out for early traction).
- 90-day plan with author + slug per post.
- Long-game vs wedge separated.
