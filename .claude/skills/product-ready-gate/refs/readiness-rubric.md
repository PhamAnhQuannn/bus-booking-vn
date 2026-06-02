# readiness-rubric — product-ready gate row definitions

READ WHEN: running `/product-ready-gate`. This is the authoritative,
row-by-row rubric the gate evaluates. The SKILL.md carries only a summary
table; the pass criteria, severity, command, and class-waiver rules live here.

---

## Verdict rule

**READY** only if zero P0 **and** zero P1 findings.
P2/P3-only → **READY-WITH-NOTES** (ship allowed; notes tracked, not blocking).
Any P0 or P1 → **BLOCKED**.

Severity scale (shared with `/edge-case-enum`):
- **P0** — would lose money/data, expose a secret, or ship a broken build. Never ship.
- **P1** — would corrupt UX or core behavior. Block.
- **P2** — degraded quality (coverage gap, lint debt). Note, don't block.
- **P3** — cosmetic. Note.

---

## Rows

### 1. Issues — `P0`
- **Check:** every file in `issues/*.md` (PRD excluded) is DONE; no open issue carries `severity: P0|P1` in frontmatter.
- **Source:** `/project-status` issue classification + `issues/*.md` frontmatter.
- **Fail:** any NOT-STARTED / IN-PROGRESS issue → P0 finding (the product isn't built). Open P0/P1 fix-issue → P0.
- **Waiver:** none.

### 2. Build — `P0`
- **Check:** project compiles. Run the stack build command (`npm run build` / `vite build` / `go build ./...` / `cargo build` / `python -m build` …), expect exit 0.
- **Fail:** non-zero exit → P0, message = first error block.
- **Waiver:** interpreted projects with no build step → mark N/A (not a finding).

### 3. Types — `P1`
- **Check:** typecheck clean. `tsc --noEmit` / `mypy` / `pyright`. Expect 0 errors.
- **Fail:** each distinct type error → P1 finding (dedupe by file+code, cap one finding per file unless errors differ).
- **Waiver:** untyped projects (no tsconfig / type checker) → N/A.

### 4. Lint — `P2`
- **Check:** linter clean, or no *new* errors vs the committed baseline. `eslint` / `ruff` / `golangci-lint` / `clippy`.
- **Fail:** new lint errors → one P2 finding summarizing count + top rules.
- **Waiver:** S class may waive (note only).

### 5. Tests — `pass: P1`, `coverage: P2`
- **Check:** full suite passes AND line coverage ≥ bar (`docs/nfr.md` value, else 70%).
- **Fail:** any failing test → P1 finding per failing test (fingerprint by test name + file). Coverage below bar → one P2 finding naming the worst-covered files.
- **Waiver:** none on the pass dimension; coverage bar waivable for S.

### 6. Security — `P0`
- **Check:** (a) no secrets committed — grep for high-entropy / known key patterns (AWS, private keys, `.env` values in tracked files); (b) no P0/P1 dependency CVE — run `/dependency-update`'s scan (`npm audit --audit-level=high` / `pip-audit` / `govulncheck` / `cargo audit`).
- **Fail:** secret in repo → P0. Critical/high CVE → P0/P1 per advisory.
- **Waiver:** none (security rows never waived; XS is skipped at the skill level instead).

### 7. Artifacts — `P2` (class-aware)
- **Check:** required release docs present. Glob:
  - `docs/release/rollback-plan-*.md` (L/XL mandatory)
  - `docs/nfr.md` (M/L/XL)
  - `docs/qa/prod-smoke-*.md` OR a deploy plan (`docs/release/{canary,blue-green}-*.md`) (L/XL)
- **Fail:** missing mandatory artifact for the class → P2 finding naming the missing doc + the skill that writes it.
- **Waiver:** XS/S → artifacts row N/A. M → only `docs/nfr.md` mandatory.

### 8. Smoke — `P1`
- **Check:** golden paths pass. Consume the latest `docs/qa/smoke-test-*` result if fresh (< 1 day) or recommend running `/smoke-test`.
- **Fail:** any golden-path failure → P1 finding per path.
- **Waiver:** headless/CLI projects with no UI → N/A.

### 9. CI — `P1`
- **Check:** latest real CI run on the gate branch concluded success.
- **Authorized** (`.understand/ci-gate.json` `allow_autopilot_push=true`): push HEAD to the dedicated non-default `gate_branch`, `gh run watch <run-id>`, read `conclusion`. Log the push to `docs/qa/ci-gate-pushes.log`.
- **Unauthorized:** local-only — record `CI: SKIPPED — no push authorization` as a **note** (not a finding). The build/types/lint/tests rows already cover most of what CI runs locally.
- **Fail (authorized):** `conclusion != success` → P1 finding quoting the failing job/step.
- **Hard refuse:** never push to the default branch; never `--force`.
- **Waiver:** no remote / no CI workflow configured → N/A with a note.

---

## Fingerprint rule

`fp = short-hash(category + "|" + check + "|" + file + "|" + normalize(message))`

`normalize()` strips line numbers, timestamps, run-ids, and absolute paths from
the message so the **same problem** yields the **same fingerprint** across gate
runs. This is what lets `/findings-to-issues` dedupe and the cycle-cap detect an
unfixable finding repeating.
