# Frontend Stage Report — 2026-06-07

Scope: full route inventory + live Playwright route-coverage crawl + SEO audit + CTA/conversion
audit of the BBVN bus-booking webapp. Driver evidence: `frontend-route-audit-2026-06-07.md`
(live crawl), plus today's `operator-smoke-*` / `cross-persona-*` for the authed operator surface.

---

## 1. Stage verdict
**Frontend is mature/pre-launch for the LIVE surface (guest booking + operator console + admin
console).** Public pages render clean (0 broken, 0 console errors), gates enforce correctly. The
**customer account/auth surface is intentionally DORMANT** (disabled at the middleware), and the
**SEO infrastructure layer is essentially absent** — that's the biggest gap before a public launch.

Two headline gaps to fix before go-live marketing:
1. **SEO infra missing** (no sitemap / robots / OG / structured data) — P1 for an OTA that lives on search traffic.
2. **Funnel exits weak** (confirmation + empty-search have no forward CTA) — P1 for conversion completeness.

---

## 2. Route inventory + live crawl coverage
64 page routes. Live crawl probed 35 (all public + admin gate-set + dynamic resolves); operator
console (22) covered by today's operator-smoke; customer/account surface is disabled (below).

| Surface | Routes | Live result |
|---|---|---|
| **Public (customer-facing)** | `/`, `/search`, `/routes`, `/trips/[id]`, `/lien-he-dat-xe`(+confirmation), `/terms`, `/privacy` | ✅ all 200, clean, h1=1, meta-desc present, 0 errors |
| **Auth pages** (`/auth/login,register,forgot,reset`) | 4 | ↪️ **all redirect → `/`** (middleware-disabled — intentional, see §3) |
| **Operator login set** (`/op/login,register,register/confirmation,forgot-password`) | 4 | ✅ 200 / correct redirect |
| **Admin gate** (`/admin`, `/admin/*` 8) | 8 | ↪️ **all redirect → `/admin/login`** (gate works; no seed admin) |
| **Operator console** (`/op/(console)/*` 22) | 22 | ✅ health confirmed in `operator-smoke-2026-06-07.md` (crawler's own op-login automation needs a selector fix — harness limitation, not an app fault) |
| **Customer account** (`/account/*` 3) | 3 | ⚠️ dormant — depends on disabled customer auth (see §3) |
| **Fixture-gated dynamic** (`/verify/[token]`, `/booking/{confirmation,result}/[token]`, `/charter/status/[ref]`, `/booking/{review,customer}`, admin `[id]`) | ~8 | ⬜ skipped — need a live entity/flow fixture |

**Broken routes: 0.** No 5xx, no nav errors, no console errors on any probed route.

---

## 3. KEY FINDING — customer auth/account is intentionally disabled
`proxy.ts:192-206`:
- `pathname === '/auth' || startsWith('/auth/')` → **`NextResponse.redirect('/')`** — every customer
  auth PAGE bounces to home.
- Customer auth APIs `register` / `otp` / `forgot-password` / `reset-password` / `refresh` → **410 Gone**
  (`/api/auth/login` stays live — operators use it).

**Implication:** the live product is **guest-checkout booking + operator + admin**. The
`/auth/*` and `/account/*` pages are **dormant code** (built, shipped, gated off). This is a
deliberate decision (guest-only booking), but it means:
- Several CTA-audit "account retention / guest-to-account" findings are **moot** while accounts are off.
- `/auth/*` are auto-noindex (they 302 to `/`), but `/account/*` page files still exist and would
  need noindex/removal if ever crawled.
- **Decision needed:** are customer accounts coming back before launch, or should the dormant
  `/auth/*` + `/account/*` surface be removed/clearly parked? Affects SEO + CTA scope below.

---

## 4. SEO ability — current state + gaps
Full audit detail available; headline below. **The infra layer is the problem, not the per-page basics.**

**What's good:** root `<html lang="vi">`, root title+description, every public page has exactly one
`<h1>`, `/trips/[id]` has dynamic `generateMetadata` (origin→dest title + operator description) —
genuinely good OTA per-trip SEO. Transient pages (charter confirmation/status) correctly `index:false`.

**P1 gaps (block/skew indexing — an OTA lives on this):**
- **No `app/robots.ts`** → gated `/op/*`, `/admin/*`, `/dev/*` are crawlable/indexable by default (they 200 then client/redirect, but bots see them). Add disallow rules.
- **No `app/sitemap.ts`** → no route discovery; should list public routes + (optionally) live `/trips/[id]`, `/routes`.
- **No per-page metadata on auth/account/booking** → all inherit the home title; and **no `robots:{index:false}`** on `/account/*`, `/booking/*`, `/verify/[token]` (the ones not already redirect-gated).

**P2 gaps (rich results / sharing):**
- **No `metadataBase`** → OG/canonical resolve relative (social scrapers may fail).
- **No `openGraph` / `twitter` cards + no OG image** → shared links have no preview.
- **No JSON-LD** anywhere → add `Organization` (home), `Trip`/`Offer` (`/trips/[id]`), `BreadcrumbList` (search/trip). Big OTA CTR lever.
- `/terms` + `/privacy` missing `description`.

**P3 / strategic:**
- **No `app/manifest.ts` / declared icons** (PWA, favicon metadata).
- **Param-only route URLs** (`/search?origin=…&destination=…`) instead of static slug pages
  (`/tuyen/ha-noi-sai-gon`). Competitors (Vexere, Rome2Rio) rank long-tail on per-route slug
  landings; this is the single biggest organic-traffic structural gap, but a larger build.

---

## 5. CTA / conversion — current state + gaps
Funnel `home → search → trip → review → pay → confirmation` is **well built through "review"**:
clear single orange primary per step with action verbs (Tìm chuyến / Đặt vé / Xác nhận thanh toán).
Hero search is the clear primary; trust strip + popular-trips-with-price reinforce. Cross-sell
(charter) is correctly secondary.

**P1 (hurts conversion completeness):**
- **Confirmation page** (`booking/confirmation/[token]`) has **no forward CTA** — user is stranded
  after paying. Add "Về trang chủ" / "Tra cứu vé".
- **Empty search results** (`search/page.tsx`) — only ±1-day chips, **no discovery CTA**; add a
  "Xem tất cả tuyến" link to `/routes`.
- **Charter status (completed)** (`charter/status/[ref]`) — no next action for non-cancellable states.

**P2:**
- Payment-polling page after max refresh → no "Liên hệ hỗ trợ" path.
- `/trips/[id]` `notFound()` → no custom "Về tìm kiếm" fallback (broken-link dead-end).
- No global support/contact CTA in footer (phone only buried in flows).

**Moot while accounts disabled (§3):** guest-to-account upgrade prompt; account-bookings remediation CTAs.

---

## 6. Recommended next steps (ranked)
1. **Decide the customer-account question (§3)** — back before launch, or park/remove `/auth/*` + `/account/*`. Gates the SEO + CTA scope.
2. **Add SEO infra** (P1): `app/robots.ts`, `app/sitemap.ts`, `metadataBase` + OG/twitter + OG image in root layout, `robots:{index:false}` on the remaining private pages. Low effort, high impact.
3. **Fix funnel exits** (P1 CTA): confirmation forward CTA, empty-search discovery CTA, charter-status next action.
4. **Add JSON-LD** (P2): Organization + Trip/Offer + Breadcrumb.
5. **Strategic**: per-route slug landings (`/tuyen/<slug>`) for long-tail SEO — larger build, schedule deliberately.
6. **Housekeeping**: fix the route-audit crawler's op-login selector so operator+customer coverage runs in one pass next time.

---

## Evidence
- Live crawl: `docs/qa/frontend-route-audit-2026-06-07.md` (`scripts/smoke/route-audit.mts`) — 25 clean / 0 broken / 9 gated-redirect / 7 fixture-skip.
- Operator surface health: `docs/qa/operator-smoke-2026-06-07.md`, `cross-persona-2026-06-07.md`.
- Middleware gate source: `proxy.ts:192-206`.
- Dynamic trip SEO: `app/(customer)/trips/[id]/page.tsx` `generateMetadata`.
