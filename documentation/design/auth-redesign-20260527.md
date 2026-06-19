---
title: Auth Redesign — Split-Panel Brand (Customer + Operator)
date: 2026-05-27
cites: design-language.md v1.0
scope: app/auth/{login,register,forgot-password,reset-password}, app/op/{login,first-login}
status: design spec → implementation
covers: wireframe · form-design · cta-hierarchy · a11y · anti-generic
---

# Auth Redesign — design-team spec

Consolidated output of the design pass (wireframe / form / CTA / a11y / anti-generic),
scoped to the 6 auth screens. Pins **design-language v1.0** — orange single-action
accent, warm OKLCH, Be Vietnam Pro, `e1–e4` elevation (never flat), pill primary,
`motion-safe` only. No new tokens.

## 1. Layout — split-panel (`md+`), form-only (mobile)

```
desktop ≥768px                         mobile <768px
┌───────────────────┬───────────────┐  ┌───────────────┐
│  BRAND PANEL      │  FORM PANEL   │  │ ◖ brand bar ◗ │  slim: glyph+wordmark
│  (hidden md:flex) │  min-h-svh    │  ├───────────────┤
│  logo + wordmark  │  centered     │  │   <h1>        │
│  headline         │  card e3      │  │   form card   │
│  value bullets ×3 │  max-w-sm     │  │   (e3)        │
│  route motif      │  form         │  │   links       │
└───────────────────┴───────────────┘  └───────────────┘
```

- Shell: `grid min-h-svh md:grid-cols-[1.1fr_1fr] lg:grid-cols-[1.25fr_1fr]`.
- **Brand panel** `hidden md:flex flex-col justify-between p-10 lg:p-14`, full-bleed
  orange gradient surface. Content top-aligned headline + value props; bottom-aligned
  fine print / locale. Decorative route motif (reuse `Logo` route-mark language) at low
  opacity — `aria-hidden`.
- **Form panel** `flex min-h-svh flex-col items-center justify-center px-4 py-10`.
  Form sits in a `max-w-sm` column; the existing `Card` (`shadow-e1`) is bumped to
  `shadow-e3` for the search-card weight (login surface = high-intent, deserves e3).
- **Mobile brand bar** (`md:hidden`): single row — `Logo variant="combo"` + the page
  title, above the card. Large brand panel hidden entirely (no wasted vertical scroll).

## 2. Brand panel content — customer vs operator

`AuthSplitLayout` takes `audience: 'customer' | 'operator'`.

| | Customer | Operator |
|---|---|---|
| Surface | `bg-gradient-to-br from-primary to-primary/80` (orange) | `bg-gradient-to-br from-sidebar to-sidebar/80` warm-neutral + orange logo accent — distinctly "back-office", not the consumer orange wash |
| Wordmark | `Logo combo mono` on orange (white ink) | `Logo combo` (orange glyph) on neutral + "Cổng nhà xe" label |
| Headline | "Đặt vé xe khách liên tỉnh — nhanh, an toàn." | "Cổng quản trị nhà xe" |
| Value bullets (×3, `shield-check`/`bus`/`wallet` lucide, `size-5`) | "Giữ chỗ tức thì" · "Thanh toán an toàn" · "Hỗ trợ 24/7" | "Quản lý chuyến & đội xe" · "Theo dõi doanh thu" · "Xử lý đặt vé" |
| Foreground tokens | `text-primary-foreground` / `/80` | `text-sidebar-foreground` / `text-sidebar-foreground/70` |

Rationale: operators must *know they're in the right door* — different surface, different
copy, different headline. Same structural shell so the system reads as one family.

## 3. Per-screen wireframe + states

All forms: `<Card shadow-e3>` → `CardHeader` (title `as=h1` via heading override is not
supported; use `<h1>` inside header) + optional sub-copy → form fields → inline error
(`aria-live`) → primary submit (`Button size=lg w-full`) → tertiary links.

| Screen | Title | Fields | Primary CTA | Tertiary links |
|---|---|---|---|---|
| `auth/login` | Đăng nhập | phone, password | Đăng nhập | Quên mật khẩu? · Đăng ký · Đăng nhập nhà xe |
| `auth/register` | Đăng ký | step wizard (below) | per-step | Đã có tài khoản? Đăng nhập |
| `auth/forgot-password` | Quên mật khẩu / Đặt lại mật khẩu / Thành công | phone → code+pw×2 → ✓ | Gửi mã OTP / Đặt lại mật khẩu / Đăng nhập | Quay lại đăng nhập / Dùng số khác |
| `auth/reset-password` | Đặt lại mật khẩu / Thành công | phone, code, pw×2 | Đặt lại mật khẩu | Yêu cầu OTP mới · Đăng nhập |
| `op/login` | Đăng nhập — Quản trị viên | phone, password | Đăng nhập | Quên mật khẩu? |
| `op/first-login` | Đổi mật khẩu lần đầu | current, new, confirm | Đổi mật khẩu | — |

**States (every screen):** `default` · `loading` (button label swap + `disabled`,
`aria-busy`) · `error` (inline `text-destructive` for customer / `Alert variant=error`
for operator, `aria-live=assertive`) · `success` (forgot/reset done panel). Register adds
`otp-sent`, `otp-invalid/expired`, lockout messaging (copy already in source).

### Register wizard (3 steps)
- **Step indicator** above the form: 3 dots/segments, current = `bg-primary`, done =
  `bg-primary/40`, todo = `bg-border`. `aria-hidden` (decorative); real progress conveyed
  by the changing `<h1>`/sub-copy ("Bước 2/3"). Steps: `Số điện thoại → Xác minh → Mật khẩu`.
- **Resend OTP** affordance on step 2: `Button variant=link size=sm` "Gửi lại mã" — re-calls
  step-1 send. (Cooldown: disable + countdown label if a 429 `retryAfter` returns; reuse the
  existing rate-limit error path, no new API.)
- Step 2 sub-copy keeps "Nhập mã 6 chữ số đã gửi đến {phone}".

## 4. Form-design rules

- **Validation timing:** native HTML constraints (`required`, `type=tel`, `minLength=8`,
  `pattern=[0-9]{6}`, `inputMode=numeric`, `autoComplete=one-time-code`) — submit-time
  server validation drives the inline error. No premature on-blur red. Keep client
  password-match check (`!==` → "Mật khẩu xác nhận không khớp.") before network.
- **Error placement:** single error region directly above the submit button, `aria-live`.
  One message at a time; map server error codes to the existing VN copy (unchanged).
- **Field grouping:** one field per row, `gap-1.5` label→input, `gap-4` between fields.
- **Submit:** one primary per view (`size=lg`, `w-full`, customer) / default size operator
  (keep `[type=submit]`). Disabled + spinner-label while `loading`.
- **Autofill:** keep `name`/`type` so password managers + SMS OTP autofill keep working.

## 5. CTA hierarchy (per design-language §9)

- **Primary** (orange pill, `Button` default `size=lg`): the form submit — exactly one.
- **Tertiary** (`variant=link` / `text-primary` anchors): nav links (register, forgot,
  operator-login, back-to-login, resend, use-other-number).
- No secondary `outline` buttons on auth (nothing competes with submit).
- Operator login keeps default button size (matches console density), still single primary.

## 6. A11y (WCAG 2.2 AA)

- **Focus order:** brand panel is non-interactive + after the form in DOM order so keyboard
  lands on the first field immediately; OR brand panel rendered first but `aria-hidden` on
  decorative motif and no focusables. Decision: render form panel content with the `<h1>`
  as the page's first heading; brand panel decorative svg `aria-hidden`.
- **One `<h1>` per page**, inside the form (the operative title). Brand headline is a `<p>`
  styled large (not a competing heading) to keep a single document outline.
- Every input keeps a visible `<Label htmlFor>`. Errors: `aria-live` region; operator uses
  `Alert role=alert`. Loading button: `aria-busy`.
- Touch targets ≥44px (`size=lg` h-11 ✓; links use `min-h-11` where they're standalone).
- Focus ring `focus-visible:ring-3` inherited from primitives.
- `prefers-reduced-motion`: gradient is static; any entrance/hover lift gated `motion-safe:`.
- Contrast: white ink on orange gradient `from-primary` ≥4.5:1 ✓ (orange-600); operator
  neutral surface uses `sidebar-foreground` (designed pair).

## 7. Anti-generic check (13 tells)

| Tell | Status |
|---|---|
| Default system font | ✓ avoided — Be Vietnam Pro |
| Slate-only palette | ✓ avoided — warm OKLCH + orange |
| Single flat accent everywhere | ✓ orange action + neutral operator surface differentiation |
| KPI-grid headline | n/a (auth) |
| Uniform radius | ✓ pill primary vs `rounded-lg` inputs vs `rounded-xl` card — varied |
| No motion | ✓ motion-safe hover/step-advance |
| Gradient-blob hero | ⚠ using a brand gradient panel — mitigated: directional `to-br`, route-motif content, not a centered radial blob; copy + bullets carry it, not the gradient alone |
| Centered lonely card | ✓ avoided on desktop (split-panel); mobile keeps card but with brand bar |
| Stocky emoji | ✓ none — lucide line icons |
| Generic "Welcome back" | ✓ VN value-prop headline, not "Welcome" |
| No brand presence | ✓ logo + wordmark + value props |
| All-gray icons | ✓ accent-colored where meaningful |
| Identical customer/admin | ✓ explicitly differentiated (§2) |

**Verdict:** low-generic. One watch-item: keep the brand gradient *content-led* (headline +
bullets + motif), not an empty color wash.
