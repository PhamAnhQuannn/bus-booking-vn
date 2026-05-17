---
name: grant-eligibility-scan
description: Scan for grant/non-dilutive funding eligibility by domain (SBIR/STTR, EU Horizon, climate, AI safety, public-good) before founders default to VC. Outputs to `docs/inception/grants-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "grants", "non-dilutive funding", "SBIR", "Horizon", "/grant-eligibility-scan", or before `/funding-strategy`.
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 2h
  XL: 4h
---

# /grant-eligibility-scan — Non-Dilutive Funding

## Why you'd care

Most founders default to VC without checking if non-dilutive funding (SBIR/STTR, Horizon, climate) would have given them the same cash without the cap-table dilution. A 30-minute eligibility scan can save 10–20% of the company.

Invoke as `/grant-eligibility-scan`. Anti-default-to-VC skill. Surfaces free money first.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS / S → SKIP (grant overhead > grant value at this scale).
   - M+ → continue.
2. Read `docs/inception/canvas-<project>.md` if exists — pull domain.

## Inputs
- Domain tags (one or more: ai / ai-safety / climate / health / education / accessibility / public-good / dual-use / hardware / biotech / quantum / cyber / space / defense).
- Founder country + entity country (eligibility often jurisdiction-bound).
- Stage (idea / prototype / revenue / scale).
- Is product open-source? (gates many EU + public grants).

## Process
1. **Match programs** to domain × jurisdiction × stage.
2. **Per-program** — capture: name, ceiling, dilutive?, IP-takes?, deadlines, docs needed.
3. **Effort estimate** — application weeks + reporting overhead if won.
4. **ROI ranking** — $ ceiling / authoring weeks.
5. **Top 3 to pursue** vs skip-the-rest.

## Reference programs (non-exhaustive — verify current calls)
- **US:** SBIR/STTR (DoD/NIH/NSF/DoE), NSF America's Seed Fund, NIH Direct-to-Phase-II, USDA SBIR, ARPA-H, ARPA-E, NIST AI grants
- **EU:** Horizon Europe (EIC Accelerator/Pathfinder), Eurostars, EU AI Act sandbox, Digital Europe Programme
- **UK:** Innovate UK SMART, NIHR i4i
- **Canada:** IRAP, SR&ED (tax credit, not grant)
- **Climate:** Breakthrough Energy, Prime Coalition, ClimateWorks
- **AI safety:** OpenPhilanthropy, Survival & Flourishing Fund, LTFF, SFF
- **Open-source:** Sovereign Tech Fund (DE), NLnet, Mozilla MOSS, Open Tech Fund

## Output
Write `docs/inception/grants-<project>.md`:

```markdown
# Grant Eligibility — <project>
**Date:** <YYYY-MM-DD> | **Domain:** <tags> | **Jurisdiction:** <X>

## Eligible programs
| # | Program | Ceiling | Dilutive? | IP take? | Deadline | App weeks | Reporting | ROI ($/wk) |
|--:|---------|--------:|:--------:|:--------:|----------|----------:|-----------|-----------:|
| 1 | NSF SBIR Phase I | $275k | No | No | Mar / Sep | 6 | Quarterly | $46k/wk |
| 2 | EIC Accelerator | €17.5M | Equity option | No | Rolling | 12 | Heavy | $1.5M/wk |
| ... | | | | | | | | |

## Top 3 to pursue
1. <program> — <why>
2. <program> — <why>
3. <program> — <why>

## Skip and why
- ...

## Disqualified (non-eligible)
- ...
```

## Verification
- ≥3 programs evaluated (not single-program decision).
- ROI ranked, not chronological order.
- Disqualified list shows you actually checked (not "none" by default).
- Deadlines sourced (note "verify on official site as of <date>").
