---
name: stakeholder-map
description: Power-Interest grid + RACI for every stakeholder (users, buyers, blockers, regulators, vendors, partners, advisors). Outputs to `docs/inception/stakeholder-map-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "stakeholder map", "stakeholders", "power-interest", "RACI", "who needs to know", "/stakeholder-map", or before inception-gate-review.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /stakeholder-map — Stakeholder Map

Invoke as `/stakeholder-map`. Identify who matters. Score power × interest. Plan engagement.

## Why you'd care

Stakeholders you didn't map are the ones who block your launch from the corner you weren't watching. The Power-Interest grid surfaces them while there's still time to bring them along.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP.
   - S → Solo-dev fast pass (5–8 stakeholders).
   - M/L/XL → full Mendelow grid + RACI.
2. Pull priors:
   - `docs/inception/buyer-persona-deep-<project>.md` — buyer + user split.
   - `docs/inception/procurement-pathway-<project>.md` — economic buyer, gatekeepers.
   - `docs/inception/regulatory-preflight-<project>.md` — regulators.
   - `docs/inception/channel-partner-map-<project>.md` — partners.

## Inputs
- Project goal.
- Org chart of target buyer (if B2B).
- List of any 3rd-party dependencies (Stripe, AWS, app stores, gov agencies).

## Process
1. **Enumerate stakeholders** across 7 buckets:
   - End users
   - Economic buyer (signs check)
   - Champion (internal advocate)
   - Blocker / Saboteur (loses from change)
   - Regulator / Compliance
   - Vendor / Platform dependency
   - Advisor / Investor / Community
2. **Score each** 1–5:
   - **Power** (ability to help/kill project)
   - **Interest** (cares about outcome)
3. **Mendelow quadrant**:
   - **High-Power High-Interest** → Manage Closely
   - **High-Power Low-Interest** → Keep Satisfied
   - **Low-Power High-Interest** → Keep Informed
   - **Low-Power Low-Interest** → Monitor
4. **RACI per major decision** (e.g., pricing change, regulatory submission, launch date):
   - **R**esponsible · **A**ccountable · **C**onsulted · **I**nformed
5. **Engagement plan** per Manage-Closely stakeholder:
   - Cadence (weekly/monthly demo, async update, formal review)
   - Channel (email, Slack, in-person)
   - Message (what they need to hear)
6. **Risk flag**: any Manage-Closely stakeholder unidentified or unreachable → add to `/risk-register`.

## Output
Write `docs/inception/stakeholder-map-<project>.md`:

```markdown
# Stakeholder Map — <project>
**Date:** <YYYY-MM-DD>

## Mendelow grid
| Stakeholder | Bucket | Power | Interest | Quadrant | Stance (+/-/?) |
|---|---|--:|--:|---|:-:|
| VP Engineering (buyer) | Economic buyer | 5 | 5 | Manage Closely | + |
| End-user devs | End user | 2 | 5 | Keep Informed | ? |
| Tech-lead (champion) | Champion | 4 | 5 | Manage Closely | + |
| Incumbent observability vendor | Blocker | 4 | 3 | Keep Satisfied | − |
| Stripe (platform) | Vendor | 5 | 1 | Keep Satisfied | ? |
| SOC 2 auditor | Regulator | 3 | 2 | Monitor | ? |
| Dev-rel community / OSS maintainers | Community | 2 | 4 | Keep Informed | + |
| ... | | | | | |

## Engagement plan (Manage-Closely only)
| Stakeholder | Cadence | Channel | Key message | Next touch |
|---|---|---|---|---|
| VP Engineering | Weekly | In-person | ROI proof, low switching cost | 2026-05-15 |
| Tech-lead (champion) | 2× weekly | Slack | Wins, blockers, asks | 2026-05-13 |

## RACI — key decisions
| Decision | R | A | C | I |
|---|---|---|---|---|
| Pricing change | Founder | Founder | Champion, advisor | Users, blockers |
| Launch date | Founder | Founder | Buyer, design partners | Community, regulator |
| Regulatory submission | Founder | Founder | Lawyer | Buyer |

## Unidentified / unreachable (risk)
- [name/role] — why critical, why blocked, owner, next step.

## Re-run trigger
- Org change at buyer site.
- New regulator/vendor enters scope.
- Champion leaves / blocker hired.
```

## Verification
- All 7 buckets represented (or N/A with reason).
- ≥1 Champion + ≥1 Blocker named (no Blocker = blind spot).
- Every Manage-Closely entry has cadence + channel + next-touch date.
- RACI has exactly one **A**ccountable per row.
- Stance (+/-/?) recorded for every stakeholder.

## When to re-run
- Quarterly during inception.
- After any org change at the buyer.
- Before every major decision (pricing, launch, pivot).
- Always before `/inception-gate-review`.
