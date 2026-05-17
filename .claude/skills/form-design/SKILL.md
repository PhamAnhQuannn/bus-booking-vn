---
name: form-design
description: Form UX design — validation timing, error placement, field grouping, multi-step wizards, autosave, accessible labeling, submit states. Outputs `docs/design/form-<feature>.md` with field map + validation matrix + error copy + state diagram. Use when user says "form design", "validation", "form errors", "wizard", "multi-step form", "autosave", "field grouping", "form a11y", "/form-design", or before building any non-trivial form (sign-up, checkout, settings, application).
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 6h
---

# Form Design

## Why you'd care

Forms are where activation, checkout, and signup actually live or die — bad validation timing and error placement quietly cost double-digit percent conversion. The field-map-plus-error-copy artifact catches the failure modes before they ship.

Form contract before code. Field-by-field spec: label, type, validation, error message, a11y wiring, state transitions. Catches the missing edge cases that bite at QA.

## When This Skill Applies

Activate when:
- User says "form design", "validation", "form errors", "wizard", "multi-step form", "autosave", "field grouping", "form accessibility", "/form-design"
- Form has ≥3 fields OR any conditional field OR any async validation
- Multi-step / wizard flow
- High-stakes form: payment, sign-up, application, settings save
- Accessibility audit of existing form
- Re-design after high abandonment / error rate

## Prerequisites

- Wireframe exists for the screen (`docs/design/wireframes/<screen>.md`).
- Data model decided (field types + constraints known).
- Decision: validation strategy (on-blur default; on-submit only if specified).
- API contract for submit endpoint (success + error shapes).

## Steps

1. **List fields.** Name, type, required?, default, source (user input / pre-filled / hidden).
2. **Group fields.** Semantic groups (`<fieldset>` + `<legend>`). Personal info / address / payment.
3. **Define validation per field.** Format rule, range, async check (uniqueness), depends-on (conditional required).
4. **Decide validation timing.** On-blur (default), on-change (only for char-counters / strength meters), on-submit (last resort).
5. **Write error copy per rule.** Plain language, action-oriented. No "invalid input"; instead "phone needs 10 digits, you entered 9".
6. **Map error placement.** Inline below field (default). Summary at top on submit-fail (links to fields). Toast for server errors only.
7. **Define submit states.** idle → submitting (button disabled + spinner) → success (redirect or inline) → error (re-enable + announce).
8. **Multi-step wizards.** Per-step validation, back/forward state preservation, progress indicator, can-skip rules.
9. **Autosave policy.** Debounce window, save indicator, conflict resolution (last-write-wins vs merge).
10. **A11y wiring.** Label association (`for`/`id`), `aria-describedby` for hint + error, `aria-invalid`, `aria-required`, focus-on-error.
11. **Write** `docs/design/form-<feature>.md`.
12. **Auto-chain.** Async validation → `/api-contract`. Errors involving money/PII → `/threat-model`. Multi-step → `/user-flow`.

## Output Format — `docs/design/form-<feature>.md`

```markdown
---
form: signup
last-updated: YYYY-MM-DD
status: draft | reviewed | implemented
wireframe: docs/design/wireframes/signup.md
endpoint: POST /api/auth/signup
---

# Form: Signup

## Fields

| Group | Name | Type | Required | Default | Notes |
|-------|------|------|----------|---------|-------|
| Account | email | email | yes | — | unique async-checked |
| Account | password | password | yes | — | min 12, strength meter |
| Account | passwordConfirm | password | yes | — | must match password |
| Profile | displayName | text | yes | — | 2–40 chars |
| Profile | locale | select | yes | browser | en, vi |
| Consent | tos | checkbox | yes | unchecked | must be true |
| Consent | marketing | checkbox | no | unchecked | optional |

## Validation Matrix

| Field | Rule | Timing | Error copy |
|-------|------|--------|------------|
| email | RFC 5322 format | on-blur | "Enter an email like name@example.com" |
| email | unique (async) | on-blur (debounced 500ms) | "That email's taken — sign in instead?" |
| password | length ≥ 12 | on-change (live meter) | "12+ characters" |
| password | not in pwned list (async) | on-blur | "This password has appeared in a breach. Pick another." |
| passwordConfirm | === password | on-blur | "Passwords don't match" |
| displayName | 2 ≤ len ≤ 40 | on-blur | "2–40 characters" |
| tos | === true | on-submit | "You must accept the terms" |

## Error Placement

- **Inline** below each field: text-error token, `role="alert"` only when error first appears (not on every keystroke).
- **Summary block** at top of form on submit-fail with ≥2 errors: list of field names linking to each.
- **Toast** for server-side errors only ("Network error, try again"). Never for field validation.

## Submit States

```
idle ──submit──▶ submitting ──ok──▶ success (redirect /welcome)
                     │
                     └──err──▶ error (re-enable, announce, focus first error)
```

| State | Button label | Button enabled | Spinner | Announce |
|-------|--------------|----------------|---------|----------|
| idle | "Create account" | yes | no | — |
| submitting | "Creating…" | no | yes | "Creating account" (aria-live polite) |
| success | "Created" | no | no | "Account created" → redirect |
| error | "Create account" | yes | no | error summary (aria-live assertive) |

## A11y Wiring

| Field | Pattern |
|-------|---------|
| Each input | `<label for="X">` + `<input id="X" aria-describedby="X-hint X-err" aria-required="true" aria-invalid="{hasError}">` |
| Hint text | `<p id="X-hint" class="text-muted">…</p>` |
| Error text | `<p id="X-err" role="alert" class="text-error">…</p>` (rendered only when error present) |
| Required marker | visible "*" + `aria-required="true"`; legend explains "* required" |
| Submit fail | focus moves to first error field; summary block announced via `aria-live="assertive"` |

## Autosave (n/a for signup; example for settings form)

- Trigger: 1500ms debounce after last change.
- Indicator: `<span aria-live="polite">Saved 2s ago</span>`.
- Conflict: last-write-wins; if `If-Match` 412 returned, show "Someone else updated this — reload?" modal.

## Multi-step (n/a here; pattern reference)

- Per-step validation gate before "Next".
- State preserved in URL query (`?step=2`) + form-store.
- Back never re-validates already-passed steps.
- Progress: `<ol>` with `aria-current="step"` on current.

## Open Questions

- Social sign-up buttons above or below form? Defer A/B post-launch.
- Remember-me toggle? Not in MVP.

## Out of Scope

- Sign-in form (separate file).
- Password reset (separate file).
```

## Boundaries

- **One form per file.** Compose by linking; never bundle signup + signin.
- **Validation copy is final.** Engineering uses these strings verbatim. Do not paraphrase.
- **No code.** Pseudocode in state diagram only; impl is downstream.
- **A11y wiring mandatory.** A form spec without label/aria pattern is incomplete.
- **Server-error vocabulary only via toast.** Field errors stay inline.

## Re-run Behavior

- If file exists, read first. Surface diff.
- Bump `last-updated`.
- Status: draft → reviewed → implemented.

## Auto-chain

- Any async validation → `/api-contract` for the check endpoint.
- Money / PII fields → `/threat-model`.
- Multi-step → `/user-flow` for wizard navigation.
- New error patterns → `/design-system` for token usage if novel.

## Example Trigger

User: "design the signup form"
→ List fields, define validation per field, write error copy, map a11y wiring, define submit states, write `docs/design/form-signup.md`.
