---
name: account-deletion-ux
description: Account deletion UX. Confirmation friction, cooling-off period, soft-delete vs hard-delete, what's purged vs retained (legal hold, billing), audit trail UI, irreversibility warning copy. Outputs `docs/design/account-deletion.md` with delete flow + retention map + audit + a11y. Use when user says "delete account", "close account", "right to be forgotten", "account deletion flow", "/account-deletion-ux", or before EU launch / app-store submission.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 3h
  XL: 4h
---

# Account Deletion UX

## Why you'd care

Botched deletion flows are the single biggest source of dark-pattern complaints to app-store reviewers and EU regulators. Either you make leaving too easy (impulse churn) or too hard (FTC enforcement target) — this skill picks the middle path before legal picks it for you.

Easy to start, hard to actually finish — but never tricked. Cooling-off period stops impulse delete; soft-delete preserves option to recover; hard-delete is irreversible and clearly labelled. The hardest part is what we're forced to keep (legal hold, finance, fraud) and how to surface that without sounding like a refusal.

## When This Skill Applies

Activate when:
- User says "delete account", "close account", "deactivate", "right to be forgotten", "/account-deletion-ux"
- EU / UK launch (GDPR Art. 17 surface)
- App store submission (Apple/Google require in-app deletion since 2022)
- Adding deletion entry point to settings
- Audit existing deletion for dark-pattern drift

## Prerequisites

- `docs/design/gdpr-rights.md` exists (this is the erasure detail).
- `docs/compliance/data-export.md` exists (delete endpoint impl).
- `docs/compliance/retention-policy.md` — what survives by law.
- Audit log infrastructure (`docs/design/audit-log.md` if exists).
- Legal-hold list (which records cannot be deleted: tax, AML, dispute-pending).
- `docs/design/consent.md` (deletion ≠ consent withdraw; both must exist).

## Steps

1. **Entry point.** Settings → Account → "Delete account" — never hidden behind 5 clicks.
2. **Pre-delete export prompt.** "Want a copy of your data first?" — link to export.
3. **Confirmation friction.** Re-auth + type "DELETE" + checkbox acknowledging irreversibility.
4. **Cooling-off period.** 30-day default soft-delete; account locked, scheduled hard-delete.
5. **Recovery path.** Sign-in during cooling-off restores account; one-click cancel.
6. **Hard-delete contents.** Specify what's purged: profile, content, settings, derived data.
7. **Retention notice.** Explicit list of what survives + why + duration + when it dies.
8. **Audit trail.** Immutable record under hashed UID after PII purge.
9. **Cascading effects.** Sessions revoked, OAuth tokens invalidated, webhooks notified, third-party processors signalled.
10. **A11y + plain language.** Confirmation copy plain; warning copy WCAG-clear; no jargon.
11. **Write** `docs/design/account-deletion.md`.
12. **Auto-chain.** Audit log → `/audit-log-design`. Erasure entry → `/gdpr-rights-ux`. Endpoint impl → `data-export`. Cascading session kill → `/auth-flow-design`.

## Output Format — `docs/design/account-deletion.md`

```markdown
---
last-updated: YYYY-MM-DD
status: draft | reviewed | implemented
parent: docs/design/gdpr-rights.md
implementation: docs/compliance/data-export.md
retention: docs/compliance/retention-policy.md
cooling-off-days: 30
hard-delete-grace-days: 0  (after cooling-off, immediate)
---

# Account Deletion

## Entry Points

| Surface | Path | Visibility |
|---------|------|-----------|
| Settings | Settings → Account → "Delete account" | always visible (not hidden) |
| Privacy centre | `/account/privacy` → "Delete my account" | always visible |
| Onboarding email | "If this isn't right for you, delete your account here" | included |
| App store description | direct deep link `app://settings/delete-account` | per Apple/Google guideline |

**Anti-pattern:** entry point removed for paid users until subscription cancelled — forbidden. Both flows allowed independently; deletion of paid account auto-cancels subscription with prorated refund per terms.

## Pre-Delete Flow

Step 1 — **Reason capture (optional)**
- "Tell us why you're leaving — this helps us improve. Skip if you'd rather not."
- Single-select: Not useful / Too expensive / Privacy concern / Found alternative / Other.
- Skippable. NOT a friction wall.

Step 2 — **Export offer**
- "Download your data first?" → link to Access flow (see `gdpr-rights.md`).
- "Skip and continue to delete" — equally prominent.

Step 3 — **What happens**
- Plain-language summary (≤120 words):
  - "Your account locks immediately."
  - "After 30 days, we permanently delete your data."
  - "Sign in within 30 days to cancel."
  - "Some records by law remain — see below."
- Expandable: "What's deleted" / "What's kept" (see Retention Map).

Step 4 — **Confirmation**
- Re-auth (password OR magic-link).
- Type "DELETE" in input (not pre-filled).
- Checkbox: "I understand this is irreversible after 30 days."
- Primary CTA: "Delete account" (filled-destructive, in modal).
- Tertiary: "Cancel" (ghost).

Step 5 — **Confirmation page + email**
- "Account scheduled for deletion on <ISO date>."
- "Sign in before then to cancel."
- Email same content with cancel-link (single-use token).

## Cooling-Off Period (30 days)

State: `pending_deletion`.

During cooling-off:
- Sign-in allowed → cancel-deletion screen first; user must explicitly cancel to restore.
- All processing paused: no marketing, no profiling, no notifications, no API access.
- Read-only data preserved (recoverable on cancel).
- Subscriptions: paused; billing not charged.
- Outbound webhooks: notified `account.deletion_pending`.

Daily cron: check pending → if past cooling-off → hard-delete.

Notification cadence:
- Day 0: confirmation email + in-app banner if signs in.
- Day 7: reminder email "Your account deletes in 23 days. Cancel by signing in."
- Day 25: final warning email.
- Day 30: deletion email "Your account has been deleted."

## Hard-Delete (after day 30)

What's purged from primary stores:
- Profile (name, email, phone, address, avatar).
- User-generated content (posts, comments, uploads).
- Settings, preferences, consent state.
- Sessions, devices, OAuth tokens, API keys.
- Derived data: recommendation profile, behavioural segments, A/B test assignment.
- Backups: deletion propagates within 30 days (next backup rotation).

What's kept (retention map):

| Data | Retained? | Why | Duration | Then |
|------|-----------|-----|----------|------|
| Email (hashed) on suppression list | yes | prevent re-marketing | indefinite | n/a |
| Tax invoices / payment records | yes | tax law (UK 6yr / US 7yr) | per jurisdiction | hard-delete |
| AML/KYC records (if regulated) | yes | AMLD5 — 5 yr from termination | 5 yr | hard-delete |
| Audit log entries (you did X on date Y) | yes | compliance | 6 yr | hard-delete; UID stays hashed |
| Anonymised aggregate analytics | yes | non-PII | indefinite | n/a |
| Active dispute / chargeback records | yes | until dispute closed + 1 yr | varies | hard-delete |
| Legal hold (active litigation) | yes | indefinite until lifted | indefinite | hard-delete on lift |
| Backup tapes (offline) | rotates | RPO recovery | 30-90 d | overwritten |

This map must be surfaced on the deletion confirmation page (expandable).

## Recovery

Cancel-deletion page (sign-in during cooling-off):
- Banner: "Your account is scheduled for deletion on <date>. Cancel to restore?"
- Buttons: "Cancel deletion" (primary) | "Continue with deletion" (tertiary).
- On cancel: state reverts to `active`; previous data restored intact; subscriptions resume next cycle.
- Audit log entry: `account.deletion_cancelled`.

After cooling-off: NO recovery. Recreating account = new account, no data restore.

## Cascading Effects (on hard-delete)

| System | Action |
|--------|--------|
| Auth | All sessions invalidated; refresh tokens revoked |
| OAuth providers | Token revocation calls issued (Google, Apple, etc.) |
| Webhooks subscribers | `account.deleted` event broadcast |
| Email/marketing | Add to suppression list (hashed) |
| Third-party processors | Delete-request issued (Stripe customer, Intercom contact, etc.) |
| Search indexes | Removed |
| CDN / cache | Purged |
| Logs | Replaced with hashed UID; raw PII redacted |

Failures retry with exponential backoff; failure after 7 days escalates to ops queue.

## Audit Trail

Per deletion event, immutably persist:
```
{
  "deletion_id": "uuid",
  "user_uid_hash": "sha256(uid + per-user-salt)",
  "requested_at": "ISO",
  "verified_at": "ISO",
  "scheduled_hard_delete": "ISO",
  "hard_deleted_at": "ISO|null",
  "cancelled_at": "ISO|null",
  "actor": "user|admin|system",
  "method": "self_service|admin_initiated|gdpr_request",
  "reason_code": "not_useful|too_expensive|...|null",
  "data_categories_purged": [...],
  "data_categories_retained": [...],
  "third_party_revocations": [{"vendor": "...", "status": "...", "ts": "..."}]
}
```

Retain ≥6 years. Surfaced to admin in `/admin/account-deletions`. Surfaced to user (if account ever re-created with same email) as: "An account with this email was previously deleted on <date>."

## Admin / Staff Console

`/admin/accounts/<uid>/delete`:
- Initiate deletion on behalf of user (with documented authority).
- Two-staff approval: one queues, second approves.
- Visible audit reason field; required.
- Cooling-off applies same as user-initiated.

`/admin/account-deletions`:
- Inbox of pending deletions sorted by scheduled date.
- Filter by status (pending / hard-deleted / cancelled).
- Stuck deletions (cascade failures) flagged red.

## Copy Catalog

### Pre-delete summary
> "Deleting your account locks it immediately and erases your data after 30 days. You can sign in within 30 days to cancel. Some records — payment history, audit logs, and any data we're legally required to keep — remain for the periods set out below."

### Confirmation modal title
> "Delete your account?"

### Confirmation modal body
> "This locks your account now and permanently deletes your data on <date in 30 days>. You can cancel any time before then by signing in.
> 
> Type DELETE below to confirm."

### Type-to-confirm placeholder
> "Type DELETE"

### Checkbox label
> "I understand this is irreversible after 30 days."

### Final CTA button
> "Delete account"  (destructive-filled, in modal only — never on settings page)

### Confirmation page heading
> "Your account is scheduled for deletion"

### Confirmation page body
> "We've locked your account. On <date>, we'll permanently delete your data.
> 
> Sign in before then to cancel.
> 
> A confirmation email is on its way to <email>."

### Cancel-deletion banner (on sign-in during cooling-off)
> "Your account is scheduled for deletion on <date>. Cancel to keep your account?"

## A11y

- Modal: `role="dialog" aria-modal="true"`; focus trap; Esc cancels (closes modal, no deletion).
- First focus on heading, not on destructive button.
- "DELETE" input: `aria-describedby` linking to instruction.
- Checkbox: native `<input type="checkbox">` with linked label.
- Destructive CTA: `aria-disabled="true"` until type-to-confirm passes + checkbox checked; reason explained via `aria-describedby`.
- Confirmation page: success announced via `role="status" aria-live="polite"`.
- Plain language: Flesch reading ease ≥60; no terms-of-art without inline definition.
- Cooling-off countdown: NOT shown as urgent red; neutral information.

## Anti-Patterns (forbidden)

- Hidden behind 5+ clicks.
- "Are you sure?" loop > 2 levels.
- Forced reason selection (must pick before continuing) — "Skip" must be available.
- Destructive button visually identical to primary CTA on settings page (must be in modal).
- Pre-checked irreversibility checkbox.
- "We'll miss you" guilt copy.
- Discount offer interstitial as gate ("Get 50% off — wait 24 hours before deleting").
- Bait-and-switch deactivate ("hold for 24 months without notice").
- Email deletion confirmation that requires clicking to *complete* (already past confirmation point).
- Cooling-off > 30 days as default (excessive; some jurisdictions cap at 30).

## Mobile / Native Specifics

- Apple App Store (since 2022): in-app deletion required for any app with account creation.
- Google Play (since 2024): same; web URL fallback acceptable IF launched from app.
- Deep link from app store description page: `app://settings/delete-account`.
- iOS Settings → Privacy: deletion entry mirrored.

## Analytics Events (deletion UX itself)

| Event | When | Props |
|-------|------|-------|
| `deletion.entry_viewed` | settings → delete page | source |
| `deletion.export_offered` | export prompt shown | exported_yes_no |
| `deletion.confirmation_started` | confirmation modal opened | — |
| `deletion.confirmed` | type-to-confirm passes + submit | reason_code |
| `deletion.cancelled` | user signs in during cooling-off | days_into_cooling |
| `deletion.hard_completed` | cron fires | days_total |

These events processed under "legitimate interest — compliance audit"; consent banner cannot disable.

## Out of Scope

- Subscription cancellation flow (separate `subscription-cancel-ux` if exists; deletion auto-triggers cancel).
- Data export endpoint impl (see `data-export`).
- Audit log infra (see `audit-log-design`).
- Bulk admin deletion (deletes >100 accounts → separate `bulk-deletion-runbook`).

## Open Questions

- Cooling-off length: 30 days standard? Some apps use 14. Default 30 unless legal/cost says otherwise.
- Reason capture: required vs optional? Default optional — reduces friction; analytics still useful at scale.
- Allow account recreation with same email immediately, or block N days? Default allow with notice "Previous account on this email was deleted on <date>."
```

## Boundaries

- **Cooling-off mandatory.** 30 days default. Stops impulse + regret.
- **Type-to-confirm.** Stops accidental delete. Pre-fill = forbidden.
- **Retention disclosed up front.** Not a footnote.
- **Audit log preserved with hashed UID.** Not a contradiction of erasure — compliance requirement.
- **Cancel path equally easy.** Sign-in alone surfaces cancel option.
- **No code beyond endpoint shape — impl in `data-export`.**

## Re-run Behavior

- Read existing first; surface diff (cooling-off change, new retention category, new cascade).
- Bump `last-updated`.
- Re-run when adding processor, retention law change, app-store policy update.

## Auto-chain

- Audit log shape → `/audit-log-design`.
- Erasure rights entry → `/gdpr-rights-ux`.
- Endpoint impl → `data-export`.
- Session/token revocation → `/auth-flow-design`.
- Subscription cancellation handoff → `pricing-page-draft` if exists.
- Admin two-staff approval → `/two-person-rule-design`.

## Example Trigger

User: "design the delete-account flow with cooling-off"
→ Define entry, pre-delete export, confirmation friction, cooling-off, hard-delete contents, retention map, cascading effects, audit, copy + a11y, write `docs/design/account-deletion.md`.
