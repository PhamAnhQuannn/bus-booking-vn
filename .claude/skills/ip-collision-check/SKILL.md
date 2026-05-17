---
name: ip-collision-check
description: Pre-launch IP clearance — TM/patent/copyright collision search. Outputs to `docs/inception/ip-collision-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "IP clearance", "TM search", "patent collision", "/ip-collision-check", or before name commit / launch.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /ip-collision-check — IP Clearance

## Why you'd care

Launching with a name or mark that collides with an existing TM means a cease-and-desist on day 30, a rebrand on day 60, and lost SEO equity forever. The clearance check is hours of effort to avoid that.

Invoke as `/ip-collision-check`. Better to find collision before launch than during cease-and-desist.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP

## Inputs
- Brand name candidate(s).
- Logo design (if final).
- Core method/algorithm if patenting.
- Geo: where you'll operate.

## Process
1. **Trademark clearance**:
   - USPTO TESS search (US): exact + phonetic + similar-meaning, all classes
   - EUIPO eSearch: same for EU
   - WIPO Global Brand DB: international
   - State TMs (US): some states still register
   - Common-law usage check (Google + social handles)
2. **Domain check** — primary .com, key TLDs, country TLDs.
3. **Social handles** — Twitter/X, LinkedIn, GitHub, Reddit, IG.
4. **Patent collision** — Google Patents + Patentscope (WIPO):
   - Search keywords in claims
   - Identify granted + applied patents in space
   - Forward-citation check for foundational patents
5. **Copyright** — for content/UI inspiration: confirm sourced material is licensed.
6. **Code IP** — open-source license compatibility (per `/ip-strategy`).
7. **Risk scoring** per finding: blocking / risky / monitor.

## Output
Write `docs/inception/ip-collision-<project>.md`:

```markdown
# IP Collision Check — <project>
**Date:** <YYYY-MM-DD> | **Brand:** <X>

## Trademark search (US)
**Source:** USPTO TESS — searched <date>
| Mark | Class | Status | Owner | Risk |
|---|---|---|---|---|
| <exact same> | — | — | — | — (none found) |
| <similar phonetic> | 9 | LIVE | Co A | medium |
| <similar meaning> | 42 | DEAD | — | low |
**Verdict:** <CLEAR / RISKY / BLOCKED in US>

## Trademark search (EU)
**Source:** EUIPO eSearch
| Mark | Class | Status | Owner | Risk |
|---|---|---|---|---|
| ... | | | | |
**Verdict:** <CLEAR / RISKY / BLOCKED in EU>

## Trademark search (WIPO)
| ... | ... | ... | ... | ... |

## Common-law usage (Google + social)
- Twitter @<handle>: <available / taken by <user>>
- LinkedIn /company/<x>: <available / taken>
- GitHub /<org>: <available / taken>
- Top-rank Google for "<brand>": <generic / unrelated co / competing>

## Domain availability
| TLD | Status | Cost |
|---|---|--:|
| .com | available | $10/yr |
| .io | $35/yr | $35/yr |
| .ai | $80/yr | $80/yr |
| .co | available | $25/yr |
| Country: .uk, .de | both available | varies |

## Patent collision
**Source:** Google Patents — searched <date>
**Keywords:** <algorithm/method terms>
| Patent # | Title | Owner | Status | Conflict risk |
|---|---|---|---|---|
| US 10,xxx,xxx | <title> | Co B | granted | medium — claims overlap on <X> |
| US 9,xxx,xxx | <title> | Co C | granted | low — different domain |
**Verdict:** <CLEAR / DESIGN-AROUND-NEEDED / BLOCKED>

## Copyright/asset review
- Stock images: all licensed via <source>
- Fonts: <name> license <SIL OFL / commercial>
- Code dependencies: SBOM clean per `/ip-strategy`

## Overall risk summary
| Area | Risk | Action |
|---|---|---|
| US TM | medium | engage TM attorney for full opinion |
| EU TM | clear | proceed |
| Patent | medium | design-around <X>, document |
| Domain | clear | register .com today |
| Social | clear | claim handles today |

## Action items (urgent)
1. Register <brand>.com — today
2. Claim Twitter/GitHub/LinkedIn handles — today
3. TM attorney consultation if any "medium/risky" — week 1
4. File ITU TM US Class 9 + 42 — week 2
5. Patent design-around document — week 4

## Verdict
**LAUNCH-CLEAR / NEEDS-OPINION / NAME-CHANGE-REQUIRED**
```

## Verification
- USPTO TESS searched (not just Google).
- EUIPO + WIPO if international.
- Phonetic + similar-meaning, not just exact.
- Patent search with claim overlap analysis.
- Domain + social handles checked + secured.
- Risk per finding tagged.
