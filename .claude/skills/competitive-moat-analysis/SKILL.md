---
name: competitive-moat-analysis
description: Hamilton Helmer 7-Powers analysis — counter-positioning, scale economies, network economies, switching cost, branding, cornered resource, process power. Outputs to `docs/inception/moat-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "moat", "7 powers", "competitive advantage", "/competitive-moat-analysis", or before fundraising.
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 2h
  XL: 4h
---

# /competitive-moat-analysis — 7 Powers

## Why you'd care

A startup without an articulable durable advantage gets commoditized the day a well-funded incumbent decides to compete. Helmer's 7 forces you to name the specific moat — scale, network, switching cost, cornered resource, process, brand, or counter-positioning — before the term sheet conversation needs the answer.

Invoke as `/competitive-moat-analysis`. Helmer's 7. No moat = no business long-term.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S → SKIP
   - M+ → after PMF
2. Read `docs/inception/incumbent-moat-<project>.md` + `commodity-risk-<project>.md`.

## Inputs
- Product + business model.
- Competitor list.
- Customer base size + behavior data.

## Process
1. **Score current state on 7 Powers** — 0–10 each:
   - **Counter-positioning** — incumbent can't copy without cannibalizing core
   - **Scale economies** — unit cost falls with scale (you have, they can't catch)
   - **Network economies** — value per user grows with user count
   - **Switching costs** — pain for customer to leave
   - **Branding** — durable trust premium (luxury, regulated)
   - **Cornered resource** — exclusive access (patent, contract, talent)
   - **Process power** — embedded org capability impossible to copy quickly
2. **Identify which power(s)** you'll build (typically 1–2, rarely more).
3. **Build plan per chosen power** — what investments, by when.
4. **Power test** — for each power: would removing it kill the business?
5. **Stage check** — Origination (have plan) / Take-Off (executing) / Stability (locked in).

## Output
Write `docs/inception/moat-<project>.md`:

```markdown
# Competitive Moat — <project>
**Date:** <YYYY-MM-DD>

## 7 Powers scoring (current)
| Power | Score | Notes |
|---|--:|---|
| Counter-positioning | 4 | Mid; incumbent could copy with org pain |
| Scale economies | 1 | Tiny; no advantage |
| Network economies | 6 | Multi-sided; growing |
| Switching costs | 5 | Some data lock-in |
| Branding | 2 | New brand, no premium yet |
| Cornered resource | 0 | None |
| Process power | 1 | Too young |

## Chosen powers (target)
1. **Network economies** — multi-sided marketplace; flywheel after 100 active sellers
2. **Switching costs** — embedded API + workflow integrations

## Build plan
### Network economies
- Year 1: hit 100 active sellers (current 20)
- Year 2: 500 sellers; matching effect strong
- Year 3: 2000 sellers; clear leader

### Switching costs
- Q1: API webhooks (1-way data out)
- Q2: deep CRM integrations (Salesforce, HubSpot)
- Q3: workflow automation triggers

## Power tests
- Network: yes — without 100+ active sellers, value collapses
- Switching: partial — some buyers tolerate cost to leave

## Stage
- Network: Origination (plan, no take-off yet)
- Switching: Origination → Take-Off (Q1 build live)

## Verdict
**MOAT-PLAUSIBLE / WEAK / NONE**
- Plausible: ≥1 power scores ≥6 in target state
- Weak: scattered low scores
- None: kill or pivot to where moat exists
```

## Verification
- All 7 Powers scored honestly (most products have 0–2 strong, that's normal).
- Chosen powers ≤2 (over-claiming = lying).
- Build plan per power has timeline + investment.
- Power test answered (would removing kill business?).
