---
name: two-person-rule-design
description: Dual-control design for high-blast-radius internal actions — mass refund, prod DB write, account deletion, secrets rotation. Approver-can't-be-actor invariant, expiring approval tokens, break-glass override. Outputs to `docs/design/two-person-rule-<action>-<project>.md`. Use when user says "two-person rule", "dual control", "four-eyes", "maker-checker", "segregation of duties", "SOX SoD", "/two-person-rule-design", or before shipping a T3-tier admin action. Upstream: `/override-gate-design`, `/rbac-model`, `/audit-log-design`. Downstream: `/internal-tool-blast-radius-audit`, `/incident-commander-runbook`.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 3h
  XL: 4h
---

# /two-person-rule-design — Two Keys to Launch

Why you'd care: a single compromised support session, a single fat-finger by a half-asleep engineer, or a single rogue insider should not be able to wipe a tenant, mass-refund $200k, or rotate the prod root credential. The two-person rule (a.k.a. four-eyes, maker-checker, dual control) is the SOX-era control pattern that turns a single point of failure into two — borrowed from bank wire-transfer desks (e.g., wires >$50k require a second clerk's sign-off) and codified in NIST SP 800-53 AC-3(2). Skip it and your worst incident is one bad session away.

## Why you'd care

Single-operator mass-refund or prod-DB-write actions are how rogue actors, compromised credentials, and well-meaning mistakes drain accounts in minutes. The two-person rule is the blast-radius cap that doesn't depend on individual judgment.

## Pre-flight
- Read `/override-gate-design` — two-person is the gate elements at T3.
- Read `/rbac-model` — both actors need identity + role binding.
- Read `/audit-log-design` — every dual-control event chains two audit entries.
- Confirm a notification channel exists (Slack, PagerDuty, email) for approver paging.

## Inputs
- The action under control (function, route, blast radius).
- The list of roles eligible to **request** the action.
- The list of roles eligible to **approve** the action (often a different role).
- Expected request volume (5/week vs 5/day vs 5/hour — drives approver pool sizing).
- Break-glass policy (does engineering on-call have a unilateral override for a P0 incident? what's the post-hoc review path?).

## Process

1. **List the actions that warrant dual control.** Reach for this pattern *only* at T3 blast radius. Typical:
   - Mass refund (≥10 customers or ≥$10k in one batch).
   - Production DB write outside of migrations (raw SQL UPDATE/DELETE in prod console).
   - Account / tenant deletion.
   - Secrets rotation for shared root credentials (DB master, signing keys, payment processor restricted keys).
   - Permission grant that adds another user to the approver role itself (privilege escalation).
   - Bulk PII export.
   - Disabling audit logging or retention policies.

   The SOX SoD canon: anyone who can *initiate* a transfer must not also *authorize* it. Adapt: anyone who can request the action cannot approve it for themselves.

2. **Define the requester-approver matrix.** Approver pool ≠ actor pool:

   | Action | Requester roles | Approver roles | Min approvers |
   |---|---|---|---|
   | Mass refund ≥$10k | support-l2, finance-ops | finance-manager, controller | 1 |
   | Prod DB write | platform-engineer, on-call | platform-lead, CTO | 1 (2 if irreversible) |
   | Tenant delete | support-l2, account-mgr | account-director, legal | 1 |
   | Shared-secret rotation | platform-engineer | platform-lead, security-lead | 1 |
   | Grant `approver` role | admin | CEO, CTO | 1 |

   Rule: `approver.user_id ≠ requester.user_id` is a hard invariant — checked server-side, not UI-side.

3. **Model the request lifecycle.** Five states:
   ```
   draft → pending_approval → approved → executing → completed
                            ↘ denied
                            ↘ expired
   ```
   Each transition emits an audit event. `approved → executing` is the only state that triggers the actual mutation; do not collapse this into `pending_approval → completed`.

4. **Approval tokens.** When a request enters `pending_approval`:
   - Generate a single-use, URL-safe token (≥32 bytes random).
   - Bind it to: `request_id`, `approver_role_required`, `expires_at` (default 60 min, max 4 hours).
   - Send the token only via a channel the approver controls (Slack DM, signed magic-link email, or push to a registered device).
   - Approver lands on `/admin/approvals/<token>` — page shows: requester, action, target, reason, blast-radius preview, deny + approve buttons.
   - Approve requires the approver to also pass an override-gate (re-auth + reason). The approver's reason is recorded distinctly from the requester's.

5. **Approver-can't-be-actor invariant.** Enforce in three places (defense in depth):
   - Client UI: hide the approve button if `current_user.id === request.requester_id`.
   - API: reject with 403 if same.
   - DB: a CHECK constraint or trigger on the approval-write `requester_id <> approver_id`.

6. **Multi-approver / quorum for highest-tier actions.** For nuclear actions (prod DB write that's also irreversible, disabling audit logging, granting `approver` role), require **two** approvers, each from a distinct role bucket. Both must approve within the expiry window. Stripe Atlas-style: their internal "destructive ops" require an SRE *and* a security engineer to co-sign.

7. **Expiry + reminder logic.** At 50% of expiry, re-page the approver pool. At expiry, transition to `expired` and audit; the requester must re-submit. Never silently extend.

8. **Break-glass override.** Real incidents need a bypass; codify it rather than letting people invent one:
   - Available only to a small named pool (e.g., `incident-commander`, `cto`).
   - Activation requires: stated incident severity (P0/P1), declared incident ID (from `/incident-commander-runbook`), one-line justification.
   - Auto-emits a P1 alert to security + a calendar item for the next post-incident review.
   - All break-glass uses are reviewed weekly by the security lead. Pattern of repeated use = the dual-control rule is wrong; fix the rule, don't normalize the bypass.

9. **Audit chain.** A single dual-control flow emits at least four events:
   1. `request.created` (actor: requester)
   2. `request.approved` or `request.denied` (actor: approver, references `request_id`)
   3. `action.executed` (actor: system, references both `request_id` and `approval_id`)
   4. `action.completed` or `action.failed`

   Each event references the prior via `parent_event_id`. The audit-log verifier (see `/audit-log-design`) checks that no `action.executed` exists without a matching `request.approved` upstream.

10. **Test the unhappy paths.** Write integration tests for:
    - Requester tries to approve their own request → 403.
    - Approver from wrong role tries to approve → 403.
    - Token replay (use same token twice) → second attempt 410 Gone.
    - Expired token → 410.
    - Two-quorum: one approval lands, second never arrives → expires, action never executes.
    - Break-glass without incident ID → blocked.

11. **Operational hygiene**:
    - Approver pool size ≥ 3 per role bucket; otherwise vacations break the system.
    - Approver on-call rotation if request volume is daily.
    - Monthly review: which actions hit dual-control most? If one action is at >50/month, the threshold is probably too low — recalibrate.
    - Quarterly drill: walk a sample request end-to-end, verify Slack + email + audit chain still wire correctly. Skill: `/game-day`.

12. **Anti-patterns to forbid**:
    - Same person approves under a "service account" they own — defeats the rule.
    - "Just slack the on-call manager and they'll approve in DM" — out-of-band, no audit, not verifiable.
    - Optional dual-control toggle in the UI — gets toggled off "just this once" and stays off.
    - Approver-receives-token-via-email-the-requester-can-see (shared inbox) — token theft.
    - Break-glass with no post-hoc review — normalizes the bypass within 90 days.

## Output

Write `docs/design/two-person-rule-<action>-<project>.md`:

```markdown
# Two-Person Rule — <action> — <project>
**Date:** <YYYY-MM-DD> | **Owner:** <team>
**Tier:** T3 (catastrophic blast radius)

## Action under control
<one-line description; function name; what it mutates>

## Blast radius (from `/override-gate-design`)
- Rows touched: <>
- Money moved: <>
- Customers affected: <>
- Reversibility: <>

## Requester / approver matrix
| Role | Can request? | Can approve? |
|---|:---:|:---:|
| support-l1 | | |
| support-l2 | ✓ | |
| finance-ops | ✓ | |
| finance-manager | | ✓ |
| controller | | ✓ |
| (etc.) | | |

Hard invariant: `approver.user_id ≠ requester.user_id`. Enforced: UI + API + DB CHECK.

## Quorum
- Approvers required: <1 or 2>
- Distinct role buckets required: <yes/no>

## Lifecycle
1. requester submits → `pending_approval`
2. approver(s) review → `approved` or `denied`
3. on `approved` → `executing` → `completed`
4. on `expired` (60min default) → audit + requester re-submits

## Approval token
- Length: 32 bytes random, URL-safe
- Binding: request_id, approver_role, expires_at
- Delivery: <Slack DM / signed magic link / push>
- Single-use; replay returns 410 Gone

## Break-glass
- Eligible roles: <incident-commander, cto>
- Required: incident severity + incident_id + justification
- Auto-emits: P1 alert + post-incident review calendar item
- Weekly security-lead review of all uses

## Audit chain
- request.created
- request.approved / request.denied
- action.executed (references both upstream events via parent_event_id)
- action.completed / action.failed
- Verifier: scripts/audit-verify.ts asserts no executed without approved upstream

## Tests
- [ ] Self-approval blocked at API
- [ ] Wrong-role approval blocked
- [ ] Token replay blocked
- [ ] Expired token blocked
- [ ] Two-quorum: one approval alone never fires action
- [ ] Break-glass without incident_id blocked
- [ ] Audit chain integrity preserved end-to-end

## Operational
- Approver pool size per bucket: ≥3
- On-call rotation: <yes/no; rotation tool>
- Monthly action-volume review: <owner>
- Quarterly drill: `/game-day` walk-through

## Anti-patterns enforced
- ❌ No service-account self-approval
- ❌ No Slack-DM out-of-band approval
- ❌ No dual-control optional toggle
- ❌ Approver token never shares an inbox with requester
- ❌ Break-glass without post-hoc review = re-design trigger
```

## Verification
- `approver.user_id ≠ requester.user_id` invariant exists in API + DB layer, tested.
- Single-use approval tokens cannot be replayed.
- Audit chain links `action.executed` to its upstream `request.approved`.
- Break-glass usage paged + post-hoc-reviewed within 7 days, every time.
- Approver pool ≥3 per role bucket; vacation breakage impossible.
- Quarterly drill ran in the last 90 days.
