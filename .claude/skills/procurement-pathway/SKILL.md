---
name: procurement-pathway
description: Map the procurement path required for target buyer (self-serve / SMB / mid-market / enterprise / public sector) — flags 6-month sales cycles before you build for them. Outputs to `docs/inception/procurement-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "how do they buy", "procurement", "sales cycle", "/procurement-pathway", or before targeting enterprise/gov.
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 2h
  XL: 4h
---

# /procurement-pathway — How They Buy

Invoke as `/procurement-pathway`. Anti-naive-enterprise skill. Maps gates from intent → signed contract.

## Why you'd care

Selling into enterprise or government means six-month procurement cycles, security questionnaires, and an InfoSec gauntlet — none of which your product roadmap accounted for. Mapping the path early stops you from building features no buyer can purchase.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS / S → SKIP (self-serve only at this scale).
   - M+ → continue.
2. Read `docs/inception/canvas-<project>.md` for target customer segment.

## Inputs
- Target buyer segment (one of: self-serve / SMB / mid-market / enterprise / public-sector / regulated).
- Average deal size hypothesis ($).
- Decision-maker title.

## Process
1. **Identify pathway** — match segment to required gates.
2. **Per-gate document** — list every artifact buyer will demand.
3. **Cycle estimate** — weeks per gate, total.
4. **Cost estimate** — sales/legal/security artifact authoring cost.
5. **Self-serve fallback** — could you skip this segment and stay self-serve?

## Procurement gates by segment
| Segment | Gates | Typical cycle |
|---|---|---:|
| **self-serve** | credit card | 0 days |
| **SMB** | demo + invoice + ToS click | 2–4 wk |
| **mid-market** | demo + security q'naire + MSA negotiation | 6–12 wk |
| **enterprise** | RFP/RFI + SOC2 + DPA + MSA + InfoSec review + Legal redline + procurement portal | 4–9 mo |
| **public-sector** | bid response + FedRAMP/StateRAMP + Section 508 + W-9 + SAM.gov + small-business cert | 6–18 mo |
| **regulated (health/finance)** | + HIPAA BAA / PCI AOC / SOC2 / pen-test / model risk / vendor onboarding | +3–6 mo on enterprise |

## Output
Write `docs/inception/procurement-<project>.md`:

```markdown
# Procurement Pathway — <project>
**Date:** <YYYY-MM-DD> | **Segment:** <X> | **Avg deal:** $X | **Est cycle:** N wk

## Required gates
| Gate | Artifact needed | Wk | Authoring cost | Status |
|---|---|---:|---:|---|
| Demo | scripted demo + sandbox | 1 | $X | not started |
| SOC2 | audit report | 12 | $30k+12mo | not started |
| ... | ... | | | |
| **Total** | | **N** | **$X** | |

## Decision-maker map
- Champion: <title>
- Economic buyer: <title>
- Technical evaluator: <title>
- Gatekeeper: <title>

## Self-serve fallback
<could we skip this segment? at what revenue cap?>

## Verdict
<PURSUE / DELAY-12-mo / SKIP-segment + 2 lines>
```

## Verification
- Gate list matches segment template (no missing artifacts).
- Cycle weeks summed.
- Self-serve fallback explicitly considered (don't drift into enterprise by default).
