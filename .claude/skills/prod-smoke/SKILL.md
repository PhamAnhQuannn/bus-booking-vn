---
name: prod-smoke
description: Run a read-only / canary smoke pass against the production URL after a deploy. Walks a fixed set of safe golden paths (home, login, primary read endpoint, billing portal-view, health endpoint) without writing data, captures status / latency / screenshots, and emits `docs/qa/prod-smoke-YYYYMMDD.md`. Distinct from `/smoke-test` (which runs against the dev server). Use when user says "prod smoke", "production smoke", "post-deploy check", "smoke prod", "/prod-smoke", or immediately after any L/XL prod deploy.
output_size:
  XS: skip
  S:  skip
  M:  30m
  L:  1h
  XL: 2h
---

# /prod-smoke — read-only canary against production

Invoke as `/prod-smoke`. Hit prod URLs the user lists. Do not write. Time it. Screenshot it. Log it.

## Why you'd care

Dev-server smoke proves the code compiles and the happy path renders against fixtures. Prod smoke proves the deploy actually reached prod, the prod DB / prod cache / prod secrets / prod CDN are wired, and a real user with a real session can complete a read. Three failures hide until prod smoke fires:

- **Env drift** — staging has `FEATURE_X=on`; prod has `FEATURE_X=unset`. Code branches differently. Tests passed against staging.
- **DNS / CDN cache** — new build deployed to origin, edge still serves the previous version for 5–60 minutes. `/health` says new, `/` says old.
- **Auth-provider sandbox vs live** — login worked on staging because it used the test-mode OIDC tenant; prod uses the live tenant and the new redirect URI was never whitelisted there.

The pass is intentionally **read-only**. Writing to prod from a smoke pass creates test orders, test refunds, test emails — drag on the support queue and noise in the analytics.

## Pre-flight

1. Read `docs/classify/<project>.md`.
   - XS / S → SKIP (single-user hobby projects don't need a separate prod smoke; `/smoke-test` against the deployed URL is enough).
   - M / L / XL → run.
2. Read `CLAUDE.md` `## Prod smoke paths` block if present. Otherwise prompt user for prod URL + 3–5 read-only golden paths.
3. Confirm a deploy actually shipped within the last 30 min (check `vercel ls` / `gh run list` / release tag). A prod smoke without a recent deploy is a synthetic monitor — different cadence skill.
4. Confirm one of: a real smoke-account login, a magic-link, or a public unauthenticated path. **Never** smoke prod with a real customer's credentials.

## Inputs

- Prod base URL (e.g. `https://app.example.com`).
- 3–5 golden-path URLs that are safe to GET. Examples: `/` (home), `/pricing`, `/login`, `/api/health`, `/dashboard` (after login), `/billing` (view-only).
- Optional smoke-account credentials (stored in `.env.smoke` or a secrets manager — never in repo).
- Expected status codes per path (default 200; document the 30x / 401 / 302 paths explicitly).
- Latency budget per path (from `docs/nfr.md` if present; default p95 ≤ 2s for HTML, ≤ 500ms for API).

## Process

1. **Boundary check.** Confirm the URL is prod and not staging by hostname. Refuse to run against `localhost` (use `/smoke-test` instead).
2. **Health endpoint first.** GET `/api/health` (or equivalent). Must return 200 with the new build's commit SHA. If it returns the previous build's SHA, deploy hasn't fully propagated — wait 60s and retry once, then abort with "deploy still propagating" if it stays stale.
3. **Walk each golden path.** Headless Chromium (Playwright MCP if available) or `curl -w` for API paths. Record status, response time, response size, presence of expected DOM markers (e.g. `<main>`, no `<div class="error-boundary">`).
4. **Screenshot at each path.** Save to `docs/qa/prod-smoke-YYYYMMDD/<path-slug>.png`.
5. **No writes.** If a golden path requires a POST to function (e.g. login), use the smoke account. Never POST to `/checkout`, `/refund`, `/delete`, `/cancel`, `/admin/*`.
6. **Compare to baseline.** If a previous run exists, diff status + latency + DOM markers; flag any regression.
7. **Write** `docs/qa/prod-smoke-YYYYMMDD.md` + screenshots.

## Output Format

```markdown
# Prod smoke — <project> — <YYYY-MM-DD HH:MM TZ>
**Build SHA:** <git-sha> · **Deploy id:** <vercel-deploy-id> · **Driver:** <name>
**Base URL:** https://app.example.com

## Results
| Path                  | Method | Expected | Got | Latency | Verdict |
|-----------------------|--------|---------:|----:|--------:|---------|
| /api/health           | GET    | 200      | 200 | 84ms    | PASS    |
| /                     | GET    | 200      | 200 | 412ms   | PASS    |
| /pricing              | GET    | 200      | 200 | 380ms   | PASS    |
| /login                | GET    | 200      | 200 | 290ms   | PASS    |
| /dashboard (auth)     | GET    | 200      | 200 | 1.1s    | PASS    |
| /billing (auth, view) | GET    | 200      | 500 | 220ms   | FAIL    |

## Diff vs previous run (2026-05-13 17:30)
- /dashboard latency 720ms → 1.1s (+53%) — over budget if budget ≤1s
- /billing 200 → 500 — new regression

## Screenshots
- docs/qa/prod-smoke-20260515/home.png
- docs/qa/prod-smoke-20260515/pricing.png
- docs/qa/prod-smoke-20260515/billing-error.png

## Verdict: FAIL — /billing 500
Recommended action: open `/deploy-health-gate` window OR `/rollback-plan` if regression confirmed in next 5 min.
```

## Verification

- Build SHA in the report matches the SHA `/api/health` returned.
- No POST / PUT / DELETE in the request log. (grep the run trace.)
- Every FAIL row has a recommended action (rollback, hold, investigate).
- Screenshots saved at the named paths; report links resolve.

## Cross-skill references

- **Upstream:** `/smoke-test` (dev-server equivalent), `/blue-green-deploy` / `/canary-deploy` (deploy mechanics), `/api/health` instrumentation (`/observability-design`).
- **Downstream:** `/deploy-health-gate` (continues watching for N minutes after smoke passes), `/rollback-plan` (FAIL row triggers), `/incident-runbook` (FAIL row → page on-call).

## When to re-run

- Immediately after every prod deploy (L / XL ship-block).
- After every CDN purge or DNS change.
- Hourly during a sensitive rollout window (release morning).
- Before announcing a release publicly.
