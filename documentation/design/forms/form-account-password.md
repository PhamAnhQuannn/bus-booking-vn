---
form: account-password
last-updated: 2026-05-20
status: draft
wireframe: docs/design/wireframes/account-settings.md
endpoint: POST /api/account/password
---

# Form: Account — Change Password

Inline section on `/account/settings`. Bearer auth. Verifies current password,
sets new, revokes sibling sessions (keeps current).

## Fields

| Group | Name | Type | Required | Default | Notes |
|-------|------|------|----------|---------|-------|
| Current | currentPassword | password | yes | — | verified server-side |
| New | newPassword | password | yes | — | strength rules; live meter |

## Validation Matrix

| Field | Rule | Timing | Error copy |
|-------|------|--------|------------|
| currentPassword | non-empty (`min(1)`) | on-submit | "Vui lòng nhập mật khẩu hiện tại" |
| newPassword | `min(8)` | on-change (live meter) | "Password must be at least 8 characters" |
| newPassword | `max(128)` | on-change | "Password must be at most 128 characters" |
| newPassword | `/[a-zA-Z]/` | on-blur | "Password must contain at least one letter" |
| newPassword | `/[0-9]/` | on-blur | "Password must contain at least one digit" |

Server: 422 CURRENT_PASSWORD_WRONG → "Mật khẩu hiện tại không đúng." (inline under
currentPassword); 422 PASSWORD_REUSED → "Mật khẩu mới phải khác mật khẩu cũ."
(inline under newPassword); 400 WEAK_PASSWORD → "Mật khẩu chưa đủ mạnh." (inline
under newPassword).

## Error Placement

- Inline below each field. CURRENT_PASSWORD_WRONG → currentPassword; reuse/weak →
  newPassword.
- Banner (`role="alert"`) only for generic/network error.
- Success: inline "Đã đổi mật khẩu" (aria-live polite); current session retained.

## Submit States

```
idle ──submit──▶ submitting ──ok(200)──▶ saved (inline confirm, clear fields)
                     │
                     └──err──▶ error (re-enable, announce, focus first error field)
```

| State | Button label | Enabled | Spinner | Announce |
|-------|--------------|---------|---------|----------|
| idle | "Đổi mật khẩu" | yes | no | — |
| submitting | "Đang đổi..." | no | yes | aria-live polite |
| saved | "Đổi mật khẩu" | yes | no | "Đã đổi mật khẩu" aria-live polite |
| error | "Đổi mật khẩu" | yes | no | inline / banner assertive |

## A11y Wiring

| Field | Pattern |
|-------|---------|
| each input | `<label for>` + `aria-describedby="X-hint X-err"` + `aria-required` + `aria-invalid` |
| newPassword meter | `aria-live="polite"` strength text, NOT only color |
| submit-fail | focus → first error field (currentPassword precedence) |

## Open Questions

- Confirm whether sibling-session revocation needs a "you've been signed out
  elsewhere" notice — currently silent (current session kept, no UI signal).

## Out of Scope

- Reset-password (separate file — OTP-gated, no current-password).
- Name / phone / delete (separate files; same settings screen).
