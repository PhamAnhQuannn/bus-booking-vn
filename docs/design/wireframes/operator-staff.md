---
screen: operator-staff
route: /op/staff
last-updated: 2026-05-20
status: draft
---

# Wireframe: Operator — Staff Management

## Purpose
Admin-only management of an operator's staff roster: list staff (name, phone,
assigned trip, status), create a new staff account (which SMSes a temporary
password), rename a staff member inline, and disable a staff member (revokes all
their sessions). Non-admin operators see the roster **read-only** (controls
hidden; the API enforces 403 regardless). Vietnamese title "Quản lý nhân viên".

## Entry Points
- Operator nav shell → "Staff" (`/op/staff`) — admin nav item.
- Redirects: no session → `/op/login`; `requiresPasswordChange` → `/op/first-login`.

## Device Targets
- Mobile (375–767px)
- Desktop (≥768px) — primary (roster table + create form)

## Layout — Mobile (≤767px)
Create form stacks; roster table → cards. Inline rename becomes a per-card edit field.
```
┌──────────────────────────────────────┐
│ [Operator nav shell — see            │
│  operator-dashboard.md]              │
├──────────────────────────────────────┤
│ Quản lý nhân viên             (h1)   │
│ Danh sách nhân viên của nhà xe. Tạo  │
│ tài khoản … gửi mật khẩu tạm thời…   │  ← muted intro
│                                       │
│ ┌── message banner ────────────────┐ │  ← shown after any mutation
│ │ Đã tạo nhân viên. Mật khẩu tạm    │ │     (success or translated error)
│ │ thời đã gửi qua SMS tới +8490…    │ │
│ └──────────────────────────────────┘ │
│                                       │
│ ┌─ Tạo nhân viên mới (admin only) ─┐ │  ← bordered section (Card MISSING)
│ │ Tên nhân viên                    │ │
│ │ [____________________________]   │ │  ← Input, required 1–120
│ │ Số điện thoại                    │ │
│ │ [____________________________]   │ │  ← Input type=tel, required
│ │ [   Tạo nhân viên   ]            │ │  ← submit; "Đang xử lý..." when busy
│ └──────────────────────────────────┘ │
│                                       │
│ Danh sách nhân viên (3)        (h2)  │
│ ┌── staff card ────────────────────┐ │
│ │ [ Nguyễn Văn A____ ] (edit, admin)│ │  ← inline name Input
│ │ +8490xxxx12                       │ │
│ │ Chuyến gán: a1b2c3d4 / —          │ │
│ │ Trạng thái: Hoạt động             │ │
│ │ [ Lưu tên ]  [ Vô hiệu hoá ]      │ │  ← admin actions (Lưu disabled if unchanged)
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Trần Thị B                        │ │
│ │ Trạng thái: Đã vô hiệu hoá        │ │  ← "Vô hiệu hoá" Button disabled
│ └──────────────────────────────────┘ │
│ (empty) "Chưa có nhân viên nào."     │
└──────────────────────────────────────┘
```

## Layout — Desktop (≥768px)
```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ [Operator nav shell — see operator-dashboard.md]                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ Quản lý nhân viên                                                              (h1)    │
│ Danh sách nhân viên của nhà xe. Tạo tài khoản nhân viên sẽ gửi mật khẩu…  (muted)      │
│                                                                                       │
│ ── message banner (success / translated error) — after any mutation ──                │
│                                                                                       │
│ ┌─ Tạo nhân viên mới (admin only — hidden for non-admin) ──────────────────────────┐  │
│ │ Tên nhân viên  [_______________________]                                         │  │
│ │ Số điện thoại  [_______________________]   [ Tạo nhân viên ]                      │  │
│ └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                       │
│ Danh sách nhân viên (3)                                                        (h2)    │
│ ┌──────────────────────┬──────────────┬────────────┬───────────────┬───────────────┐ │
│ │ Tên                  │ SĐT          │ Chuyến gán │ Trạng thái    │ Hành động     │ │ ← Hành động col admin-only
│ ├──────────────────────┼──────────────┼────────────┼───────────────┼───────────────┤ │
│ │ [Nguyễn Văn A____]   │ +8490xxxx12  │ a1b2c3d4   │ Hoạt động     │[Lưu tên][Vô…] │ │
│ │ [Trần Thị B______]   │ +8490xxxx08  │ —          │ Đã vô hiệu hoá│[Lưu tên][Vô…]✗│ │ ← disable disabled
│ │ [Lê Văn C________]   │ +8490xxxx07  │ —          │ Hoạt động     │[Lưu tên][Vô…] │ │
│ └──────────────────────┴──────────────┴────────────┴───────────────┴───────────────┘ │
│  (non-admin: name = plain text, no "Hành động" column)                                │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| Operator nav shell | `operator-dashboard.md` | reference |
| Page title + muted intro | inline `<h1>` + `<p>` | existing markup |
| Message banner | inline `<div data-testid=staff-message>` (neutral fill) | New? (no Toast/Alert primitive) |
| Create-staff section | inline bordered `<section>` | New? — **Card primitive MISSING** |
| Name / Phone Inputs | raw `<input>` + wrapping `<label>` | promote → `Input` + `Label` (Label MISSING) |
| "Tạo nhân viên" submit | raw `<button>` → `Button` variant=default | New? (markup raw) |
| Staff Table | raw `<table data-testid=staff-table>` | New? — **Table primitive MISSING** (`/data-table-design`) |
| Inline rename Input | raw `<input>` per row (admin) | promote → `Input` |
| "Lưu tên" Button | raw `<button>` → `Button` variant=outline size=sm | New? (markup raw) |
| "Vô hiệu hoá" Button | raw `<button style=color:red>` → `Button` variant=destructive | New? (destructive renders SOFT) |
| Disable confirm | native `confirm()` | New? — **Dialog/Modal primitive MISSING** (should replace native confirm) |

## States
| State | Trigger | UI |
|-------|---------|----|
| Loading (initial) | RSC `getOperatorStaff()` | server-rendered roster (SSR) |
| Empty | `staff.length === 0` | "Chưa có nhân viên nào." |
| Busy (any mutation) | `busy === true` | submit + row Buttons disabled, label "Đang xử lý..." |
| Success — create | `res.status === 201` | banner "Đã tạo nhân viên. Mật khẩu tạm thời đã gửi qua SMS tới {phone}."; form clears; roster refetch |
| Success — rename | rename `res.ok` | banner "Đã cập nhật tên."; roster refetch |
| Success — disable | disable `res.ok` | banner "Đã vô hiệu hoá nhân viên."; roster refetch |
| Error — phone_in_use | API `error='phone_in_use'` | banner "Số điện thoại đã được sử dụng" |
| Error — not_found | API `error='not_found'` | banner "Không tìm thấy" |
| Error — invalid_input/body | API resp. | banner "Dữ liệu không hợp lệ" |
| Error — other | default | banner "Đã xảy ra lỗi" |
| Disable confirm | "Vô hiệu hoá" click | native `confirm('Vô hiệu hoá nhân viên này? Mọi phiên đăng nhập sẽ bị thu hồi.')` — cancel aborts |
| Row — disabled member | `member.disabled` | "Đã vô hiệu hoá" status; "Vô hiệu hoá" Button disabled |
| Row — assigned trip | `member.assignedTripId != null` | trip id shown (else —) |
| Rename disabled | `editName === displayName` OR empty/trim-empty | "Lưu tên" disabled (no-op guard) |
| Non-admin view | `isAdmin === false` | create section hidden; name = plain text; no "Hành động" column |

## Interactions
- Create: fill name + phone → submit → `POST /api/op/staff` (`X-CSRF-Token` +
  `Content-Type: application/json`, body `{name, phone}`) → 201 success banner +
  `refreshStaff()` (`GET /api/op/staff`).
- Rename: edit row Input → "Lưu tên" → `PATCH /api/op/staff/[id]` `{name}` →
  refetch. Button disabled unless `editName` differs from current & non-empty.
- Disable: "Vô hiệu hoá" → native `confirm()` → on accept `POST /api/op/staff/[id]/disable`
  (`X-CSRF-Token`) → refetch. **Side effect: revokes all that member's sessions.**
- No optimistic UI: roster is refetched from server after each mutation.

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| Initial roster + isAdmin | RSC render | `getOperatorStaff()` in-process | n/a (SSR) |
| Create staff | submit | `POST /api/op/staff` (SMS temp password side effect) | No |
| Rename | "Lưu tên" | `PATCH /api/op/staff/[id]` | No |
| Disable (+ session revoke) | confirm | `POST /api/op/staff/[id]/disable` | No |
| Refetched roster | after each mutation | `GET /api/op/staff` | No |

## Open Questions
- Replace native `confirm()` with a focus-trapping Dialog (primitive MISSING) for
  the disable-confirm — current native dialog isn't styled or a11y-consistent.
- Provisioning sends temp password via SMS to `contactPhone == notificationPhone`
  (no phones-differ CHECK — Issue 020 Mistake Log). Surface the sent-to phone
  clearly so admin can relay/verify. Confirm the temp password is never shown in UI.
- Staff RBAC granularity (admin vs sub-roles) is flat today (flow Open Questions) —
  any future per-staff permission UI lands here.
- Auto-chain `/data-table-design` (Table primitive + inline-edit row pattern,
  mobile→card) and `/form-design` (Label/Input pattern for the create form).
- "Chuyến gán" shows raw `assignedTripId` — link to `/op/manifest/[tripId]`?

## Out of Scope
- Operator (company) self-signup — provisioned via platform-admin CLI (Issue 020).
- Password reset for staff (separate forgot-password OTP flow).
- Re-enabling a disabled staff member (no re-enable action in current source).
