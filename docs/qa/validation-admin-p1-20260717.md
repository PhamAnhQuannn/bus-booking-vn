# Validation Report — Session Fixes (admin console P1 + prod-safety)

**Date:** 2026-07-17 · **Branch:** `feat/admin-console-p1` · **Target:** local dev (`http://localhost:3001`) on a docker Postgres, seeded catalog + `admin@busbookvn.local` (SUPER_ADMIN, TOTP).
**Method:** parallel Sonnet terminal-test agent + Opus-driven Playwright MCP browser flow + Chrome DevTools MCP inspection + dev-server pino log monitoring + direct `AdminAuditLog` DB queries. **Scope:** only this session's fixes (PR #304, PR #305) + a full unit regression sweep.

## Result: ALL FIXES PASS. No defects found.

| Fix | Method | Result |
|-----|--------|--------|
| `seed.ts` prod-guard | terminal | **PASS** — `NODE_ENV=production` seed throws exit 1 ("Refusing to seed… BBOp2026!"), nothing deleted; dev seed (NODE_ENV unset) ran fine (3 ops/14 buses/35 routes/1440 trips). |
| `purge-demo-catalog.ts` guards | terminal | **PASS** — refuses without `CONFIRM_PURGE=yes` (exit 1). Not run destructively locally. |
| Logout + identity menu | Playwright + DevTools | **PASS** — sidebar `AdminAccountMenu` shows `admin@busbookvn.local` + role "Quản trị tối cao" + "Đăng xuất"; logout POST → `/admin/login`; revisiting `/admin` bounces (307) — session cleared. No client 500 (no barrel regression). |
| TOTP enroll page + login 409-redirect | Playwright + DevTools | **PASS** — TOTP reset → login → `/totp/verify` 409 → auto-redirect `/admin/enroll-totp` → page renders secret + otpauth + copy → confirm with live code → `/admin`. Unauthenticated hit → `/enroll` 401 → redirect `/admin/login`. No CSP violations, no console errors. |
| `proxy.ts` admin allowlist (`/admin/enroll-totp`) | Playwright | **PASS** — reachable with password-only (totpVerified=false) session; `/admin` still gated (307 when unauth). |
| Login audit trail | Playwright + DB | **PASS** — after good/bad-password/bad-TOTP attempts, `AdminAuditLog` held `admin_login_success`×3, `admin_login_failure`×1, `admin_totp_failure`×1. `argsRedacted` = `{"ip":"::1"}` only — no secret leak. Bad password → uniform "Email hoặc mật khẩu không đúng" (no enumeration). |
| Break-glass doc | static + used | **PASS** — `docs/ops/admin-break-glass.md` exists; its reset-TOTP CLI was exercised successfully during this run. |

## Terminal sweep (Sonnet agent + serial re-runs)
- `pnpm tsc --noEmit`: **0 errors** (serial, after clearing stale `.next/dev/types` — the ~280 errors first seen were torn dev-artifact writes from running tsc concurrently with the live dev server, NOT source errors).
- `pnpm lint`: **0 errors** (43 pre-existing warnings in tests/`scripts/smoke/**`).
- `pnpm test` (unit regression): **1614/1614 pass** — 5 initial "failures" were CPU-contention **timeouts** (ticketPdf / generateTicketPdfs / retentionSweeper — none in the admin diff) under 6 concurrent Node procs; **all 11 pass when re-run in isolation** (2.07s). Confirmed flake, not regression.
- Targeted admin-auth units (`totp`, `adminTotp`, `adminAuthService`, login route, totp-verify route): **38/38 pass**.

## Browser flow (Playwright MCP) — chronological
1. Cold first login POST → 404 masking a Prisma connection-timeout (Next **dev** compiles the route ~3.1s, starving the pg 3s connect budget — env artifact, not a fix defect). Resolved by warming routes on the restarted server.
2. Warm login: password 200 → TOTP step → live code (from backend `generateTotp`) → `/admin` console renders.
3. Account menu: email + role + logout item all present.
4. Logout → `/admin/login`; `/admin` re-nav bounces to login.
5. Break-glass TOTP reset → login → 409 → `/admin/enroll-totp` → secret shown → confirm → `/admin`.
6. Bad-password + bad-TOTP attempts for audit coverage.
- Console errors observed were all benign: the pre-warm 404, the by-design 409 (enrollment_required), and `webpack-hmr` WS reconnect noise from the mid-session dev restart. Network: `login 200 · verify 409 · enroll 200 · confirm 200`.

## Chrome DevTools MCP (independent pass)
`/admin/enroll-totp` (unauthenticated context): console = **0 errors/warns/issues**; network = page 200 → `/enroll` 401 → `/admin/login` 200 (graceful). No `cspviolationreport`.

## Monitoring
Restarted dev server pino stdout during the authenticated session: **zero `level:40/50` lines, zero prisma errors, zero connection-timeouts** (the timeouts were only on the pre-warm first server).

## Environment notes (not fix defects)
- Next **dev** compile starves the `connectionTimeoutMillis: 3000` pg handshake on a route's first hit → warm routes (or use a prod build) before browser testing.
- Running heavy commands concurrently with the live dev server corrupts `.next/dev/types` (tsc noise) and starves test timeouts — validate serially.
