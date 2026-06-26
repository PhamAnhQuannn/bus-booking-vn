CODE REVIEW — PR #115 "chore(deploy): add staging compose, nginx config, cron sidecar" @ e9884b2f
────────────────────────────────
Diff scope: 7 files, +231 / -7 lines

PRIORITY 1 — Block push, fix first:
  (none)

PRIORITY 2 — Fix before merge:
  (none)

PRIORITY 3 — Address when convenient:
  [HYGIENE / TEMPLATE] deploy/nginx/busmap.conf:8
    `listen 443 ssl http2;` — the `http2` parameter on `listen` is deprecated
    in nginx 1.25.1+. Use `http2 on;` as a separate directive.
    Not blocking — depends on target nginx version.

  [HYGIENE / TEMPLATE] deploy/nginx/busmap.conf
    No `client_max_body_size` directive — defaults to 1MB. If the app
    handles file uploads, requests > 1MB will be rejected at nginx.
    Fix: add `client_max_body_size 10m;` (or appropriate limit) in each server block.

  [HYGIENE / DEFENSE-IN-DEPTH] deploy/nginx/busmap.conf
    No HSTS header (`Strict-Transport-Security`). Cloudflare handles it when
    fronted, but if origin is accessed directly, no HSTS.
    Fix: `add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;`

VERIFICATION:
  ✓ All 11 cron endpoints referenced in crontab exist as route handlers
  ✓ Staging network `internal: true` matches existing prod compose pattern
  ✓ No secrets in diff — all credentials via env var substitution
  ✓ Cron `/api/cron/` path restricted in nginx to localhost + Docker ranges
  ✓ No app logic changes — comment updates only in env.ts / prisma.config.ts

SUMMARY: 0 P1, 0 P2, 3 P3

RECOMMENDED NEXT STEPS:
  → No blockers. Safe to merge.
  → P3 nginx tweaks can ride a future infra-hardening pass.
