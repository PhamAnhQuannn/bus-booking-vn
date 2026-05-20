---
screen: auth-login
route: /auth/login
last-updated: 2026-05-20
status: draft
---

# Wireframe: Đăng nhập (Login)

## Purpose
Authenticate an existing customer with phone + password. On success stores the
access token (in-memory module store) + displayName and redirects to `returnTo`
(default `/`).

## Entry Points
- Direct nav `/auth/login`, often with `?returnTo=<path>` from a guarded page.
- "Đăng nhập" link on `/auth/register`.
- "Đăng nhập" CTA on reset/forgot success screens.
- "Quay lại đăng nhập" link on `/auth/forgot-password`.

## Device Targets
- Mobile (375–767px) — primary
- Desktop (≥768px)

## Layout — Mobile (≤767px)
```
+----------------------------------+
|                                  |
|  Đăng nhập              ← h1 (text-2xl font-bold)
|                                  |
|  Số điện thoại         ← Label (NEW)
|  [ 0901234567        ]  ← Input (type=tel, required)
|                                  |
|  Mật khẩu              ← Label (NEW)
|  [ ************      ]  ← Input (type=password, required)
|                                  |
|  (!) <error banner>    ← error state only (text-destructive)
|                                  |
|  [ Đăng nhập        ]   ← Button (default, full-w on mobile)
|                                  |
|  Quên mật khẩu?         ← Button (link variant) → /auth/forgot-password
|  Chưa có tài khoản?     ← text + Button(link) "Đăng ký" → /auth/register
|                                  |
+----------------------------------+
```

## Layout — Desktop (≥768px)
```
            +--------------------------------+
            |  Đăng nhập             ← h1
            |                                |
            |  Số điện thoại         ← Label
            |  [ 0901234567       ]  ← Input |
            |                                |
            |  Mật khẩu              ← Label
            |  [ ***********      ]  ← Input |
            |                                |
            |  [ Đăng nhập       ]   ← Button|
            |                                |
            |  Quên mật khẩu?  ·  Đăng ký    |
            +--------------------------------+
   centered card, max-w ~400px, vertical center in viewport
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| Phone Input | components/ui/input.tsx | No |
| Password Input | components/ui/input.tsx | No |
| Submit Button | components/ui/button.tsx (default) | No |
| Link buttons (Quên mật khẩu / Đăng ký) | components/ui/button.tsx (link variant) | No |
| Field Label | — (inline `<label>` today) | Yes (Label primitive missing) |
| Card shell | — (inline `<main>` today) | Yes (Card primitive missing) |

## States
| State | Trigger | UI |
|-------|---------|----|
| default | initial load | Empty phone + password, button enabled, no error |
| loading | submit in flight | Button disabled, label "Đang đăng nhập..." |
| error (bad creds) | non-OK login response | Banner "Số điện thoại hoặc mật khẩu không đúng." (text-destructive); fields retained |
| error (network) | fetch throws | Banner "Lỗi kết nối. Vui lòng thử lại." |
| success | OK response | Store accessToken + displayName, redirect to returnTo (no on-page success UI) |
| disabled | loading=true | Submit button disabled |
| empty | n/a | Login has no empty-data state (static form) |

> Login is password-based — no OTP states (otp-sent/invalid/expired/lockout/
> resend-cooldown) apply here. OTP error paths live on register / forgot /
> reset wireframes.

## Interactions
- Submit triggers `POST /api/auth/login {phone,password}` with `X-CSRF-Token`
  from `bb_csrf` cookie.
- On non-OK: generic credential error (non-enumerating — does not distinguish
  "no such phone" from "wrong password").
- Enter key submits the form.
- Links navigate via `<a>` (forgot/register).

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| accessToken + customer.displayName | on submit success | POST /api/auth/login | No |
| returnTo path | on mount | `?returnTo` search param | No |
| CSRF token | on submit | `bb_csrf` cookie | No |

## Open Questions
- Promote inline `<label>`/`<main>` to Label + Card primitives during normalization.
- Show/hide password toggle? (not in source today)
- Should bad-creds vs locked-account be distinguished? (currently generic)

## Out of Scope
- OTP / passwordless login.
- Social / OAuth login.
- Refresh-token rotation UI.
