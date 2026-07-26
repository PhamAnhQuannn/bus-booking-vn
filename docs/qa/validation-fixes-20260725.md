# Validation sweep — this session's fixes (2026-07-25)

Multi-modal validation: 5 parallel Sonnet test agents (terminal/headless) + interactive
browser & console inspection (chrome-devtools MCP) on local dev :3001, synthesized here (Opus).
Scope: ONLY the 6 fixes shipped this session. No code changed. Local email/SMS stubbed →
email/notification validated by RENDER + enqueue ROW, not external delivery.

## Verdict: ALL PASS — clean bill

| # | Fix | How validated | Result |
|---|-----|---------------|--------|
| #340 | Email typo "did you mean" + soft-gate + onChange click-steal fix | Browser (chrome-devtools) + unit (emailSuggest 7) | ✅ |
| #340 | Phone validation message + placeholder | Browser (chrome-devtools) | ✅ |
| #339 | Branded HTML emails (logo, ticket rows, no raw JSON) | email-render agent (14/14 asserts) + unit (emailBody 5) | ✅ |
| #334 | SePay accountNumber validation → orphan, not credited | webhook-behavior agent (live) + unit (bankTransfer 25, route 10) | ✅ |
| #329 | bank_transfer webhook edge rate-limit | webhook-behavior agent (live 60→429) + unit (proxy 11) | ✅ |
| #328 | Operator email on new booking | unit (reconcile 15, channel=email row) + CI integration (green) | ✅ |

Totals: **unit 73/73 pass · tsc clean · eslint 0 errors · email-render 14/14 · 2 live webhook checks PASS · browser flow PASS · console clean.**

## Evidence

### Phase A — parallel Sonnet agents (terminal)

**unit** — `vitest run` the 6 fix test files → **73 passed / 0 failed**:
emailBody (5), emailSuggest (7), bankTransfer (25), route (10), proxy.ratelimit (11), reconcilePayments (15).

**static** — `pnpm tsc --noEmit` → 0 `error TS`; `pnpm eslint` on 12 fix files → **0 errors** (only the
pre-existing boundaries/entry-point deprecation warning).

**integration** — SKIPPED locally: `prepare-int-db` fails at `pnpm prisma db seed` (P2003
`LedgerEntry_bookingId_fkey` at seed.ts:51 `booking.deleteMany()` — the documented append-only-ledger
reseed condition needing DROP SCHEMA). CI already ran `reconcilePayments.int` + `bankTransferWebhook.int`
GREEN on PRs #341/#342.

**email-render [#339]** — called the REAL `renderEmailBody()` for ticketReady / customerBookingPaid /
operatorNewBooking → **14/14 assertions PASS**: each embeds the real logo
`https://lenxevn.com/brand/logo-horizontal-white.png`; NONE leaks a raw `{"bookingRef"` JSON blob;
ticketReady renders labeled VN rows (Hành khách / Khởi hành / Xe), an absolute `https://lenxevn.com`
ticket link, and a "Xem vé" CTA button; each carries a non-empty plain-text fallback.

**webhook-behavior [#329, #334]** — live against dev :3001 webhook (Apikey auth):
- **#329**: 70 rapid POSTs from one IP → first **60 = HTTP 200**, requests **61–70 = HTTP 429** with
  `Retry-After: 58`. Limiter = 60/min/IP (`lib/ratelimit`), bank_transfer routed through it (not in
  `RATELIMIT_EXEMPT`). Edge rate-limit fires. ✅
- **#334**: one POST with `accountNumber:"999999999"` (wrong) → **200 `{"success":true}`** AND a new
  orphan `PaymentEvent` (`id=d092f20b…`, `bookingId IS NULL`, rawBody carries `"accountNumber":"999999999"`)
  → money captured for audit, **not credited** to any booking. ✅

### Phase B — browser + console (chrome-devtools MCP), local dev

Booking form `/booking/customer?tripId=cmrpedyba001r38cdefefame1` (Cần Thơ→Đà Lạt, 340.000đ):
- **#340 email typo** — typing `x@gmail.co` surfaced the hint **"Có phải bạn muốn nhập x@gmail.com?"** on
  onChange (no blur) — proving the onChange fix.
- **#340 soft-gate** — 1st *Tiếp tục* → visible nudge (error naming the suggestion), stayed on form, click
  registered (no stolen click). 2nd *Tiếp tục* (same value) → **proceeded to `/booking/review?holdId=…`**
  (POST `/api/holds` → 200). Full nudge-once-then-proceed confirmed; click-steal bug gone.
- **#340 phone** — `123` + *Tiếp tục* → error **"Số điện thoại không hợp lệ. Nhập số di động Việt Nam
  10 chữ số bắt đầu bằng 0 hoặc +84, VD: 0912345678."**; placeholder `VD: 0912345678` present.
- **Console** — clean: only React-DevTools info + HMR/Fast-Refresh logs. **No errors, no warnings** from
  the fixes.
- **Network** — `POST /api/holds` 200 → `GET /booking/review` (RSC) 200. Single POST, expected flow.

## Notes

- **#328** live paid-path (a real paid booking → operator email enqueue) not exercised locally: email is
  stubbed in dev and it needs a paid booking; it is covered by the unit test (asserts the single
  `operatorNewBooking` row with `channel:'email'`, `recipient=contactEmail`) + CI integration (green).
- Throwaway dev artifacts created during validation (a test hold `300eec4e…`, an orphan PaymentEvent
  `d092f20b…`) — dev-only, harmless.
- No prod mutation. No code edits.
