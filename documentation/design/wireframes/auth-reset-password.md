---
screen: auth-reset-password
route: /auth/reset-password
last-updated: 2026-05-20
status: draft
---

# Wireframe: Đặt lại mật khẩu (Reset password — direct OTP + new password)

## Purpose
Direct-URL password reset (same logic as the reset step of `/auth/forgot-password`,
but a single self-contained form that also collects the phone). Accepts an
optional `?phone=` query param to pre-fill. Verifies the OTP (mints reset
`otpProof`), resets the password and revokes all sessions, then shows a 'done'
confirmation that routes to login.

## Entry Points
- "Yêu cầu mã OTP mới" / deep links carrying `?phone=` from forgot-password flow.
- Direct nav `/auth/reset-password?phone=<phone>`.

## Device Targets
- Mobile (375–767px) — primary
- Desktop (≥768px)

## Layout — Mobile (≤767px)

### Form (default)
```
+----------------------------------+
|  Đặt lại mật khẩu      ← h1
|                                  |
|  Số điện thoại         ← Label (NEW)
|  [ 0901234567       ]  ← Input (type=tel, required,
|                           defaultValue = ?phone= prefill)
|                                  |
|  Mã OTP (6 chữ số)     ← Label (NEW)
|  [ _ _ _ _ _ _      ]  ← Input (numeric, maxLength 6,
|                           pattern [0-9]{6}, autoComplete one-time-code)
|                                  |
|  Mật khẩu mới          ← Label (NEW)
|  [ ************      ]  ← Input (password, minLength 8)
|                                  |
|  Xác nhận mật khẩu mới ← Label (NEW)
|  [ ************      ]  ← Input (password, minLength 8)
|                                  |
|  (!) <error banner>    ← otp/password errors
|  [ Đặt lại mật khẩu ]   ← Button (default)
|                                  |
|  Yêu cầu mã OTP mới · Đăng nhập   ← Button(link) ×2
+----------------------------------+
```

### Done
```
+----------------------------------+
|  Thành công            ← h1
|  Mật khẩu của bạn đã được        ← body text
|  cập nhật.                        |
|                                  |
|  [ Đăng nhập        ]   ← Button (default) → /auth/login
+----------------------------------+
```

## Layout — Desktop (≥768px)
```
            +--------------------------------+
            |  Đặt lại mật khẩu      ← h1    |
            |                                |
            |  Số điện thoại  [ ........ ]   |
            |  Mã OTP         [ _ _ _ _ ]   |
            |  Mật khẩu mới   [ ........ ]   |
            |  Xác nhận       [ ........ ]   |
            |                                |
            |  [ Đặt lại mật khẩu ]          |
            |  Yêu cầu mã OTP mới · Đăng nhập|
            +--------------------------------+
   centered card, max-w ~400px, vertical center in viewport.
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| Phone Input | components/ui/input.tsx | No |
| OTP Input | components/ui/input.tsx | No |
| New-password Input | components/ui/input.tsx | No |
| Confirm-password Input | components/ui/input.tsx | No |
| Submit / Done Button | components/ui/button.tsx (default) | No |
| "Yêu cầu mã OTP mới" / "Đăng nhập" links | components/ui/button.tsx (link variant) | No |
| Field Label | — (inline `<label>` today) | Yes (Label missing) |
| Card shell | — (inline `<main>` today) | Yes (Card missing) |

## States
| State | Trigger | UI |
|-------|---------|----|
| default | initial load | Phone prefilled from `?phone=` if present; all fields empty otherwise; button enabled |
| loading | submit in flight | Button disabled, "Đang xử lý..." |
| password-mismatch | newPassword ≠ confirm (client) | Banner "Mật khẩu xác nhận không khớp." (no network call) |
| otp-invalid / otp-expired | verify `OTP_INVALID` / `OTP_EXPIRED` | Banner "Mã OTP không hợp lệ hoặc đã hết hạn." |
| lockout (429) | verify `OTP_LOCKED_OUT` | Banner "Tài khoản tạm khóa. Vui lòng thử lại sau 15 phút." |
| error (password reused) | reset `PASSWORD_REUSED` | Banner "Mật khẩu mới không được trùng mật khẩu cũ." |
| error (weak password) | reset `WEAK_PASSWORD` | Banner "Mật khẩu mới quá yếu. Vui lòng chọn mật khẩu mạnh hơn." |
| error (invalid proof) | reset `INVALID_PROOF` | Banner "Phiên xác thực đã hết hạn. Vui lòng yêu cầu mã OTP mới." → use "Yêu cầu mã OTP mới" link |
| error (network) | any fetch throws | Banner "Lỗi kết nối. Vui lòng thử lại." |
| resend-cooldown | re-request OTP within window | No on-page resend; "Yêu cầu mã OTP mới" routes to /auth/forgot-password to re-issue; cooldown UI is a placeholder (Open Q) |
| otp-sent | n/a here | This page does NOT send OTP — assumes an OTP already issued (via forgot-password). No otp-sent state. |
| success | reset OK (200/204) | Show 'done' confirmation ("Thành công") |
| disabled | loading=true | Submit button disabled |
| empty | initial w/o prefill | All fields blank — the baseline form |

## Interactions
- Submit: 1) `POST /api/auth/forgot-password/verify {phone,code}` → `otpProof`;
  2) `POST /api/auth/reset-password {otpProof,newPassword}`. Both pre-auth
  exempt (no CSRF header). Client-side confirm-match guard runs before any fetch.
- otpProof is single-use (jti consume, B3); replay yields `INVALID_PROOF`.
- Reset success revokes all sessions server-side.
- "Yêu cầu mã OTP mới" → /auth/forgot-password (to re-issue an OTP).
- Done "Đăng nhập" → router.push('/auth/login').

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| phone prefill | on mount | `?phone=` search param | No |
| otpProof JWT (reset) | on verify OK | POST /api/auth/forgot-password/verify | No |
| reset result | on reset call | POST /api/auth/reset-password | No |

## Open Questions
- This page cannot issue an OTP itself — if the user lands here with no active
  OTP, the only path is "Yêu cầu mã OTP mới". Consider merging with
  forgot-password to avoid the dead-end, or add an inline "Gửi mã OTP" action.
- Add resend cooldown timer once a resend control exists.
- Surface password rules (minLength=8 + reuse/weak) inline.

## Out of Scope
- OTP issuance (handled by forgot-password / send endpoints).
- Email-based recovery.
- Logged-in password change (account settings surface, separate screen).
