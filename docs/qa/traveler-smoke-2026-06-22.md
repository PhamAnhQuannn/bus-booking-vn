# Traveler-side smoke crawl — 2026-06-22

Target: `http://localhost:3001` · Driver: standalone Playwright (`scripts/smoke/traveler-crawl.mts`) · Viewports: desktop 1280 + mobile-390.
Mode: full mutating flows. OTP for every otp-gated flow pulled directly from the backend test-peek sink (`/api/auth/otp/test-peek`).

## Summary

| Result | Count |
|---|---|
| 🟥 BROKEN | 7 |
| 🟧 WARN | 0 |
| 🟩 PASS | 94 |
| Total checks | 110 |

## Story coverage matrix

Each restated traveler story → the phase that exercises it → result.

| Story | Coverage | Result |
|---|---|---|
| **S02 Search** — Search trips (origin/dest/date/qty) → results load | `A-static` | 🟩 PASS |
| **S02 Search** — Filter (bus-type) / sort (price) / next-prev-day nav | `F-search` | 🟩 PASS |
| **S02 Search** — Trip detail page + ticket-count stepper | `G-trip` | 🟩 PASS |
| **S03 Buy** — Guest checkout: buyer form → seat hold + countdown → review | `B-booking` | 🟩 PASS |
| **S03 Buy** — Pay rail → result → confirmation → ticket PDF → /verify page | `—` | ⏭ skip-pay (payment step intentionally skipped) |
| **S04 Account** — Register via phone + OTP (+ password) | `D-account` | 🟩 PASS |
| **S04 Account** — Login via phone + password (+ wrong-password path) | `H-login` | 🟩 PASS |
| **S04 Account** — Bookings list (upcoming/past tabs) + detail | `D-account` | 🟩 PASS |
| **S04 Account** — Settings: change name / phone (OTP) / password / delete | `I-` | 🟩 PASS |
| **S04 Account** — Guest → account auto-link by shared phone | `J-link` | 🟩 PASS |
| **S04 Account** — Forgot password (OTP from backend) | `C-forgot` | 🟩 PASS |
| **S04 Account** — Reset password (OTP from backend) | `C-reset` | 🟩 PASS |
| **S16 Charter** — Charter request → confirmation ref → status → cancel | `E-charter` | 🟩 PASS |

## 🟥 Broken transitions / functions

| Sev | VP | Phase | Route | Action | Detail |
|---|---|---|---|---|---|
| BROKEN | desktop | phase-error | - | account | phase threw: locator.waitFor: Timeout 12000ms exceeded. Call log: [2m  - waiting for locator('#phone') to be visible[22m  |
| BROKEN | desktop | phase-error | - | login | phase threw: locator.waitFor: Timeout 12000ms exceeded. Call log: [2m  - waiting for locator('#phone') to be visible[22m  |
| BROKEN | desktop | phase-error | - | settings-mutations | phase threw: locator.waitFor: Timeout 12000ms exceeded. Call log: [2m  - waiting for locator('#phone') to be visible[22m  |
| BROKEN | desktop | phase-error | - | guest-link | phase threw: locator.waitFor: Timeout 12000ms exceeded. Call log: [2m  - waiting for locator('#phone') to be visible[22m  |
| BROKEN | desktop | phase-error | - | forgot-password | phase threw: locator.waitFor: Timeout 12000ms exceeded. Call log: [2m  - waiting for locator('#phone') to be visible[22m  |
| BROKEN | desktop | phase-error | - | reset-password | phase threw: locator.waitFor: Timeout 12000ms exceeded. Call log: [2m  - waiting for locator('#phone') to be visible[22m  |
| BROKEN | mobile | phase-error | - | account | phase threw: locator.waitFor: Timeout 12000ms exceeded. Call log: [2m  - waiting for locator('#phone') to be visible[22m  |

## 🟧 Warnings (degraded / needs human eyes)

_None._

## Route load matrix

| Route | Result |
|---|---|
| / | PASS — HTTP 200 |
| /search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-23&ticketCount=1 | PASS — HTTP 200 |
| /routes | PASS — HTTP 200 |
| /lien-he-dat-xe | PASS — HTTP 200 |
| /lien-he-dat-xe/confirmation | PASS — HTTP 200 |
| /auth/login | PASS — HTTP 200 → redirected to / |
| /auth/register | PASS — HTTP 200 → redirected to / |
| /auth/forgot-password | PASS — HTTP 200 → redirected to / |
| /auth/reset-password | PASS — HTTP 200 → redirected to / |
| /account/bookings | PASS — HTTP 200 → redirected to / |
| /account/settings | PASS — HTTP 200 → redirected to / |
| /booking/customer | PASS — HTTP 200 → redirected to /search |
| /booking/review | PASS — HTTP 200 → redirected to /search |
| /privacy | PASS — HTTP 200 |
| /terms | PASS — HTTP 200 |
| /charter/status/INVALID-REF-TEST | INFO — HTTP 404 (notFound — expected for invalid id/token) |
| /verify/invalid-token-test | INFO — HTTP 404 (notFound — expected for invalid id/token) |
| /trips/cmqoizjpk004n8scdwqx263nb | PASS — HTTP 200 |
| /trips/cmqoizjpk00518scd3i1s9hm3 | PASS — HTTP 200 |
| /trips/cmqoizjpl00fj8scdulat1j17 | PASS — HTTP 200 |
| /trips/cmqoizjpk00528scdwsxyzgs8 | PASS — HTTP 200 |
| /trips/cmqoizjpl00fk8scd4f1nmcsn | PASS — HTTP 200 |
| /trips/cmqoizjpk00538scdym01z3um | PASS — HTTP 200 |
| /trips/cmqoizjpl00fl8scdvxs69s72 | PASS — HTTP 200 |
| /charter/status/CH-2026-E46212 | PASS — HTTP 200 |
| /charter/status/CH-2026-3T3533 | PASS — HTTP 200 |

## In-app link graph (from → to)

- `/` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/search?origin=Thanh+H%C3%B3a&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=B%C3%ACnh+D%C6%B0%C6%A1ng&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Sa+Pa&date=2026-06-22&ticketCount=1`, `/search?origin=%C4%90%C3%A0+N%E1%BA%B5ng&destination=Hu%E1%BA%BF&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=H%E1%BA%A3i+Ph%C3%B2ng&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=V%C5%A9ng+T%C3%A0u&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=Nha+Trang&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=H%C3%A0+N%E1%BB%99i&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Thanh+H%C3%B3a&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Vinh&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=C%E1%BA%A7n+Th%C6%A1&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=Nha+Trang&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=C%E1%BA%A7n+Th%C6%A1&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=Hu%E1%BA%BF&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=%C4%90%C3%A0+L%E1%BA%A1t&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/terms`, `/privacy`
- `/search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-23&ticketCount=1` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-24&ticketCount=1`, `/trips/cmqoizjpk004n8scdwqx263nb`, `/trips/cmqoizjpk00518scd3i1s9hm3`, `/trips/cmqoizjpl00fj8scdulat1j17`, `/trips/cmqoizjpk00528scdwsxyzgs8`, `/trips/cmqoizjpl00fk8scd4f1nmcsn`, `/trips/cmqoizjpk00538scdym01z3um`, `/trips/cmqoizjpl00fl8scdvxs69s72`, `/terms`, `/privacy`
- `/routes` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=B%C3%ACnh+D%C6%B0%C6%A1ng&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/search?origin=C%E1%BA%A7n+Th%C6%A1&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/search?origin=C%E1%BA%A7n+Th%C6%A1&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=%C4%90%C3%A0+L%E1%BA%A1t&destination=Nha+Trang&date=2026-06-22&ticketCount=1`, `/search?origin=%C4%90%C3%A0+L%E1%BA%A1t&destination=C%E1%BA%A7n+Th%C6%A1&date=2026-06-22&ticketCount=1`, `/search?origin=%C4%90%C3%A0+L%E1%BA%A1t&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/search?origin=%C4%90%C3%A0+N%E1%BA%B5ng&destination=Hu%E1%BA%BF&date=2026-06-22&ticketCount=1`, `/search?origin=%C4%90%C3%A0+N%E1%BA%B5ng&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/search?origin=%C4%90%C3%A0+N%E1%BA%B5ng&destination=H%C3%A0+N%E1%BB%99i&date=2026-06-22&ticketCount=1`, `/search?origin=E2E+Race+Origin&destination=E2E+Race+Destination&date=2026-06-22&ticketCount=1`, `/search?origin=H%E1%BA%A3i+Ph%C3%B2ng&destination=H%C3%A0+N%E1%BB%99i&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Vinh&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=H%E1%BA%A3i+Ph%C3%B2ng&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Sa+Pa&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Thanh+H%C3%B3a&date=2026-06-22&ticketCount=1`, `/search?origin=Hu%E1%BA%BF&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=Nha+Trang&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=Nha+Trang&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=H%C3%A0+N%E1%BB%99i&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=Thanh+H%C3%B3a&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=V%C5%A9ng+T%C3%A0u&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=Nha+Trang&date=2026-06-22&ticketCount=1`
- `/lien-he-dat-xe` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/terms`, `/privacy`
- `/lien-he-dat-xe/confirmation` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/terms`, `/privacy`
- `/auth/login` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/search?origin=Thanh+H%C3%B3a&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=B%C3%ACnh+D%C6%B0%C6%A1ng&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Sa+Pa&date=2026-06-22&ticketCount=1`, `/search?origin=%C4%90%C3%A0+N%E1%BA%B5ng&destination=Hu%E1%BA%BF&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=H%E1%BA%A3i+Ph%C3%B2ng&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=V%C5%A9ng+T%C3%A0u&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=Nha+Trang&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=H%C3%A0+N%E1%BB%99i&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Thanh+H%C3%B3a&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Vinh&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=C%E1%BA%A7n+Th%C6%A1&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=Nha+Trang&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=C%E1%BA%A7n+Th%C6%A1&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=Hu%E1%BA%BF&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=%C4%90%C3%A0+L%E1%BA%A1t&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/terms`, `/privacy`
- `/auth/register` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/search?origin=Thanh+H%C3%B3a&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=B%C3%ACnh+D%C6%B0%C6%A1ng&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Sa+Pa&date=2026-06-22&ticketCount=1`, `/search?origin=%C4%90%C3%A0+N%E1%BA%B5ng&destination=Hu%E1%BA%BF&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=H%E1%BA%A3i+Ph%C3%B2ng&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=V%C5%A9ng+T%C3%A0u&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=Nha+Trang&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=H%C3%A0+N%E1%BB%99i&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Thanh+H%C3%B3a&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Vinh&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=C%E1%BA%A7n+Th%C6%A1&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=Nha+Trang&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=C%E1%BA%A7n+Th%C6%A1&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=Hu%E1%BA%BF&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=%C4%90%C3%A0+L%E1%BA%A1t&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/terms`, `/privacy`
- `/auth/forgot-password` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/search?origin=Thanh+H%C3%B3a&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=B%C3%ACnh+D%C6%B0%C6%A1ng&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Sa+Pa&date=2026-06-22&ticketCount=1`, `/search?origin=%C4%90%C3%A0+N%E1%BA%B5ng&destination=Hu%E1%BA%BF&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=H%E1%BA%A3i+Ph%C3%B2ng&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=V%C5%A9ng+T%C3%A0u&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=Nha+Trang&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=H%C3%A0+N%E1%BB%99i&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Thanh+H%C3%B3a&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Vinh&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=C%E1%BA%A7n+Th%C6%A1&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=Nha+Trang&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=C%E1%BA%A7n+Th%C6%A1&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=Hu%E1%BA%BF&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=%C4%90%C3%A0+L%E1%BA%A1t&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/terms`, `/privacy`
- `/auth/reset-password` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/search?origin=Thanh+H%C3%B3a&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=B%C3%ACnh+D%C6%B0%C6%A1ng&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Sa+Pa&date=2026-06-22&ticketCount=1`, `/search?origin=%C4%90%C3%A0+N%E1%BA%B5ng&destination=Hu%E1%BA%BF&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=H%E1%BA%A3i+Ph%C3%B2ng&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=V%C5%A9ng+T%C3%A0u&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=Nha+Trang&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=H%C3%A0+N%E1%BB%99i&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Thanh+H%C3%B3a&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Vinh&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=C%E1%BA%A7n+Th%C6%A1&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=Nha+Trang&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=C%E1%BA%A7n+Th%C6%A1&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=Hu%E1%BA%BF&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=%C4%90%C3%A0+L%E1%BA%A1t&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/terms`, `/privacy`
- `/account/bookings` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/search?origin=Thanh+H%C3%B3a&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=B%C3%ACnh+D%C6%B0%C6%A1ng&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Sa+Pa&date=2026-06-22&ticketCount=1`, `/search?origin=%C4%90%C3%A0+N%E1%BA%B5ng&destination=Hu%E1%BA%BF&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=H%E1%BA%A3i+Ph%C3%B2ng&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=V%C5%A9ng+T%C3%A0u&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=Nha+Trang&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=H%C3%A0+N%E1%BB%99i&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Thanh+H%C3%B3a&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Vinh&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=C%E1%BA%A7n+Th%C6%A1&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=Nha+Trang&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=C%E1%BA%A7n+Th%C6%A1&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=Hu%E1%BA%BF&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=%C4%90%C3%A0+L%E1%BA%A1t&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/terms`, `/privacy`
- `/account/settings` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/search?origin=Thanh+H%C3%B3a&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=B%C3%ACnh+D%C6%B0%C6%A1ng&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Sa+Pa&date=2026-06-22&ticketCount=1`, `/search?origin=%C4%90%C3%A0+N%E1%BA%B5ng&destination=Hu%E1%BA%BF&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=H%E1%BA%A3i+Ph%C3%B2ng&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=V%C5%A9ng+T%C3%A0u&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=Nha+Trang&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=H%C3%A0+N%E1%BB%99i&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Thanh+H%C3%B3a&date=2026-06-22&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Vinh&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=C%E1%BA%A7n+Th%C6%A1&date=2026-06-22&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=Nha+Trang&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=C%E1%BA%A7n+Th%C6%A1&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-22&ticketCount=1`, `/search?origin=Hu%E1%BA%BF&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-22&ticketCount=1`, `/search?origin=%C4%90%C3%A0+L%E1%BA%A1t&destination=S%C3%A0i+G%C3%B2n&date=2026-06-22&ticketCount=1`, `/terms`, `/privacy`
- `/booking/customer` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/terms`, `/privacy`
- `/booking/review` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/terms`, `/privacy`
- `/privacy` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/terms`, `/privacy`
- `/terms` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/terms`, `/privacy`
- `/charter/status/INVALID-REF-TEST` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/search`, `/terms`, `/privacy`
- `/verify/invalid-token-test` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/search`, `/terms`, `/privacy`
- `/trips/cmqoizjpk004n8scdwqx263nb` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/search`, `/terms`, `/privacy`
- `/trips/cmqoizjpk00518scd3i1s9hm3` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/search`, `/terms`, `/privacy`
- `/trips/cmqoizjpl00fj8scdulat1j17` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/search`, `/terms`, `/privacy`
- `/trips/cmqoizjpk00528scdwsxyzgs8` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/search`, `/terms`, `/privacy`
- `/trips/cmqoizjpl00fk8scd4f1nmcsn` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/search`, `/terms`, `/privacy`
- `/trips/cmqoizjpk00538scdym01z3um` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/search`, `/terms`, `/privacy`
- `/trips/cmqoizjpl00fl8scdvxs69s72` → `/`, `/lien-he-dat-xe`, `/op/register`, `/op/login`, `/search`, `/terms`, `/privacy`

## Button inventory (per route)

- `/`: "Chọn ngày đi", "Tìm chuyến xe"
- `/search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-23&ticketCount=1`: "23/06/2026", "Tìm chuyến xe", "Ghế ngồi (3)", "Limousine (2)", "Giường nằm (2)", "Chiều (11–17h) (2)", "Tối (17–22h) (2)", "Sáng (5–11h) (1)", "Đêm (22–5h) (2)", "≤ 4h", "≤ 6h", "≤ 8h", "≤ 10h", "Giờ đi sớm nhất▼", "Bộ lọc", "Đặt vé"
- `/lien-he-dat-xe`: "Chọn ngày đi", "Gửi yêu cầu"
- `/auth/login`: "23/06/2026", "Tìm chuyến xe"
- `/auth/register`: "23/06/2026", "Tìm chuyến xe"
- `/auth/forgot-password`: "23/06/2026", "Tìm chuyến xe"
- `/auth/reset-password`: "23/06/2026", "Tìm chuyến xe"
- `/account/bookings`: "23/06/2026", "Tìm chuyến xe"
- `/account/settings`: "23/06/2026", "Tìm chuyến xe"
- `/booking/customer`: "Chọn ngày đi", "Tìm chuyến xe"
- `/booking/review`: "Chọn ngày đi", "Tìm chuyến xe"
- `/trips/cmqoizjpk004n8scdwqx263nb`: "Đặt vé"
- `/trips/cmqoizjpk00518scd3i1s9hm3`: "Đặt vé"
- `/trips/cmqoizjpl00fj8scdulat1j17`: "Đặt vé"
- `/trips/cmqoizjpk00528scdwsxyzgs8`: "Đặt vé"
- `/trips/cmqoizjpl00fk8scd4f1nmcsn`: "Đặt vé"
- `/trips/cmqoizjpk00538scdym01z3um`: "Đặt vé"
- `/trips/cmqoizjpl00fl8scdvxs69s72`: "Đặt vé"

## Full check log

| Sev | VP | Phase | Route | Action | Detail |
|---|---|---|---|---|---|
| INFO | desktop | meta | - | start viewport | desktop @ http://localhost:3001 |
| PASS | desktop | A-static | / | load | HTTP 200 |
| PASS | desktop | A-static | /search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-23&ticketCount=1 | load | HTTP 200 |
| PASS | desktop | A-static | /routes | load | HTTP 200 |
| PASS | desktop | A-static | /lien-he-dat-xe | load | HTTP 200 |
| PASS | desktop | A-static | /lien-he-dat-xe/confirmation | load | HTTP 200 |
| PASS | desktop | A-static | /auth/login | load | HTTP 200 → redirected to / |
| PASS | desktop | A-static | /auth/register | load | HTTP 200 → redirected to / |
| PASS | desktop | A-static | /auth/forgot-password | load | HTTP 200 → redirected to / |
| PASS | desktop | A-static | /auth/reset-password | load | HTTP 200 → redirected to / |
| PASS | desktop | A-static | /account/bookings | load | HTTP 200 → redirected to / |
| PASS | desktop | A-static | /account/settings | load | HTTP 200 → redirected to / |
| PASS | desktop | A-static | /booking/customer | load | HTTP 200 → redirected to /search |
| PASS | desktop | A-static | /booking/review | load | HTTP 200 → redirected to /search |
| PASS | desktop | A-static | /privacy | load | HTTP 200 |
| PASS | desktop | A-static | /terms | load | HTTP 200 |
| INFO | desktop | A-static | /charter/status/INVALID-REF-TEST | load | HTTP 404 (notFound — expected for invalid id/token) |
| INFO | desktop | A-static | /verify/invalid-token-test | load | HTTP 404 (notFound — expected for invalid id/token) |
| PASS | desktop | A-static | /trips/cmqoizjpk004n8scdwqx263nb | load | HTTP 200 |
| PASS | desktop | A-static | /trips/cmqoizjpk00518scd3i1s9hm3 | load | HTTP 200 |
| PASS | desktop | A-static | /trips/cmqoizjpl00fj8scdulat1j17 | load | HTTP 200 |
| PASS | desktop | A-static | /trips/cmqoizjpk00528scdwsxyzgs8 | load | HTTP 200 |
| PASS | desktop | A-static | /trips/cmqoizjpl00fk8scd4f1nmcsn | load | HTTP 200 |
| PASS | desktop | A-static | /trips/cmqoizjpk00538scdym01z3um | load | HTTP 200 |
| PASS | desktop | A-static | /trips/cmqoizjpl00fl8scdvxs69s72 | load | HTTP 200 |
| PASS | desktop | F-search | /search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-23&ticketCount=1 | load | HTTP 200 |
| PASS | desktop | F-search | /search | sort → Giá thấp→cao | URL has sort=price_asc |
| PASS | desktop | F-search | /search | filter chip "Giường nằm" | URL has busType: /search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&da |
| PASS | desktop | F-search | /search | date-nav next day | 2026-06-23 → 2026-06-24 |
| PASS | desktop | G-trip | /search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-23&ticketCount=1 | load | HTTP 200 |
| PASS | desktop | G-trip | /search→/trips/[id] | Xem chi tiết | at /trips/cmqoizjpk004n8scdwqx263nb |
| PASS | desktop | G-trip | /trips/[id] | ticket stepper +/- | stepper clicked (2× tăng, 1× giảm) ([shot](traveler-smoke-shots/001-trip-stepper.png)) |
| PASS | desktop | G-trip | /trips/[id]→/booking/customer | Đặt vé | reached customer form |
| PASS | desktop | B-booking | /search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-23&ticketCount=1 | load | HTTP 200 |
| PASS | desktop | B-booking | /search | results | 7 book button(s) |
| PASS | desktop | B-booking | /search→/booking/customer | BookButton | reached customer form |
| PASS | desktop | B-booking | /booking/customer→/booking/review | submit customer form (POST /api/holds) | hold created, reached review |
| PASS | desktop | B-booking | /booking/review | hold timer | countdown="10:00" |
| PASS | desktop | B-booking | /booking/review | pay button (pay step skipped — SMOKE_RUN_PAY unset) | present=true disabledBeforeConsent=true |
| PASS | desktop | E-charter | /lien-he-dat-xe | load | HTTP 200 |
| INFO | desktop | E-charter | /lien-he-dat-xe | form buttons | Chọn ngày đi \| Gửi yêu cầu |
| PASS | desktop | E-charter | /lien-he-dat-xe | pick departure date | date selected via DatePicker popover |
| PASS | desktop | E-charter | /lien-he-dat-xe | submit charter form | ref CH-2026-E46212 → /lien-he-dat-xe/confirmation?ref=CH-2026-E46212 ([shot](traveler-smoke-shots/002-charter-submit.png)) |
| PASS | desktop | E-charter | /charter/status/CH-2026-E46212 | load | HTTP 200 |
| PASS | desktop | E-charter | /charter/status/CH-2026-E46212 | cancel charter | cancel clicked ([shot](traveler-smoke-shots/003-charter-cancel.png)) |
| PASS | desktop | D-account | /auth/register | load | HTTP 200 → redirected to / |
| BROKEN | desktop | phase-error | - | account | phase threw: locator.waitFor: Timeout 12000ms exceeded. Call log: [2m  - waiting for locator('#phone') to be visible[22m  |
| PASS | desktop | H-login(setup) | /auth/register | load | HTTP 200 → redirected to / |
| BROKEN | desktop | phase-error | - | login | phase threw: locator.waitFor: Timeout 12000ms exceeded. Call log: [2m  - waiting for locator('#phone') to be visible[22m  |
| PASS | desktop | I-settings-A(setup) | /auth/register | load | HTTP 200 → redirected to / |
| BROKEN | desktop | phase-error | - | settings-mutations | phase threw: locator.waitFor: Timeout 12000ms exceeded. Call log: [2m  - waiting for locator('#phone') to be visible[22m  |
| PASS | desktop | J-link | /search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-23&ticketCount=1 | load | HTTP 200 |
| PASS | desktop | J-link | /search | results | 7 book button(s) |
| PASS | desktop | J-link | /search→/booking/customer | BookButton | reached customer form |
| PASS | desktop | J-link | /booking/customer→/booking/review | submit customer form (POST /api/holds) | hold created, reached review |
| PASS | desktop | J-link | /booking/review | hold timer | countdown="10:00" |
| PASS | desktop | J-link | /booking/review | guest booking w/ shared phone | hold created for +84932133894 |
| PASS | desktop | J-link | /auth/register | load | HTTP 200 → redirected to / |
| BROKEN | desktop | phase-error | - | guest-link | phase threw: locator.waitFor: Timeout 12000ms exceeded. Call log: [2m  - waiting for locator('#phone') to be visible[22m  |
| PASS | desktop | C-forgot(setup) | /auth/register | load | HTTP 200 → redirected to / |
| BROKEN | desktop | phase-error | - | forgot-password | phase threw: locator.waitFor: Timeout 12000ms exceeded. Call log: [2m  - waiting for locator('#phone') to be visible[22m  |
| PASS | desktop | C-reset(setup) | /auth/register | load | HTTP 200 → redirected to / |
| BROKEN | desktop | phase-error | - | reset-password | phase threw: locator.waitFor: Timeout 12000ms exceeded. Call log: [2m  - waiting for locator('#phone') to be visible[22m  |
| INFO | mobile | meta | - | start viewport | mobile @ http://localhost:3001 |
| PASS | mobile | A-static | / | load | HTTP 200 |
| PASS | mobile | A-static | /search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-23&ticketCount=1 | load | HTTP 200 |
| PASS | mobile | A-static | /routes | load | HTTP 200 |
| PASS | mobile | A-static | /lien-he-dat-xe | load | HTTP 200 |
| PASS | mobile | A-static | /lien-he-dat-xe/confirmation | load | HTTP 200 |
| PASS | mobile | A-static | /auth/login | load | HTTP 200 → redirected to / |
| PASS | mobile | A-static | /auth/register | load | HTTP 200 → redirected to / |
| PASS | mobile | A-static | /auth/forgot-password | load | HTTP 200 → redirected to / |
| PASS | mobile | A-static | /auth/reset-password | load | HTTP 200 → redirected to / |
| PASS | mobile | A-static | /account/bookings | load | HTTP 200 → redirected to / |
| PASS | mobile | A-static | /account/settings | load | HTTP 200 → redirected to / |
| PASS | mobile | A-static | /booking/customer | load | HTTP 200 → redirected to /search |
| PASS | mobile | A-static | /booking/review | load | HTTP 200 → redirected to /search |
| PASS | mobile | A-static | /privacy | load | HTTP 200 |
| PASS | mobile | A-static | /terms | load | HTTP 200 |
| INFO | mobile | A-static | /charter/status/INVALID-REF-TEST | load | HTTP 404 (notFound — expected for invalid id/token) |
| INFO | mobile | A-static | /verify/invalid-token-test | load | HTTP 404 (notFound — expected for invalid id/token) |
| PASS | mobile | A-static | /trips/cmqoizjpk004n8scdwqx263nb | load | HTTP 200 |
| PASS | mobile | A-static | /trips/cmqoizjpk00518scd3i1s9hm3 | load | HTTP 200 |
| PASS | mobile | A-static | /trips/cmqoizjpl00fj8scdulat1j17 | load | HTTP 200 |
| PASS | mobile | A-static | /trips/cmqoizjpk00528scdwsxyzgs8 | load | HTTP 200 |
| PASS | mobile | A-static | /trips/cmqoizjpl00fk8scd4f1nmcsn | load | HTTP 200 |
| PASS | mobile | A-static | /trips/cmqoizjpk00538scdym01z3um | load | HTTP 200 |
| PASS | mobile | A-static | /trips/cmqoizjpl00fl8scdvxs69s72 | load | HTTP 200 |
| PASS | mobile | F-search | /search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-23&ticketCount=1 | load | HTTP 200 |
| PASS | mobile | F-search | /search | sort → Giá thấp→cao | URL has sort=price_asc |
| INFO | mobile | F-search | /search | filter chip | no bus-type chip visible (single-facet or mobile sheet collapsed) |
| PASS | mobile | F-search | /search | date-nav next day | 2026-06-23 → 2026-06-24 |
| PASS | mobile | G-trip | /search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-23&ticketCount=1 | load | HTTP 200 |
| PASS | mobile | G-trip | /search→/trips/[id] | Xem chi tiết | at /trips/cmqoizjpk004n8scdwqx263nb |
| PASS | mobile | G-trip | /trips/[id] | ticket stepper +/- | stepper clicked (2× tăng, 1× giảm) ([shot](traveler-smoke-shots/004-trip-stepper.png)) |
| PASS | mobile | G-trip | /trips/[id]→/booking/customer | Đặt vé | reached customer form |
| PASS | mobile | B-booking | /search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-23&ticketCount=1 | load | HTTP 200 |
| PASS | mobile | B-booking | /search | results | 7 book button(s) |
| PASS | mobile | B-booking | /search→/booking/customer | BookButton | reached customer form |
| PASS | mobile | B-booking | /booking/customer→/booking/review | submit customer form (POST /api/holds) | hold created, reached review |
| PASS | mobile | B-booking | /booking/review | hold timer | countdown="10:00" |
| PASS | mobile | B-booking | /booking/review | pay button (pay step skipped — SMOKE_RUN_PAY unset) | present=true disabledBeforeConsent=true |
| PASS | mobile | E-charter | /lien-he-dat-xe | load | HTTP 200 |
| INFO | mobile | E-charter | /lien-he-dat-xe | form buttons | Chọn ngày đi \| Gửi yêu cầu |
| PASS | mobile | E-charter | /lien-he-dat-xe | pick departure date | date selected via DatePicker popover |
| PASS | mobile | E-charter | /lien-he-dat-xe | submit charter form | ref CH-2026-3T3533 → /lien-he-dat-xe/confirmation?ref=CH-2026-3T3533 ([shot](traveler-smoke-shots/005-charter-submit.png)) |
| PASS | mobile | E-charter | /charter/status/CH-2026-3T3533 | load | HTTP 200 |
| PASS | mobile | E-charter | /charter/status/CH-2026-3T3533 | cancel charter | cancel clicked ([shot](traveler-smoke-shots/006-charter-cancel.png)) |
| PASS | mobile | D-account | /auth/register | load | HTTP 200 → redirected to / |
| BROKEN | mobile | phase-error | - | account | phase threw: locator.waitFor: Timeout 12000ms exceeded. Call log: [2m  - waiting for locator('#phone') to be visible[22m  |
