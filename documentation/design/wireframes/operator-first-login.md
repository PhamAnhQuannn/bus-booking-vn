---
screen: operator-first-login
route: /op/first-login
last-updated: 2026-05-20
status: draft
---

# Wireframe: Operator First-Login (Forced Password Change)

## Purpose
Force a freshly-provisioned operator to replace their temporary (CLI-issued)
password before reaching any working surface. Reachable only while the operator
JWT claim `requiresPasswordChange = true`; `proxy.ts` Layer 1 redirects EVERY
other `/op/*` route here (307) until the flag clears, so the operator cannot
navigate away. On success the change route returns 204, mints a fresh token with
`requiresPasswordChange:false`, revokes other sessions, and the client redirects
to `/op/profile`.

## Entry Points
- Direct from login success when `requiresPasswordChange:true`
  (`/op/login` → `router.push('/op/first-login')`).
- Proxy Layer 1 forced redirect: any `/op/*` request (except `/op/first-login`)
  while flag is true → 307 here.

## Device Targets
- Mobile (375–767px)
- Desktop (≥768px) — primary for operator. Narrow centered card on both; this is
  an interrupt screen, not a data surface.

## Layout — Mobile (≤767px)
```
+--------------------------------+
|   Đổi mật khẩu lần đầu          | ← page title (h1)
|   Bạn cần đặt mật khẩu mới      | ← helper copy (p)
|   trước khi tiếp tục.          |
|                                |
|   Mật khẩu hiện tại            | ← Label
|  [ ........................ ]   | ← Input (password, currentPassword, required)
|                                |
|   Mật khẩu mới                 | ← Label
|  [ ........................ ]   | ← Input (password, newPassword, minLength=8)
|                                |
|   Xác nhận mật khẩu mới        | ← Label
|  [ ........................ ]   | ← Input (password, confirmPassword, required)
|                                |
|  [ !! validation banner !! ]   | ← error region (conditional)
|                                |
|  [      Đổi mật khẩu       ]   | ← Button (default, submit, full-width)
+--------------------------------+
  (NO nav shell, NO logout, NO back — exit only via success)
```

## Layout — Desktop (≥768px)
```
+------------------------------------------------------------+
|                +----------------------------+              |
|                |  Đổi mật khẩu lần đầu      |              | ← centered card ~400px
|                |  Bạn cần đặt mật khẩu mới  | ← helper      |
|                |  trước khi tiếp tục.      |              |
|                |                            |              |
|                |  Mật khẩu hiện tại         | ← Label       |
|                |  [ .................... ]  | ← Input       |
|                |                            |              |
|                |  Mật khẩu mới              | ← Label       |
|                |  [ .................... ]  | ← Input       |
|                |                            |              |
|                |  Xác nhận mật khẩu mới     | ← Label       |
|                |  [ .................... ]  | ← Input       |
|                |                            |              |
|                |  [ validation banner ]     |              |
|                |  [     Đổi mật khẩu    ]   | ← Button      |
|                +----------------------------+              |
+------------------------------------------------------------+
```
Deliberately NO operator nav shell — the gate must not expose escape links.

## Components
| Component | Source | New? |
|-----------|--------|------|
| Page title (h1) | inline `<h1>` | existing markup |
| Helper copy (p) | inline `<p>` | existing markup |
| Labels (×3) | inline `<label>` today | New — promote to `Label` primitive |
| Current-password Input | inline `<input type=password>` | Migrate to `Input` |
| New-password Input | inline `<input minLength=8>` | Migrate to `Input` |
| Confirm-password Input | inline `<input>` | Migrate to `Input` |
| Submit Button ("Đổi mật khẩu") | inline `<button>` | Migrate to `Button` (default) |
| Error banner | inline `<p style=color:red>` | Use `text-destructive` token |

## States
| State | Trigger | UI |
|-------|---------|-----|
| Default | Page load (after redirect) | All three fields empty, Button enabled |
| Loading | Submit in flight | Button disabled, label → "Đang lưu..." |
| Confirm-mismatch | `newPassword !== confirmPassword` (client-side, pre-fetch) | Banner "Mật khẩu xác nhận không khớp."; no request sent; loading reset |
| Weak password | 4xx `{error:'WEAK_PASSWORD'}` | Banner "Mật khẩu mới không đủ mạnh (tối thiểu 8 ký tự)." |
| Wrong current password | 4xx `{error:'WRONG_CURRENT'}` | Banner "Mật khẩu hiện tại không đúng." |
| Same as old | 4xx `{error:'SAME_AS_OLD'}` | Banner "Mật khẩu mới phải khác mật khẩu cũ." |
| Generic error | other non-204 | Banner "Đã xảy ra lỗi. Vui lòng thử lại." |
| Connection error | fetch throws | Banner "Lỗi kết nối. Vui lòng thử lại." |
| Success | 204 No Content | fresh token Set-Cookie (flag cleared), `router.push('/op/profile')` |
| requiresPasswordChange-redirect (forced) | Operator types another `/op/*` URL | proxy 307 → `/op/first-login`; cannot leave until 204 |
| Disabled (Button) | While `loading` | Button disabled |
| Empty (n/a) | — | No list/empty state |

## Interactions
- Client validates `newPassword === confirmPassword` BEFORE the request; mismatch
  shows banner and aborts (no network call).
- Submit posts `{ currentPassword, newPassword }` to
  `POST /api/op/auth/password/change` with `X-CSRF-Token` header. The change route
  runs `requireOperatorAuth({ allowDuringPasswordChange: true })` so it is the one
  `/op/*` endpoint reachable while the flag is set.
- On 204 the server has already updated `passwordHash`, set
  `requiresPasswordChange:false`, revoked all OTHER operator sessions, and minted a
  fresh `bb_op_access`/`bb_op_refresh` carrying the cleared flag — so the proxy no
  longer redirects and `/op/profile` loads.
- No "cancel" / "skip" / "logout" affordance — exit is success-only by design.

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| CSRF token | Before submit | `bb_csrf` cookie (`getCsrf()`) | n/a |
| Change result (204 or `{error}`) | On submit | `POST /api/op/auth/password/change` | No |
| Fresh session cookies (flag cleared) | On 204 | server `Set-Cookie` | No |

## Open Questions
- Password-strength rule is only stated as ">= 8 chars" in copy; surface the full
  policy (composition rules?) inline before submit to reduce WEAK_PASSWORD round-trips.
- Should an aria-live region announce validation errors for screen readers (interrupt
  screen, keyboard-only operators)?
- New-password field has `minLength=8` native validation AND a server WEAK_PASSWORD
  path — confirm they agree so native browser validation doesn't mask the server rule.

## Out of Scope
- Forgot-password / OTP reset (branch B5).
- Session-revocation UX for the OTHER revoked sessions (silent server-side).
