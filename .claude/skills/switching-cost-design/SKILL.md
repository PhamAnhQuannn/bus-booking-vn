---
name: switching-cost-design
description: Design switching costs — data lock-in, workflow integration, training sunk cost, contract terms. Outputs to `docs/inception/switching-costs-<project>.md`. Use when user says "switching cost", "lock-in", "stickiness", "retention design", "/switching-cost-design", or before `/competitive-moat-analysis`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /switching-cost-design — Make Leaving Cost Something

Switching costs are the second-most reliable moat after real network effects. Designed thoughtfully = ethical. Designed greedily = customer-hostile and triggers regulators.

## Why you'd care

Products without designed switching costs lose customers at the first hint of churn. Data lock-in, workflow integration, and contract terms compound retention in a way no feature can.

## Pre-flight
None. Pairs with `/network-effect-design`, `/data-moat-design`.

## Inputs
- Product surface, user data flow, current contract terms.

## Process
1. **List candidate switching costs** across 6 types:
   - **Data**: accumulated user data, history, settings, customizations
   - **Workflow**: deep integration with other tools (CI, accounting, CRM, POS)
   - **Training**: hours spent learning, muscle memory, certifications
   - **Social / reputation**: followers, reviews, network they built on platform
   - **Contract**: term length, prepay, exit fees
   - **Identity**: phone number, account name, URL — externally referenced
2. **Score each** for your product 1-5: how strong does this cost become at month 12?
3. **Ethical filter** — distinguish "earned" lock-in (real value created) from "imposed" lock-in (hostage-taking).
   - ✓ Data export available (right to leave) — earned lock-in
   - ✗ No export, vendor-only format — imposed lock-in
4. **Design moves** — for each kept type, concrete product moves to deepen it:
   - Data: invite users to enrich profile, history, preferences
   - Workflow: build integrations early, deep not shallow
   - Training: certification program, in-app credentials
   - Social: encourage public profile, public reviews
5. **Anti-pattern check** — if your lock-in plan relies on no-export, hidden cancel buttons, or auto-renewal traps → re-design. Regulators (FTC click-to-cancel rule, EU DSA) will force it.
6. **Net Promoter math** — if NPS is negative, switching costs only delay churn; users leave the moment alternative emerges. Fix product first.

## Output
Write `docs/inception/switching-costs-<project>.md`:

```markdown
# Switching Cost Design — <project>
**Date:** <YYYY-MM-DD>

## Candidate types
| Type | Applies? | Strength at month 12 (1-5) | Earned or imposed? |
|------|----------|-----------------------------|---------------------|
| Data | Y/N | __ | Earned/Imposed |
| Workflow | Y/N | __ | Earned/Imposed |
| Training | Y/N | __ | Earned/Imposed |
| Social/Reputation | Y/N | __ | Earned/Imposed |
| Contract | Y/N | __ | Earned/Imposed |
| Identity | Y/N | __ | Earned/Imposed |

## Primary switching cost
**Type:** <e.g., workflow integration>
**Mechanism:** <one paragraph>

## Design moves (next 90 days)
1. <e.g., ship CI integration w/ GitHub, GitLab — week 4>
2. <e.g., allow custom dashboard layouts saved per tenant — week 6>
3. <e.g., run-history dashboard 12-month — week 8>

## Ethical filter passed
- [ ] One-click data export available
- [ ] Cancel-anywhere (no phone-call-only)
- [ ] No dark-pattern auto-renewal
- [ ] Terms of service plain-language

## NPS guard
- Current NPS: <X>
- If NPS < 0: switching costs delay, not prevent, churn. Pause moat work, fix product.

## Risks
- Regulator action: FTC click-to-cancel, EU DSA, state laws
- PR backlash if export blocked
- Competitor "easy migration" campaigns

## Next
- Combine w/ moat assessment → `/competitive-moat-analysis`
- Data moat specifically → `/data-moat-design`
- Cancel flow design → `/onboarding-flow` (mirror image)
```

## Verification
- All 6 types triaged.
- "Earned vs imposed" tagged per type.
- ≥ 3 design moves with dates.
- Ethical filter checklist clean.
- NPS guard stated.
