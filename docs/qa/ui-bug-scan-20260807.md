# UI bug scan — sign-in + new auth/account UI (2026-08-07)

**Findings only — no fixes applied.** Method: live Playwright evidence across viewports (320–1440) +
4 parallel Sonnet scanners (overlays/header, auth pages, account area, a11y/cross-cutting) → Opus
synthesis (dedup + rank). Stack: Next.js 16, Tailwind v4, Base UI (`@base-ui/react`). Server `:3001`.

Deduped to **35 issues**. IDs group by area: **DD** overlays/dropdown, **AU** auth pages, **AC**
account area, **AX** accessibility, **GL** global.

---

## BLOCKER (4)

**DD-1 · Account dropdown clipped behind the header (the reported bug).**
`components/auth/CustomerAccountMenu.tsx:62-67`. The popup *is* positioned correctly (opens below the
trigger, `sideOffset=6`). The bug is **stacking**: `z-50` sits on `Menu.Popup`, but the actually-
positioned ancestor `Menu.Positioner` gets only floating-ui's inline `transform` → it forms a stacking
context with **`z-index:auto` (≈0)**. The sticky header (`SiteHeader.tsx:128`, `sticky z-40`) is an
explicit-z sibling of the portal root at `<body>`, so **0 < 40** → the whole portal (incl. its z-50
child) paints *under* the header; the top ~19px (icon + first item) is clipped. Measured @1280:
popup.top=65, header.bottom=84, `popupTop−headerBottom=−19`. **Fix belongs on `Menu.Positioner` (or
the portal), not `Popup`.** Evidence: `uiscan-dropdown-1280-clip.png` + metrics.

**DD-2 · Mobile nav drawer stuck open + page scroll-locked across the `xl` breakpoint.**
`SiteHeader.tsx:125-345`. `drawerOpen` has no `matchMedia`/resize listener. Base UI `Dialog` is modal
→ applies body scroll-lock while `open`. But `Dialog.Popup`+`Backdrop` carry `xl:hidden`, so resizing
(or rotating a tablet) past 1280px **while open** hides all drawer UI yet keeps the scroll-lock/inert →
page is frozen with **no visible way to close** (only a reload recovers). *(Verify live with a resize.)*

**AX-1 · Signed-in account-menu trigger has no accessible name on mobile (<640px).**
`CustomerAccountMenu.tsx:47-60`. The name `<span>` is `hidden sm:inline`; the initials span + chevron
are both `aria-hidden`. Below `sm` (the majority traffic) the trigger exposes **no name** to
screen-readers. WCAG 4.1.2. (Same control also fails **AX-tap**: `px-2 py-1` ≈ 28–30px, < 44px — the
one header control breaking the site's own `min-h-11` rule.)

**AX-2 · Auth inline links fail text contrast (3.28:1 < 4.5:1).**
All "Quên mật khẩu?/Đăng ký/Đăng nhập nhà xe/Quay lại…" links use `text-primary`. `app/globals.css:82-84`
**self-documents** `text-primary` at 3.28:1 (graphics floor only) and reserves `text-primary-strong`
(globals.css:100-104) for 4.5:1 text — but the auth links use the weak token. WCAG 1.4.3.

---

## HIGH (6)

**DD-3 · Same z-index defect in the admin + operator account menus.**
`components/admin/AdminAccountMenu.tsx:75-78`, `components/op/OperatorPillMenu.tsx:66-69` — `z-50` on
`Menu.Popup` again (OperatorPillMenu under `ConsoleHeader` `sticky z-20`). The codebase's own
`ui/select.tsx:57`, `ui/date-picker.tsx:120`, `ui/combobox.tsx:60` correctly put `z-50` on the
**Positioner** — proving the right pattern exists; only the 3 Menu-based menus got it wrong.

**DD-4 · Sign-in hydration flash: guest CTA → account pill on every load.**
`SessionBootstrap.tsx:19-21` + `SiteHeader.tsx:229-246`. SSR/first paint always renders the guest
branch (`accessToken` starts `null`); the account pill only appears after the `useEffect` refresh
resolves. A returning signed-in user sees "Đăng nhập / Đăng ký" flash then swap (layout shift), and a
fast click during the flash **navigates an already-authed user to `/auth/login`**. Needs an
"unknown/pending" tri-state, not a binary `useIsSignedIn`.

**DD-5 · Truncated long display name has no fallback.**
`CustomerAccountMenu.tsx:58` (`max-w-32 truncate`, no `title=`) vs `:69` (`sm:hidden` full-name row —
inverse of when the trigger is visible). At ≥sm the name is truncated with no tooltip/popup fallback
("Nguyễn Văn Khá…").

**AX-3 · Invalid ARIA menu structure.** `CustomerAccountMenu.tsx:69` — a plain non-interactive `<div>`
is a direct child of `role="menu"` (only menuitem/group/separator allowed). AT may skip/misreport.

**AX-4 · Account status messages not announced.** `account/settings/page.tsx` `OkText`/`ErrText`
(name/password/phone/**delete-confirm**) are plain `<p>` with no `role="alert"`/`aria-live` — Save/
Change/Delete outcomes are silent to SR users, **inconsistent** with the auth pages which do set
`role="alert"`. WCAG 4.1.3. (Delete-confirm text also lacks live/dialog semantics — 3.2.2.)

**AC-1 · Delete-account double-tap risk.** `account/settings/page.tsx:363-382`. "Xóa tài khoản" swaps
in-place for "Xác nhận xóa" a few px lower with **no focus move / scroll**; a fast double-tap (mobile
muscle memory) can hit the real irreversible confirm. A `ui/dialog.tsx` primitive already exists but
isn't used. (Related **AC-2 MED**: `destructive` variant is pale `bg-destructive/10` — same weight as
the outline "Hủy", weak affordance for the highest-risk action.)

**AU-1 · Split-panel form column too narrow at iPad-portrait widths.**
`AuthSplitLayout.tsx:80` `md:grid-cols-[1.1fr_1fr]` with **no `gap`** → at 768–~874px the form column is
~333px, ~50–90px narrower than both the phone layout just below and the desktop layout above.

---

## MED (17)

- **AU-2 · OTP paste not sanitized** — `register/forgot/reset` code `<Input maxLength=6 pattern="[0-9]{6}">`
  has no onChange/onPaste strip; pasting "123-456" truncates to "123-45" and silently fails the pattern.
- **AU-3 · Error-alert reflow** — conditional `{error && <p role=alert>}` with no reserved space pushes
  the submit button on every failed→retry cycle (all auth pages; same pattern **AC-4** in settings).
- **AU-4 · Step-1→2 layout jump** — the Google button + "hoặc" divider (~100px) exist only on
  `register` step `email`, so the card height drops when advancing to OTP.
- **AU-5 · Small tap targets** — `size="sm"` = `h-7` (28px) on the OTP "Gửi lại mã" + "Dùng email khác";
  plain `text-sm` inline links (`gap-1` column) also < 44px with mis-tap risk (`button.tsx:27`).
- **AX-5 · No `autoComplete`** on any email/password field sitewide (only OTP sets `one-time-code`) —
  breaks password-manager autofill + WCAG 1.3.5. (Also surfaced by AU scanner.)
- **AX-6 · aria-invalid unused** — `ui/input.tsx:12` styles `aria-invalid` but no auth/settings field
  ever sets it; password-mismatch (forgot/reset/settings) shows only a generic top error, fields not
  marked/`aria-describedby`. WCAG 3.3.1.
- **AX-7 · Step transitions: no focus move / announce** — `register`(3-step)/`forgot`(2-step); `StepDots`
  is `aria-hidden`, subtitle non-live → focus lands on `<body>`, SR users get no "advanced" signal.
- **AX-8 · Bookings tabs — incomplete ARIA tabs** — `bookings/page.tsx:147-163` sets `role=tab`/
  `aria-selected` only; no `aria-controls`/`role=tabpanel`, no roving tabindex / arrow-key nav.
- **AX-9 · No reduced-motion guard** — drawer slide-in (`SiteHeader.tsx:288`) + menu fade/scale
  (`CustomerAccountMenu.tsx:64-67`) lack `motion-reduce:`, inconsistent with globals.css's own guards.
- **AX-10 · No skip-to-content link** — `app/layout.tsx:58-62`; keyboard users tab the whole header on
  every page. WCAG 2.4.1.
- **DD-6 · Logout "pending" state is dead** — `Menu.Item` default `closeOnClick=true` unmounts the popup
  on click, so `setPending(true)` / "Đang đăng xuất…" never renders (`CustomerAccountMenu.tsx:93-100`).
- **DD-7 · Cookie banner vs open drawer, both `z-50`** — `CookieConsent.tsx:43` vs `SiteHeader.tsx:288`;
  equal z + portal DOM order → drawer can cover the accept/reject buttons on a first-visit + drawer-open.
- **DD-8 · Drawer doesn't close on browser back/forward** — `drawerOpen` only cleared by in-drawer
  clicks; no `useEffect(…, [pathname])` closes it → drawer stays open over the destination.
- **GL-1 · z-index scale is ad hoc** — header 40, ConsoleHeader 20, OperatorNav 30/40/50, menus 50,
  toast 100 — no shared `--z-*` scale; DD-1/DD-3 are the direct symptom. No single source of truth.
- **AC-3 · Booking-detail skeleton mismatch** — `bookings/[id]/page.tsx:166` renders one `Skeleton`
  block but the real row has 2 buttons ("Gọi nhà xe" + "Tải vé PDF") → reflow when loading flips.

## LOW (8)
- **GL-2** `<body>`/`<html>` runtime scroll-lock (Base UI modal) is a generic future clip risk — sweep, don't point-fix (generalizes DD-1/DD-2).
- **AU-6** long email local-part no `break-words` in the OTP-step sentence (`register:217`) at 320–360.
- **AU-7** resend-countdown button width jitters each second (`self-center`, no fixed width).
- **AX-11** destructive text on `bg-destructive/10` contrast **unverified** (no measurement documented) — check AA.
- **AX-12** `GoogleSignInButton.tsx:52-56` — the whole "hoặc" divider incl. the word is `aria-hidden`, so SR users hear no "or" separator.
- **AC-5** `bookings` h1 + "Cài đặt tài khoản" row: `justify-between` no `flex-wrap`/`shrink-0` → link may wrap at 320 against a single-line h1.
- **AC-6** breadcrumbs (`settings/bookings/[id]`) `flex` with no wrap/`truncate` guard — a long `bookingRef`/locale could overflow at 320.
- **AC-7 (dev-only, not a prod bug)** the Next.js **dev-mode indicator** badge overlaps the "Số điện thoại mới" label in `uiscan-settings-390.png` — disappears in a production build; just confirm the deploy never serves a dev build.

---

## Root-cause clusters (fix these once → many bugs fall)
1. **Base UI Menu z-index on `Popup` not `Positioner`** → DD-1 (reported), DD-3 (admin/operator). One-line-each fix pattern, already correct in Select/DatePicker/Combobox.
2. **No shared z-index scale** (GL-1) → the class of DD-1/DD-3/DD-7 stacking bugs.
3. **Drawer open-state not tied to route/breakpoint** → DD-2 (blocker), DD-8.
4. **Binary signed-in state (no pending tri-state)** → DD-4 flash + wrong-nav.
5. **Status/error text = bare `<p>` with no reserved space / no live region** → AX-4, AU-3/AC-4 (reflow), AX-6.
6. **Weak-contrast token + missing autoComplete/aria-invalid** applied uniformly → AX-2, AX-5, AX-6.

## Evidence
`.playwright-mcp/` (or repo root): `uiscan-dropdown-1280-clip.png`, `uiscan-settings-1280.png`,
`uiscan-settings-390.png`, `uiscan-login-390.png`, `uiscan-register-390.png` + the @1280 dropdown
rect/z-index metrics captured live. Coverage: overlays/header, auth pages, account area, a11y — 320→1440.
