---
form: operator-login
last-updated: 2026-05-20
status: draft
wireframe: docs/design/wireframes/operator-auth.md
endpoint: POST /api/auth/login
---

# Form: Operator — Login

Unified login endpoint with `{scope:'operator'}`. NO separate `/api/op/auth/login`.
Server routes to `operatorLogin`; mints operator JWT (scope='operator', `operatorId`,
`requiresPasswordChange`). Cookies `bb_op_access` (15min) + `bb_op_refresh` (30d).
If `requiresPasswordChange:true` → redirect `/op/first-login`, else operator landing.

## Fields

| Name | Type | Required | Default | Notes |
|------|------|----------|---------|-------|
| phone | tel | yes | — | VN mobile; operator login phone |
| password | password | yes | — | non-empty |

(Hidden: `scope:'operator'` sent in request body, not a user field.)

## Validation Matrix

| Field | Rule | Timing | Error copy |
|-------|------|--------|------------|
| phone | `/^(0|\+84)[35789][0-9]{8}$/` | on-blur | "Số điện thoại không hợp lệ" |
| password | `min(1)` | on-submit | "Password is required" |

Server (banner): 401 INVALID_CREDENTIALS → "Số điện thoại hoặc mật khẩu không đúng."
(generic, non-enumerating — never reveals which field). 403 ACCOUNT_DISABLED →
"Tài khoản đã bị vô hiệu hóa. Liên hệ quản trị viên." 429 RATE_LIMITED → "Quá nhiều
lần thử. Vui lòng thử lại sau." Generic failure → "Có lỗi xảy ra. Vui lòng thử lại."

## Error Placement

- Inline below field (format only).
- Banner (`role="alert"`) above submit for all server outcomes — credential failure
  is generic, never inline under one field (non-enumerating).
- No toast.

## Submit States

```
idle ──submit──▶ submitting ──ok(200)──▶ route on requiresPasswordChange
                     │                      ├─ true  → /op/first-login
                     │                      └─ false → operator landing
                     └──err──▶ error (re-enable, announce banner, focus phone)
```

| State | Button label | Enabled | Spinner | Announce |
|-------|--------------|---------|---------|----------|
| idle | "Đăng nhập" | yes | no | — |
| submitting | "Đang đăng nhập..." | no | yes | aria-live polite |
| success | "Đăng nhập" | no | no | redirect |
| error | "Đăng nhập" | yes | no | banner assertive |

## A11y Wiring

| Field | Pattern |
|-------|---------|
| each input | `<label for>` + `aria-describedby="X-err"` + `aria-required` + `aria-invalid` |
| phone | `inputmode="tel"` `autocomplete="username"` |
| password | `autocomplete="current-password"` |
| banner | `role="alert" aria-live="assertive"` |
| submit-fail | focus → phone |

## Open Questions

- Operator landing after login: source redirects to `/op/profile`; flow doc names
  `/op/dashboard`. Needs reconciliation (flow-doc conflict, defer to build).

## Out of Scope

- First-login forced change (separate file — operator-first-login).
- Customer login (separate file — auth-login).
- Operator self-registration (admin-provisioned only; Issue 020 CLI).
