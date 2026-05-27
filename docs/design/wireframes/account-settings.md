---
screen: account-settings
route: /account/settings
last-updated: 2026-05-20
status: draft
---

# Wireframe: Cài đặt tài khoản (Account Settings)

## Purpose
Single authenticated screen where a customer manages their own account: change
display name, change password, change phone (OTP-gated init→confirm), and
soft-delete the account. Mirrors `app/account/settings/page.tsx` (Issue 008) —
four independent Card sections, each with its own form + inline status line.

## Entry Points
- Account menu / header link once logged in (Bearer token in client memory).
- Direct nav to `/account/settings`.
- Unauthenticated request → every `/api/account/*` call returns 401; UI shows
  "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại." inline (no auto-redirect in
  current source).

## Device Targets
- Mobile (375–767px) — primary
- Desktop (≥768px) — same single column, capped width (~480px container)

## Layout — Mobile (≤767px)
```
+--------------------------------------------------+
|  Cài đặt tài khoản                  ← h1 (text-2xl font-bold)
+--------------------------------------------------+
| ┌── Card: Tên hiển thị ──────────────────────┐  | ← Card (NEW) wrapping <section>
| |  Tên hiển thị            ← h2 (text-lg)     |  |
| |  Tên mới                 ← Label (NEW)      |  |
| |  [______________________]  ← Input         |  |
| |  (✓/✗ inline status line)  ← status text   |  |
| |  [ Lưu tên ]             ← Button default   |  |
| └─────────────────────────────────────────────┘  |
| ┌── Card: Đổi mật khẩu ─────────────────────┐  |
| |  Đổi mật khẩu            ← h2               |  |
| |  Mật khẩu hiện tại       ← Label            |  |
| |  [______________________]  ← Input (pw)    |  |
| |  Mật khẩu mới            ← Label            |  |
| |  [______________________]  ← Input (pw,≥8) |  |
| |  Xác nhận mật khẩu mới   ← Label            |  |
| |  [______________________]  ← Input (pw)    |  |
| |  (status: "Đã đổi mật khẩu. Đăng nhập lại")|  |
| |  [ Đổi mật khẩu ]        ← Button default   |  |
| └─────────────────────────────────────────────┘  |
| ┌── Card: Đổi số điện thoại (STEP 1: init) ─┐  |
| |  Đổi số điện thoại       ← h2               |  |
| |  Số điện thoại mới       ← Label            |  |
| |  [0901234567__________]  ← Input (tel)     |  |
| |  (status line)                              |  |
| |  [ Gửi mã OTP ]          ← Button default   |  |
| └─────────────────────────────────────────────┘  |
| ┌── Card: Xóa tài khoản (danger) ───────────┐  |
| |  Xóa tài khoản           ← h2 (text-destructive)
| |  Thao tác này không thể hoàn tác...  ← copy |  |
| |  [ Xóa tài khoản ]       ← Button destructive(soft)
| └─────────────────────────────────────────────┘  |
+--------------------------------------------------+
```

## Layout — Desktop (≥768px)
```
            +----------------------------------------+
            |  Cài đặt tài khoản            ← h1     |
            +----------------------------------------+
            | [ Card: Tên hiển thị ]                 |  container max-w ~480,
            | [ Card: Đổi mật khẩu ]                 |  centered; single column
            | [ Card: Đổi số điện thoại ]            |  (no multi-col — matches
            | [ Card: Xóa tài khoản (danger) ]       |   480px source container)
            +----------------------------------------+
```
Phone-change STEP 2 (confirm) replaces the phone Card body in place:
```
| ┌── Card: Xác nhận số điện thoại mới ───────┐ |
| |  Nhập mã OTP đã gửi đến 0901234567  ← copy | |
| |  Mã OTP (6 chữ số)       ← Label           | |
| |  [ _ _ _ _ _ _ ]         ← Input (numeric, | |
| |                             maxLen 6, OTC) | |
| |  (status line)                             | |
| |  [ Xác nhận ]  [ Hủy ]   ← Button ×2        | |
| └────────────────────────────────────────────┘ |
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| Card (section wrapper ×4) | components/ui/card.tsx (to build) | Yes — MISSING (inline `<section>` today) |
| Label (per field) | components/ui/label.tsx (to build) | Yes — MISSING (inline `<label>` today) |
| Input (name/pw×3/phone/otp) | components/ui/input.tsx | No |
| Button (save / change / send-otp / confirm / cancel / delete) | components/ui/button.tsx | No |
| Status line (success/error text) | inline `<p>` → status-banner palette | promote later |
| Page heading h1 / section h2 | semantic markup | No |

## States
| State | Trigger | UI |
|-------|---------|----|
| loading (idle) | initial render | all forms enabled, no status line |
| submitting (per form) | form submit in flight | Button disabled + label "Đang lưu...", "Đang xử lý...", "Đang gửi OTP...", "Đang xác nhận...", "Đang xóa..." |
| success — name | PATCH /api/account/name 200 | green status: "Đã cập nhật tên hiển thị." (green-50/green-900) |
| success — password | POST /api/account/password 200 | green: "Đã đổi mật khẩu. Vui lòng đăng nhập lại." (sibling sessions revoked) |
| error — name | DISPLAY_NAME_TOO_SHORT / TOO_LONG | red banner: "Tên hiển thị quá ngắn (tối thiểu 4 ký tự)." / "...quá dài (tối đa 100 ký tự)." |
| error — password mismatch | newPassword ≠ confirmPassword (client) | red: "Mật khẩu xác nhận không khớp." (no network call) |
| error — password | CURRENT_PASSWORD_WRONG / PASSWORD_REUSED | red: "Mật khẩu hiện tại không đúng." / "Mật khẩu mới không được trùng mật khẩu cũ." |
| **phone-otp-sent** (init→confirm) | POST /api/account/phone/init 200 | phone Card swaps to STEP 2 confirm view; copy "Nhập mã OTP đã gửi đến {phone}"; OTP Input shown |
| error — phone init | LOCKED_OUT / RATE_LIMITED | red: "Số điện thoại tạm khóa..." / "Gửi OTP quá nhiều..." (shares auth lockout-sentinel) |
| **phone-otp-confirm** success | POST /api/account/phone/confirm 200 | green "Đã đổi số điện thoại thành công."; Card resets to STEP 1 (init) |
| error — phone confirm | PHONE_TAKEN / OTP_INVALID / OTP_EXPIRED / OTP_LOCKED_OUT | red: generic non-enumerating "Số điện thoại đã được đăng ký bởi tài khoản khác." (P2002) / "Mã OTP không đúng." / "Mã OTP đã hết hạn." / "Tài khoản tạm khóa sau nhiều lần nhập sai." |
| phone confirm — cancel | "Hủy" button | resets to STEP 1 (init), status cleared |
| **delete-confirm** | "Xóa tài khoản" first click | inline reveal: bold "Bạn có chắc chắn muốn xóa tài khoản?" + [Xác nhận xóa] (destructive) + [Hủy] |
| delete success (idempotent) | DELETE /api/account/delete 200 (`{ok, alreadyDeleted}`) | drop token + display name, redirect `/`; second call still 200 `{alreadyDeleted:true}` — same redirect, no error |
| delete cancel | "Hủy" in confirm | collapses back to single "Xóa tài khoản" button |
| disabled | any form submitting | that form's Button(s) disabled; confirm/cancel disabled during delete |
| 401 (any endpoint) | expired/missing Bearer | inline red "Phiên đăng nhập hết hạn..." per form |
| network error | fetch throws | red "Lỗi kết nối." |

## Interactions
- Each Card form is independent — submitting one does not affect another.
- Name: required, minLength 4, maxLength 100 (HTML + server echo).
- Password: 3 fields; client checks `new === confirm` before POST; success
  warns to re-login (server revokes sibling sessions, keeps current).
- Phone change is two-step: init sends OTP to the NEW phone → Card re-renders to
  confirm step (state `phoneStep: init|confirm`, `pendingPhone` held in memory).
  OTP Input is `inputMode=numeric`, `pattern=[0-9]{6}`, `autoComplete=one-time-code`.
  "Hủy" returns to init without sending.
- Delete is a single in-page confirm reveal (not a modal in current source) —
  idempotent: re-running after deletion returns 200 `{alreadyDeleted:true}`.
- All state-changing calls send `Authorization: Bearer` + `X-CSRF-Token`
  (proxy.ts double-submit enforcement; token via `readCsrfToken()`).

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| access token | every call | in-memory store (register page) | n/a |
| CSRF token | every state-change | `bb_csrf` cookie via `readCsrfToken()` | n/a |
| displayName echo | name success | PATCH response → `setDisplayName()` cache | No (server-confirmed) |
| pendingPhone | phone init→confirm | client state from init form | n/a |
| alreadyDeleted flag | delete | DELETE response discriminator | No |

## Open Questions
- Re-auth prompt before delete? Currently single in-page confirm, no password
  re-entry (flow doc Open Question).
- Promote inline success/error `<p>` to the amber/green/red status-banner
  palette + a real Card/Label primitive (both MISSING today).
- Should phone-confirm offer a "resend OTP" affordance? Not in source.

## Out of Scope
- Account data export (GDPR-style) — flow doc Out of Scope.
- Email management (no email field in Customer model for this surface).
- Dark-mode toggle.
