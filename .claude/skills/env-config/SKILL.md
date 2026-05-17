---
name: env-config
description: Build the env-var × environment matrix and the `.env.example` template the repo is missing. One row per env var, columns for dev / staging / prod, marking which are secret (rotated by `/secrets-rotation`) vs config (safe to commit defaults), required vs optional, plus the failure mode if absent. Use when user says "env config", "env vars", "dotenv", "env matrix", ".env.example", "config defaults", "/env-config", or before any M/L/XL `planned`-stage exit or first deploy.
output_size:
  XS: skip
  S:  30m
  M:  1h
  L:  2h
  XL: 3h
---

# /env-config — env-var × environment matrix + .env.example

Invoke as `/env-config`. Walk the code for env reads, group them, decide per-env values, document, generate template.

## Why you'd care

Three failure shapes hide in undocumented env config:

- **Boot-fail in prod** — code reads `process.env.STRIPE_WEBHOOK_SECRET` with no fallback; staging had it; prod doesn't; deploy boots, first webhook crashes the worker.
- **Silent prod-on-staging** — `SENDGRID_API_KEY` accidentally points at the live tenant from a dev shell; `/prod-smoke` looks fine because reads work; the actual send goes to real customers.
- **Secret in repo** — `.env` got committed; a fresh contributor reads the README and pulls a live DB password from history. Audit hit.

The matrix forces every env var to declare which env owns it, what happens if absent, and whether it's a secret or a config default. `.env.example` is the template that catches the missing var at `pnpm dev` boot, not at 2 a.m.

## Pre-flight

1. Read `docs/classify/<project>.md`.
   - XS / S → SKIP (single-env hobby projects use one `.env`; over-engineering).
   - M / L / XL → run.
2. Read `docs/inception/pii-inventory-*.md` if present — PII-handling env vars get special review (encryption keys, signing secrets).
3. Read `docs/ops/secrets-rotation.md` if present — secrets listed there are pre-classified; cross-check.
4. Check git history: `git log --all -p -- .env` should return nothing. If `.env` ever shipped, flag P0 and chain to `/secrets-rotation` immediately.

## Inputs

- Codebase (greps for `process.env.X` / `import.meta.env.X` / `os.environ["X"]` / `ENV["X"]`).
- Existing `.env*` files (do not commit; read locally to learn).
- Deploy target (Vercel / Fly / Render / AWS) — defines the env-var UI / secret-store mechanism.
- Stage list (default: `dev`, `staging`, `prod`; some projects also have `ci` / `preview`).

## Process

1. **Harvest reads.** Grep the codebase for every env-var read. Capture file:line for each. Deduplicate by name.
2. **Classify each var** as one of:
   - **secret** (rotatable, never logged, never default; e.g. `*_KEY`, `*_SECRET`, `*_TOKEN`, `*_PASSWORD`).
   - **config** (non-sensitive, has a sensible default; e.g. `LOG_LEVEL`, `PORT`, `FEATURE_X_ON`).
   - **identifier** (per-env URL or ID; not sensitive but environment-specific; e.g. `DATABASE_URL` host portion, `NEXT_PUBLIC_APP_URL`).
3. **Decide required vs optional** per var. Required = the code crashes or misbehaves at boot if absent. Optional = code has a documented fallback.
4. **Assign per-env value (or placeholder).** For secrets → placeholder `__set_in_<env>_secrets_store__`. For config → actual default. For identifiers → per-env URL.
5. **Generate `.env.example`** — every var listed, secrets blanked, config defaulted, comments per group.
6. **Write `docs/ops/env-config.md`** — the matrix + per-var description + failure-mode-if-missing.
7. **Add `.env*` to `.gitignore`** (verify; if `.env` is already tracked, generate the rm-from-history command but do not run it — that's an `/secrets-rotation` decision).

## Output Format

`docs/ops/env-config.md`:

```markdown
# Env-config matrix — <project>
**Generated:** <YYYY-MM-DD> · **Vars:** <N> · **Deploy target:** <vercel|fly|render|aws|...>

## Matrix
| Var                       | Class      | Req | Dev                       | Staging                       | Prod                          | If missing                       | Read at                         |
|---------------------------|------------|----:|---------------------------|-------------------------------|-------------------------------|----------------------------------|---------------------------------|
| DATABASE_URL              | identifier | Y   | postgres://localhost/app  | (staging secret store)        | (prod secret store)           | boot crash                       | src/db/client.ts:4              |
| STRIPE_SECRET_KEY         | secret     | Y   | sk_test_xxx (local only)  | (staging secret store)        | (prod secret store)           | webhook 500                      | src/payments/stripe.ts:11       |
| STRIPE_WEBHOOK_SECRET     | secret     | Y   | whsec_xxx (local only)    | (staging secret store)        | (prod secret store)           | webhook signature reject         | src/payments/webhook.ts:18      |
| LOG_LEVEL                 | config     | N   | debug                     | info                          | warn                          | defaults to "info"               | src/log.ts:3                    |
| NEXT_PUBLIC_APP_URL       | identifier | Y   | http://localhost:3000     | https://staging.example.com   | https://app.example.com       | absolute-URL helpers return ""    | src/lib/url.ts:2                |
| FEATURE_REFUNDS_ON        | config     | N   | true                      | true                          | false (gradual rollout)       | defaults to false                | src/features.ts:7               |

## Secret-store mapping
- **Vercel**: Project Settings → Environment Variables (Production / Preview / Development scopes).
- **Local**: `.env.local` (gitignored). Never commit.

## Per-var notes
### STRIPE_WEBHOOK_SECRET
Stripe-issued; rotates via Stripe dashboard. Update in `/secrets-rotation` quarterly. Different value per Stripe account → staging and prod must use different Stripe accounts (test mode vs live mode).

### FEATURE_REFUNDS_ON
Gradual-rollout flag. Default false in prod. Flip true once `/dr-drill` confirms refund flow rollback path works.

## .env.example
See `.env.example` at repo root.
```

`.env.example` at repo root:

```bash
# ---- Required ----
DATABASE_URL=postgres://user:password@localhost:5432/app
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ---- Secrets (do not commit real values) ----
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# ---- Config (defaults shown) ----
LOG_LEVEL=info
FEATURE_REFUNDS_ON=false
```

## Verification

- Every `process.env.X` (or equivalent) in source has a row in the matrix.
- Every secret row in the matrix has a blank value in `.env.example` (grep: no `=sk_` / `=whsec_` / etc.).
- `.gitignore` contains `.env`, `.env.local`, `.env.*.local`.
- `git log --all --full-history -- .env` returns nothing (or P0 → `/secrets-rotation`).
- A fresh `cp .env.example .env.local` + `pnpm dev` boots without an env-related crash for required vars marked Y after the developer fills them in.

## Cross-skill references

- **Upstream:** `/data-model-design` (DATABASE_URL surfaces), `/api-contract` (third-party API keys surface), `/auth-flow-design` (auth secrets surface), `/pii-inventory` (encryption-key secrets).
- **Downstream:** `/secrets-rotation` (manages the secret-class rows), `/launch-checklist` (verifies `.env.example` exists), `/prod-smoke` (uses the prod URL), `/incident-runbook` (rotates compromised secrets).

## When to re-run

- After every new third-party integration (Stripe, Sendgrid, OIDC provider, observability vendor).
- Before any first-deploy.
- Before every new env (adding `preview` or `ci` to the existing dev/staging/prod).
- Quarterly during mature stage (drift check — vars that got removed from code but linger in the env-var UI).
- After any `/secrets-rotation` pass (re-sync the matrix with rotated values).
