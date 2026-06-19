---
feature: auth
target: WCAG 2.2 AA
last-updated: 2026-05-20
status: draft
inherits: docs/design/a11y-global.md
---

# A11y Design: Auth (Customer + Operator)

Surfaces: login, register (phone→OTP→name+password), forgot-password, reset-password,
operator-login, operator-first-login (forced change). Wireframes:
`docs/design/wireframes/auth-*.md`, `operator-login.md`, `operator-first-login.md`.
Flow: `docs/design/flows/auth.md`. Form contracts: `docs/design/forms/form-auth-*.md`,
`form-operator-login.md`, `form-operator-first-login.md`. Inherits global baseline.

## Landmarks

| Element | Role / Tag |
|---------|-----------|
| Main | `<main id="main">` |
| Form region | `<form aria-labelledby="auth-heading">` |
| Step indicator (register/forgot) | `<ol>` with `aria-current="step"` on active step |

## Keyboard Map

| Key | Context | Action |
|-----|---------|--------|
| Tab / Shift+Tab | global | Move through fields |
| Enter | any single-field step | Submit step (send OTP / verify / set password) |
| Enter | login | Submit credentials |
| Esc | (no modal in auth flows) | — |

OTP input: 6-digit code field is ONE `inputmode="numeric"` field (NOT 6 boxes) —
`autocomplete="one-time-code"`, label "Mã xác thực". Single tab stop.

## Tab Order

**login:** phone → password → "Đăng nhập" → "Quên mật khẩu?" link → "Đăng ký" link.
**register step1:** phone → "Gửi mã". **step2:** OTP → "Xác nhận" (+ "Gửi lại mã" link).
**step3:** name → password → "Hoàn tất đăng ký".
**forgot-password:** phone → "Gửi mã" → OTP → "Xác nhận".
**reset-password:** newPassword → confirmPassword → "Đặt lại mật khẩu".
**operator-first-login:** currentPassword → newPassword → confirmPassword → "Đổi mật khẩu".

## Focus Management

| Trigger | Focus moves to |
|---------|----------------|
| each step mount | first (or only) field of step |
| OTP sent | OTP field; announce "Đã gửi mã xác thực" polite |
| validation error | first errored field |
| server error (INVALID_CREDENTIALS / OTP_INVALID / locked-out / generic) | banner `role="alert"` |
| OTP lockout (3 fails → 15min) | banner assertive: lockout copy + retry-after |
| step advance | next step's first field |
| reset/register success | redirect (login or home); announce success polite before nav |
| operator forced-change success | redirect to op dashboard (204 + fresh token) |

## Live Regions

| Region | Pattern |
|--------|---------|
| field errors | `role="alert"` id `<field>-err`; verbatim VN copy from form contract |
| auth banner (cred fail / OTP fail / lockout / generic) | `role="alert" aria-live="assertive"` |
| OTP-sent / resend confirmation | `aria-live="polite"` |
| resend cooldown countdown | `aria-live="polite"`, "Gửi lại sau N giây" |
| submit pending | button label swap + polite |

## Screen Reader Script (register step2, VoiceOver vi)

1. "Đăng ký, tiêu đề cấp 1"
2. "Bước 2 trên 3" (aria-current step)
3. "Đã gửi mã xác thực tới số 09xx" (polite, on mount after step1)
4. "Mã xác thực, chỉnh sửa văn bản, bắt buộc" (inputmode numeric, otp autocomplete)
5. "Xác nhận, nút"
6. "Gửi lại mã, liên kết" (disabled until cooldown elapses; announce enabled state)

## Security / SR Copy Notes

- Login failure copy MUST be non-enumerating: "Số điện thoại hoặc mật khẩu không đúng."
  (never reveal which field) — applies to both customer + operator login.
- OTP code field never echoed to SR beyond field label; do not announce typed digits.
- Phone announced as raw digits, not grouped/symbolized.
- Password strength hint (if shown) via `aria-describedby` polite, not assertive.
- otpProof JWT is transport-internal — no a11y/SR surface.

## Touch Targets

All auth submit buttons full-width primary, Button `lg` padded ≥44px. Inline links
("Quên mật khẩu?", "Gửi lại mã") need 44px hit area (pad — they sit below sub-44px text).

## Out of Scope

- Social / OAuth sign-in (not in MVP).
- Remember-me toggle (not in MVP).
- Multi-factor beyond OTP (deferred).

## Open Questions

- Inherits global F1 ring + F3 border-input — auth fields are the densest field surface;
  F3 (border ≈1.26:1) most felt here. Mandated label + focus ring is the current mitigation.
- "Gửi lại mã" cooldown duration shown in copy — confirm value in build vs flow contract.
