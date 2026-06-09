# Frontend Problems Register — 2026-06-07

Problems found across the route-coverage crawl + SEO audit + CTA/conversion audit (and the
2026-06-05 home design review). Deduplicated, ranked. Live surface = guest booking + operator +
admin consoles. Evidence: `frontend-route-audit-2026-06-07.md`, `frontend-stage-report-2026-06-07.md`.

Severity: **P1** = blocks launch / conversion / indexing · **P2** = degrades quality/SEO/UX ·
**P3** = polish / strategic / housekeeping.

---

## P1 — must fix before public launch

| # | Problem | Where | Impact | Fix |
|---|---------|-------|--------|-----|
| 1 | **No `robots.ts`** — gated `/op/*`, `/admin/*`, `/dev/*` indexable by default | missing `app/robots.ts` | search bots index internal consoles | add `app/robots.ts` with disallow rules + sitemap ref |
| 2 | **No `sitemap.ts`** — no route discovery for crawlers | missing `app/sitemap.ts` | weak/slow indexing of public pages | add `app/sitemap.ts` (home, search, routes, legal, +live `/trips/[id]`) |
| 3 | **Confirmation page is a dead-end** — no forward CTA after paying | `booking/confirmation/[token]` | user stranded post-payment; no next action | add "Về trang chủ" / "Tra cứu vé" CTA |
| 4 | **Empty search results — no discovery CTA** | `app/(customer)/search/page.tsx` (zero-result state) | dead-end on no results; lost conversion | add "Xem tất cả tuyến" → `/routes` |
| 5 | **Customer auth/accounts shipped but disabled** — undecided state | `proxy.ts:192-206` (auth pages→`/`, auth APIs→410) | `/auth/*` + `/account/*` are dormant code; product is guest-only; ambiguous for launch | DECIDE: re-enable accounts before launch, or park/remove the dead surface |

---

## P2 — degrades SEO / UX, fix before marketing push

| # | Problem | Where | Impact | Fix |
|---|---------|-------|--------|-----|
| 6 | **`/trips/[id]` 404s for a search-returned tripId** | crawl: search→`/trips/<id>`→404 | possible detail-lookup/date mismatch; broken-link risk from results | investigate `getTripDetails` vs search result id; reproduce |
| 7 | **No `metadataBase`** | `app/layout.tsx` | OG/canonical resolve relative → social scrapers may fail | add `metadataBase: new URL('https://<domain>')` |
| 8 | **No OpenGraph / Twitter cards + no OG image** | root layout | shared links show no preview (low CTR on social/chat) | add `openGraph`/`twitter` + an OG image |
| 9 | **No JSON-LD structured data anywhere** | all public pages | no rich results; engines don't understand business/trip | add `Organization` (home), `Trip`/`Offer` (`/trips/[id]`), `BreadcrumbList` |
| 10 | **Private pages not noindexed** (`/account/*`, `/booking/*`, `/verify/[token]`) | per-page metadata | personal/transient pages indexable if reached | `export const metadata = { robots: { index:false } }` each |
| 11 | **Auth/account/booking pages inherit home `<title>`** | no per-page metadata | wrong SERP context if indexed | add per-page metadata (title + noindex) |
| 12 | **`/terms` + `/privacy` missing `description`** | `app/terms/page.tsx`, `app/privacy/page.tsx` | empty SERP snippet | add `description` |
| 13 | **Charter status (completed) — no next action** | `charter/status/[ref]` | dead-end for non-cancellable states | add "Về trang chủ" / "Đặt xe khác" |
| 14 | **Payment polling max-refresh — no support path** | `booking/result/[token]` | user stuck after auto-refresh stops | add "Liên hệ hỗ trợ" tel/CTA |
| 15 | **`/trips/[id]` notFound() — no fallback CTA** | `app/(customer)/trips/[id]/page.tsx` | broken-link dead-end → bounce | custom not-found with "Về tìm kiếm" |
| 16 | **No global support/contact CTA** | `SiteFooter` | support phone buried in flows only | add "Hỗ trợ 24/7 · <phone>" to footer |

---

## P3 — polish / strategic / housekeeping

| # | Problem | Where | Impact | Fix |
|---|---------|-------|--------|-----|
| 17 | **No `manifest.ts` / declared icons** | missing `app/manifest.ts` | no PWA/install, no favicon metadata | add manifest + icons |
| 18 | **Param-only search URLs, no per-route slug pages** | `/search?origin=…` everywhere | misses long-tail organic vs Vexere/Rome2Rio `/tuyen/<slug>` | build `/tuyen/[slug]` landings (larger task) |
| 19 | **Home hero primary = search input, not an orange pill** | `app/(customer)/page.tsx` hero | soft design-language §9 deviation (one orange primary/view) | acceptable, or add a clear "Tìm chuyến" pill |
| 20 | **`route-audit.mts` op-login automation fails** (`/api/auth/login` never fires) | `scripts/smoke/route-audit.mts` | operator+customer routes not covered in one pass (op health checked via operator-smoke) | fix op-login button/selector to match current markup |
| 21 | **`ticketPdf.test.ts` 30s timeout flake** | `lib/booking/__tests__/ticketPdf.test.ts` | intermittent red in full unit run (unrelated to features) | raise test timeout or speed the PDF render |

---

## Notes
- **0 broken routes** in the live crawl — no 5xx, no console errors on any probed route. The
  problems above are about SEO infrastructure, funnel completeness, and one product decision
  (accounts), not page crashes.
- Items 5 (accounts) gates the relevance of some CTA/SEO items on `/account/*` and `/auth/*`.
- Earlier design-review queue (price-on-cards) is DONE; section-swap + trust-strip shipped.
