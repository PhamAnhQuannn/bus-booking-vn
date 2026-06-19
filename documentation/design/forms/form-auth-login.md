---
form: auth-login
last-updated: 2026-05-20
status: draft
wireframe: docs/design/wireframes/auth-login.md
endpoint: POST /api/auth/login
---

# Form: Auth — Login (customer)

Phone + password. Bearer-session result. Operator login is the same route with
`scope:'operator'` — see `form-operator-login.md` (separate file).

## Fields

| Group | Name | Type | Required | Default | Notes |
|-------|------|------|----------|---------|-------|
| Credentials | phone | tel | yes | — | VN mobile, normalized client-side |
| Credentials | password | password | yes | — | no strength meter on login |

## Validation Matrix

| Field | Rule | Timing | Error copy |
|-------|------|--------|------------|
| phone | `/^(0|\+84)[35789][0-9]{8}$/` | on-blur | "Số điện thoại không hợp lệ" |
| password | non-empty (`min(1)`) | on-submit | "Vui lòng nhập mật khẩu" |

Server never field-validates credentials — wrong phone/password is a single
non-enumerating banner (below), NOT an inline field error.

## Error Placement

- **Inline** below phone (format only). Password inline only for empty.
- **Banner** (server, `role="alert"`): invalid credentials + rate-limit.
  - INVALID_CREDENTIALS → "Số điện thoại hoặc mật khẩu không đúng."
  - RATE_LIMITED → "Quá nhiều yêu cầu. Vui lòng thử lại sau {retryAfter} giây."
- No toast. Banner sits above the submit button.

## Submit States

```
idle ──submit──▶ submitting ──ok──▶ success (store token, redirect /account)
                     │
                     └──err──▶ error (re-enable, announce banner, focus phone)
```

| State | Button label | Enabled | Spinner | Announce |
|-------|--------------|---------|---------|----------|
| idle | "Đăng nhập" | yes | no | — |
| submitting | "Đang đăng nhập..." | no | yes | aria-live polite |
| success | "Đăng nhập" | no | no | redirect |
| error | "Đăng nhập" | yes | no | banner aria-live assertive |

## A11y Wiring

| Field | Pattern |
|-------|---------|
| phone | `<label for="phone">` + `<input id="phone" type="tel" aria-describedby="phone-err" aria-required="true" aria-invalid={hasErr}>` |
| password | `<label for="password">` + `<input id="password" type="password" aria-describedby="password-err" aria-required="true">` |
| banner | `<div role="alert" aria-live="assertive">` rendered only when present |
| submit-fail | focus → phone field |

## Open Questions

- "Remember me" toggle? Not in MVP (refresh cookie handles 30d).
- Forgot-password link placement — below submit, links to `/auth/forgot-password`.

## Out of Scope

- Register (separate file).
- Operator login (separate file, scope discriminant).
