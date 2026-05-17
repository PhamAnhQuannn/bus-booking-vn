---
name: traction-stage-gate
description: Gate which skills/compliance/board/insurance fire based on traction stage (pre-PMF / paid / scale / enterprise). Outputs active-skill subset to `docs/classify/traction-<project>.md`. Reads `/project-classify`. Fires EARLY in Inception — right after `/project-classify` and BEFORE any compliance/governance/board skill is considered — so per-stage skill subset constrains the rest of Inception. Use when user says "traction stage", "what skills apply", "stage gate", "/traction-stage-gate", or before invoking heavy compliance/governance skills.
output_size:
  XS: 30m
  S: 30m
  M: 30m
  L: 30m
  XL: 30m
---

# /traction-stage-gate — Stage-Based Skill Subset

Invoke as `/traction-stage-gate`. Project class (XS–XL) describes intrinsic complexity. Traction stage describes where the product is in its life. Different stages activate different skills.

## Why you'd care

Loading every compliance and governance skill before product-market fit is how pre-PMF teams burn months on SOC 2 instead of finding customers. The stage gate prunes the skill set to what actually applies right now.

## Pre-flight
1. Read `docs/classify/<project>.md` (project class).
2. Read any of: revenue records, user count, customer list, runway report.

## Inputs
- Current MRR / ARR (or "0" pre-revenue)
- Paid customers count
- Has signed contracts (DPA/MSA/BAA)? Y/N
- Funded? (bootstrap / pre-seed / seed / Series A+)
- Months since first launch

## Process

1. **Stage rubric**:

   | Stage | Trigger condition |
   |---|---|
   | **T0 pre-build** | no code, no users, idea/research only |
   | **T1 pre-PMF** | code shipped, <10 users, no revenue |
   | **T2 early-paid** | $1–10k MRR OR 1–10 paying customers |
   | **T3 scale** | $10k–100k MRR OR 50+ paying customers |
   | **T4 enterprise** | first signed DPA/MSA OR >$10k ACV deal OR any contract with audit clause |
   | **T5 mature** | $100k+ MRR OR SOC2/ISO certified OR >50 employees |

2. **Skill activation per stage**:

   | Skill cluster | T0 | T1 | T2 | T3 | T4 | T5 |
   |---|:--:|:--:|:--:|:--:|:--:|:--:|
   | Inception (problem/market) | ✓ | ✓ | – | – | – | – |
   | Discovery (interviews) | ✓ | ✓ | ✓ | – | – | – |
   | Design + Build core | – | ✓ | ✓ | ✓ | ✓ | ✓ |
   | Testing baseline | – | ✓ | ✓ | ✓ | ✓ | ✓ |
   | Release (canary, blue-green) | – | – | ✓ | ✓ | ✓ | ✓ |
   | Operate (SLO, DORA, incident) | – | – | ✓ | ✓ | ✓ | ✓ |
   | Lean loop (activation, churn) | – | ✓ | ✓ | ✓ | – | – |
   | Compliance — ToS/Privacy/GDPR baseline | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
   | Compliance — DPA/SOC2/HIPAA/PCI | – | – | – | ✓ | ✓ | ✓ |
   | Enterprise — SSO/RBAC/Audit-log | – | – | – | – | ✓ | ✓ |
   | Governance — Board/Cap-table/409a | – | – | – | – | ✓ | ✓ |
   | Sunset — customer-offboarding | – | – | ✓ | ✓ | ✓ | ✓ |

3. **Hide noisy skills** — emit explicit skip-list. Future skill invocations check this gate before firing.

4. **Re-gate triggers**:
   - First paying customer → re-run, expect T1→T2 promotion
   - First $10k MRR → T2→T3
   - First signed contract with audit clause → T3→T4
   - Annual review

## Output

Write `docs/classify/traction-<project>.md`:

```markdown
# Traction Gate — <project>
**Date:** <YYYY-MM-DD> | **Class:** <XS-XL> | **Stage:** <T0-T5>

## Stage rationale
- MRR: <X>
- Paid customers: <N>
- Signed contracts: <Y/N>
- Months since launch: <M>
- → Stage T<N>

## Active skill clusters
- ✓ Inception baseline
- ✓ Design/Build/Test
- ✗ Compliance heavy (gated to T3+)
- ✗ Enterprise multi-tenancy (gated to T4+)

## Skill skip-list (will not auto-fire)
- iso27001-pre-scope (T4+)
- sso-saml-design (T4+)
- 409a-precheck (T4+)
- board-meeting-cadence (T4+)
- [N more]

## Re-gate trigger
- First paying customer
- First $10k MRR
- First DPA signed
- Quarterly review

## Next recommended skill
<one>
```

## Verification
- Stage assigned with named trigger condition met.
- Active vs skip lists both explicit.
- Re-gate triggers named.
- Doesn't override `/project-classify` — both gate together (class ∩ stage).
