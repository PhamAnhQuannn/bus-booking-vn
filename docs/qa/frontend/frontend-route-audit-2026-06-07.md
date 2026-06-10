# Frontend route-coverage audit — 2026-06-07

Target `http://localhost:3001` · Driver `scripts/smoke/route-audit.mts` · Per route: HTTP status, final path (redirect), <title>, meta-description present, <h1> count, console/page errors.

## Summary
| Bucket | Count |
|---|---|
| ✅ loaded clean | 25 |
| 🟥 broken (5xx / nav-error / console error) | 0 |
| ↪️ redirected (gate/guard) | 9 |
| ⬜ skipped (needs fixture) | 7 |
| Total routes probed | 35 |

## 🟥 Broken
_None._

## Full matrix
| Persona | Route | Status | Final | Title | Desc | H1 | Err | Note |
|---|---|---|---|---|---|---|---|---|
| public | / | 200 | / | Đặt vé xe khách \| BBVN | ✓ | 1 |  |  |
| public | /search | 200 | /search | Tìm chuyến xe \| BBVN | ✓ | 1 |  |  |
| public | /routes | 200 | /routes | Tuyến đường \| BBVN | ✓ | 1 |  |  |
| public | /lien-he-dat-xe | 200 | /lien-he-dat-xe | Liên hệ đặt xe \| BBVN | ✓ | 1 |  |  |
| public | /lien-he-dat-xe/confirmation | 200 | /lien-he-dat-xe/confirmation | Đã nhận yêu cầu \| BBVN | ✓ | 1 |  |  |
| public | /terms | 200 | /terms | Điều khoản dịch vụ \| BBVN | ✓ | 1 |  |  |
| public | /privacy | 200 | /privacy | Chính sách bảo mật \| BBVN | ✓ | 1 |  |  |
| public | /auth/login | 200 | / | Đặt vé xe khách \| BBVN | ✓ | 1 |  |  |
| public | /auth/register | 200 | / | Đặt vé xe khách \| BBVN | ✓ | 1 |  |  |
| public | /auth/forgot-password | 200 | / | Đặt vé xe khách \| BBVN | ✓ | 1 |  |  |
| public | /auth/reset-password | 200 | / | Đặt vé xe khách \| BBVN | ✓ | 1 |  |  |
| public | /op/login | 200 | /op/login | Đặt vé xe khách \| BBVN | ✓ | 1 |  |  |
| public | /op/register | 200 | /op/register | Đặt vé xe khách \| BBVN | ✓ | 1 |  |  |
| public | /op/register/confirmation | 200 | /op/register/confirmation | Đặt vé xe khách \| BBVN | ✓ | 1 |  |  |
| public | /op/forgot-password | 200 | /op/login | Đặt vé xe khách \| BBVN | ✓ | 1 |  |  |
| public | /admin/login | 200 | /admin/login | Đặt vé xe khách \| BBVN | ✓ | 1 |  |  |
| public | /trips/cmq33moxc0094cscd3gyij4wp | 404 | /trips/cmq33moxc0094cscd3gyij4wp | Chuyến xe \| BBVN | ✓ | 1 |  | resolved trip id |
| public | /search?origin=H%C3%A0%20N%E1%BB%99i&destination=S%C3%A0i%20G%C3%B2n&date=2026-06-07&ticketCount=1 | 200 | /search?origin=H%C3%A0%20N%E1%BB%99i&destination=S%C3%A0i | Tìm chuyến xe \| BBVN | ✓ | 1 |  | param search |
| public | /verify/[token] | — | SKIP | — | ✗ | 0 |  | needs entity/flow fixture |
| public | /booking/confirmation/[token] | — | SKIP | — | ✗ | 0 |  | needs entity/flow fixture |
| public | /booking/result/[token] | — | SKIP | — | ✗ | 0 |  | needs entity/flow fixture |
| public | /charter/status/[ref] | — | SKIP | — | ✗ | 0 |  | needs entity/flow fixture |
| public | /booking/review | — | SKIP | — | ✗ | 0 |  | needs entity/flow fixture |
| public | /booking/customer | — | SKIP | — | ✗ | 0 |  | needs entity/flow fixture |
| admin | /admin | 200 | /admin/login | Đặt vé xe khách \| BBVN | ✓ | 1 |  | no seed admin — expect gate redirect to /admin/login |
| admin | /admin/approvals | 200 | /admin/login | Đặt vé xe khách \| BBVN | ✓ | 1 |  | no seed admin — expect gate redirect to /admin/login |
| admin | /admin/charter | 200 | /admin/login | Đặt vé xe khách \| BBVN | ✓ | 1 |  | no seed admin — expect gate redirect to /admin/login |
| admin | /admin/finance | 200 | /admin/login | Đặt vé xe khách \| BBVN | ✓ | 1 |  | no seed admin — expect gate redirect to /admin/login |
| admin | /admin/moderation | 200 | /admin/login | Đặt vé xe khách \| BBVN | ✓ | 1 |  | no seed admin — expect gate redirect to /admin/login |
| admin | /admin/operators | 200 | /admin/login | Đặt vé xe khách \| BBVN | ✓ | 1 |  | no seed admin — expect gate redirect to /admin/login |
| admin | /admin/system | 200 | /admin/login | Đặt vé xe khách \| BBVN | ✓ | 1 |  | no seed admin — expect gate redirect to /admin/login |
| admin | /admin/users | 200 | /admin/login | Đặt vé xe khách \| BBVN | ✓ | 1 |  | no seed admin — expect gate redirect to /admin/login |
| operator | (login) | — | /op/login | — | ✗ | 0 |  | LOGIN FAILED — op routes will redirect |
| customer | (register) | — | / | — | ✗ | 0 |  | REGISTER FAILED — account routes will redirect |
| customer | /account/bookings/[id] | — | SKIP | — | ✗ | 0 |  | needs a booking fixture |
