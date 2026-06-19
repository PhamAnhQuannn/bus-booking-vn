---
screen: operator-profile
route: /op/profile
last-updated: 2026-05-20
status: draft
---

# Wireframe: Operator Profile

## Purpose
Show the operator user's account info (login phone, role — read-only) and let them
edit display name, contact phone, and notification phone. Also hosts the Logout
action. Server component reads `getOperatorProfile` in-process (never self-fetches);
the `OpProfileClient` island handles the edit PATCH and logout POST. This is the
current post-login landing page in source (see Open Question).

## Entry Points
- Post-login success (`/op/login` and `/op/first-login` both `router.push('/op/profile')`).
- Operator nav shell "Profile" item.
- Direct navigation to `/op/profile`.

## Device Targets
- Mobile (375–767px)
- Desktop (≥768px) — primary; narrower form column inside the shared nav shell

## Layout — Mobile (≤767px)
```
+------------------------------------------------+
| [≡] Bus-Booking (operator)        [Profile ▾]  | ← shared shell top bar
+------------------------------------------------+
|  Hồ sơ quản trị viên                            | ← h1
|                                                |
|  Read-only (dl):                               |
|   Số điện thoại đăng nhập:  09xxxxxxxx          | ← profile.phone
|   Vai trò:                  admin               | ← profile.role
|                                                |
|  Edit form:                                    |
|   Tên hiển thị                                  | ← Label
|  [ Nguyễn Văn A             ]                   | ← Input (displayName)
|   Số điện thoại liên hệ                          | ← Label
|  [ 09xxxxxxxx               ]                   | ← Input (contactPhone, tel)
|   Số điện thoại thông báo                        | ← Label
|  [ 09xxxxxxxx               ]                   | ← Input (notificationPhone, tel)
|                                                |
|  [ !! save message banner !! ]                 | ← message (green=ok / red=err)
|  [        Lưu hồ sơ        ]                    | ← Button (default, submit)
|  ----------------------------------            | ← <hr>
|  [        Đăng xuất        ]                    | ← Button (destructive/link, logout)
+------------------------------------------------+
```

## Layout — Desktop (≥768px)
```
+--------------+------------------------------------------------------+
|  NAV SHELL   |  Hồ sơ quản trị viên                                  | ← h1
|  (sidebar —  |                                                      |
|   see        |  Số điện thoại đăng nhập:  09xxxxxxxx                  | ← dl (read-only)
|   dashboard) |  Vai trò:                  admin                       |
|              |                                                      |
|              |  Tên hiển thị                                         | ← Label
|              |  [ Nguyễn Văn A                          ]            | ← Input
|              |  Số điện thoại liên hệ                                  | ← Label
|              |  [ 09xxxxxxxx                            ]            | ← Input
|              |  Số điện thoại thông báo                                | ← Label
|              |  [ 09xxxxxxxx                            ]            | ← Input
|              |                                                      |
|              |  [ save message banner (cond) ]                       |
|              |  [   Lưu hồ sơ   ]                                     | ← Button
|              |  ----------------------------------                   | ← hr
|              |  [   Đăng xuất   ]                                     | ← Button (logout)
+--------------+------------------------------------------------------+
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| Nav shell | see operator-dashboard.md | New (shared) |
| Page title (h1) | `app/op/profile/page.tsx` inline | existing markup |
| Read-only `dl` (phone, role) | `OpProfileClient.tsx` inline `<dl>` | Keep; consider `Card` once primitive exists |
| Labels (×3) | inline `<label>` | New — promote to `Label` primitive |
| Display-name Input | inline `<input type=text>` | Migrate to `Input` |
| Contact-phone Input | inline `<input type=tel>` | Migrate to `Input` |
| Notification-phone Input | inline `<input type=tel>` | Migrate to `Input` |
| Save Button ("Lưu hồ sơ") | inline `<button>` | Migrate to `Button` (default) |
| Save message banner | inline `<p>` (green/red by prefix) | Use success/destructive convention |
| Divider | inline `<hr>` | keep |
| Logout Button ("Đăng xuất") | inline `<button style=color:red>` | Migrate to `Button` (destructive — soft) |

## States
| State | Trigger | UI |
|-------|---------|-----|
| Default | Page load | Fields pre-filled from profile; phone + role read-only |
| Loading (save) | `loading=true` during PATCH | Save Button disabled, label → "Đang lưu..." |
| Success (save) | 204 No Content | Green message "Đã lưu hồ sơ." |
| Phones-must-differ | `{error:'PHONES_MUST_DIFFER'}` | Red "Số điện thoại liên hệ và thông báo phải khác nhau." (NOTE: see Open Question — flow doc says OperatorUser has NO phones-differ CHECK) |
| Invalid phone | `{error:'INVALID_PHONE'}` | Red "Số điện thoại không hợp lệ." |
| Generic error | other non-204 | Red "Đã xảy ra lỗi. Vui lòng thử lại." |
| Connection error | fetch throws | Red "Lỗi kết nối." |
| Disabled | While `loading` | Save Button disabled |
| Empty (n/a) | — | No list/empty state (single record) |
| Logout | "Đăng xuất" clicked | `POST /api/op/auth/logout` → `window.location.href='/op/login'` |
| requiresPasswordChange-redirect | session flag true | server `redirect('/op/first-login')` before render |
| Unauthenticated | no profile / session | server `redirect('/op/login')` |

## Interactions
- Save submits `{ displayName, contactPhone, notificationPhone }` via
  `PATCH /api/op/profile` with `X-CSRF-Token` header (PATCH is non-safe → CSRF required).
- Message color is derived client-side: green when text starts with "Đã lưu", red otherwise.
- Logout sends `POST /api/op/auth/logout` with CSRF header, then hard-navigates to
  `/op/login` (full reload to clear client state and dropped cookies).
- Login phone and role are display-only — not editable here (provisioning is CLI-side).

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| Operator profile `{ phone, role, displayName, contactPhone, notificationPhone, requiresPasswordChange }` | Server render | `getOperatorProfile()` in-process | No |
| CSRF token | Before save / logout | `bb_csrf` cookie (`getCsrf()`) | n/a |
| Save result (204 or `{error}`) | On save | `PATCH /api/op/profile` | No (no optimistic update) |
| Logout | On logout click | `POST /api/op/auth/logout` | No |

## Open Questions
- `OpProfileClient` handles `PHONES_MUST_DIFFER`, but the operator flow doc + Issue 020
  mistake-log say the `OperatorUser_phones_differ` CHECK was DROPPED (the two phones
  may be equal for a single-person operator user). Confirm whether `/api/op/profile`
  still enforces phones-differ — if not, remove the dead error branch + copy.
- Read-only `dl` for phone/role — promote to `Card` once that primitive exists.
- Save uses no optimistic update; confirm a green banner is sufficient feedback or
  whether the form should reset/dirty-track.
- Login lands here per source; reconcile with dashboard-as-home (see operator-dashboard).

## Out of Scope
- Password change (operator-first-login wireframe / forgot-password B5).
- Staff management (operator-staff — separate surface).
- Operator company profile (this is the per-user OperatorUser profile).
