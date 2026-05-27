---
form: operator-first-login
last-updated: 2026-05-20
status: draft
wireframe: docs/design/wireframes/operator-auth.md
endpoint: POST /api/op/auth/password/change
---

# Form: Operator — First-Login Forced Password Change

Reached when operator JWT carries `requiresPasswordChange:true`. Edge middleware
(proxy Layer 1) redirects all `/op/*` here except the exact-match allowlist. Sets
new password, clears the flag, mints a FRESH token (`requiresPasswordChange:false`)
in the same transaction → 204. No way to skip (no cancel/back to `/op/*`).

## Fields

| Name | Type | Required | Default | Notes |
|------|------|----------|---------|-------|
| currentPassword | password | yes | — | the admin-issued temp password |
| newPassword | password | yes | — | strength rules; live meter |

## Validation Matrix

| Field | Rule | Timing | Error copy |
|-------|------|--------|------------|
| currentPassword | non-empty (`min(1)`) | on-submit | "Vui lòng nhập mật khẩu hiện tại" |
| newPassword | `min(8)` | on-change (live meter) | "Password must be at least 8 characters" |
| newPassword | `max(128)` | on-change | "Password must be at most 128 characters" |
| newPassword | `/[a-zA-Z]/` | on-blur | "Password must contain at least one letter" |
| newPassword | `/[0-9]/` | on-blur | "Password must contain at least one digit" |

Server: 422 CURRENT_PASSWORD_WRONG → "Mật khẩu hiện tại không đúng." (inline under
currentPassword); 422 PASSWORD_REUSED → "Mật khẩu mới phải khác mật khẩu cũ." (inline
under newPassword); 400 WEAK_PASSWORD → "Mật khẩu chưa đủ mạnh." (inline under
newPassword). Generic failure banner → "Có lỗi xảy ra. Vui lòng thử lại."

## Error Placement

- Inline below each field. CURRENT_PASSWORD_WRONG → currentPassword; reuse/weak →
  newPassword.
- Banner (`role="alert"`) only for generic/network error.
- No toast.

## Submit States

```
forced ──submit──▶ submitting ──ok(204)──▶ success (fresh token set, redirect landing)
                       │
                       └──err──▶ error (re-enable, announce, focus first error field)
```

| State | Button label | Enabled | Spinner | Announce |
|-------|--------------|---------|---------|----------|
| idle | "Đổi mật khẩu" | yes | no | — |
| submitting | "Đang đổi..." | no | yes | aria-live polite |
| success | "Đổi mật khẩu" | no | no | redirect (flag cleared) |
| error | "Đổi mật khẩu" | yes | no | inline / banner assertive |

204 response carries the fresh `requiresPasswordChange:false` token via Set-Cookie;
client redirects to operator landing (no body to parse).

## A11y Wiring

| Field | Pattern |
|-------|---------|
| each input | `<label for>` + `aria-describedby="X-hint X-err"` + `aria-required` + `aria-invalid` |
| currentPassword | `autocomplete="current-password"` |
| newPassword | `autocomplete="new-password"` |
| newPassword meter | `aria-live="polite"` strength text, NOT only color |
| submit-fail | focus → first error field (currentPassword precedence) |

## Open Questions

- Show a one-line "Bạn cần đổi mật khẩu trước khi tiếp tục" notice at top? Currently
  the screen heading carries the intent; defer copy to a11y/typography pass.

## Out of Scope

- Operator login (separate file — operator-login).
- In-app change-password for customers (separate file — account-password).
