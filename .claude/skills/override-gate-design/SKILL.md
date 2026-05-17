---
name: override-gate-design
description: Destructive-action gate design for internal admin tools — type-the-name confirm, reason-required field, audit-log entry, manager-approval escalation. Outputs to `docs/design/override-gate-<surface>-<project>.md`. Use when user says "override gate", "confirm dialog", "destructive action UI", "admin tool safety", "type-to-confirm", "are-you-sure", "destructive confirm", "/override-gate-design", or before exposing any irreversible admin action. Upstream: `/rbac-model`, `/audit-log-design`. Downstream: `/two-person-rule-design`, `/internal-tool-blast-radius-audit`.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 3h
  XL: 4h
---

# /override-gate-design — Make the Wrong Click Hurt to Make

## Why you'd care

Internal admin tools without confirm-gates are how a single typo deletes 10,000 users or refunds $2M to the wrong account. The type-the-name + audit-log pattern is the cheap defense against the rare-but-fatal mistake.

Why you'd care: every internal admin tool has at least one button that can wipe a customer, refund $10k, or detach a payment method. A vanilla `confirm()` dialog is muscle-memory bypass — the click-throughs are reflexive. Skip the gate and you ship a Friday-afternoon incident waiting for an over-caffeinated support agent.

## Pre-flight
- Read `/rbac-model` — actor identity + role must exist before you can gate on it.
- Read `/audit-log-design` — every override must emit an event; without that, the gate is theater.
- Read `/internal-tool-blast-radius-audit` if it exists — tells you which actions need this skill.
- Confirm SSO/session re-auth is wired (you may step-up here).

## Inputs
- The destructive action (function name, route, what it mutates).
- Blast radius: rows touched, dollars moved, customers affected, reversibility window.
- Actor role (support L1 / L2 / engineer / admin).
- Existing audit-log writer (`lib/audit.ts`) and RBAC primitives.

## Process

1. **Classify the action.** Use this table to pick the gate tier:

   | Tier | Trigger | Required gate elements |
   |---|---|---|
   | T0 Soft | Reversible <5 min, single row, no $ | Standard confirm dialog |
   | T1 Hard | Irreversible OR moves money <$500 OR affects 1 customer | Type-to-confirm + reason field + audit |
   | T2 Critical | Money >$500 OR affects ≥10 customers OR PII export | T1 + step-up re-auth + manager-approval escalation |
   | T3 Catastrophic | Mass mutation OR prod DB write OR account purge | T2 + two-person rule (see `/two-person-rule-design`) |

2. **Type-to-confirm string discipline.** Pick a string the user must type verbatim. Rules:
   - **Specific to the target**, not the action: type the *customer name* / *email* / *invoice ID*, not "DELETE". Stripe dashboard's "type the customer's name" pattern.
   - Case-sensitive, no auto-fill, no copy-paste shortcut (`onPaste={e => e.preventDefault()}`).
   - Confirm button stays disabled until exact match.
   - The string is rendered as plain text adjacent to the input, not hidden — this is not a captcha, it is a slowdown ritual.

3. **Reason-required free-text field.** Min 10 characters, max 500. Persisted into the audit event's `metadata.reason`. Anti-patterns: dropdown of canned reasons (people pick "other"), optional field, default-filled text. Wire a soft block on placeholder content (`"asdf"`, `"test"`, ticket-number-only).

4. **Step-up re-authentication for T2.** Force the user to re-enter password or re-tap WebAuthn within the last 5 minutes. Don't accept session age alone — a logged-in laptop walked away from is the classic incident vector.

5. **Manager-approval escalation for T2.** When the actor's role lacks `<action>:execute-without-approval`, the action enters a `pending_approval` state:
   - Slack/email a designated approver group with deep-link to approve page.
   - Approval token is single-use, scoped to that one pending action, expires in 60 min.
   - Approver cannot be the requester (see `/two-person-rule-design` for the full pattern).
   - Approval page shows: requester, action, target, reason, blast radius preview.

6. **Audit-log entry.** Emit two events: one at gate-shown (`action.requested`) and one at execution (`action.executed` or `action.denied`). Schema fields: `actor`, `target`, `action`, `reason`, `gate_tier`, `approver_id` (T2+), `confirm_string_typed` (yes/no), `outcome`. Wire so the audit write happens *in the same transaction* as the mutation — split = lost events.

7. **Blast-radius preview.** Before the confirm button is enabled, render a dry-run summary: "This will delete 1 user, cancel 3 active subscriptions ($147/mo), and remove 2,341 events from the activity log. **Irreversible.**" If the action has a server-computable preview (count of rows), call it on dialog open.

8. **Undo window where physically possible.** For deletes, soft-delete + 30-day purge wins over hard-delete every time. The gate text changes from "this is permanent" to "this can be restored within 30 days by engineering". Reduces incident severity by an order of magnitude.

9. **Rate limit override gates.** A support agent who fires 20 T1 confirms in a row is either compromised, training, or scripting. Per-actor rate limit on T1+ (e.g., 5/hour) with manager-paged breach.

10. **Anti-patterns to forbid**:
    - Browser `confirm()` / `alert()` — bypassable, no audit, no metadata.
    - "Are you sure?" yes/no buttons — muscle memory, no friction.
    - "DELETE" as the type-to-confirm string — universal, learnable, not target-specific.
    - Auto-focus on the confirm button — encourages Enter-mash.
    - Hidden destructive actions in overflow menus — surface them explicitly so they get the gate.
    - Same gate at every tier — gate fatigue → checkbox theater → support ignores it.

## Output

Write `docs/design/override-gate-<surface>-<project>.md`:

```markdown
# Override Gate — <surface, e.g. customer-delete> — <project>
**Date:** <YYYY-MM-DD> | **Owner:** <team>
**Action:** <function / route / button>
**Tier:** <T0 / T1 / T2 / T3>

## Blast radius
- Rows touched: <count + table list>
- Money moved: $<min>–$<max>
- Customers affected: <count or formula>
- Reversibility: <hard / soft 30d / soft 7d / via support ticket>

## Gate tier (from blast radius)
| Element | Required? | Notes |
|---|:---:|---|
| Standard confirm dialog | ✓ | |
| Type-to-confirm string | ✓ | "Type the customer's name: <example>" |
| Reason-required field (≥10 chars) | ✓ | min length enforced server-side |
| Step-up re-auth (<5min) | <yes/no> | |
| Manager-approval escalation | <yes/no> | Approver group: <slack channel / role> |
| Two-person rule | <yes/no> | See `/two-person-rule-design` if yes |
| Blast-radius preview | ✓ | Source: `previewDelete(target)` |

## Type-to-confirm pattern
- String: <customer.name / invoice.id / account.email>
- Case sensitive: yes
- Paste disabled: yes
- Confirm button enabled when: exact string match

## Reason field
- Min length: 10 chars
- Soft blocks: ["asdf", "test", "x", "<numeric-only>"]
- Persisted to: audit_events.metadata.reason

## Audit events
- `action.requested` on dialog open
- `action.executed` or `action.denied` on submit
- Schema fields: actor, target, action, reason, gate_tier, approver_id, confirm_string_typed, outcome
- Atomic with mutation: <transaction boundary>

## Rate limit
- Per actor: <N>/hour
- Breach action: page manager + Slack #security-ops

## Approval flow (T2+)
1. Requester submits → action enters `pending_approval`
2. Notification: <channel + template>
3. Approver page URL: `/admin/approvals/<token>`
4. Token: single-use, 60-min expiry, requester≠approver
5. On approve: action fires, audit `action.executed` with `approver_id`
6. On expire or deny: audit `action.denied` with reason

## Undo
- Strategy: <soft-delete 30d / hard / N/A>
- Restore path: <self-serve / support / engineer>
- Tombstone retention: <duration>

## Tested
- [ ] Confirm button stays disabled until exact-match
- [ ] Audit event lands with correct `gate_tier`
- [ ] Rate limit fires at threshold
- [ ] Approval token rejects requester=approver
- [ ] Approval token expires at 60min
- [ ] Paste into confirm input is blocked

## Anti-patterns enforced
- ❌ No `window.confirm()`
- ❌ No "DELETE" as universal confirm string
- ❌ No auto-focus on destructive button
- ❌ No optional reason field
- ❌ No same gate at every tier
```

## Verification
- Every T1+ action lists a target-specific type-to-confirm string (not "DELETE").
- Reason field is required server-side, not just client-side.
- Audit event fires in the same transaction as the mutation.
- T2 actions route through manager approval with requester≠approver invariant.
- Browser `confirm()` and `alert()` grep returns zero results in admin tool code paths.
- Rate limit + manager-page wired for repeated T1+ fires.
