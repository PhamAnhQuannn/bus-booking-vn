# UI fix plan — sign-in + account UI (2026-08-07)

Fix design for the 35 issues in `docs/qa/ui-bug-scan-20260807.md`. Root cause + fix + files + effort +
risk + verify per item. **Planning doc — no code applied yet.** Ordered by dependency: **foundations
first** (shared fixes that unblock many), then BLOCKER → HIGH → MED → LOW. Effort: S≤15min, M≤1h, L>1h.

Reuse patterns already in the repo: `ui/select.tsx`/`date-picker`/`combobox` put z-index on the
**Positioner** (not Popup); `ui/dialog.tsx` (focus-trap/restore); `text-primary-strong` token
(globals.css:100-105, the 4.5:1 text token); `role="alert" aria-live` on the auth error `<p>`; the
`min-h-11`/`size-11` 44px header convention; `motion-reduce:` variant (skeleton.tsx, TripMiniCard).

---

## Batch A — Foundations (do first; each unblocks several bugs)

**A1 · Shared z-index scale** — *fixes the whole DD-1/DD-3/DD-7 class*. Add `--z-*` tokens to
`app/globals.css @theme` (**verify the `@theme` block actually generates `z-*` utilities** — the repo
has no prior custom `--z-*`; confirm at build, else fall back to documented literals):
`--z-raised:10 · --z-chrome:40 · --z-banner:45 · --z-overlay-backdrop:50 · --z-overlay-panel:60 ·
--z-popover:70 · --z-toast:100`. Adopt across: header/ConsoleHeader/OperatorNav/BottomNav→`z-chrome`;
CookieConsent→`z-banner`; all Dialog/CommandPalette backdrops→`z-overlay-backdrop`, panels→`z-overlay-panel`;
all Menu/Select/DatePicker/Combobox **Positioners**→`z-popover`; toast→`z-toast`. Rationale: `popover(70)
> panel(60)` so a Menu opened inside the open drawer (`SiteHeader.tsx:328`) still stacks right.
**+ CLAUDE.md rule:** new floating UI uses a `z-*` token, never a bare `z-NN`. Effort **M**, risk low
(pure token rename), verify via the per-menu checks below + a build check that `z-*` classes resolve.

**A2 · `FormError` component** — *fixes AU-3 + AC-4 reflow + gives AX-6 its target id*.
`components/auth/FormError.tsx`: always-mounted `<p role="alert" aria-live="assertive" id=…
className="min-h-5 text-sm text-destructive" + invisible when empty>` (content `message || ' '`).
Replace the 8 `{error && <p role=alert>…}` sites (4 auth pages) + settings status. Effort **S**, risk low
(SR doesn't announce empty mount). 

**A3 · `OtpCodeInput` component** — *fixes AU-2*. Wrap `ui/input` with the shared OTP props +
`onChange` that strips non-digits & clamps to 6 (`value.replace(/\D/g,'').slice(0,6)`). Swap the 3 OTP
sites (register/forgot/reset). Effort **S**, risk none.

**A4 · Signed-in tri-state** — *fixes DD-4 flash + wrong-nav*. `lib/auth/clientSession.ts`: add
`resolved:boolean` (set true in `setAccessToken`, `clearSession`, **and the `attemptRefresh` network-error
catch** — else stuck "unknown" forever). Add `useAuthStatus(): 'unknown'|'guest'|'authed'`. `SiteHeader`
branches 3-way at both slots: authed→menu, guest→login link, **unknown→non-interactive `Skeleton`
`h-11 w-32 rounded-full`** (no href/onClick → kills the fast-click-to-/auth/login bug; matched width →
no shift). SSR-safe (store init is a pure constant → server + first client both render 'unknown', no
hydration mismatch). Keep `useIsSignedIn` for back-compat. Effort **M**, risk low; extend
`clientSession.test.ts` for the network-error `resolved` case.

**A5 · Shared status role in settings** — *fixes AX-4*. `settings/page.tsx` `OkText`→`role="status"
aria-live="polite"`, `ErrText`→`role="alert" aria-live="assertive"` (fix once in the helpers, covers all
4 sub-forms). Delete-confirm copy handled by A/C-1's dialog. Effort **S**, risk none.

---

## Batch B — BLOCKER (4)

**DD-1 · Dropdown clipped behind header.** Root: `z-50` on `Menu.Popup` but `Menu.Positioner` has
`z-index:auto` → whole portal under sticky header z-40. Fix: add `className="z-popover outline-none"` to
`Menu.Positioner` (`CustomerAccountMenu.tsx:62`), remove `z-50` from `Popup` (`:65`) — mirrors
`ui/select.tsx:55-58`. Effort **S** (depends A1). Verify @1280/390/768/1440: `popup.top −
header.bottom ≥ 0` (was −19).

**DD-2 · Drawer stuck open + scroll-locked across xl.** Root: `drawerOpen` no breakpoint listener; Base
UI Dialog scroll-lock persists while `open` even though Popup is `xl:hidden`. Fix:
`useEffect(()=>{const m=matchMedia('(min-width:1280px)'); const f=e=>e.matches&&setDrawerOpen(false);
m.addEventListener('change',f); return ()=>m.removeEventListener('change',f)},[])` in `SiteHeader`. Effort
**S**, risk low (edge-case only). Verify: open @390, resize→1400, assert lock cleared + page scrolls.

**AX-1 · Account-menu trigger no accessible name <sm** (+ **AX-tap** 28px). Root: name span `sm:inline`
hidden, initials+chevron `aria-hidden`. Fix: `aria-label={\`Tài khoản: ${name}\`}` on `Menu.Trigger`
(unconditional) + add `min-h-11` (matches header's own convention). Effort **S**, risk none. Verify:
axe/`getByRole('button',{name:/Tài khoản/})` at <640px; trigger height ≥44px.

**AX-2 · Auth links fail 4.5:1** (3.28:1). Fix: swap `text-primary`→`text-primary-strong` at 7 sites
(login:102/110/120, register:279, forgot:218, reset:168/172). Effort **S**, risk none. Verify: measure
`--primary-strong` against **card white** too (not just the page field's documented 4.79:1) → ≥4.5:1.

---

## Batch C — HIGH (6)

**DD-3 · Same z defect in admin + operator menus.** Fix: `z-popover` on the Positioner + drop `z-50`
from Popup in `AdminAccountMenu.tsx:75/78` + `OperatorPillMenu.tsx:66/69`. Effort **S** (depends A1).

**DD-4** → done in **A4**.

**DD-5 · Truncated long name, no fallback.** Fix: `title={name}` on the trigger span (`:58`) + popup row
(`:69`); AX-1's `aria-label` covers AT. Effort **S**, risk none.

**AX-3 · Invalid ARIA menu (div child of role=menu).** Fix: wrap the name row + the two account items in
`Menu.Group` + `Menu.GroupLabel` (Base UI primitives, default to plain divs → no visual change);
separator+logout stay outside. Effort **S**, risk low.

**AC-1 · Delete-account double-tap.** Root: in-place button swap, no focus move; `ui/dialog.tsx` unused.
Fix: convert to `ui/dialog` (Trigger→destructive button; DialogContent = warning + confirm/cancel).
Focus-trap/restore kills the double-tap structurally; keep the 401 error visible inside the dialog.
Effort **M**, risk low.

**AU-1 · Split-panel form column too narrow (768–874px).** Fix: `AuthSplitLayout.tsx:80`
`md:grid-cols-[minmax(0,1.1fr)_minmax(380px,1fr)] lg:grid-cols-[minmax(0,1.25fr)_minmax(400px,1fr)]`
(no `gap`). Effort **S**, risk: check the brand `aside` still fits at 768.

---

## Batch D — MED (17)

- **AU-2** → **A3**. · **AU-3/AC-4** → **A2**. · **AX-4** → **A5**. · **DD-7** → **A1** (banner<backdrop<panel).
- **AX-5 · autoComplete** — 11 one-line adds: login username/current-password; register email/new-password/name;
  forgot+reset email/new-password×2. Effort **S**.
- **AX-6 · aria-invalid** — password-mismatch (forgot/reset) + settings: add `passwordMismatch` state →
  `aria-invalid` + `aria-describedby={FormError id}` on the two fields (turns on the dormant
  `ui/input.tsx:12` red-border — note the intentional visual change). Effort **S** (depends A2).
- **AX-7 · step focus/announce** — `AuthSplitLayout` subtitle `aria-live="polite"` (attr only, keeps it
  hook-free); focus-move effect **local** to register/forgot (`useRef` + `isFirstRender` guard → focus a
  `tabIndex={-1}` step heading; guard against stealing initial-load focus). Effort **M**.
- **AX-8 · bookings tabs full ARIA** — add `aria-controls`/`role=tabpanel`/`aria-labelledby`, roving
  `tabIndex`, ArrowLeft/Right handler (2 tabs). Effort **M**, behavior change → keyboard test.
- **AX-9 · reduced-motion** — append `motion-reduce:transition-none` to the 3 animated surfaces
  (SiteHeader drawer backdrop+popup, CustomerAccountMenu popup). Effort **S**.
- **AX-10 · skip-link** — `app/layout.tsx`: `<a href="#main-content" class="sr-only focus:not-sr-only …
  focus:z-50">Bỏ qua đến nội dung chính</a>` first in body + `id="main-content"` on the children wrapper.
  (z above header's 40.) Effort **S**.
- **DD-6 · logout pending dead** — make `Menu.Root` controlled (`open`/`onOpenChange`), add
  `closeOnClick={false}` on the logout item, `setOpen(false)` after the fetch resolves. Effort **S**.
- **DD-8 · drawer not closing on back/forward** — `useEffect(()=>setDrawerOpen(false),[pathname])` in
  SiteHeader (existing idiom). Effort **S**.
- **AU-4 · step layout jump** — `min-h-[Npx]` on the per-step wrapper sized to the tallest step (measure
  first); bounds the jump (Google block only exists on step 1). Effort **S**, needs visual tuning.
- **AU-5 · tap targets** — `min-h-11` on `size="sm"` resend/secondary buttons; wrap plain links
  `inline-flex min-h-11 items-center`. Watch `gap-1` link stacks. Effort **S**.
- **AC-3 · skeleton mismatch** — booking-detail loading row → 2 `Skeleton` blocks (real row has 2
  buttons). Effort **S**.

---

## Batch E — LOW / polish (8)

- **AU-6** `break-words` on the OTP-step email sentence. · **AU-7** resend button `min-w-40 tabular-nums`.
- **AX-12** move `aria-hidden` off the "hoặc" wrapper onto only the two rule spans (expose "or").
- **AC-5** `flex-wrap` on bookings h1+link row. · **AC-7** `flex-wrap` on breadcrumbs + `max-w truncate`
  on the dynamic `bookingRef` crumb.
- **GL-2** CLAUDE.md rule: `fixed` UI must render through a `.Portal` (CookieConsent is the lone
  non-portaled `fixed` today — re-verify if the header ever gains transform/filter). Doc-only.
- **AC-6** dev-only Next.js indicator overlap — **no code**; just confirm the deploy runs `next build`
  (not `next dev`). Closed.

---

## Product / design decisions to confirm before coding
- **AC-2 · Destructive-variant weight.** Pale `bg-destructive/10` for the irreversible confirm reads no
  stronger than "outline". Option 1 (scoped): solid `bg-destructive text-white` on the confirm button
  only. Option 2 (global): new `destructive-solid` variant — needs a sitewide grep of every
  `variant="destructive"` first. → decide scoped vs global.
- **AX-11 · Destructive-on-tint contrast.** `text-destructive` on `bg-destructive/10` estimated ≈4.4:1
  (borderline). Measure real value (light + dark) on the danger badges + destructive buttons; if <4.5,
  darken the tint or the text — bundle with AC-2. Document the measurement in globals.css.
- **DD-7 drawer-covers-banner** + **DD-2 resize auto-close** are standard modal UX (assumed correct); flag
  if product wants different behavior.

## Suggested execution order (PRs)
1. **PR1 (foundations):** A1 z-scale + A2 FormError + A5 status roles. (unblocks the most)
2. **PR2 (blockers):** DD-1, DD-2, AX-1(+tap), AX-2 + DD-3 (rides A1).
3. **PR3 (header/menu):** A4 tri-state, DD-5, AX-3, DD-6, DD-8, AX-9, AX-10.
4. **PR4 (auth forms):** A3 OtpCodeInput, AU-1, AU-4/5/6/7, AX-5/6/7/12.
5. **PR5 (account):** AC-1 dialog, AC-3, AC-5, AC-7, AX-8 + the AC-2/AX-11 decision.

## Dependency notes
A1→DD-1/DD-3/DD-7 · A2→AU-3/AC-4/AX-6 · A3→AU-2 · A4→DD-4 · A5→AX-4. AX-6 after A2. AX-7 announce +
AU-3 touch the same region on step pages — do together. No source changed by this plan.
