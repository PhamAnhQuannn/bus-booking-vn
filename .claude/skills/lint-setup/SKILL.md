---
name: lint-setup
description: One-shot lint + format + pre-commit hook configuration matched to the stack from `/stack-profile`. Emits config files (eslint/biome/ruff/golangci-lint + prettier/black/gofmt + husky/pre-commit + commitlint) and package.json scripts. Idempotent. Use when user says "set up lint", "lint config", "pre-commit hooks", "stop me from committing garbage", "/lint-setup", or before first commit on a new project.
---

# /lint-setup — Lint, Format, Pre-Commit

## Why you'd care

A repo without lint + pre-commit hooks ships bugs that any linter would have caught and burns CI cycles re-finding them at PR time. The one-shot config moves the catch left for free.

Invoke as `/lint-setup`. Lands a complete linting + formatting + pre-commit hook chain in one turn. Stack-branched. Idempotent — re-running does not duplicate config.

---

## Pre-flight

1. Read `docs/stack/profile.md`. If missing → run `/stack-profile` first, halt.
2. Check whether config files already exist (eslint.config.*, biome.json, .prettierrc, ruff.toml, .pre-commit-config.yaml, .husky/). If found → ask: keep, augment, or overwrite?
3. Class **XS** → minimal install (formatter only, no pre-commit). Ask user to confirm "is this throwaway?" before installing nothing more.

---

## Inputs

- `docs/stack/profile.md` (Lint/format + Pre-commit + Language fields)
- Class (controls strictness)
- Detected package manager (npm/pnpm/yarn/bun; pip/poetry/uv; go mod)

---

## Stack × class branch table

| Lang  | Class    | Linter           | Formatter   | Pre-commit hook                                                |
|-------|----------|------------------|-------------|----------------------------------------------------------------|
| TS/JS | XS       | none             | prettier    | none                                                            |
| TS/JS | S        | eslint:recommended | prettier  | husky + lint-staged (format only)                              |
| TS/JS | M        | eslint typescript-eslint:recommended | prettier | + commitlint + tsc --noEmit on changed files |
| TS/JS | L        | biome strict OR eslint typescript-eslint:strict | biome/prettier | + secret-scan (gitleaks) |
| TS/JS | XL       | biome strict + eslint plugin-security | biome | + license-check + SAST (semgrep)                              |
| Python| XS       | none             | black       | none                                                            |
| Python| S        | ruff             | black       | pre-commit (format only)                                        |
| Python| M+       | ruff strict + mypy --strict | black | + commitlint                                                |
| Python| XL       | + bandit (security) | black    | + secret-scan + license-check                                  |
| Go    | XS       | gofmt            | gofmt       | none                                                            |
| Go    | S+       | golangci-lint    | gofmt       | pre-commit                                                      |
| Go    | XL       | + gosec          | gofmt       | + secret-scan                                                   |

---

## Workflow

1. Detect package manager.
2. Compute config set from stack × class.
3. Print plan: "Will install <deps> and write <files>. Proceed?"
4. On confirm, in one batch:
   - Add dev deps via detected pkg manager.
   - Write each config file (overwriting only if user said overwrite).
   - Write `.husky/pre-commit` (chmod +x) or `.pre-commit-config.yaml`.
   - Inject `package.json` scripts: `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `check` (run all).
   - Write `.editorconfig` if absent.
   - Append `.gitignore` entries (`.eslintcache`, etc.) if absent.
5. Run `<pkg-mgr> install` once.
6. Run `<pkg-mgr> run lint` and `<pkg-mgr> run typecheck` smoke check. Report any failures — do not auto-fix.

---

## File templates

`eslint.config.mjs` (M, TS):

```js
import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['dist', '.next', 'node_modules'] },
  ...tseslint.configs.recommended,
);
```

`.prettierrc.json`:

```json
{ "semi": true, "singleQuote": true, "trailingComma": "all", "printWidth": 100 }
```

`.husky/pre-commit` (M, TS):

```sh
#!/usr/bin/env sh
npx lint-staged
```

`lint-staged.config.mjs`:

```js
export default {
  '*.{ts,tsx,js,jsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
};
```

`commitlint.config.cjs`:

```js
module.exports = { extends: ['@commitlint/config-conventional'] };
```

`ruff.toml` (Python, M):

```toml
line-length = 100
target-version = "py312"
[lint]
select = ["E","F","I","B","UP","SIM","TCH"]
```

`.pre-commit-config.yaml` (Python):

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.5.0
    hooks: [{id: ruff}, {id: ruff-format}]
```

`.golangci.yml` (Go, S+):

```yaml
linters:
  enable: [govet, staticcheck, errcheck, revive, gosec, gofmt]
```

---

### Per-workspace-package config negotiation

Monorepos: root `eslint.config.js` holds shared rules; each package extends it with overrides. Cross-ref `/workspace-detect` to enumerate packages.

```js
// packages/api/eslint.config.js (flat)
import root from '../../eslint.config.js';
export default [...root, { rules: { 'no-console': 'error' } }];
```

Flat-config ↔ legacy `.eslintrc` interop: use `@eslint/eslintrc` `FlatCompat` to load legacy configs from inside flat config. Do not mix both formats in same package — pick one per package.

### Biome migration path

From ESLint + Prettier → Biome. Biome subsumes both formatting and lint, but does not yet cover every ESLint plugin (`react-hooks`, `jsx-a11y` partial, `import/order` partial, security plugins absent).

Checklist:
1. `npx @biomejs/biome migrate eslint --write` and `migrate prettier --write` (dry-run first without `--write`).
2. Diff Biome output against `eslint --format json` on a sample dir. Catalog uncovered rules.
3. Keep ESLint scoped to uncovered plugins only; remove all rules Biome covers.
4. Wire both in pre-commit: `biome check --apply` then `eslint --fix` (Biome first, faster).
5. Drop Prettier entirely once Biome formatter passes diff parity.

### Rust (clippy)

`clippy.toml` for thresholds; `cargo clippy --all-targets --all-features -- -D warnings` in CI/pre-commit. Audit `#[allow(...)]` on every PR — each must carry a `// reason: <text>` adjacent comment or be rejected.

```toml
# clippy.toml
cognitive-complexity-threshold = 20
too-many-arguments-threshold = 6
```

### Kotlin (detekt)

`detekt.yml` config, baseline file (`detekt-baseline.xml`) freezes legacy violations so new code is held to current rules. Gradle plugin:

```kotlin
plugins { id("io.gitlab.arturbosch.detekt") version "1.23.6" }
detekt { config.setFrom("detekt.yml"); baseline = file("detekt-baseline.xml") }
```

Generate baseline once: `./gradlew detektBaseline`. Re-baseline only on intentional rule changes; otherwise treat new violations as failures.

### C# (.NET)

`.editorconfig` carries style (severity = `error` for must-fix). `dotnet format` enforces. Add `Microsoft.CodeAnalysis.NetAnalyzers` + `StyleCop.Analyzers` via NuGet. `Directory.Build.props` at solution root applies analyzers + warning-as-error solution-wide.

```xml
<!-- Directory.Build.props -->
<Project>
  <PropertyGroup>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
    <AnalysisLevel>latest-recommended</AnalysisLevel>
  </PropertyGroup>
</Project>
```

### Pre-commit hook actually installed?

Verifying config exists is not verifying hooks run. Cross-check:
1. `.husky/pre-commit` (or `.git/hooks/pre-commit`) file exists and is executable.
2. `lint-staged` config present (`package.json#lint-staged` or `lint-staged.config.*`).
3. Audit recent commits for `--no-verify` bypass: `git log --format='%H %s' -n 50` plus reflog scan for `commit (amend)` patterns; flag any. If team routinely bypasses, hooks are theatre — escalate.
4. For `pre-commit` framework: `pre-commit install` was actually run (check `.git/hooks/pre-commit` contains `pre-commit.com` sentinel).

### Pragma-override comment generator

Every suppression must be narrow + reasoned + traceable. Canonical shapes:

```ts
// eslint-disable-next-line <rule-id> -- <reason>: <ticket-or-link>
```

```py
x = foo()  # noqa: E501  -- legacy API, ticket PROJ-123
```

```rust
#[allow(clippy::too_many_arguments)] // reason: stable public API, ticket PROJ-456
```

Rules enforced by this skill:
- No bare `// eslint-disable-next-line` (rule id required).
- No file-wide disables (`/* eslint-disable */` with no rule) without ticket reference in same comment.
- No `// @ts-ignore` — use `// @ts-expect-error -- <reason>` so it self-removes when fixed.
- Generator emits comment with placeholders `<rule>` and `<reason>` filled from context; if reason absent, refuse to emit.

---

## Output

Side-effect = config files + `package.json` patches. After emit, write a one-line summary to `docs/ops/lint-setup-<date>.md` capturing what was added (for traceability + future audit):

```markdown
# /lint-setup run — <YYYY-MM-DD>
- Lang: <ts|py|go>
- Class: <X>
- Files: <list>
- Deps added: <list>
- Smoke: lint <pass|fail>, typecheck <pass|fail>
```

---

## When to re-run

Re-run on: class change, lang change, or "tighten linting" request. Idempotent — re-running on same class is a no-op unless overwrite confirmed.
