---
name: risk-register
description: Rolling probability×impact risk matrix across all project risks (tech, market, legal, ops, financial, key-person). Outputs to `docs/inception/risk-register-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "risk register", "risk matrix", "P×I", "what could go wrong", "/risk-register", or before inception-gate-review.
output_size:
  XS: 30m
  S: 30m
  M: 1h
  L: 1h
  XL: 2h
---

# /risk-register — Risk Register

Invoke as `/risk-register`. Enumerate risks. Score. Assign mitigation owner.

## Why you'd care

Risks that aren't on a list and ranked never get worked on — they only get post-mortemed. A rolling P×I matrix is what turns "oh no" moments into pre-empted mitigations.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP.
   - S → Top-10 risks only.
   - M/L/XL → full register.
2. Read existing inception artifacts to harvest known risks:
   - `docs/inception/rat-<project>.md` — top assumption already flagged.
   - `docs/inception/threat-model-pre-<project>.md` — security risks.
   - `docs/inception/runway-model-<project>.md` — financial risks.
   - `docs/inception/regulatory-preflight-<project>.md` — compliance risks.
   - `docs/inception/founder-fit-<project>.md` — key-person risks.

## Inputs
- All inception artifacts above.
- Brainstorm dump of "what kills this".
- Cadence: weekly review during pre-launch, monthly post-launch.

## Process
1. **Enumerate** — list all risks across 6 categories:
   - Tech / Feasibility
   - Market / Demand
   - Legal / IP / Regulatory
   - Financial / Runway
   - Operational / Key-Person
   - External (macro, dependency, vendor)
2. **Score each** 1–5:
   - **Probability** (1=rare, 5=near-certain)
   - **Impact** ($ loss, time lost, or kill-product severity)
3. **Risk = P × I** (1–25). Tier:
   - 15–25 = Red (action now)
   - 8–14 = Amber (mitigation plan, monitor)
   - 1–7 = Green (accept, monitor)
4. **Per Red/Amber row** define:
   - Mitigation action
   - Owner (always founder in solo-dev)
   - Trigger (what tells you risk is materializing)
   - Review date
5. **Top-5 watchlist** — surfaced to weekly stand-up.
6. **Roll forward** — at each review, re-score, retire closed risks, add new ones, never delete (mark CLOSED with date + outcome).

## Output
Write `docs/inception/risk-register-<project>.md`:

```markdown
# Risk Register — <project>
**Created:** <YYYY-MM-DD> · **Last review:** <YYYY-MM-DD> · **Next review:** <YYYY-MM-DD>

## Top-5 Watchlist
1. R-007 — Stripe Connect rejection (P5 × I5 = 25)
2. R-002 — Cold-outreach reply rate < 2% (P4 × I5 = 20)
3. ...

## Register
| ID | Category | Risk | P | I | Score | Tier | Mitigation | Owner | Trigger | Review | Status |
|---|---|---|--:|--:|--:|---|---|---|---|---|---|
| R-001 | Tech | better-sqlite3 native-build fails on prod node version | 3 | 4 | 12 | Amber | Pin node version in CI, doc rebuild script | me | CI fail on deploy | 2026-06-01 | OPEN |
| R-002 | Market | Cold-outreach reply rate < 2% | 4 | 5 | 20 | Red | Run 50-message test before MVP build | me | Test result | 2026-05-20 | OPEN |
| R-003 | Legal | TM collision on brand name | 2 | 5 | 10 | Amber | USPTO TESS search complete | me | TM filing | 2026-05-25 | OPEN |
| R-004 | Financial | Runway < 9 mo at launch | 3 | 5 | 15 | Red | Pre-sale 5 LOIs before build | me | LOI count | 2026-06-15 | OPEN |
| R-005 | Operational | Solo-dev burnout | 3 | 5 | 15 | Red | 1-day/wk hard rest; quarterly check | me | Energy < 6/10 | 2026-08-01 | OPEN |
| ... | | | | | | | | | | | |

## Closed
| ID | Risk | Resolution | Closed |
|---|---|---|---|
| R-000 | better-sqlite3 NODE_MODULE_VERSION | Pinned to 20.x + rebuild script | 2026-05-08 |

## Review log
- 2026-05-10 — created, 12 risks, 3 Red.
- ...
```

## Verification
- ≥10 risks for M+; ≥5 for S.
- Every Red has mitigation + trigger + review date.
- All 6 categories represented (or explicitly N/A with reason).
- Top-5 watchlist size = 5, not more.
- No deletions — closed risks retained with outcome.

## When to re-run
- Weekly during pre-launch.
- Monthly post-launch.
- After any incident, near-miss, or major external change.
- Always before `/inception-gate-review`.
