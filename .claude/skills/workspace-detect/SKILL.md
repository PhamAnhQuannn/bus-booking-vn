---
name: workspace-detect
description: Detect monorepo workspace topology (Nx / Turbo / pnpm-workspace / Cargo / Go-multi-module / Lerna / Bazel / yarn workspaces). Emit {root, packages[], boundary-rules, package-manager} JSON for downstream skills. Use when user says "monorepo", "workspace", "Nx", "Turbo", "pnpm workspace", "/workspace-detect", or auto-invoked by commit-split / lint-setup / dead-code-scan / consistency-audit / scaffold-feature / coverage-map / refactor-extract before they fire.
output_size:
  XS: skip
  S: 15m
  M: 30m
  L: 30m
  XL: 30m
---

# /workspace-detect — Monorepo Topology Probe

## Why you'd care

Monorepo-blind skills break cross-package boundaries: a rename in package A leaks into package B's public API, two `lint-setup` runs race on conflicting ESLint configs, `commit-split` misroutes hunks because it thinks `apps/web/auth/` and `packages/auth/` are the same domain, and `dead-code-scan` deletes "unused" exports that another package actually imports. One detect pass lifts seven downstream skills. Without it, each one re-implements topology guessing, badly.

Invoke as `/workspace-detect`. Read-only. Emits a JSON topology map either to stdout or `.workspace-map.json` at repo root.

---

## When This Skill Applies

User-facing triggers:
- "monorepo", "workspace", "Nx", "Turbo", "pnpm workspace", "yarn workspace", "Cargo workspace", "go.work"
- `/workspace-detect`
- "what packages are in this repo", "show me the topology"

Auto-invoked (sibling skill calls this first, reads the JSON, branches on `topology`):
- `/commit-split` — to route hunks per package, not per repo
- `/lint-setup` — to install root-level config vs per-package configs
- `/dead-code-scan` — to resolve cross-package imports before flagging exports
- `/consistency-audit` — to scope naming/structure rules per package
- `/scaffold-feature` — to know where new code belongs
- `/coverage-map` — to attribute untested entrypoints to the right package
- `/refactor-extract` — to know if the extract target crosses a boundary

---

## Pre-flight

1. Confirm working dir is repo root (`.git/` present). If not, walk up until found or stop.
2. Probe for any workspace manifest:
   - `pnpm-workspace.yaml` → pnpm workspace
   - `nx.json` → Nx (typically over pnpm/yarn)
   - `turbo.json` → Turborepo (typically over pnpm/yarn)
   - `lerna.json` → Lerna (legacy; often co-exists with yarn workspaces)
   - root `package.json` with `"workspaces": [...]` → yarn / npm workspaces
   - `Cargo.toml` with `[workspace]` → Cargo workspace
   - `go.work` → Go multi-module
   - `WORKSPACE` or `MODULE.bazel` → Bazel
3. If none of the above exist → emit single-package fallback and exit:

```json
{ "root": "<abs>", "packageManager": "<detected>", "topology": "single-package",
  "packages": [{ "name": "<root pkg name>", "path": ".", "deps": [] }],
  "boundaryRules": {} }
```

---

## Inputs

- **Repo root path** (default: cwd). Optional positional arg.
- **`--format json|table`** (default: `json`). `table` is for human readout; downstream skills always use `json`.
- **`--cache`** — write `.workspace-map.json` at repo root (gitignored by convention; remind user once). Downstream skills check for and prefer this file over re-detection.

---

## Process

1. **Detect package manager** via lockfile presence (in priority order, first hit wins):
   - `pnpm-lock.yaml` → `pnpm`
   - `yarn.lock` → `yarn`
   - `package-lock.json` → `npm`
   - `Cargo.lock` → `cargo`
   - `go.sum` → `go`
   - `MODULE.bazel.lock` or none of the above with Bazel files → `bazel`
2. **Parse the workspace manifest** matched in Pre-flight. Extract glob patterns (`packages/*`, `apps/*`, `members = [...]`, `use ./pkg-a`, etc.).
3. **Resolve globs to package directories.** For each match, confirm a manifest file exists (`package.json`, `Cargo.toml`, `go.mod`, `BUILD.bazel`). Skip dirs without one.
4. **Read each package's manifest** to extract: `name`, `version` (optional), and internal deps (deps whose names also appear in the package list — these are workspace-internal edges).
5. **Build the dependency graph** (`name → [internal dep names]`). Used downstream by `commit-split` for topological commit order and by `refactor-extract` to detect cycles.
6. **Extract boundary rules:**
   - **Nx:** read `tags` from each package's `project.json` plus `targetDefaults` / `nx.json` `tagsAllow` constraints.
   - **Turbo:** read `pipeline` entries — `dependsOn: ["^build"]` arrows imply build-order rules.
   - **TS path aliases:** read root `tsconfig.json` `compilerOptions.paths`.
   - **Cargo:** `members` list is the boundary; `[workspace.dependencies]` block defines shared pinning.
   - **Go:** each module in `go.work` is its own boundary; no cross-module deep imports.
7. **Emit JSON** (shape below). With `--cache`, also write `.workspace-map.json`.

---

## Output Format

```json
{
  "root": "/abs/path/to/repo",
  "packageManager": "pnpm",
  "topology": "turbo",
  "packages": [
    { "name": "@org/web",    "path": "apps/web",       "deps": ["@org/ui", "@org/shared"] },
    { "name": "@org/api",    "path": "apps/api",       "deps": ["@org/shared", "@org/db"] },
    { "name": "@org/ui",     "path": "packages/ui",    "deps": ["@org/shared"] },
    { "name": "@org/shared", "path": "packages/shared","deps": [] },
    { "name": "@org/db",     "path": "packages/db",    "deps": ["@org/shared"] }
  ],
  "boundaryRules": {
    "tagsAllow": { "scope:app": ["scope:lib"], "scope:lib": ["scope:lib"] },
    "pathAliases": { "@org/ui": "packages/ui/src", "@org/shared": "packages/shared/src" },
    "buildOrder": ["@org/shared", "@org/db", "@org/ui", "@org/api", "@org/web"]
  }
}
```

### Worked examples (three verticals)

**1. SaaS web app — Turborepo + pnpm**
```
root/
  pnpm-workspace.yaml      → packages: ["apps/*", "packages/*"]
  turbo.json               → pipeline.build.dependsOn: ["^build"]
  apps/web/package.json    → name: "@org/web",   deps: ["@org/ui", "@org/shared"]
  apps/api/package.json    → name: "@org/api",   deps: ["@org/shared", "@org/db"]
  packages/ui/package.json → name: "@org/ui",    deps: ["@org/shared"]
```
→ topology: `turbo`, 5 packages, buildOrder threads `shared` → `db`/`ui` → `api`/`web`.

**2. Multi-service backend — Cargo workspace**
```
root/
  Cargo.toml               → [workspace] members = ["crates/api", "crates/worker", "crates/shared"]
  crates/api/Cargo.toml    → name = "api",    [dependencies] shared = { path = "../shared" }
  crates/worker/Cargo.toml → name = "worker", [dependencies] shared = { path = "../shared" }
  crates/shared/Cargo.toml → name = "shared", [dependencies] (none internal)
```
→ topology: `cargo-workspace`, 3 packages, no tag system → `boundaryRules.tagsAllow` empty.

**3. Polyglot platform — Go multi-module**
```
root/
  go.work                  → use ( ./services/gateway ./services/billing ./libs/proto )
  services/gateway/go.mod  → module github.com/org/gateway; require github.com/org/proto v0.0.0
  services/billing/go.mod  → module github.com/org/billing; require github.com/org/proto v0.0.0
  libs/proto/go.mod        → module github.com/org/proto
```
→ topology: `go-multi-module`, 3 packages. Note: Go modules don't have a tag system; boundary enforcement is by import path only.

---

## Boundaries

- **Read-only.** Never modifies workspace manifests, lockfiles, or package configs.
- **Doesn't enforce** boundary rules — that's `consistency-audit`'s job (which reads this skill's output).
- **Doesn't create** new packages — that's `scaffold-feature` (which also reads this output to know where to put them).
- **Doesn't resolve external deps.** Only internal workspace edges. External npm/crates.io/pkg.go.dev resolution is out of scope.
- **Doesn't run package-manager commands.** No `pnpm install`, no `cargo metadata`. Pure file parse — fast (<1s on 50-package repos) and offline.

---

## Re-run Behavior

- Re-running with `--cache` refreshes `.workspace-map.json`. Add it to `.gitignore` (skill will print a one-time reminder if absent).
- Downstream skills detect stale cache via mtime: if any workspace manifest (`pnpm-workspace.yaml`, `nx.json`, `turbo.json`, `Cargo.toml`, `go.work`, root `package.json`) has mtime newer than `.workspace-map.json`, they re-invoke `/workspace-detect` automatically.
- Re-run manually after: adding/removing a package, renaming a package, changing `tags` (Nx), changing `pipeline` (Turbo), or migrating package manager.

---

## Auto-chain

This skill is a **prerequisite** for the seven downstream skills listed at the top. Each of them will:

1. Check for `.workspace-map.json` at repo root.
2. If present and fresh → use it.
3. If absent or stale → fire `/workspace-detect --cache` first, then proceed.

You generally don't run this skill standalone. Run it explicitly only when: debugging a topology mismatch, onboarding to an unfamiliar repo, or after a workspace manifest change you want reflected immediately.

---

## Example Trigger

> **User:** "set up lint config for our Nx monorepo"

Flow:
1. `/lint-setup` starts, checks for `.workspace-map.json` — not found.
2. `/lint-setup` auto-invokes `/workspace-detect --cache`.
3. `/workspace-detect` emits topology: `nx`, 12 packages, `tagsAllow` rules from `nx.json`.
4. `/lint-setup` reads the JSON, sees `topology: "nx"` → installs root `eslint.config.js` with `@nx/eslint-plugin` boundary rules wired from `tagsAllow`, skips per-package configs.
5. Without this skill, `/lint-setup` would have installed a flat repo-wide config that ignores Nx's boundary system entirely.
