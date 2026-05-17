---
name: formatter-pick
description: Pick + configure formatter (Prettier vs Biome vs dprint for JS/TS; Black/Ruff for Py; gofmt for Go; rustfmt). Outputs decision rationale + config + CI gate to `docs/build/formatter-<repo>.md`. Reads `/project-classify`. Use when user says "formatter", "Prettier", "Biome", "Black", "rustfmt", "/formatter-pick", or when team argues about whitespace.
output_size:
  XS: 30m
  S: 30m
  M: 30m
  L: 30m
  XL: 30m
---

# /formatter-pick — Formatter Decision + Wire

## Why you'd care

Every minute spent arguing about whitespace or fighting auto-format on save is pure waste, and the cost compounds across the team. Pick one formatter, wire the CI gate, and the argument is over forever.

Invoke as `/formatter-pick`. Style debates are runway-burn. Pick one tool, gate in CI, never argue again.

## Pre-flight
1. Read `docs/classify/<project>.md`. All classes apply.
2. Identify languages in repo (lockfile-based: `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`).

## Inputs
- Languages
- Existing tool (if any) — keep unless concrete reason to switch
- Editor stack (VS Code, JetBrains, Neovim)

## Process

1. **Default picks** (use unless concrete reason otherwise):

   | Language | Formatter | Linter | Rationale |
   |---|---|---|---|
   | JS/TS | **Biome** (new) or **Prettier** (legacy) | Biome OR ESLint+Prettier | Biome: single tool, 10× faster. Prettier: ecosystem maturity. |
   | Python | **Ruff** (format+lint) | Ruff | Replaces Black+isort+flake8+pyupgrade |
   | Go | `gofmt` (built-in) | `golangci-lint` | Non-negotiable |
   | Rust | `rustfmt` (built-in) | `clippy` | Non-negotiable |
   | Java | `google-java-format` or `spotless` | Checkstyle/SpotBugs | — |
   | C# | `dotnet format` | Roslyn analyzers | Built-in |
   | Markdown/JSON/YAML | Prettier | — | Universal |

2. **Decision matrix** for JS/TS specifically:
   - Brand-new repo, no plugins needed → **Biome**
   - Existing Prettier + ESLint config, plugin-heavy → **stay on Prettier**, migrate to Biome on next major refactor
   - Monorepo > 100 packages → **Biome** (speed matters)

3. **Config minimalism**:
   - Take defaults. Override only when team has objective complaint (line length is the only legitimate one).
   - Forbidden: arguing about semicolons, trailing commas, quote style. Defaults end the debate.

4. **Editor integration**:
   - Save-on-format enabled per repo (`.vscode/settings.json` committed, `.editorconfig` committed)
   - JetBrains: matching config noted

5. **CI gate**:
   - Job: `format-check` runs formatter in `--check` mode (no write). Fails PR if anything would reformat.
   - Pre-commit hook also runs (see `/precommit-setup`).

6. **Migration plan** (if switching tools):
   - One PR, mechanical reformatting, no other changes
   - Add commit to `.git-blame-ignore-revs` so blame skips the reformat

## Output

Write `docs/build/formatter-<repo>.md`:

```markdown
# Formatter — <repo>
**Date:** <YYYY-MM-DD>

## Stack picks
| Lang | Tool | Config file |
|---|---|---|
| TS | Biome | biome.json |
| Python | Ruff | pyproject.toml [tool.ruff] |
| MD/YAML/JSON | Prettier | .prettierrc |

## Config overrides (justified only)
- line-length: 100 (team consensus)
- <other>: <reason>

## CI gate
- Job: `format-check`
- File: `.github/workflows/lint.yml`
- Failure mode: PR blocked

## Editor
- `.vscode/settings.json`: format-on-save enabled
- `.editorconfig`: committed

## Migration (if applicable)
- Reformatting commit: <sha>
- `.git-blame-ignore-revs` entry: yes
```

## Verification
- Single formatter per language (no overlap).
- CI gate blocks PRs.
- Editor formats on save out-of-box for new clones.
- Overrides have written rationale.
- `.git-blame-ignore-revs` exists if mass-reformat occurred.
