---
feature: account-settings
target: WCAG 2.2 AA
last-updated: 2026-05-20
status: draft
inherits: docs/design/a11y-global.md
---

# A11y Design: Account Settings

Surfaces: account-settings (name edit, change password, phone-change via OTP, soft-delete),
account-bookings (list), account-booking-detail. Wireframes:
`docs/design/wireframes/account-*.md`. Flow: `docs/design/flows/account-settings.md`.
Form contracts: `form-account-name.md`, `form-account-password.md`,
`form-account-phone-change.md`, `form-account-delete.md`. Inherits global baseline.

## Landmarks

| Element | Role / Tag |
|---------|-----------|
| Main | `<main id="main">` |
| Settings sections | each `<section aria-labelledby="<section>-heading">` (Card primitive, MISSING — build) |
| Bookings list | real `<table>` OR list of Cards; if table → global Table a11y rules |
| Booking detail | `<article aria-labelledby="booking-ref-heading">` |

Account settings is a SINGLE page of stacked sections (name / password / phone / delete),
each its own `<form>` with its own submit + live region — NOT one mega-form.

## Keyboard Map

| Key | Context | Action |
|-----|---------|--------|
| Tab / Shift+Tab | global | Move through sections in DOM order |
| Enter | any section submit | Save that section only |
| Arrow Up/Down | (none — no radio groups here) | — |
| Enter / Space | "Xóa tài khoản" trigger | Open soft-delete confirm Dialog |
| Esc | delete-confirm Dialog | Close (cancel) — Dialog IS dismissible (non-destructive default) |
| Tab | inside Dialog | Trapped within Dialog until close |

## Tab Order

Page: name input → "Lưu tên" → currentPassword → newPassword → confirmPassword → "Đổi mật
khẩu" → phone input → "Gửi mã" → (OTP step) OTP → "Xác nhận đổi số" → "Xóa tài khoản"
(destructive trigger, LAST). Dialog open: confirm-phrase input → "Hủy" → "Xác nhận xóa"
(destructive).

## Focus Management

| Trigger | Focus moves to |
|---------|----------------|
| each section save validation error | first errored field IN THAT section |
| section save success | stay in section; announce "Đã lưu" polite (no page nav) |
| phone-change OTP init success | OTP field; announce "Đã gửi mã" polite |
| phone-change confirm success | phone field (updated value); announce polite |
| delete trigger click | Dialog confirm-phrase input (focus trap) |
| Dialog Esc / "Hủy" | return focus to "Xóa tài khoản" trigger |
| delete confirm success | redirect to home/login; announce "Tài khoản đã xóa" polite before nav |
| any server error | that section's banner `role="alert"` |

## Live Regions

| Region | Pattern |
|--------|---------|
| per-section "Đã lưu N giây trước" | `aria-live="polite"` (one per section, scoped) |
| field errors | `role="alert"` id `<field>-err`, verbatim VN copy |
| section banner (server error) | `role="alert" aria-live="assertive"` |
| phone-change OTP sent / resend | `aria-live="polite"` |
| delete Dialog error | banner inside Dialog `role="alert" assertive` |

Multiple polite "saved" regions exist (one per section) — only the just-saved one updates;
never fire two at once.

## Soft-Delete Dialog (destructive, PII anonymization)

- `role="dialog" aria-modal="true"` + `aria-labelledby` (heading) + `aria-describedby`
  (consequence copy: "Hành động này không thể hoàn tác. Dữ liệu cá nhân sẽ bị ẩn danh.").
- Focus trap; Esc + "Hủy" both cancel and restore trigger focus.
- Confirm requires typed phrase (per form-account-delete.md) — confirm button disabled
  until phrase matches; disabled state announced (`aria-disabled`).
- "Xác nhận xóa" uses Button `destructive` (SOFT: `bg-destructive/10 text-destructive`) —
  destructive contrast #dc2626/bg ≈4.84:1 ✅ (global table). Don't rely on color alone;
  icon + text label.

## Screen Reader Script (settings, VoiceOver vi)

1. "Cài đặt tài khoản, tiêu đề cấp 1"
2. "Họ và tên, vùng" → "Họ và tên, chỉnh sửa văn bản" → "Lưu tên, nút"
3. "Đổi mật khẩu, vùng" → 3 password fields → "Đổi mật khẩu, nút"
4. "Số điện thoại, vùng" → "Số điện thoại, chỉnh sửa văn bản" → "Gửi mã, nút"
5. "Vùng nguy hiểm" → "Xóa tài khoản, nút" (destructive)

## Touch Targets

Section submit buttons + Dialog buttons full-width or ≥44px. Delete trigger ≥44px,
visually separated (danger zone). Bookings-list row actions (view detail) ≥44px hit area.

## Out of Scope

- Re-enable a soft-deleted account (one-way in MVP).
- Avatar / profile photo (not in MVP).
- Email field (SMS-only contact in MVP).

## Open Questions

- Inherits global F1 (focus ring). Danger-zone delete relies on SOFT destructive variant +
  icon + text (not color-only) — confirm icon present in build.
- Bookings list: table vs Card-list decision affects which global a11y rules apply
  (Table primitive MISSING — build). Defer to `/data-table-design` if table chosen.
