---
name: internal-tool-blast-radius-audit
description: Inventory of internal admin tools by potential damage — rows touched, dollars moved, customers affected — with risk-tier classification (T0–T3) and gate-requirement matrix per tool. Outputs to `docs/ops/internal-tool-blast-radius-<project>.md`. Use when user says "blast radius audit", "admin tool inventory", "internal tool risk", "what can my support tool do", "destructive action inventory", "/internal-tool-blast-radius-audit", or before a SOC2 readiness review / after an internal-tool incident. Upstream: `/rbac-model`, `/audit-log-design`. Downstream: `/override-gate-design`, `/two-person-rule-design`.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 6h
---

# /internal-tool-blast-radius-audit — Map the Buttons That Can End You

## Why you'd care

A support tool that can refund $10M, delete users in bulk, or mass-email customers is a single-employee insider-threat vector — and most teams have no idea which tools are T0 vs harmless. The audit surfaces what needs a confirm gate before it gets misused.

Why you'd care: most companies have no central inventory of what their internal admin tools can do. The "delete-user" button shipped in 2022 by an engineer who has since left is still wired to a support panel an L1 contractor has access to. You will not find this until the contractor's session is compromised at 3am. The audit forces a one-time enumeration of every destructive surface, classifies each by blast radius, and points you at which ones need an override-gate vs a two-person rule vs deletion. This is the input to your SOC2 CC6.3 + CC7.1 evidence.

## Pre-flight
- Read `/rbac-model` — you need the role-binding map to know who can hit each tool.
- Read `/audit-log-design` — gaps in audit-log coverage are first-class findings of this audit.
- If both `/override-gate-design` and `/two-person-rule-design` exist, this audit drives where each is applied.

## Inputs
- Source code access to every internal-facing app: support portal, admin dashboard, finance console, ops scripts, raw-SQL runbooks, Retool / Forest / Superblocks dashboards, Slack-bot commands, kubectl access to prod.
- Production DB schema + Stripe (or payment processor) account scope.
- Current RBAC matrix (who has which role).
- Last 90 days of audit-log events (to spot tools used in anger).
- List of past incidents tagged "internal tool" or "support action".

## Process

1. **Enumerate every admin surface.** Don't trust memory; grep + interview:
   - `grep -rE "admin|internal|support|ops" app/` — route handlers, pages, server actions.
   - Retool / Forest / Superblocks / Hex workspaces — list every app.
   - Slack bot commands wired to mutations (`/refund`, `/ban`).
   - Direct prod access: kubectl, psql, prisma studio, AWS console mutate permissions.
   - Cron jobs and one-off scripts in `scripts/` that mutate prod.
   - Stripe Dashboard restricted-key actions.
   - DNS / domain registrar / email-provider admin panels.
   - Cloud console: IAM, RDS snapshot delete, S3 bucket delete, KMS key disable.

   Build the master list as `tools[]` — one row per action, not per app.

2. **For each tool, capture the metadata table:**

   | Field | What |
   |---|---|
   | `tool_id` | stable slug, e.g. `support.delete-customer` |
   | `surface` | which app/portal exposes it |
   | `entry_point` | route / function / Slack command / Retool query |
   | `mutates` | tables + external systems (Stripe, S3, DNS) |
   | `reversibility` | hard / soft-Nd / via-ticket / impossible |
   | `roles_with_access` | from RBAC matrix |
   | `last_used` | from audit log (or "no audit coverage") |
   | `last_used_90d_count` | usage volume |
   | `audit_coverage` | yes / partial / none |

3. **Compute blast radius per tool.** Three dimensions, each scored independently:

   | Dimension | T0 | T1 | T2 | T3 |
   |---|---|---|---|---|
   | Rows touched | 1 | 1–10 | 10–1,000 | >1,000 or schema |
   | Dollars moved (one fire) | $0 | <$500 | $500–$10k | >$10k |
   | Customers affected | 0–1 internal | 1 ext | 2–10 ext | >10 or all-tenant |

   Tool tier = **max of the three dimensions** (not average — worst dimension wins).

   Multiply blast by reversibility:
   - reversibility=hard or impossible → bump tier +1 (cap T3).
   - reversibility=soft-30d → no change.
   - reversibility=soft-7d → no change.

4. **Map current control state per tool.** For each tool, mark:
   - Has override-gate? (type-to-confirm + reason)
   - Has step-up re-auth?
   - Has manager approval?
   - Has two-person rule?
   - Has rate limit?
   - Has audit-log coverage?

5. **Compute gap matrix.** Required controls per tier (default policy — adjust to your org):

   | Tier | Confirm dialog | Type-to-confirm | Reason field | Step-up reauth | Manager approval | Two-person | Audit |
   |---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
   | T0 | ✓ | | | | | | ✓ |
   | T1 | ✓ | ✓ | ✓ | | | | ✓ |
   | T2 | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ |
   | T3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

   Gap = required control not currently present. Each gap is a remediation ticket.

6. **Triage findings.** For each gap, classify:
   - **Fix-in-place:** add the missing gate; ticket → `/override-gate-design` or `/two-person-rule-design`.
   - **Demote:** restrict roles so fewer people can reach it; ticket → `/rbac-model` update.
   - **Delete:** the tool is unused (last_used >180 days) or was a one-off — remove the entry point entirely. The cheapest fix is the one you don't have to maintain.
   - **Decompose:** the tool does too much; split into smaller actions, each with a tighter gate.

7. **Surface the over-privileged-role problem.** Group tools by role: a role that can hit ≥3 T2+ tools is a concentration risk. Bank patterns: support-L1 is rarely allowed any T2; if yours can, that's a finding. Common fix: introduce a `support-l2-escalation` role that L1 must request into for the session.

8. **Surface audit-log gaps.** Any tool where `audit_coverage == none or partial` and tier ≥ T1 is a finding. This is the same evidence SOC2 CC7.1 wants; bundle the fix-list.

9. **Surface the "ghost tool" problem.** Tools with `last_used_90d_count == 0` AND access available to ≥5 people = ghost — nobody uses it but it can hurt you. Default disposition: delete or restrict to a single admin role. Re-grant on-demand if someone actually needs it.

10. **Stripe-Atlas pattern callout.** Their destructive-ops policy (public via security blog): every action that mutates production-customer state at scale requires (a) ticket, (b) two-engineer sign-off, (c) executable-as-code with diff in PR, (d) audit. For high-tier finds, propose this same shape — convert ad-hoc Retool actions into reviewed PRs.

11. **Quarterly cadence.** Schedule re-audit every 90 days. Track a Tier-T3-tool-count metric. Increase = drift; investigate.

12. **Deliver as a remediation plan, not a list.** Rank gaps by `(tier severity × access breadth)`. Top 10 ship in 30 days; the rest scheduled with owners.

## Output

Write `docs/ops/internal-tool-blast-radius-<project>.md`:

```markdown
# Internal-Tool Blast-Radius Audit — <project>
**Date:** <YYYY-MM-DD> | **Owner:** <security / platform team>
**Method:** code grep + Retool inventory + RBAC matrix + 90d audit-log review
**Re-audit cadence:** quarterly

## Summary
| Metric | Count |
|---|---:|
| Total admin actions inventoried | <N> |
| T0 (low) | <N> |
| T1 (medium) | <N> |
| T2 (high) | <N> |
| T3 (catastrophic) | <N> |
| Actions with full required controls | <N> |
| Actions with control gaps | <N> |
| Ghost tools (0 use 90d, ≥5 with access) | <N> |
| Audit-log coverage gaps (tier≥T1) | <N> |

## Inventory
| tool_id | surface | mutates | reversibility | roles_with_access | last_used | uses_90d | audit | tier |
|---|---|---|---|---|---|---:|---|:---:|
| support.delete-customer | /admin/customer | users, subs, stripe | soft 30d | support-l2, admin | 2026-04-12 | 3 | yes | T2 |
| support.mass-refund | /admin/finance | charges via Stripe | hard | finance-ops, admin | 2026-03-08 | 1 | partial | T3 |
| ops.kubectl-prod-exec | local | all of prod | hard | platform-engineer | 2026-05-01 | 12 | none | T3 |
| ... | | | | | | | | |

## Gate gap matrix
| tool_id | tier | confirm | type-to-confirm | reason | reauth | mgr approval | two-person | audit | gaps |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| support.delete-customer | T2 | ✓ | ✓ | ✓ | — | — | n/a | ✓ | reauth, mgr approval |
| support.mass-refund | T3 | ✓ | — | — | — | — | — | partial | type-to-confirm, reason, reauth, mgr approval, two-person, audit |
| ops.kubectl-prod-exec | T3 | — | — | — | — | — | — | none | ALL |
| ... | | | | | | | | | |

## Role concentration
| Role | T2+ tools accessible | Concentration risk |
|---|---:|---|
| admin | 14 | high — split into admin-billing, admin-platform, admin-security |
| support-l2 | 6 | medium — fine, but require step-up on T2 |
| support-l1 | 2 | low |
| finance-ops | 3 | low |

## Audit-log gaps (CC7.1 evidence)
- <tool_id 1> — no event written on execution
- <tool_id 2> — event written but missing `target.id`
- (etc.)

## Ghost tools (delete or restrict)
- <tool_id> — last used <date>, <N> roles can fire it
- (etc.)

## Remediation plan
| Priority | tool_id | Action | Owner | Due |
|:---:|---|---|---|---|
| P0 | ops.kubectl-prod-exec | Wrap in approval workflow; restrict access to platform-lead + on-call; emit audit on every exec | platform | <date> |
| P0 | support.mass-refund | Add type-to-confirm + reason + two-person rule (`/two-person-rule-design`) | support eng | <date> |
| P1 | support.delete-customer | Add step-up reauth + manager approval | support eng | <date> |
| P1 | <ghost_tool_id> | Delete entry point | <owner> | <date> |
| (etc.) | | | | |

## Tier-T3 trend (re-audit cadence)
| Date | T3 count |
|---|---:|
| <prev audit date> | <N> |
| <this audit date> | <N> |

Increase from prior audit → root-cause review.

## Anti-patterns surfaced
- <e.g. "8 different admin panels each with their own ad-hoc auth">
- <e.g. "RBAC says 'admin' role; in practice 23 people are admin">
- <e.g. "Retool app `customer-tools` has unaudited write queries">

## References
- `/override-gate-design` for T1+ gate work
- `/two-person-rule-design` for T3 dual-control
- `/rbac-model` for role split work
- `/audit-log-design` for audit-coverage gaps
```

## Verification
- Every admin surface (code, Retool, Slack bot, prod console) is inventoried — no source skipped.
- Each tool has a tier assigned by the worst-dimension rule, not average.
- Reversibility multiplier is applied (hard or impossible → tier +1).
- Gap matrix lists missing controls per tool, ranked.
- Ghost tools (no use in 90d + ≥5 with access) are flagged for delete-or-restrict.
- Remediation plan has owner + due date per item, top 10 inside 30 days.
- Quarterly re-audit scheduled on the calendar.
