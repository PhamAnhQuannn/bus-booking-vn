---
screen: auth-forgot-password
route: /auth/forgot-password
last-updated: 2026-05-20
status: draft
---

# Wireframe: Quên mật khẩu (Forgot password — phone → OTP → reset)

## Purpose
Recover account access. Step 1 requests an OTP for a phone (always reports
success — non-enumerating, branch B4). Step 2 takes the OTP + new password,
verifies the OTP (mints reset `otpProof`) then resets the password and revokes
all sessions. Step 3 ('done') confirms and routes to login. Single page; `step`
state ('phone' | 'reset' | 'done') swaps the whole body.

## Entry Points
- "Quên mật khẩu?" link on `/auth/login`.
- Direct nav `/auth/forgot-password`.

## Device Targets
- Mobile (375–767px) — primary
- Desktop (≥768px)

## Layout — Mobile (≤767px)

### Step 1 — phone
```
+----------------------------------+
|  Quên mật khẩu         ← h1
|  Nhập số điện thoại đã đăng ký.   ← helper text
|  Chúng tôi sẽ gửi mã OTP...       |
|                                  |
|  Số điện thoại         ← Label (NEW)
|  [ 0901234567       ]  ← Input (type=tel, required)
|                                  |
|  (!) <error banner>    ← network error only
|  [ Gửi mã OTP       ]   ← Button (default)
|                                  |
|  Quay lại đăng nhập     ← Button(link) → /auth/login
+----------------------------------+
```

### Step 2 — reset
```
+----------------------------------+
|  Đặt lại mật khẩu      ← h1
|  Nhập mã OTP đã gửi... và mật     ← helper text
|  khẩu mới.                        |
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
|  Dùng số điện thoại khác ← Button(link) → back to step 1
+----------------------------------+
```

### Step 3 — done
```
+----------------------------------+
|  Đặt lại mật khẩu thành công  ← h1
|  Mật khẩu của bạn đã được        ← body text
|  cập nhật.                        |
|                                  |
|  [ Đăng nhập        ]   ← Button (default) → /auth/login
+----------------------------------+
```

## Layout — Desktop (≥768px)
```
            +--------------------------------+
            |  <step h1>                     |
            |  <step helper text>            |
            |                                |
            |  [ step-specific form body ]   |
            |   (phone | reset | done)       |
            |                                |
            |  [ step CTA Button ]           |
            |  <step footer link>            |
            +--------------------------------+
   centered card, max-w ~400px, vertical center in viewport.
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| Phone Input (step 1) | components/ui/input.tsx | No |
| OTP Input (step 2) | components/ui/input.tsx | No |
| New-password Input (step 2) | components/ui/input.tsx | No |
| Confirm-password Input (step 2) | components/ui/input.tsx | No |
| Step CTA / Done Button | components/ui/button.tsx (default) | No |
| "Quay lại đăng nhập" / "Dùng số điện thoại khác" | components/ui/button.tsx (link variant) | No |
| Field Label | — (inline `<label>` today) | Yes (Label missing) |
| Card shell | — (inline `<main>` today) | Yes (Card missing) |

## States
| State | Trigger | UI |
|-------|---------|----|
| default (step 1) | initial load | Empty phone, "Gửi mã OTP" enabled |
| loading (request) | step-1 submit | Button disabled, "Đang gửi..." |
| otp-sent | request returns (any) | Advance to step 2 — ALWAYS (non-enumerating B4); no signal whether phone exists |
| loading (reset) | step-2 submit | Button disabled, "Đang xử lý..." |
| password-mismatch | newPassword ≠ confirm (client) | Banner "Mật khẩu xác nhận không khớp." (no network call) |
| otp-invalid / otp-expired | verify `OTP_INVALID` / `OTP_EXPIRED` | Banner "Mã OTP không hợp lệ hoặc đã hết hạn." stay on step 2 |
| lockout (429) | verify `OTP_LOCKED_OUT` | Banner "Tài khoản tạm khóa sau nhiều lần nhập sai. Vui lòng thử lại sau 15 phút." |
| error (password reused) | reset `PASSWORD_REUSED` | Banner "Mật khẩu mới không được trùng mật khẩu cũ." |
| error (weak password) | reset `WEAK_PASSWORD` | Banner "Mật khẩu mới quá yếu. Vui lòng chọn mật khẩu mạnh hơn." |
| error (invalid proof) | reset `INVALID_PROOF` | Banner "Phiên xác thực đã hết hạn. Vui lòng yêu cầu mã OTP mới." |
| error (network) | any fetch throws | Banner "Lỗi kết nối. Vui lòng thử lại." |
| resend-cooldown | re-request OTP within window | No resend control in source — "Dùng số điện thoại khác" returns to step 1 to re-request; cooldown UI is a placeholder (Open Q) |
| success | reset OK (200/204) | Advance to step 3 'done' confirmation |
| disabled | loading=true | Active step button disabled |
| empty | n/a | Each step's form is the empty baseline |

## Interactions
- Step 1: `POST /api/auth/forgot-password {phone}` (no CSRF — pre-auth exempt).
  Always advances to step 2 regardless of phone existence (B4).
- Step 2a: `POST /api/auth/forgot-password/verify {phone,code}` → `otpProof`
  (purpose=reset). 2b: `POST /api/auth/reset-password {otpProof,newPassword}`.
  Both pre-auth exempt (no CSRF). otpProof jti consumed once (B3).
- Reset success revokes all existing sessions server-side.
- "Dùng số điện thoại khác" resets to step 1 and clears error.
- Step 3 "Đăng nhập" → router.push('/auth/login').

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| forgot-password ack | step-1 submit | POST /api/auth/forgot-password | Yes — advances regardless of response (B4) |
| otpProof JWT (reset) | step-2 verify OK | POST /api/auth/forgot-password/verify | No |
| reset result | step-2 reset call | POST /api/auth/reset-password | No |

## Open Questions
- Add a "Gửi lại mã" (resend OTP) button + cooldown timer on step 2? Today only
  "Dùng số điện thoại khác" exists.
- Surface password-strength rules inline (minLength=8 + reuse/weak checks).
- Should the masked target phone be echoed on step 2 (it isn't today)?

## Out of Scope
- Email-based recovery.
- Security-question fallback.
- Account-recovery via support agent.
