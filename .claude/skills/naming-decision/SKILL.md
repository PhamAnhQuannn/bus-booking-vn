---
name: naming-decision
description: Pick brand name — generation, scoring, TM/domain check, founder gut. Outputs to `docs/inception/naming-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "naming", "pick a name", "brand name", "/naming-decision", or before launch.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /naming-decision — Brand Name

## Why you'd care

Bad names get rebranded later, dragging SEO equity, social handles, and brand recognition through the dirt. Picking once with a TM + domain + gut check costs days; rebranding costs months.

Invoke as `/naming-decision`. Names are sticky. Easier to live with OK name than rebrand later.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP (use working title)
2. Read `docs/inception/category-<project>.md` if exists.

## Inputs
- Product category + positioning.
- Target persona (consumer / dev / executive).
- Geo + language reach.

## Process
1. **Brainstorm 30+ candidates** — don't filter early. Categories:
   - **Descriptive** — Salesforce, PayPal (SEO friendly, weak distinctiveness)
   - **Compound** — Snowflake, Lightspeed (made of real words)
   - **Coined / made-up** — Spotify, Twilio (distinctive, hard to TM-collide)
   - **Mythological / classical** — Nike, Hermes (evocative, often taken)
   - **Person name** — Tesla, Bloomberg (founder ego risk)
   - **Acronym** — IBM, AWS (memorable only after fame)
   - **Wordplay / pun** — Zillow, Lyft (memorable)
   - **Foreign word** — Asana, Häagen-Dazs (distinctive, pronunciation risk)
2. **Score per name** (0–10):
   - Memorable (one-hear stick)
   - Pronounceable (intl)
   - Spellable (search match)
   - Domain availability (.com)
   - TM-clearable (per `/ip-collision-check`)
   - Doesn't mean something embarrassing in another language
   - Future-proof (won't constrain product evolution)
   - Founder loves
3. **Top-5 deeper test**:
   - Say aloud 3x
   - Read in tagline
   - Read in URL
   - Imagine on conference badge
   - Imagine in news headline
4. **Final 3** → full TM clearance (USPTO TESS) + domain check.
5. **Founder gut** — when in doubt, founder picks. Speed > perfection.

## Output
Write `docs/inception/naming-<project>.md`:

```markdown
# Naming Decision — <project>
**Date:** <YYYY-MM-DD>

## Brainstorm (30+)
| # | Candidate | Type |
|--:|---|---|
| 1 | <name> | coined |
| 2 | <name> | compound |
| ... | | |
| 30 | <name> | descriptive |

## Top-10 scored
| Name | Memorable | Pronounce | Spell | Domain | TM-clear | Intl-OK | Future | Founder | Total |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| <A> | 9 | 9 | 8 | 7 | 8 | 9 | 8 | 8 | 66 |
| <B> | 8 | 7 | 7 | 9 | 9 | 9 | 7 | 7 | 63 |
| ... | | | | | | | | | |

## Top-3 deep test
| Name | Sound aloud | Tagline test | URL test | Badge test | Headline test |
|---|---|---|---|---|---|
| <A> | strong | works | <a>.com | clean | "<A> raises $5M" — natural |
| <B> | OK | clunky | <b>.io | OK | OK |
| <C> | strong | works | <c>.com | clean | natural |

## Top-3 clearance (per `/ip-collision-check`)
| Name | TM US Class 9 | TM US Class 42 | TM EU | Domain .com | Social handles |
|---|---|---|---|---|---|
| <A> | clear | clear | clear | available $10 | all available |
| <B> | similar (Co X) | clear | clear | $35k aftermarket | mixed |
| <C> | clear | clear | similar | available $10 | available |

## Decision
**<Chosen name>**

## Rationale
- Strongest score
- Cleanest TM
- .com available
- Founder loves
- Future-proof for category evolution

## Anti-patterns
- ✗ Picking based on cleverness alone (memorable but unspellable)
- ✗ Two-word descriptive (cluttered, confusing)
- ✗ Hard-to-spell coined name without compelling brand reason
- ✗ Settling because impatient — vs spending 1 more week
- ✗ Asking too many people for opinions (vetocracy)

## Backup name
**<Second-place candidate>** — if primary fails clearance or other block.
```

## Verification
- ≥30 candidates brainstormed.
- Top-10 scored with all 8 dimensions.
- Top-3 TM-cleared via TESS.
- .com availability checked.
- Backup chosen.
