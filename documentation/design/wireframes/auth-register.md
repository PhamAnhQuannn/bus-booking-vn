---
screen: auth-register
route: /auth/register
last-updated: 2026-05-20
status: draft
---

# Wireframe: Đăng ký (Register — phone → OTP → profile)

## Purpose
3-step customer registration. Step 1 sends an OTP to the phone, step 2 verifies
it (mints an `otpProof` JWT), step 3 sets password + optional display name and
creates the account. On success stores accessToken + displayName, redirects to
`returnTo`. Single page, `step` state ('phone' | 'otp' | 'details') swaps the
form body; the `<h1>` "Đăng ký" + footer "Đã có tài khoản? Đăng nhập" persist.

## Entry Points
- "Đăng ký" link from `/auth/login`.
- Direct nav `/auth/register` (optionally `?returnTo=<path>`).

## Device Targets
- Mobile (375–767px) — primary
- Desktop (≥768px)

## Layout — Mobile (≤767px)

### Step 1 — phone
```
+----------------------------------+
|  Đăng ký               ← h1
|                                  |
|  Số điện thoại         ← Label (NEW)
|  [ 0901234567       ]  ← Input (type=tel, required)
|                                  |
|  (!) <error banner>    ← error only
|  [ Gửi mã OTP       ]   ← Button (default)
|                                  |
|  Đã có tài khoản? Đăng nhập  ← Button(link)
+----------------------------------+
```

### Step 2 — otp
```
+----------------------------------+
|  Đăng ký               ← h1
|                                  |
|  Nhập mã 6 chữ số đã gửi đến     ← helper text (text-muted-foreground)
|  0901234567                      |
|                                  |
|  Mã OTP                ← Label (NEW)
|  [ _ _ _ _ _ _      ]  ← Input (text, inputMode=numeric,
|                           maxLength 6, pattern [0-9]{6})
|                                  |
|  (!) <error banner>    ← otp-invalid / otp-expired
|  [ Xác minh         ]   ← Button (default)
|                                  |
|  Đã có tài khoản? Đăng nhập  ← Button(link)
+----------------------------------+
```

### Step 3 — details
```
+----------------------------------+
|  Đăng ký               ← h1
|                                  |
|  Tạo mật khẩu          ← helper text
|                                  |
|  Mật khẩu              ← Label (NEW)
|  [ ************      ]  ← Input (type=password, required, minLength 8)
|                                  |
|  Tên hiển thị (tuỳ chọn)  ← Label (NEW)
|  [                  ]  ← Input (type=text, optional)
|                                  |
|  (!) <error banner>    ← phone-already-registered / fail
|  [ Đăng ký          ]   ← Button (default)
|                                  |
|  Đã có tài khoản? Đăng nhập  ← Button(link)
+----------------------------------+
```

## Layout — Desktop (≥768px)
```
            +--------------------------------+
            |  Đăng ký               ← h1    |
            |                                |
            |  [ step-specific form body ]   |
            |   (phone | otp | details)      |
            |                                |
            |  [ step CTA Button ]           |
            |                                |
            |  Đã có tài khoản? Đăng nhập    |
            +--------------------------------+
   centered card, max-w ~400px, vertical center in viewport.
   No visible step indicator today (Open Question).
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| Phone Input (step 1) | components/ui/input.tsx | No |
| OTP Input (step 2) | components/ui/input.tsx | No |
| Password Input (step 3) | components/ui/input.tsx | No |
| Display-name Input (step 3) | components/ui/input.tsx | No |
| Step CTA Button | components/ui/button.tsx (default) | No |
| "Đăng nhập" link | components/ui/button.tsx (link variant) | No |
| Field Label | — (inline `<label>` today) | Yes (Label missing) |
| Card shell | — (inline `<main>` today) | Yes (Card missing) |
| Step indicator (1/2/3) | — | Yes (not in source) |

## States
| State | Trigger | UI |
|-------|---------|----|
| default (step 1) | initial load | Empty phone, "Gửi mã OTP" enabled |
| loading (send) | step-1 submit | Button disabled, "Đang gửi..." |
| otp-sent | send OK | Advance to step 2; helper shows masked target phone |
| loading (verify) | step-2 submit | Button disabled, "Đang xác minh..." |
| otp-invalid | verify `error: invalid` (400) | Banner "Mã OTP không đúng." stay on step 2 |
| otp-expired | verify `error: expired` (400) | Banner "Mã OTP đã hết hạn." stay on step 2 |
| lockout (429) | verify attempt_cap / lockout sentinel | Banner advises retry later (see Open Q — 429 currently falls through to generic "Mã OTP không đúng." in source) |
| resend-cooldown | re-request OTP within window | No resend control in source today — placeholder state (Open Q) |
| loading (register) | step-3 submit | Button disabled, "Đang đăng ký..." |
| error (phone taken) | register `error: invalid_credentials` | Banner "Số điện thoại đã được đăng ký." |
| error (generic register) | register non-OK | Banner "Đăng ký thất bại." |
| error (rate-limited send) | send `error: rate_limited` | Banner "Quá nhiều yêu cầu. Thử lại sau {retryAfter}s." |
| error (network) | any fetch throws | Banner "Lỗi kết nối. Vui lòng thử lại." |
| success | register OK | Store accessToken + displayName, redirect to returnTo |
| disabled | loading=true on any step | Active step button disabled |
| empty | n/a | Each step's form is the empty baseline |

## Interactions
- Step 1: `POST /api/auth/otp/send {phone}` (+ X-CSRF-Token). OK → step 2.
- Step 2: `POST /api/auth/otp/verify {phone,code}`. OK → capture `otpProof`,
  advance to step 3. Per flow B1: ok→proof; gone→expired(400); mismatch→invalid(400);
  attempt_cap→429.
- Step 3: `POST /api/auth/register {phone,otpProof,password,displayName}`.
  Server `jwt.verify` + jti-consume (one-shot, replay-safe). OK → store + redirect.
- otpProof held in component state between step 2 and step 3 (5-min TTL).
- No back-to-previous-step control in source except implicit (re-mount).

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| OTP send result / rate-limit retryAfter | step-1 submit | POST /api/auth/otp/send | No |
| otpProof JWT | step-2 verify OK | POST /api/auth/otp/verify | No |
| accessToken + displayName | step-3 register OK | POST /api/auth/register | No |
| returnTo path | on mount | `?returnTo` search param | No |
| CSRF token | each POST | `bb_csrf` cookie | No |

## Open Questions
- Add a visible step indicator (1 → 2 → 3)?
- Add a "Gửi lại mã" (resend OTP) button + cooldown timer? None exists today —
  resend-cooldown state is a placeholder until built.
- 429 lockout currently maps to the generic "Mã OTP không đúng." message in
  source — distinct lockout copy ("thử lại sau 15 phút") needed for parity with
  forgot-password.
- Password-strength hint / minLength=8 surfaced inline?

## Out of Scope
- Social / OAuth signup.
- Email-based registration.
- Captcha / bot mitigation UI.
