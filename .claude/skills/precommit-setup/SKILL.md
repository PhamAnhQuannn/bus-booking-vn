---
name: precommit-setup
description: Pre-commit hook suite — Husky (or lefthook/pre-commit) + lint-staged + gitleaks + formatter + linter. Outputs hook config + bypass policy to `docs/build/precommit-<repo>.md`. Reads `/project-classify`. Use when user says "pre-commit", "git hook", "husky", "lint-staged", "gitleaks", "/precommit-setup", or on any repo without local quality gate.
output_size:
  XS: 30m
  S: 30m
  M: 1h
  L: 1h
  XL: 2h
---

# /precommit-setup — Local Quality Gate

Invoke as `/precommit-setup`. CI is too late. Catch trash before it reaches `origin`.

## Why you'd care

Without a local gate, secrets leak into git history, lint failures land on main, and the CI pipeline becomes the only line of defense — slow, expensive, and embarrassing in PRs. Pre-commit catches it at the keystroke.

## Pre-flight
1. Read `docs/classify/<project>.md`. All classes apply (XS still benefits).
2. Pick runner per stack:
   - Node: Husky + lint-staged (default for JS/TS repos)
   - Polyglot/Go/Python/Rust: lefthook OR pre-commit (Python)
3. Confirm: package manager (npm/pnpm/yarn), lint+formatter chosen, test runner.

## Inputs
- Repo languages
- Existing lint/format/test commands
- Secret-scan policy (gitleaks default)

## Process

1. **Install runner**:
   - Node: `pnpm add -D husky lint-staged`; `npx husky init`
   - Polyglot: `lefthook install` or `pip install pre-commit && pre-commit install`

2. **Hook stages** — split by speed:

   | Stage | When | Targets | Max time |
   |---|---|---|---|
   | pre-commit | every commit | lint-staged, format, fast lint, gitleaks | 5s |
   | pre-push | before push | type-check, fast unit tests | 30s |
   | commit-msg | commit | conventional-commits format | <1s |

3. **lint-staged config** (Node) — only mutated files:
   ```json
   {
     "*.{ts,tsx,js,jsx}": ["prettier --write", "eslint --fix"],
     "*.{md,json,yaml}": ["prettier --write"],
     "*.{py}": ["ruff format", "ruff check --fix"]
   }
   ```

4. **gitleaks** — mandatory for any non-private repo:
   - `gitleaks protect --staged` in pre-commit
   - `.gitleaks.toml` with project allowlist (test fixtures with fake keys)

5. **Bypass policy** — `--no-verify` is escape hatch, not workflow:
   - Document when it's acceptable (broken dependency, hook bug)
   - Re-enable check in CI so bypassed commits still fail PR

6. **CI mirror** — same checks run server-side. Local hooks are convenience, not enforcement.

## Output

Write `docs/build/precommit-<repo>.md`:

```markdown
# Pre-commit Setup — <repo>
**Date:** <YYYY-MM-DD> | **Runner:** <Husky/lefthook/pre-commit>

## Hooks
| Stage | Tools | File | Time budget |
|---|---|---|---:|
| pre-commit | lint-staged, gitleaks | .husky/pre-commit | 5s |
| commit-msg | commitlint | .husky/commit-msg | 1s |
| pre-push | tsc --noEmit, vitest --run --changed | .husky/pre-push | 30s |

## lint-staged config
<paste actual config>

## gitleaks
- Config: `.gitleaks.toml`
- Allowlist rationale: <each entry justified>

## Bypass policy
- Allowed: <list cases>
- Required: bypassed commits re-checked in CI

## Onboarding
- `pnpm install` auto-runs `husky init` via `prepare` script
- Doc snippet in README under "Setup"
```

## Verification
- Hook runs on fresh `git clone && pnpm install`.
- Staged-file linting (not full repo) under 5s.
- Secret scan active.
- CI mirrors local hooks.
- Bypass cases documented.
