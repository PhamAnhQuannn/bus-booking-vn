---
name: dead-code-scan
description: Language-aware unused-export, unused-file, and unused-dependency scan. Uses knip/ts-prune (TS), vulture (Python), staticcheck/unused (Go). Ranks findings by blast radius. Writes report + safe-delete script. Pairs with existing `/debt-scan`. Use when user says "dead code", "unused exports", "unused deps", "what can I delete", "/dead-code-scan", before a release, or after a big refactor.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 3h
---

# /dead-code-scan — Find Safe Deletions

## Why you'd care

The unused module nobody dares delete is the one that shows up as a top-five recommendation in next quarter's security audit because it imports a CVE'd transitive dep, and the orphan export still in the build is the one a new hire grafts onto when they don't realize it was deprecated. A blast-radius-ranked dead-code report plus a safe-delete script is what turns "we'll clean it up someday" into a one-PR cleanup before the audit, and it doubles bundle-size wins on the way.

Invoke as `/dead-code-scan`. Detects orphan code so it can be cut. Read-only scan — never deletes. Emits a graded delete script the user runs manually.

---

## Pre-flight

1. Read `docs/stack/profile.md` for Language field.
2. Detect project root (look for package.json / pyproject.toml / go.mod).
3. If repo has fewer than 10 source files → tell user "too small to bother" and halt (XS class typically).

---

## Inputs

- Project root
- Stack profile language
- Optional `--entry <paths>` to seed entry points (defaults: package.json `main`/`bin`, Next.js `app/**/page.tsx` + `app/**/route.ts`, `cmd/**/main.go`, `__main__.py`)

---

## Language × tool branch

| Lang   | Tool(s)                                  | Detects                                                  |
|--------|------------------------------------------|----------------------------------------------------------|
| TS/JS  | `knip` (preferred) or `ts-prune` + `depcheck` | unused exports, unused files, unused deps, unused devDeps, unlisted deps |
| Python | `vulture` + `pip-autoremove --dry-run`   | unused functions/classes/imports, unused requirements    |
| Go     | `staticcheck` (`U1000`) + `go mod tidy --dry-run` | unused funcs/vars/types, unused modules            |
| Rust   | `cargo +nightly udeps --all-targets` + `cargo-machete` | unused crates (udeps accurate, machete fast)   |
| Other  | manual grep + report only                | best-effort                                              |

**Rust notes.** `cargo-udeps` (nightly-only) is the accurate path; `cargo-machete` is stable + ~10x faster but misses transitive cases. Pair with `#[warn(dead_code)]` lint at crate root for unused-fn signal. `pub` items are not dead even when unreferenced internally — treat as P2 (potential public API).

**Python notes.** `vulture` accepts `--min-confidence 80` to silence noise; `unimport` rewrites + reorders unused imports; `ruff F401` catches unused-import on every save. Watch for dynamic-dispatch false positives: Django ORM model managers, `@receiver`/`@app.task` decorators, `importlib.import_module`, FastAPI route registration via decorator — flag any decorated symbol as P2 minimum.

---

## Workflow

1. Install tool via dev-dep ephemeral (`npx knip`, `uvx vulture`, etc.) — do not add as long-term dep unless user opts in.
2. Run scan. Capture stdout + exit code.
3. Group findings into 3 buckets:
   - **P1 high-confidence delete** — symbol unreferenced AND not exported from package boundary
   - **P2 review needed** — exported but no in-repo caller (may be public API)
   - **P3 dep-only** — package.json/requirements/go.mod entries with zero import
4. Compute risk per item: file size, last-modified date, test coverage of the symbol.
5. Emit report + a `scripts/safe-delete.sh` (or `.ps1` on Windows) that performs the P1 deletes — but does not run it.

---

## Monorepo workspace-aware sweep

Cross-ref `/workspace-detect` for topology. If `.workspace-map.json` missing or stale, run that first.

- Scan each package independently. A symbol `export`ed from `packages/ui` may be unused inside `packages/ui` but consumed by `apps/web` — a flat scan misreports it as P1. Per-package scan with cross-package import graph reclassifies it as live.
- Distinguish **exported-but-locally-unused** (legitimate, P2/P3) from **truly unused across all consumers** (P1).
- Dead peer packages: walk pnpm/yarn workspace dep graph; any internal package with zero `dependencies`/`devDependencies` listing across the workspace is a P1 candidate package-deletion.
- Nx / Turbo: scope to `nx affected --base=origin/main` or `turbo run lint --filter=...[origin/main]` to limit scan to changed packages in CI; full sweep stays a quarterly job.
- Per-package report rolls up into a single `docs/qa/dead-code-<date>.md` with a Workspace column added to each P1/P2/P3 table.

---

## Output template

Write to `docs/qa/dead-code-<date>.md`:

```markdown
# Dead Code Scan — <YYYY-MM-DD>

**Tool: <knip|vulture|staticcheck>** | **Lang: <ts|py|go>** | **Project: <root>**

## Summary

| Bucket | Count | Bytes saved (est) |
|--------|------:|------------------:|
| P1 delete | N | NN KB |
| P2 review | N | NN KB |
| P3 deps   | N | NN KB |

## P1 — high-confidence delete

| File / symbol | Type | Last touched | Test refs | Verdict |
|---------------|------|--------------|----------:|---------|
| ...           | fn   | 2024-08-01   | 0         | DELETE  |

## P2 — review needed

| File / symbol | Reason exported | Suggested action |
|---------------|-----------------|------------------|
| ...           | public API      | confirm w/ user  |

## P3 — unused dependencies

| Package | Type | Last imported | Action            |
|---------|------|---------------|-------------------|
| ...     | dep  | 2024-05       | `pnpm remove ...` |

## Safe-delete script

Generated at `scripts/safe-delete.<sh|ps1>`. Review before running. Includes only P1 items.

## Next

- Run `/debt-scan` for complementary TODO/FIXME signal.
- Re-run after `/refactor-extract` or any large move.
```

---

## Safety rails

- Never auto-delete. Only emit script.
- Mark generated files (`*.gen.*`, `__generated__/`, `node_modules/`, build outputs) as excluded.
- Flag any symbol referenced only by tests as P2, not P1 (may be public API under test).
- Flag any symbol exported via a barrel/index file as P2.

---

## Auto-chain

- No test covers flagged symbol → fire `/coverage-map` then `/tdd` to backfill before delete.
- P1 deletions discovered → suggest `/commit-split` to group by domain before commit.
- Workspace-aware mode → invoke `/workspace-detect` first if `.workspace-map.json` is absent or stale.
- Flagged symbol marked "maybe dead" with low confidence → auto-fire `/coverage-map` first to verify no test exercises it, then `/tdd` if a test is missing-but-warranted, otherwise safe to delete.

---

## When to re-run

- Pre-release.
- After large refactor (`/refactor-extract`, file moves).
- Quarterly hygiene pass.
- After dropping a feature.
