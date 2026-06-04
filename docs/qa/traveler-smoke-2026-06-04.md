# Traveler-side smoke crawl — 2026-06-04

Target: `http://localhost:3001` · Driver: standalone Playwright (`scripts/smoke/traveler-crawl.mts`) · Viewports: desktop 1280 + mobile-390.
Mode: full mutating flows. OTP for every otp-gated flow pulled directly from the backend test-peek sink (`/api/auth/otp/test-peek`).

## Summary

| Result | Count |
|---|---|
| 🟥 BROKEN | 0 |
| 🟧 WARN | 10 |
| 🟩 PASS | 94 |
| Total checks | 114 |

## 🟥 Broken transitions / functions

_None detected._

## 🟧 Warnings (degraded / needs human eyes)

| Sev | VP | Phase | Route | Action | Detail |
|---|---|---|---|---|---|
| WARN | desktop | http | /charter/status/INVALID-REF-TEST | GET (ctx:visit /charter/status/INVALID-REF-TEST) | HTTP 404 |
| WARN | desktop | console | /charter/status/INVALID-REF-TEST | visit /charter/status/INVALID-REF-TEST | console.error: Failed to load resource: the server responded with a status of 404 (Not Found) |
| WARN | desktop | http | /verify/invalid-token-test | GET (ctx:visit /verify/invalid-token-test) | HTTP 404 |
| WARN | desktop | console | /verify/invalid-token-test | visit /verify/invalid-token-test | console.error: Failed to load resource: the server responded with a status of 404 (Not Found) |
| WARN | desktop | C-forgot | /auth/forgot-password | verify OTP + reset password | no done screen at /auth/forgot-password ([shot](traveler-smoke-shots/004-forgot-done.png)) |
| WARN | desktop | C-reset | /auth/reset-password | verify OTP + reset password | no done screen at /auth/reset-password?phone=%2B84931060043 ([shot](traveler-smoke-shots/005-reset-done.png)) |
| WARN | mobile | http | /charter/status/INVALID-REF-TEST | GET (ctx:visit /charter/status/INVALID-REF-TEST) | HTTP 404 |
| WARN | mobile | console | /charter/status/INVALID-REF-TEST | visit /charter/status/INVALID-REF-TEST | console.error: Failed to load resource: the server responded with a status of 404 (Not Found) |
| WARN | mobile | http | /verify/invalid-token-test | GET (ctx:visit /verify/invalid-token-test) | HTTP 404 |
| WARN | mobile | console | /verify/invalid-token-test | visit /verify/invalid-token-test | console.error: Failed to load resource: the server responded with a status of 404 (Not Found) |

## Route load matrix

| Route | Result |
|---|---|
| / | PASS — HTTP 200 |
| /search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-05&ticketCount=1 | PASS — HTTP 200 |
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
| /trips/cmpygn0lt003dnkcdwv1sg4af | PASS — HTTP 200 |
| /trips/cmpygn0lt003rnkcd9p5tkknf | PASS — HTTP 200 |
| /trips/cmpygn0lt003snkcdsfk17q5i | PASS — HTTP 200 |
| /trips/cmpygn0lt003tnkcdx132cz6e | PASS — HTTP 200 |
| /charter/status/CH-2026-74P543 | PASS — HTTP 200 |
| /auth/reset-password?phone=%2B84931060043 | PASS — HTTP 200 |
| /charter/status/CH-2026-RG661P | PASS — HTTP 200 |

## In-app link graph (from → to)

- `/` → `/`, `/lien-he-dat-xe`, `/account/bookings`, `/search?origin=Thanh+H%C3%B3a&destination=S%C3%A0i+G%C3%B2n&date=2026-06-04&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=B%C3%ACnh+D%C6%B0%C6%A1ng&date=2026-06-04&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-04&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Sa+Pa&date=2026-06-04&ticketCount=1`, `/search?origin=%C4%90%C3%A0+N%E1%BA%B5ng&destination=Hu%E1%BA%BF&date=2026-06-04&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=H%E1%BA%A3i+Ph%C3%B2ng&date=2026-06-04&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=V%C5%A9ng+T%C3%A0u&date=2026-06-04&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-04&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=Nha+Trang&date=2026-06-04&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=H%C3%A0+N%E1%BB%99i&date=2026-06-04&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-04&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Thanh+H%C3%B3a&date=2026-06-04&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Vinh&date=2026-06-04&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=C%E1%BA%A7n+Th%C6%A1&date=2026-06-04&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-04&ticketCount=1`, `/search?origin=Nha+Trang&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-04&ticketCount=1`, `/search?origin=C%E1%BA%A7n+Th%C6%A1&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-04&ticketCount=1`, `/search?origin=Hu%E1%BA%BF&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-04&ticketCount=1`, `/search?origin=%C4%90%C3%A0+L%E1%BA%A1t&destination=S%C3%A0i+G%C3%B2n&date=2026-06-04&ticketCount=1`, `/auth/login`, `/terms`, `/privacy`
- `/search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-05&ticketCount=1` → `/`, `/lien-he-dat-xe`, `/account/bookings`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-04&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-06&ticketCount=1`, `/trips/cmpygn0lt003dnkcdwv1sg4af`, `/trips/cmpygn0lt003rnkcd9p5tkknf`, `/trips/cmpygn0lt003snkcdsfk17q5i`, `/trips/cmpygn0lt003tnkcdx132cz6e`, `/auth/login`, `/terms`, `/privacy`
- `/routes` → `/`, `/lien-he-dat-xe`, `/account/bookings`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-04&ticketCount=1`, `/search?origin=B%C3%ACnh+D%C6%B0%C6%A1ng&destination=S%C3%A0i+G%C3%B2n&date=2026-06-04&ticketCount=1`, `/search?origin=C%E1%BA%A7n+Th%C6%A1&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-04&ticketCount=1`, `/search?origin=C%E1%BA%A7n+Th%C6%A1&destination=S%C3%A0i+G%C3%B2n&date=2026-06-04&ticketCount=1`, `/search?origin=%C4%90%C3%A0+L%E1%BA%A1t&destination=Nha+Trang&date=2026-06-04&ticketCount=1`, `/search?origin=%C4%90%C3%A0+L%E1%BA%A1t&destination=C%E1%BA%A7n+Th%C6%A1&date=2026-06-04&ticketCount=1`, `/search?origin=%C4%90%C3%A0+L%E1%BA%A1t&destination=S%C3%A0i+G%C3%B2n&date=2026-06-04&ticketCount=1`, `/search?origin=%C4%90%C3%A0+N%E1%BA%B5ng&destination=S%C3%A0i+G%C3%B2n&date=2026-06-04&ticketCount=1`, `/search?origin=%C4%90%C3%A0+N%E1%BA%B5ng&destination=Hu%E1%BA%BF&date=2026-06-04&ticketCount=1`, `/search?origin=%C4%90%C3%A0+N%E1%BA%B5ng&destination=H%C3%A0+N%E1%BB%99i&date=2026-06-04&ticketCount=1`, `/search?origin=E2E+Race+Origin&destination=E2E+Race+Destination&date=2026-06-04&ticketCount=1`, `/search?origin=H%E1%BA%A3i+Ph%C3%B2ng&destination=H%C3%A0+N%E1%BB%99i&date=2026-06-04&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Vinh&date=2026-06-04&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-04&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=H%E1%BA%A3i+Ph%C3%B2ng&date=2026-06-04&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=S%C3%A0i+G%C3%B2n&date=2026-06-04&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Sa+Pa&date=2026-06-04&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=Thanh+H%C3%B3a&date=2026-06-04&ticketCount=1`, `/search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-04&ticketCount=1`, `/search?origin=Hu%E1%BA%BF&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-04&ticketCount=1`, `/search?origin=Nha+Trang&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-06-04&ticketCount=1`, `/search?origin=Nha+Trang&destination=S%C3%A0i+G%C3%B2n&date=2026-06-04&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=%C4%90%C3%A0+N%E1%BA%B5ng&date=2026-06-04&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=H%C3%A0+N%E1%BB%99i&date=2026-06-04&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=Thanh+H%C3%B3a&date=2026-06-04&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=V%C5%A9ng+T%C3%A0u&date=2026-06-04&ticketCount=1`, `/search?origin=S%C3%A0i+G%C3%B2n&destination=Nha+Trang&date=2026-06-04&ticketCount=1`
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
- `/trips/cmpygn0lt003dnkcdwv1sg4af` → `/`, `/lien-he-dat-xe`, `/account/bookings`, `/search`, `/auth/login`, `/terms`, `/privacy`
- `/trips/cmpygn0lt003rnkcd9p5tkknf` → `/`, `/lien-he-dat-xe`, `/account/bookings`, `/search`, `/auth/login`, `/terms`, `/privacy`
- `/trips/cmpygn0lt003snkcdsfk17q5i` → `/`, `/lien-he-dat-xe`, `/account/bookings`, `/search`, `/auth/login`, `/terms`, `/privacy`
- `/trips/cmpygn0lt003tnkcdx132cz6e` → `/`, `/lien-he-dat-xe`, `/account/bookings`, `/search`, `/auth/login`, `/terms`, `/privacy`

## Button inventory (per route)

- `/`: "Chọn ngày đi", "Tìm chuyến xe"
- `/search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-05&ticketCount=1`: "05/06/2026", "Tìm chuyến xe", "Ghế ngồi (2)", "Limousine (1)", "Giường nằm (1)", "Chiều (11–17h) (1)", "Tối (17–22h) (1)", "Sáng (5–11h) (1)", "Đêm (22–5h) (1)", "≤ 4h", "≤ 6h", "≤ 8h", "≤ 10h", "Giờ đi sớm nhất▼", "Bộ lọc", "Đặt vé"
- `/lien-he-dat-xe`: "Chọn ngày đi", "Gửi yêu cầu"
- `/auth/login`: "Đăng nhập"
- `/auth/register`: "Gửi mã OTP"
- `/auth/forgot-password`: "Gửi mã OTP"
- `/auth/reset-password`: "Đặt lại mật khẩu"
- `/account/bookings`: "Đăng nhập"
- `/account/settings`: "Đăng nhập"
- `/booking/customer`: "Chọn ngày đi", "Tìm chuyến xe"
- `/booking/review`: "Chọn ngày đi", "Tìm chuyến xe"
- `/trips/cmpygn0lt003dnkcdwv1sg4af`: "Đặt vé"
- `/trips/cmpygn0lt003rnkcd9p5tkknf`: "Đặt vé"
- `/trips/cmpygn0lt003snkcdsfk17q5i`: "Đặt vé"
- `/trips/cmpygn0lt003tnkcdx132cz6e`: "Đặt vé"

## Full check log

| Sev | VP | Phase | Route | Action | Detail |
|---|---|---|---|---|---|
| INFO | desktop | meta | - | start viewport | desktop @ http://localhost:3001 |
| PASS | desktop | A-static | / | load | HTTP 200 |
| PASS | desktop | A-static | /search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-05&ticketCount=1 | load | HTTP 200 |
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
| WARN | desktop | http | /charter/status/INVALID-REF-TEST | GET (ctx:visit /charter/status/INVALID-REF-TEST) | HTTP 404 |
| WARN | desktop | console | /charter/status/INVALID-REF-TEST | visit /charter/status/INVALID-REF-TEST | console.error: Failed to load resource: the server responded with a status of 404 (Not Found) |
| INFO | desktop | A-static | /charter/status/INVALID-REF-TEST | load | HTTP 404 (notFound — expected for invalid id/token) |
| WARN | desktop | http | /verify/invalid-token-test | GET (ctx:visit /verify/invalid-token-test) | HTTP 404 |
| WARN | desktop | console | /verify/invalid-token-test | visit /verify/invalid-token-test | console.error: Failed to load resource: the server responded with a status of 404 (Not Found) |
| INFO | desktop | A-static | /verify/invalid-token-test | load | HTTP 404 (notFound — expected for invalid id/token) |
| PASS | desktop | A-static | /trips/cmpygn0lt003dnkcdwv1sg4af | load | HTTP 200 |
| PASS | desktop | A-static | /trips/cmpygn0lt003rnkcd9p5tkknf | load | HTTP 200 |
| PASS | desktop | A-static | /trips/cmpygn0lt003snkcdsfk17q5i | load | HTTP 200 |
| PASS | desktop | A-static | /trips/cmpygn0lt003tnkcdx132cz6e | load | HTTP 200 |
| PASS | desktop | B-booking | /search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-05&ticketCount=1 | load | HTTP 200 |
| PASS | desktop | B-booking | /search | results | 4 book button(s) |
| PASS | desktop | B-booking | /search→/booking/customer | BookButton | reached customer form |
| PASS | desktop | B-booking | /booking/customer→/booking/review | submit customer form (POST /api/holds) | hold created, reached review |
| PASS | desktop | B-booking | /booking/review | hold timer | countdown="10:00" |
| PASS | desktop | B-booking | /booking/review | pay button (pay step skipped — SMOKE_RUN_PAY unset) | present=true disabledBeforeConsent=true |
| PASS | desktop | E-charter | /lien-he-dat-xe | load | HTTP 200 |
| INFO | desktop | E-charter | /lien-he-dat-xe | form buttons | Chọn ngày đi \| Gửi yêu cầu |
| PASS | desktop | E-charter | /lien-he-dat-xe | pick departure date | date selected via DatePicker popover |
| PASS | desktop | E-charter | /lien-he-dat-xe | submit charter form | ref CH-2026-74P543 → /lien-he-dat-xe/confirmation?ref=CH-2026-74P543 ([shot](traveler-smoke-shots/001-charter-submit.png)) |
| PASS | desktop | E-charter | /charter/status/CH-2026-74P543 | load | HTTP 200 |
| PASS | desktop | E-charter | /charter/status/CH-2026-74P543 | cancel charter | cancel clicked ([shot](traveler-smoke-shots/002-charter-cancel.png)) |
| PASS | desktop | D-account | /auth/register | load | HTTP 200 |
| PASS | desktop | D-account | /auth/register | step1 send OTP | advanced to OTP step |
| PASS | desktop | D-account | /auth/register | OTP peek (backend) | got code from backend sink |
| PASS | desktop | D-account | /auth/register | step2 verify OTP | advanced to details |
| PASS | desktop | D-account | /auth/register | step3 register | registered, landed / |
| PASS | desktop | D-account | /account/bookings | header "Tài khoản" link (SPA) | reached bookings authed ([shot](traveler-smoke-shots/003-acct-bookings.png)) |
| PASS | desktop | D-account | /account/bookings | tab sắp tới\|upcoming | clicked |
| INFO | desktop | D-account | /account/bookings | booking detail link | no booking rows for this fresh account (expected — guest booking used a different phone) |
| PASS | desktop | D-account | /account/bookings | link to /account/settings | settings link present |
| PASS | desktop | D-account | /account/settings | load | HTTP 200 → redirected to /auth/login?returnTo=/account/settings |
| PASS | desktop | D-account | /account/settings | auth-guard on hard load | redirected to login (guard works) |
| PASS | desktop | C-forgot(setup) | /auth/register | load | HTTP 200 |
| PASS | desktop | C-forgot(setup) | /auth/register | step1 send OTP | advanced to OTP step |
| PASS | desktop | C-forgot(setup) | /auth/register | OTP peek (backend) | got code from backend sink |
| PASS | desktop | C-forgot(setup) | /auth/register | step2 verify OTP | advanced to details |
| PASS | desktop | C-forgot(setup) | /auth/register | step3 register | registered, landed / |
| PASS | desktop | C-forgot | /auth/forgot-password | load | HTTP 200 |
| PASS | desktop | C-forgot | /auth/forgot-password | step1 request OTP | advanced to reset step |
| WARN | desktop | C-forgot | /auth/forgot-password | verify OTP + reset password | no done screen at /auth/forgot-password ([shot](traveler-smoke-shots/004-forgot-done.png)) |
| PASS | desktop | C-reset(setup) | /auth/register | load | HTTP 200 |
| PASS | desktop | C-reset(setup) | /auth/register | step1 send OTP | advanced to OTP step |
| PASS | desktop | C-reset(setup) | /auth/register | OTP peek (backend) | got code from backend sink |
| PASS | desktop | C-reset(setup) | /auth/register | step2 verify OTP | advanced to details |
| PASS | desktop | C-reset(setup) | /auth/register | step3 register | registered, landed / |
| PASS | desktop | C-reset | /api/auth/forgot-password | trigger OTP send | status 200 |
| PASS | desktop | C-reset | /auth/reset-password?phone=%2B84931060043 | load | HTTP 200 |
| WARN | desktop | C-reset | /auth/reset-password | verify OTP + reset password | no done screen at /auth/reset-password?phone=%2B84931060043 ([shot](traveler-smoke-shots/005-reset-done.png)) |
| INFO | mobile | meta | - | start viewport | mobile @ http://localhost:3001 |
| PASS | mobile | A-static | / | load | HTTP 200 |
| PASS | mobile | A-static | /search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-05&ticketCount=1 | load | HTTP 200 |
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
| WARN | mobile | http | /charter/status/INVALID-REF-TEST | GET (ctx:visit /charter/status/INVALID-REF-TEST) | HTTP 404 |
| WARN | mobile | console | /charter/status/INVALID-REF-TEST | visit /charter/status/INVALID-REF-TEST | console.error: Failed to load resource: the server responded with a status of 404 (Not Found) |
| INFO | mobile | A-static | /charter/status/INVALID-REF-TEST | load | HTTP 404 (notFound — expected for invalid id/token) |
| WARN | mobile | http | /verify/invalid-token-test | GET (ctx:visit /verify/invalid-token-test) | HTTP 404 |
| WARN | mobile | console | /verify/invalid-token-test | visit /verify/invalid-token-test | console.error: Failed to load resource: the server responded with a status of 404 (Not Found) |
| INFO | mobile | A-static | /verify/invalid-token-test | load | HTTP 404 (notFound — expected for invalid id/token) |
| PASS | mobile | A-static | /trips/cmpygn0lt003dnkcdwv1sg4af | load | HTTP 200 |
| PASS | mobile | A-static | /trips/cmpygn0lt003rnkcd9p5tkknf | load | HTTP 200 |
| PASS | mobile | A-static | /trips/cmpygn0lt003snkcdsfk17q5i | load | HTTP 200 |
| PASS | mobile | A-static | /trips/cmpygn0lt003tnkcdx132cz6e | load | HTTP 200 |
| PASS | mobile | B-booking | /search?origin=H%C3%A0+N%E1%BB%99i&destination=TP.HCM&date=2026-06-05&ticketCount=1 | load | HTTP 200 |
| PASS | mobile | B-booking | /search | results | 4 book button(s) |
| PASS | mobile | B-booking | /search→/booking/customer | BookButton | reached customer form |
| PASS | mobile | B-booking | /booking/customer→/booking/review | submit customer form (POST /api/holds) | hold created, reached review |
| PASS | mobile | B-booking | /booking/review | hold timer | countdown="10:00" |
| PASS | mobile | B-booking | /booking/review | pay button (pay step skipped — SMOKE_RUN_PAY unset) | present=true disabledBeforeConsent=true |
| PASS | mobile | E-charter | /lien-he-dat-xe | load | HTTP 200 |
| INFO | mobile | E-charter | /lien-he-dat-xe | form buttons | Chọn ngày đi \| Gửi yêu cầu |
| PASS | mobile | E-charter | /lien-he-dat-xe | pick departure date | date selected via DatePicker popover |
| PASS | mobile | E-charter | /lien-he-dat-xe | submit charter form | ref CH-2026-RG661P → /lien-he-dat-xe/confirmation?ref=CH-2026-RG661P ([shot](traveler-smoke-shots/006-charter-submit.png)) |
| PASS | mobile | E-charter | /charter/status/CH-2026-RG661P | load | HTTP 200 |
| PASS | mobile | E-charter | /charter/status/CH-2026-RG661P | cancel charter | cancel clicked ([shot](traveler-smoke-shots/007-charter-cancel.png)) |
| PASS | mobile | D-account | /auth/register | load | HTTP 200 |
| PASS | mobile | D-account | /auth/register | step1 send OTP | advanced to OTP step |
| PASS | mobile | D-account | /auth/register | OTP peek (backend) | got code from backend sink |
| PASS | mobile | D-account | /auth/register | step2 verify OTP | advanced to details |
| PASS | mobile | D-account | /auth/register | step3 register | registered, landed / |
| PASS | mobile | D-account | /account/bookings | header "Tài khoản" link (SPA) | reached bookings authed ([shot](traveler-smoke-shots/008-acct-bookings.png)) |
| PASS | mobile | D-account | /account/bookings | tab sắp tới\|upcoming | clicked |
| INFO | mobile | D-account | /account/bookings | booking detail link | no booking rows for this fresh account (expected — guest booking used a different phone) |
| PASS | mobile | D-account | /account/bookings | link to /account/settings | settings link present |
| PASS | mobile | D-account | /account/settings | load | HTTP 200 → redirected to /auth/login?returnTo=/account/settings |
| PASS | mobile | D-account | /account/settings | auth-guard on hard load | redirected to login (guard works) |
