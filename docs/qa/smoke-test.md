# Smoke test (GL-005)

Post-deploy liveness check. Hits the key **unauthenticated** public surfaces and fails non-zero on any
regression, so it can gate a deploy or run in CI right after promotion. It never books or mutates —
safe against production.

## Run

```bash
scripts/smoke-test.sh                         # production (https://lenxevn.com)
scripts/smoke-test.sh https://<preview>.vercel.app
```

## What it checks

| Surface | Expect | Why |
|---------|--------|-----|
| `GET /api/health` | 200 + `"status":"ok"` | Liveness (also the UptimeRobot target) — DB/app reachable |
| `GET /` | 200 | Homepage renders (not a 500) |
| `GET /routes` | 200 | Public catalog browse renders |
| `GET /api/geo` | 200 | API layer up (cached reference endpoint) |
| `GET /op/login` | 200 | Operator auth entry renders |
| `GET /admin/login` | 200 | Admin auth entry renders |

Authenticated / mutating flows (booking, hold, payment, operator console) are covered by `e2e/`
(Playwright), not here — this stays read-only so it is safe to fire on every production deploy.

## Baseline
- 2026-08-11 · `https://lenxevn.com` · all 6 checks **PASS**.

## Wiring (optional)
Add as a required post-deploy step (GitHub Actions, after Vercel promotion) or run manually after each
prod deploy. Non-zero exit = failed smoke → investigate before announcing the deploy.
