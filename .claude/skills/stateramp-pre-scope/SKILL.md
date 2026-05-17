---
name: stateramp-pre-scope
description: StateRAMP authorization scoping (Low/Moderate/High) — sponsor, control count, snapshot vs ATO, cost. Outputs to `docs/inception/stateramp-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "StateRAMP", "state government customer", "/stateramp-pre-scope", or before pursuing US state/local deal.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /stateramp-pre-scope — StateRAMP Pre-scoping

> **Effort estimate caveat:** `XL: 8h` covers *pre-scoping only* (impact-level pick, sponsor strategy, 3PAO shortlist, snapshot vs Authorized path). Full StateRAMP authorization is **6–12 months + $80k–$300k** (3PAO assessment, PMO review, ConMon). The 8h figure is NOT total project effort — multiply by ~30× (months not hours) when budgeting roadmap.

Invoke as `/stateramp-pre-scope`. M+ for state pipeline. Cheaper, faster than FedRAMP. Same NIST 800-53 base.

## Why you'd care

State and local procurement increasingly requires StateRAMP before signing — pursuing the deal without scoping the authorization burns months of BD effort. Pre-scope to know whether the deal is even worth chasing.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S → SKIP
2. Read `docs/inception/regulatory-<project>.md`.

## Inputs
- State/local customer pipeline.
- States in scope (some have own framework: TX-RAMP, AZ).
- Existing posture (SOC 2? FedRAMP?).

## Process
1. **StateRAMP overview**:
   - Born 2020; modeled on FedRAMP
   - Same NIST 800-53 controls
   - Lighter authorization process
   - Marketplace listing key for visibility
2. **Status options**:
   - **Ready** — self-attestation; cheap, fast, weak signal
   - **Authorized** — full 3PAO audit; strong signal
   - **Provisional** — interim while pursuing Authorized
3. **Impact levels** — Low / Moderate / High (same as FedRAMP).
4. **State alternatives**:
   - **TX-RAMP** — Texas; tier 1/2/3; required for TX state contracts
   - **AZ** — uses StateRAMP directly
   - **California** — own framework (CDT)
   - **NY OITS** — state-specific
5. **Reciprocity**:
   - **FedRAMP → StateRAMP** — generally accepted
   - **StateRAMP Authorized → some states accept directly**
   - **SOC 2 + StateRAMP Ready** — middle ground
6. **Cost vs FedRAMP**:
   - StateRAMP Authorized Moderate: ~$150k–$300k (vs FedRAMP $1M)
   - Timeline: 9–15 mo (vs 18–24)
   - 3PAO selection: same pool as FedRAMP

## Output
Write `docs/inception/stateramp-<project>.md`:

```markdown
# StateRAMP Pre-scope — <project>
**Date:** <YYYY-MM-DD>

## Decision
**PURSUE-AUTHORIZED / READY-ONLY / TX-RAMP-FIRST / DEFER / SKIP**

## Sponsor / pipeline
- States in pipeline: <list>
- Specific opportunities: <RFPs / contracts>
- Sponsor: <state agency if engaged>

## Impact level
- **Chosen:** Moderate
- Rationale: state CJI / PII not classified
- Control count: ~325

## Path
- StateRAMP Ready (self-attest) → Authorized (3PAO audit)
- 3PAO: <vendor>
- Marketplace listing post-Ready: yes

## Effort + cost
| Phase | Duration | Cost |
|---|---|--:|
| Readiness gap-close | 6–9 mo | $100k |
| 3PAO audit (Authorized) | 6 mo | $200k |
| Marketplace listing | 1 mo | $5k |
| ConMon Y1 | ongoing | $50k |
| **Total Y1 to Authorized** | **15 mo** | **~$355k** |

## Comparison to FedRAMP
| Dimension | StateRAMP | FedRAMP |
|---|---|---|
| Cost | $355k | $1M+ |
| Time | 12–15 mo | 18–24 mo |
| Control count | 325 | 325 |
| Sponsor required | helpful | mandatory |
| Reciprocity from FedRAMP | yes | n/a |

## Per-state framework needs
| State | Framework | Status needed |
|---|---|---|
| TX | TX-RAMP | Tier 2 minimum for state |
| AZ | StateRAMP | Authorized accepted |
| CA | CDT | separate; defer |
| NY | OITS audit | per-contract |

## Mitigation
- Start with **Ready** (3 mo, $30k) — listed in marketplace
- Escalate to Authorized once first state contract closes
- Use SOC 2 Type II as foundation (heavy overlap)

## Revenue justification
- State pipeline value: $X
- Cost-per-state-contract avg: $Y
- Break-even after <N> state contracts

## Risk if skip
- State RFPs require StateRAMP increasingly
- Procurement officers reject non-listed vendors
- TX explicitly requires TX-RAMP for state contracts

## 90-day plan
1. Pick states + impact level (week 1)
2. Engage 3PAO advisor (week 2–4)
3. Gap analysis (week 4–10)
4. Submit Ready self-attestation (week 10–12)
5. Decide Authorized escalation timing (end Q1)
```

## Verification
- Specific states in scope listed.
- Status (Ready vs Authorized) chosen with rationale.
- Cost compared to FedRAMP if relevant.
- Per-state framework variations noted.
