# Traveler-side smoke crawl — 2026-06-05

Target: `http://localhost:3001` · Driver: standalone Playwright (`scripts/smoke/traveler-crawl.mts`) · Viewports: desktop 1280 + mobile-390.
Mode: full mutating flows. OTP for every otp-gated flow pulled directly from the backend test-peek sink (`/api/auth/otp/test-peek`).

## Summary

| Result | Count |
|---|---|
| 🟥 BROKEN | 5 |
| 🟧 WARN | 6 |
| 🟩 PASS | 161 |
| Total checks | 183 |

## Story coverage matrix

Each restated traveler story → the phase that exercises it → result.

| Story | Coverage | Result |
|---|---|---|
| **S02 Search** — Search trips (origin/dest/date/qty) → results load | `A-static` | 🟩 PASS |
| **S02 Search** — Filter (bus-type) / sort (price) / next-prev-day nav | `F-search` | 🟩 PASS |
| **S02 Search** — Trip detail page + ticket-count stepper | `G-trip` | 🟩 PASS |
| **S03 Buy** — Guest checkout: buyer form → seat hold + countdown → review | `B-booking` | 🟥 BROKEN |
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
| BROKEN | desktop | http | /dev/stub-pay?adapter=zalopay&orderId=BB-2026-63k1-a616&amount=270000&red | POST (ctx:stub-pay success) | HTTP 500 |
| BROKEN | desktop | B-booking | /dev/stub-pay→/booking/result | pay success | stuck at /dev/stub-pay?adapter=zalopay&orderId=BB-2026-63k1-a616&amount=270000&red ([shot](traveler-smoke-shots/002-result-stuck.png)) |
| BROKEN | desktop | http | /dev/stub-pay?adapter=zalopay&orderId=BB-2026-6134-n351&amount=270000&red | POST (ctx:stub-pay fail) | HTTP 500 |
| BROKEN | desktop | B-booking-fail | /dev/stub-pay→/booking/result | pay fail | stuck at /dev/stub-pay?adapter=zalopay&orderId=BB-2026-6134-n351&amount=270000&red ([shot](traveler-smoke-shots/003-result-stuck.png)) |
| BROKEN | mobile | phase-error | - | guest-booking | phase threw: locator.click: Timeout 30000ms exceeded. Call log: [2m  - waiting for getByRole('button', { name: /xác nhận thanh toán/i }).first()[22m [2m    - locator reso |

## 🟧 Warnings (degraded / needs human eyes)

| Sev | VP | Phase | Route | Action | Detail |
|---|---|---|---|---|---|
| WARN | desktop | console | /dev/stub-pay?adapter=zalopay&orderId=BB-2026-63k1-a616&amount=270000&red | stub-pay success | console.error: Failed to load resource: the server responded with a status of 500 (Internal Server Error) |
| WARN | desktop | console | /dev/stub-pay?adapter=zalopay&orderId=BB-2026-63k1-a616&amount=270000&red | stub-pay success | console.error: %o  %s Error: stub-pay: invalid outcome      at submitStubPayment (about://React/Server/D:%5CBus-Booking%5C.next%5Cdev%5Cserver%5Cchunks%5Cssr%5C%5Broot-of-the-server%5D__0hye4px._.js?37:13955:15)     |
| WARN | desktop | console | /dev/stub-pay?adapter=zalopay&orderId=BB-2026-63k1-a616&amount=270000&red | stub-pay success | console.error: Error: stub-pay: invalid outcome      at submitStubPayment (about://React/Server/D:%5CBus-Booking%5C.next%5Cdev%5Cserver%5Cchunks%5Cssr%5C%5Broot-of-the-server%5D__0hye4px._.js?37:13955:15)     at res |
| WARN | desktop | console | /dev/stub-pay?adapter=zalopay&orderId=BB-2026-6134-n351&amount=270000&red | stub-pay fail | console.error: Failed to load resource: the server responded with a status of 500 (Internal Server Error) |
| WARN | desktop | console | /dev/stub-pay?adapter=zalopay&orderId=BB-2026-6134-n351&amount=270000&red | stub-pay fail | console.error: %o  %s Error: stub-pay: invalid outcome      at submitStubPayment (about://React/Server/D:%5CBus-Booking%5C.next%5Cdev%5Cserver%5Cchunks%5Cssr%5C%5Broot-of-the-server%5D__0hye4px._.js?37:13955:15)     |
| WARN | desktop | console | /dev/stub-pay?adapter=zalopay&orderId=BB-2026-6134-n351&amount=270000&red | stub-pay fail | console.error: Error: stub-pay: invalid outcome      at submitStubPayment (about://React/Server/D:%5CBus-Booking%5C.next%5Cdev%5Cserver%5Cchunks%5Cssr%5C%5Broot-of-the-server%5D__0hye4px._.js?37:13955:15)     at res |

## Route load matrix

| Route | Result |
|---|---|
| / | PASS — HTTP 200 |
| /search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-06&ticketCount=1 | PASS — HTTP 200 |
| /routes | PASS — HTTP 200 |
| /lien-he-dat-xe | PASS — HTTP 200 |
| /lien-he-dat-xe/confirmation | PASS — HTTP 200 |
| /auth/login | PASS — HTTP 200 |
| /auth/register | PASS — HTTP 200 |
| /auth/forgot-password | PASS — HTTP 200 |
| /auth/reset-password | PASS — HTTP 200 |
| /account/bookings | PASS — HTTP 200 → redirected to /auth/login?returnTo=/account/bookings |
| /account/settings | PASS — HTTP 200 → redirected to /auth/login?returnTo=/account/settings |
| /booking/customer | PASS — HTTP 200 → redirected to /search |
| /booking/review | PASS — HTTP 200 → redirected to /search |
| /privacy | PASS — HTTP 200 |
| /terms | PASS — HTTP 200 |
| /charter/status/INVALID-REF-TEST | INFO — HTTP 404 (notFound — expected for invalid id/token) |
| /verify/invalid-token-test | INFO — HTTP 404 (notFound — expected for invalid id/token) |
| /trips/cmq0f8mpm003dkscd2dvzipp4 | PASS — HTTP 200 |
| /trips/cmq0f8mpm003rkscdvienqs29 | PASS — HTTP 200 |
| /trips/cmq0f8mpm003skscdfiondwuq | PASS — HTTP 200 |
| /trips/cmq0f8mpm003tkscd37lszcmp | PASS — HTTP 200 |
| /charter/status/CH-2026-N24541 | PASS — HTTP 200 |
| /auth/login?returnTo=/account/bookings | PASS — HTTP 200 |
| /auth/reset-password?phone=%2B84932907659 | PASS — HTTP 200 |
| /charter/status/CH-2026-94414Y | PASS — HTTP 200 |

## In-app link graph (from → to)

- `/` → `/`, `/lien-he-dat-xe`, `/account/bookings`, `/search?origin=Thanh+H%C3%B3a&destination=S%C3%A0i+G%C3%B2n&date=2026-06-05&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=B%C3%ACnh+D%C6%B0%C6%A1ng&date=2026-06-05&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-05&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Sa+Pa&date=2026-06-05&ticketCount=1`, `/search?origin=%C4%90%C3%A0+N%E1%BA%B5ng&destination=Hu%E1%BA%BF&date=2026-06-05&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=H%E1%BA%A3i+Ph%C3%B2ng&date=2026-06-05&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=V%C5%A9ng+T%C3%A0u&date=2026-06-05&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-05&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=Nha+Trang&date=2026-06-05&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=H%C3%A0+N%E1%BB%99i&date=2026-06-05&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-05&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Thanh+H%C3%B3a&date=2026-06-05&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Vinh&date=2026-06-05&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=C%E1%BA%A7n+Th%C6%A1&date=2026-06-05&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-05&ticketCount=1`, `/search?origin=Nha+Trang&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-05&ticketCount=1`, `/search?origin=C%E1%BA%A7n+Th%C6%A1&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-05&ticketCount=1`, `/search?origin=Hu%E1%BA%BF&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-05&ticketCount=1`, `/search?origin=%C4%90%C3%A0+L%E1%BA%A1t&destination=S%C3%A0i+G%C3%B2n&date=2026-06-05&ticketCount=1`, `/auth/login`, `/terms`, `/privacy`
- `/search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-06&ticketCount=1` → `/`, `/lien-he-dat-xe`, `/account/bookings`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-05&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-07&ticketCount=1`, `/trips/cmq0f8mpm003dkscd2dvzipp4`, `/trips/cmq0f8mpm003rkscdvienqs29`, `/trips/cmq0f8mpm003skscdfiondwuq`, `/trips/cmq0f8mpm003tkscd37lszcmp`, `/auth/login`, `/terms`, `/privacy`
- `/routes` → `/`, `/lien-he-dat-xe`, `/account/bookings`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-05&ticketCount=1`, `/search?origin=B%C3%ACnh+D%C6%B0%C6%A1ng&destination=S%C3%A0i+G%C3%B2n&date=2026-06-05&ticketCount=1`, `/search?origin=C%E1%BA%A7n+Th%C6%A1&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-05&ticketCount=1`, `/search?origin=C%E1%BA%A7n+Th%C6%A1&destination=S%C3%A0i+G%C3%B2n&date=2026-06-05&ticketCount=1`, `/search?origin=%C4%90%C3%A0+L%E1%BA%A1t&destination=Nha+Trang&date=2026-06-05&ticketCount=1`, `/search?origin=%C4%90%C3%A0+L%E1%BA%A1t&destination=C%E1%BA%A7n+Th%C6%A1&date=2026-06-05&ticketCount=1`, `/search?origin=%C4%90%C3%A0+L%E1%BA%A1t&destination=S%C3%A0i+G%C3%B2n&date=2026-06-05&ticketCount=1`, `/search?origin=%C4%90%C3%A0+N%E1%BA%B5ng&destination=S%C3%A0i+G%C3%B2n&date=2026-06-05&ticketCount=1`, `/search?origin=%C4%90%C3%A0+N%E1%BA%B5ng&destination=Hu%E1%BA%BF&date=2026-06-05&ticketCount=1`, `/search?origin=%C4%90%C3%A0+N%E1%BA%B5ng&destination=H%C3%A0+N%E1%BB%99i&date=2026-06-05&ticketCount=1`, `/search?origin=E2E+Race+Origin&destination=E2E+Race+Destination&date=2026-06-05&ticketCount=1`, `/search?origin=H%E1%BA%A3i+Ph%C3%B2ng&destination=H%C3%A0+N%E1%BB%99i&date=2026-06-05&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Vinh&date=2026-06-05&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-05&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=H%E1%BA%A3i+Ph%C3%B2ng&date=2026-06-05&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-05&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Sa+Pa&date=2026-06-05&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Thanh+H%C3%B3a&date=2026-06-05&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-05&ticketCount=1`, `/search?origin=Hu%E1%BA%BF&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-05&ticketCount=1`, `/search?origin=Nha+Trang&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-05&ticketCount=1`, `/search?origin=Nha+Trang&destination=S%C3%A0i+G%C3%B2n&date=2026-06-05&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-05&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=H%C3%A0+N%E1%BB%99i&date=2026-06-05&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=Thanh+H%C3%B3a&date=2026-06-05&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=V%C5%A9ng+T%C3%A0u&date=2026-06-05&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=Nha+Trang&date=2026-06-05&ticketCount=1`
- `/lien-he-dat-xe` → `/`, `/lien-he-dat-xe`, `/account/bookings`, `/auth/login`, `/terms`, `/privacy`
- `/lien-he-dat-xe/confirmation` → `/`, `/lien-he-dat-xe`, `/account/bookings`, `/auth/login`, `/terms`, `/privacy`
- `/auth/login` → `/`, `/auth/forgot-password`, `/auth/register`, `/op/login`
- `/auth/register` → `/`, `/auth/login`
- `/auth/forgot-password` → `/`, `/auth/login`
- `/auth/reset-password` → `/`, `/auth/forgot-password`, `/auth/login`
- `/account/bookings` → `/`, `/auth/forgot-password`, `/auth/register`, `/op/login`
- `/account/settings` → `/`, `/auth/forgot-password`, `/auth/register`, `/op/login`
- `/booking/customer` → `/`, `/lien-he-dat-xe`, `/account/bookings`, `/auth/login`, `/terms`, `/privacy`
- `/booking/review` → `/`, `/lien-he-dat-xe`, `/account/bookings`, `/auth/login`, `/terms`, `/privacy`
- `/privacy` → `/`, `/lien-he-dat-xe`, `/account/bookings`, `/auth/login`, `/terms`, `/privacy`
- `/terms` → `/`, `/lien-he-dat-xe`, `/account/bookings`, `/auth/login`, `/terms`, `/privacy`
- `/charter/status/INVALID-REF-TEST` → `/`, `/lien-he-dat-xe`, `/account/bookings`, `/search`, `/auth/login`, `/terms`, `/privacy`
- `/verify/invalid-token-test` → `/`, `/lien-he-dat-xe`, `/account/bookings`, `/search`, `/auth/login`, `/terms`, `/privacy`
- `/trips/cmq0f8mpm003dkscd2dvzipp4` → `/`, `/lien-he-dat-xe`, `/account/bookings`, `/search`, `/auth/login`, `/terms`, `/privacy`
- `/trips/cmq0f8mpm003rkscdvienqs29` → `/`, `/lien-he-dat-xe`, `/account/bookings`, `/search`, `/auth/login`, `/terms`, `/privacy`
- `/trips/cmq0f8mpm003skscdfiondwuq` → `/`, `/lien-he-dat-xe`, `/account/bookings`, `/search`, `/auth/login`, `/terms`, `/privacy`
- `/trips/cmq0f8mpm003tkscd37lszcmp` → `/`, `/lien-he-dat-xe`, `/account/bookings`, `/search`, `/auth/login`, `/terms`, `/privacy`

## Button inventory (per route)

- `/`: "Chọn ngày đi", "Tìm chuyến xe"
- `/search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-06&ticketCount=1`: "06/06/2026", "Tìm chuyến xe", "Ghế ngồi (2)", "Limousine (1)", "Giường nằm (1)", "Chiều (11–17h) (1)", "Tối (17–22h) (1)", "Sáng (5–11h) (1)", "Đêm (22–5h) (1)", "≤ 4h", "≤ 6h", "≤ 8h", "≤ 10h", "Giờ đi sớm nhất▼", "Bộ lọc", "Đặt vé"
- `/lien-he-dat-xe`: "Chọn ngày đi", "Gửi yêu cầu"
- `/auth/login`: "Đăng nhập"
- `/auth/register`: "Gửi mã OTP"
- `/auth/forgot-password`: "Gửi mã OTP"
- `/auth/reset-password`: "Đặt lại mật khẩu"
- `/account/bookings`: "Đăng nhập"
- `/account/settings`: "Đăng nhập"
- `/booking/customer`: "Chọn ngày đi", "Tìm chuyến xe"
- `/booking/review`: "Chọn ngày đi", "Tìm chuyến xe"
- `/trips/cmq0f8mpm003dkscd2dvzipp4`: "Đặt vé"
- `/trips/cmq0f8mpm003rkscdvienqs29`: "Đặt vé"
- `/trips/cmq0f8mpm003skscdfiondwuq`: "Đặt vé"
- `/trips/cmq0f8mpm003tkscd37lszcmp`: "Đặt vé"

## Full check log

| Sev | VP | Phase | Route | Action | Detail |
|---|---|---|---|---|---|
| INFO | desktop | meta | - | start viewport | desktop @ http://localhost:3001 |
| PASS | desktop | A-static | / | load | HTTP 200 |
| PASS | desktop | A-static | /search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-06&ticketCount=1 | load | HTTP 200 |
| PASS | desktop | A-static | /routes | load | HTTP 200 |
| PASS | desktop | A-static | /lien-he-dat-xe | load | HTTP 200 |
| PASS | desktop | A-static | /lien-he-dat-xe/confirmation | load | HTTP 200 |
| PASS | desktop | A-static | /auth/login | load | HTTP 200 |
| PASS | desktop | A-static | /auth/register | load | HTTP 200 |
| PASS | desktop | A-static | /auth/forgot-password | load | HTTP 200 |
| PASS | desktop | A-static | /auth/reset-password | load | HTTP 200 |
| PASS | desktop | A-static | /account/bookings | load | HTTP 200 → redirected to /auth/login?returnTo=/account/bookings |
| PASS | desktop | A-static | /account/settings | load | HTTP 200 → redirected to /auth/login?returnTo=/account/settings |
| PASS | desktop | A-static | /booking/customer | load | HTTP 200 → redirected to /search |
| PASS | desktop | A-static | /booking/review | load | HTTP 200 → redirected to /search |
| PASS | desktop | A-static | /privacy | load | HTTP 200 |
| PASS | desktop | A-static | /terms | load | HTTP 200 |
| INFO | desktop | A-static | /charter/status/INVALID-REF-TEST | load | HTTP 404 (notFound — expected for invalid id/token) |
| INFO | desktop | A-static | /verify/invalid-token-test | load | HTTP 404 (notFound — expected for invalid id/token) |
| PASS | desktop | A-static | /trips/cmq0f8mpm003dkscd2dvzipp4 | load | HTTP 200 |
| PASS | desktop | A-static | /trips/cmq0f8mpm003rkscdvienqs29 | load | HTTP 200 |
| PASS | desktop | A-static | /trips/cmq0f8mpm003skscdfiondwuq | load | HTTP 200 |
| PASS | desktop | A-static | /trips/cmq0f8mpm003tkscd37lszcmp | load | HTTP 200 |
| PASS | desktop | F-search | /search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-06&ticketCount=1 | load | HTTP 200 |
| PASS | desktop | F-search | /search | sort → Giá thấp→cao | URL has sort=price_asc |
| PASS | desktop | F-search | /search | filter chip "Giường nằm" | URL has busType: /search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06- |
| PASS | desktop | F-search | /search | date-nav next day | 2026-06-06 → 2026-06-07 |
| PASS | desktop | G-trip | /search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-06&ticketCount=1 | load | HTTP 200 |
| PASS | desktop | G-trip | /search→/trips/[id] | Xem chi tiết | at /trips/cmq0f8mpm003dkscd2dvzipp4 |
| PASS | desktop | G-trip | /trips/[id] | ticket stepper +/- | stepper clicked (2× tăng, 1× giảm) ([shot](traveler-smoke-shots/001-trip-stepper.png)) |
| PASS | desktop | G-trip | /trips/[id]→/booking/customer | Đặt vé | reached customer form |
| PASS | desktop | B-booking | /search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-06&ticketCount=1 | load | HTTP 200 |
| PASS | desktop | B-booking | /search | results | 4 book button(s) |
| PASS | desktop | B-booking | /search→/booking/customer | BookButton | reached customer form |
| PASS | desktop | B-booking | /booking/customer→/booking/review | submit customer form (POST /api/holds) | hold created, reached review |
| PASS | desktop | B-booking | /booking/review | hold timer | countdown="10:00" |
| PASS | desktop | B-booking | /booking/review | pay disabled before consent | disabled=true |
| PASS | desktop | B-booking | /booking/review→/dev/stub-pay | initiate (POST /api/bookings/initiate) | reached stub gateway |
| BROKEN | desktop | http | /dev/stub-pay?adapter=zalopay&orderId=BB-2026-63k1-a616&amount=270000&red | POST (ctx:stub-pay success) | HTTP 500 |
| WARN | desktop | console | /dev/stub-pay?adapter=zalopay&orderId=BB-2026-63k1-a616&amount=270000&red | stub-pay success | console.error: Failed to load resource: the server responded with a status of 500 (Internal Server Error) |
| WARN | desktop | console | /dev/stub-pay?adapter=zalopay&orderId=BB-2026-63k1-a616&amount=270000&red | stub-pay success | console.error: %o  %s Error: stub-pay: invalid outcome      at submitStubPayment (about://React/Server/D:%5CBus-Booking%5C.next%5Cdev%5Cserver%5Cchunks%5Cssr%5C%5Broot-of-the-server%5D__0hye4px._.js?37:13955:15)     |
| WARN | desktop | console | /dev/stub-pay?adapter=zalopay&orderId=BB-2026-63k1-a616&amount=270000&red | stub-pay success | console.error: Error: stub-pay: invalid outcome      at submitStubPayment (about://React/Server/D:%5CBus-Booking%5C.next%5Cdev%5Cserver%5Cchunks%5Cssr%5C%5Broot-of-the-server%5D__0hye4px._.js?37:13955:15)     at res |
| BROKEN | desktop | B-booking | /dev/stub-pay→/booking/result | pay success | stuck at /dev/stub-pay?adapter=zalopay&orderId=BB-2026-63k1-a616&amount=270000&red ([shot](traveler-smoke-shots/002-result-stuck.png)) |
| PASS | desktop | B-booking-fail | /search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-06&ticketCount=1 | load | HTTP 200 |
| PASS | desktop | B-booking-fail | /search | results | 4 book button(s) |
| PASS | desktop | B-booking-fail | /search→/booking/customer | BookButton | reached customer form |
| PASS | desktop | B-booking-fail | /booking/customer→/booking/review | submit customer form (POST /api/holds) | hold created, reached review |
| PASS | desktop | B-booking-fail | /booking/review | hold timer | countdown="10:00" |
| PASS | desktop | B-booking-fail | /booking/review | pay disabled before consent | disabled=true |
| PASS | desktop | B-booking-fail | /booking/review→/dev/stub-pay | initiate (POST /api/bookings/initiate) | reached stub gateway |
| BROKEN | desktop | http | /dev/stub-pay?adapter=zalopay&orderId=BB-2026-6134-n351&amount=270000&red | POST (ctx:stub-pay fail) | HTTP 500 |
| WARN | desktop | console | /dev/stub-pay?adapter=zalopay&orderId=BB-2026-6134-n351&amount=270000&red | stub-pay fail | console.error: Failed to load resource: the server responded with a status of 500 (Internal Server Error) |
| WARN | desktop | console | /dev/stub-pay?adapter=zalopay&orderId=BB-2026-6134-n351&amount=270000&red | stub-pay fail | console.error: %o  %s Error: stub-pay: invalid outcome      at submitStubPayment (about://React/Server/D:%5CBus-Booking%5C.next%5Cdev%5Cserver%5Cchunks%5Cssr%5C%5Broot-of-the-server%5D__0hye4px._.js?37:13955:15)     |
| WARN | desktop | console | /dev/stub-pay?adapter=zalopay&orderId=BB-2026-6134-n351&amount=270000&red | stub-pay fail | console.error: Error: stub-pay: invalid outcome      at submitStubPayment (about://React/Server/D:%5CBus-Booking%5C.next%5Cdev%5Cserver%5Cchunks%5Cssr%5C%5Broot-of-the-server%5D__0hye4px._.js?37:13955:15)     at res |
| BROKEN | desktop | B-booking-fail | /dev/stub-pay→/booking/result | pay fail | stuck at /dev/stub-pay?adapter=zalopay&orderId=BB-2026-6134-n351&amount=270000&red ([shot](traveler-smoke-shots/003-result-stuck.png)) |
| PASS | desktop | E-charter | /lien-he-dat-xe | load | HTTP 200 |
| INFO | desktop | E-charter | /lien-he-dat-xe | form buttons | Chọn ngày đi \| Gửi yêu cầu |
| PASS | desktop | E-charter | /lien-he-dat-xe | pick departure date | date selected via DatePicker popover |
| PASS | desktop | E-charter | /lien-he-dat-xe | submit charter form | ref CH-2026-N24541 → /lien-he-dat-xe/confirmation?ref=CH-2026-N24541 ([shot](traveler-smoke-shots/004-charter-submit.png)) |
| PASS | desktop | E-charter | /charter/status/CH-2026-N24541 | load | HTTP 200 |
| PASS | desktop | E-charter | /charter/status/CH-2026-N24541 | cancel charter | cancel clicked ([shot](traveler-smoke-shots/005-charter-cancel.png)) |
| PASS | desktop | D-account | /auth/register | load | HTTP 200 |
| PASS | desktop | D-account | /auth/register | step1 send OTP | advanced to OTP step |
| PASS | desktop | D-account | /auth/register | OTP peek (backend) | got code from backend sink |
| PASS | desktop | D-account | /auth/register | step2 verify OTP | advanced to details |
| PASS | desktop | D-account | /auth/register | step3 register | registered, landed / |
| PASS | desktop | D-account | /account/bookings | header "Tài khoản" link (SPA) | reached bookings authed ([shot](traveler-smoke-shots/006-acct-bookings.png)) |
| PASS | desktop | D-account | /account/bookings | tab sắp tới\|upcoming | clicked |
| INFO | desktop | D-account | /account/bookings | booking detail link | no booking rows for this fresh account (expected — guest booking used a different phone) |
| PASS | desktop | D-account | /account/bookings | link to /account/settings | settings link present |
| PASS | desktop | D-account | /account/settings | load | HTTP 200 → redirected to /auth/login?returnTo=/account/settings |
| PASS | desktop | D-account | /account/settings | auth-guard on hard load | redirected to login (guard works) |
| PASS | desktop | H-login(setup) | /auth/register | load | HTTP 200 |
| PASS | desktop | H-login(setup) | /auth/register | step1 send OTP | advanced to OTP step |
| PASS | desktop | H-login(setup) | /auth/register | OTP peek (backend) | got code from backend sink |
| PASS | desktop | H-login(setup) | /auth/register | step2 verify OTP | advanced to details |
| PASS | desktop | H-login(setup) | /auth/register | step3 register | registered, landed / |
| PASS | desktop | H-login | /auth/login?returnTo=/account/bookings | load | HTTP 200 |
| PASS | desktop | H-login | /auth/login | wrong password → error | shows "không đúng" ([shot](traveler-smoke-shots/007-login-wrong.png)) |
| PASS | desktop | H-login | /auth/login→/account/bookings | login (POST /api/auth/login) | HTTP 200, reached bookings authed ([shot](traveler-smoke-shots/008-login-ok.png)) |
| PASS | desktop | I-settings-A(setup) | /auth/register | load | HTTP 200 |
| PASS | desktop | I-settings-A(setup) | /auth/register | step1 send OTP | advanced to OTP step |
| PASS | desktop | I-settings-A(setup) | /auth/register | OTP peek (backend) | got code from backend sink |
| PASS | desktop | I-settings-A(setup) | /auth/register | step2 verify OTP | advanced to details |
| PASS | desktop | I-settings-A(setup) | /auth/register | step3 register | registered, landed / |
| PASS | desktop | I-settings | /account/settings | reach settings (SPA, token alive) | on settings page authed |
| PASS | desktop | I-settings | /account/settings | change displayName (PATCH /api/account/name) | name updated ([shot](traveler-smoke-shots/009-settings-name.png)) |
| PASS | desktop | I-settings | /account/settings | change phone (OTP from backend) | phone changed ([shot](traveler-smoke-shots/010-settings-phone.png)) |
| PASS | desktop | I-password(setup) | /auth/register | load | HTTP 200 |
| PASS | desktop | I-password(setup) | /auth/register | step1 send OTP | advanced to OTP step |
| PASS | desktop | I-password(setup) | /auth/register | OTP peek (backend) | got code from backend sink |
| PASS | desktop | I-password(setup) | /auth/register | step2 verify OTP | advanced to details |
| PASS | desktop | I-password(setup) | /auth/register | step3 register | registered, landed / |
| PASS | desktop | I-password | /account/settings | reach settings (SPA, token alive) | on settings page authed |
| PASS | desktop | I-password | /account/settings | change password (POST /api/account/password) | password changed ([shot](traveler-smoke-shots/011-settings-password.png)) |
| PASS | desktop | I-delete(setup) | /auth/register | load | HTTP 200 |
| PASS | desktop | I-delete(setup) | /auth/register | step1 send OTP | advanced to OTP step |
| PASS | desktop | I-delete(setup) | /auth/register | OTP peek (backend) | got code from backend sink |
| PASS | desktop | I-delete(setup) | /auth/register | step2 verify OTP | advanced to details |
| PASS | desktop | I-delete(setup) | /auth/register | step3 register | registered, landed / |
| PASS | desktop | I-delete | /account/settings | reach settings (SPA, token alive) | on settings page authed |
| PASS | desktop | I-delete | /account/settings | delete account (DELETE /api/account/delete) | account deleted, redirected home ([shot](traveler-smoke-shots/012-settings-delete.png)) |
| PASS | desktop | J-link | /search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-06&ticketCount=1 | load | HTTP 200 |
| PASS | desktop | J-link | /search | results | 4 book button(s) |
| PASS | desktop | J-link | /search→/booking/customer | BookButton | reached customer form |
| PASS | desktop | J-link | /booking/customer→/booking/review | submit customer form (POST /api/holds) | hold created, reached review |
| PASS | desktop | J-link | /booking/review | hold timer | countdown="10:00" |
| PASS | desktop | J-link | /booking/review | guest booking w/ shared phone | hold created for +84932863167 |
| PASS | desktop | J-link | /auth/register | load | HTTP 200 |
| PASS | desktop | J-link | /auth/register | step1 send OTP | advanced to OTP step |
| PASS | desktop | J-link | /auth/register | OTP peek (backend) | got code from backend sink |
| PASS | desktop | J-link | /auth/register | step2 verify OTP | advanced to details |
| PASS | desktop | J-link | /auth/register | step3 register | registered, landed / |
| PASS | desktop | J-link | /account/bookings | guest→account link result | bookings list authed; 0 attached row(s) — skip-pay: held(unpaid) booking is NOT attached (only paid bookings link), so 0 rows is expected this pass ([shot](traveler-smoke-shots/013-guest-link.png)) |
| PASS | desktop | C-forgot(setup) | /auth/register | load | HTTP 200 |
| PASS | desktop | C-forgot(setup) | /auth/register | step1 send OTP | advanced to OTP step |
| PASS | desktop | C-forgot(setup) | /auth/register | OTP peek (backend) | got code from backend sink |
| PASS | desktop | C-forgot(setup) | /auth/register | step2 verify OTP | advanced to details |
| PASS | desktop | C-forgot(setup) | /auth/register | step3 register | registered, landed / |
| PASS | desktop | C-forgot | /auth/forgot-password | load | HTTP 200 |
| PASS | desktop | C-forgot | /auth/forgot-password | step1 request OTP | advanced to reset step |
| PASS | desktop | C-forgot | /auth/forgot-password | verify OTP + reset password | password reset OK (done screen) ([shot](traveler-smoke-shots/014-forgot-done.png)) |
| PASS | desktop | C-reset(setup) | /auth/register | load | HTTP 200 |
| PASS | desktop | C-reset(setup) | /auth/register | step1 send OTP | advanced to OTP step |
| PASS | desktop | C-reset(setup) | /auth/register | OTP peek (backend) | got code from backend sink |
| PASS | desktop | C-reset(setup) | /auth/register | step2 verify OTP | advanced to details |
| PASS | desktop | C-reset(setup) | /auth/register | step3 register | registered, landed / |
| PASS | desktop | C-reset | /api/auth/forgot-password | trigger OTP send | status 200 |
| PASS | desktop | C-reset | /auth/reset-password?phone=%2B84932907659 | load | HTTP 200 |
| PASS | desktop | C-reset | /auth/reset-password | verify OTP + reset password | password reset OK (done screen) ([shot](traveler-smoke-shots/015-reset-done.png)) |
| INFO | mobile | meta | - | start viewport | mobile @ http://localhost:3001 |
| PASS | mobile | A-static | / | load | HTTP 200 |
| PASS | mobile | A-static | /search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-06&ticketCount=1 | load | HTTP 200 |
| PASS | mobile | A-static | /routes | load | HTTP 200 |
| PASS | mobile | A-static | /lien-he-dat-xe | load | HTTP 200 |
| PASS | mobile | A-static | /lien-he-dat-xe/confirmation | load | HTTP 200 |
| PASS | mobile | A-static | /auth/login | load | HTTP 200 |
| PASS | mobile | A-static | /auth/register | load | HTTP 200 |
| PASS | mobile | A-static | /auth/forgot-password | load | HTTP 200 |
| PASS | mobile | A-static | /auth/reset-password | load | HTTP 200 |
| PASS | mobile | A-static | /account/bookings | load | HTTP 200 → redirected to /auth/login?returnTo=/account/bookings |
| PASS | mobile | A-static | /account/settings | load | HTTP 200 → redirected to /auth/login?returnTo=/account/settings |
| PASS | mobile | A-static | /booking/customer | load | HTTP 200 → redirected to /search |
| PASS | mobile | A-static | /booking/review | load | HTTP 200 → redirected to /search |
| PASS | mobile | A-static | /privacy | load | HTTP 200 |
| PASS | mobile | A-static | /terms | load | HTTP 200 |
| INFO | mobile | A-static | /charter/status/INVALID-REF-TEST | load | HTTP 404 (notFound — expected for invalid id/token) |
| INFO | mobile | A-static | /verify/invalid-token-test | load | HTTP 404 (notFound — expected for invalid id/token) |
| PASS | mobile | A-static | /trips/cmq0f8mpm003dkscd2dvzipp4 | load | HTTP 200 |
| PASS | mobile | A-static | /trips/cmq0f8mpm003rkscdvienqs29 | load | HTTP 200 |
| PASS | mobile | A-static | /trips/cmq0f8mpm003skscdfiondwuq | load | HTTP 200 |
| PASS | mobile | A-static | /trips/cmq0f8mpm003tkscd37lszcmp | load | HTTP 200 |
| PASS | mobile | F-search | /search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-06&ticketCount=1 | load | HTTP 200 |
| PASS | mobile | F-search | /search | sort → Giá thấp→cao | URL has sort=price_asc |
| INFO | mobile | F-search | /search | filter chip | no bus-type chip visible (single-facet or mobile sheet collapsed) |
| PASS | mobile | F-search | /search | date-nav next day | 2026-06-06 → 2026-06-07 |
| PASS | mobile | G-trip | /search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-06&ticketCount=1 | load | HTTP 200 |
| PASS | mobile | G-trip | /search→/trips/[id] | Xem chi tiết | at /trips/cmq0f8mpm003dkscd2dvzipp4 |
| PASS | mobile | G-trip | /trips/[id] | ticket stepper +/- | stepper clicked (2× tăng, 1× giảm) ([shot](traveler-smoke-shots/016-trip-stepper.png)) |
| PASS | mobile | G-trip | /trips/[id]→/booking/customer | Đặt vé | reached customer form |
| PASS | mobile | B-booking | /search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-06&ticketCount=1 | load | HTTP 200 |
| PASS | mobile | B-booking | /search | results | 4 book button(s) |
| PASS | mobile | B-booking | /search→/booking/customer | BookButton | reached customer form |
| PASS | mobile | B-booking | /booking/customer→/booking/review | submit customer form (POST /api/holds) | hold created, reached review |
| PASS | mobile | B-booking | /booking/review | hold timer | countdown="10:00" |
| PASS | mobile | B-booking | /booking/review | pay disabled before consent | disabled=true |
| BROKEN | mobile | phase-error | - | guest-booking | phase threw: locator.click: Timeout 30000ms exceeded. Call log: [2m  - waiting for getByRole('button', { name: /xác nhận thanh toán/i }).first()[22m [2m    - locator reso |
| PASS | mobile | E-charter | /lien-he-dat-xe | load | HTTP 200 |
| INFO | mobile | E-charter | /lien-he-dat-xe | form buttons | Chọn ngày đi \| Gửi yêu cầu |
| PASS | mobile | E-charter | /lien-he-dat-xe | pick departure date | date selected via DatePicker popover |
| PASS | mobile | E-charter | /lien-he-dat-xe | submit charter form | ref CH-2026-94414Y → /lien-he-dat-xe/confirmation?ref=CH-2026-94414Y ([shot](traveler-smoke-shots/017-charter-submit.png)) |
| PASS | mobile | E-charter | /charter/status/CH-2026-94414Y | load | HTTP 200 |
| PASS | mobile | E-charter | /charter/status/CH-2026-94414Y | cancel charter | cancel clicked ([shot](traveler-smoke-shots/018-charter-cancel.png)) |
| PASS | mobile | D-account | /auth/register | load | HTTP 200 |
| PASS | mobile | D-account | /auth/register | step1 send OTP | advanced to OTP step |
| PASS | mobile | D-account | /auth/register | OTP peek (backend) | got code from backend sink |
| PASS | mobile | D-account | /auth/register | step2 verify OTP | advanced to details |
| PASS | mobile | D-account | /auth/register | step3 register | registered, landed / |
| PASS | mobile | D-account | /account/bookings | header "Tài khoản" link (SPA) | reached bookings authed ([shot](traveler-smoke-shots/019-acct-bookings.png)) |
| PASS | mobile | D-account | /account/bookings | tab sắp tới\|upcoming | clicked |
| INFO | mobile | D-account | /account/bookings | booking detail link | no booking rows for this fresh account (expected — guest booking used a different phone) |
| PASS | mobile | D-account | /account/bookings | link to /account/settings | settings link present |
| PASS | mobile | D-account | /account/settings | load | HTTP 200 → redirected to /auth/login?returnTo=/account/settings |
| PASS | mobile | D-account | /account/settings | auth-guard on hard load | redirected to login (guard works) |
