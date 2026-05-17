---
name: type-safety-audit
description: Scan for type-system escape hatches — `any`/`as`/`@ts-ignore`/`!` non-null (TS), `Any`/`# type: ignore` (Python typed), `interface{}` (Go) — and rank by blast radius. Read-only audit. Skip-when language is dynamic-only. Writes `docs/qa/type-safety-<date>.md`. Use when user says "type audit", "find any types", "find ts-ignore", "type debt", "/type-safety-audit", before a release, or after onboarding a contractor.
---

# /type-safety-audit — Escape Hatch Hunt

Invoke as `/type-safety-audit`. Counts and ranks every type-system bypass in the repo so they can be re-typed or justified.

---

## Why you'd care

Every `any`, `as`, or `@ts-ignore` is a place the compiler stopped helping you — and they cluster around exactly the surfaces where bugs are most expensive. An audit ranked by blast radius is how you spend the cleanup hours where they pay back.

## Pre-flight

1. Read `docs/stack/profile.md` for Language.
2. If language has no static typing (raw JS, raw Python without hints, Ruby, etc.) → halt with note: "no type system to audit; consider migrating to TS/typed Python first".
3. If repo has zero source files → halt.

---

## Inputs

- Project root
- Language from stack profile
- Optional `--strict` flag bumps every finding +1 severity

---

## Pattern table

| Lang   | Pattern                          | Severity | Notes                                                       |
|--------|----------------------------------|----------|-------------------------------------------------------------|
| TS     | `: any` annotation               | HIGH     | Loud admission                                              |
| TS     | `as ` cast                       | MED      | Often safe; flag wide casts only                            |
| TS     | `as unknown as `                 | HIGH     | Double-cast = lying twice                                   |
| TS     | `@ts-ignore` / `@ts-expect-error`| HIGH     | Suppression — needs justifying comment                      |
| TS     | non-null `!.` postfix            | MED      | Runtime crash risk if assumption wrong                      |
| TS     | `Function` / `Object` types      | MED      | Too-wide built-ins                                          |
| TS     | `// eslint-disable` for type rule| HIGH     | Lint-level suppression                                      |
| Python | `Any` import / annotation        | HIGH     |                                                             |
| Python | `# type: ignore`                 | HIGH     |                                                             |
| Python | `cast(X, value)`                 | MED      |                                                             |
| Python | missing annotations on public API| MED      | counted only with mypy strict                               |
| Go     | `interface{}` (or `any` in Go 1.18+) | MED  | Idiomatic in some places; flag in struct fields specifically |
| Go     | type assertion w/o ok form: `x.(T)` | HIGH  | Panics on mismatch                                           |

---

## Blast-radius score

Per finding, score 1–5:
- Source: production code (5) > server entry (4) > library (3) > internal helper (2) > test (1)
- Reach: exported (×2), local (×1)
- Coverage: untested (×2), tested (×1)

Final = severity × source × reach × coverage. Sort descending.

---

## Workflow

1. Grep patterns per language (use `Grep` tool).
2. For each hit, capture: file, line, surrounding 3 lines, exported-or-local, has-justifying-comment.
3. Compute blast-radius score.
4. Group by file. Highlight top 10 hottest files.
5. Compare against prior `docs/qa/type-safety-*.md` if present — show delta (added / removed since last run).

---

## Output template

Write to `docs/qa/type-safety-<YYYY-MM-DD>.md`:

```markdown
# Type Safety Audit — <YYYY-MM-DD>

**Lang: <ts|py|go>** | **Project: <root>**

## Summary

| Pattern | Count | HIGH | MED | LOW |
|---------|------:|-----:|----:|----:|
| `any`   |   N   |   N  |  N  |  -  |
| `as`    |   N   |   -  |  N  |  -  |
| `@ts-ignore` | N |   N  |  -  |  -  |
| ...     |       |      |     |     |
| **Total**| N |  N | N | N |

## Delta vs <prior-date>

- Added: N
- Removed: N
- Net: <±N>

## Top 10 hottest files

| Rank | File | Findings | Top severity | Score |
|------|------|---------:|--------------|------:|
| 1    | ...  | N        | HIGH         | NN    |

## P1 — fix soon (HIGH severity, in prod code, exported, untested)

| File:line | Pattern | Snippet | Suggested fix |
|-----------|---------|---------|----------------|
| ...       | `any`   | `fn(x: any)` | narrow to `<T>` or union |

## P2 — review (MED in prod, or HIGH but tested)

...

## P3 — accept (in tests, well-justified, isolated)

...

## Next

- Fix top-of-P1 file first.
- Re-run after fixes; expect delta < 0.
```

---

## Per-language deep dives

### Rust type-safety audit

- `#[allow(...)]` survey — list every attribute. Especially `dead_code` (hides unused exports) and `clippy::*` (silences lints). Each needs comment justification.
- `unsafe` block inventory — file:line + invariant comment. Rule: no `unsafe` without `// SAFETY:` doc proving soundness.
- Enforce `#![deny(unsafe_code)]` at crate root unless crate is explicitly FFI/perf-critical. Flag crates missing this attribute.
- `as` casts — especially `as u8`/`as u32` (silent truncation), `as *const`/`as *mut` (pointer laundering). Prefer `TryFrom`/`u8::try_from`.
- `unwrap()` / `expect()` count per file. `expect("reason")` with reason = MED. Bare `unwrap()` in non-test code = HIGH.

### Python type-safety audit

- `# type: ignore[...]` survey — categorize by error code (`[attr-defined]`, `[arg-type]`, `[no-untyped-call]`, etc.). Bare `# type: ignore` = HIGH (no code = lazy).
- `cast(X, value)` call survey — file:line. Each needs comment explaining why the type checker is wrong.
- `Any` usage in annotations — explicit `Any` import vs implicit (missing annotation under strict). Both HIGH.
- mypy/pyright strict-mode coverage by module — list modules NOT under strict (`[mypy-*]` overrides, `# pyright: basic`). Target = 100% strict.
- Protocol vs ABC mismatch — Protocol subclasses declared as ABC inheritors, or ABCs used where structural typing intended. MED.

### TypeScript: unknown cast detection

- `as unknown as T` double-cast survey — almost always a smell. The author admitted the direct cast was rejected and went around the type system. HIGH; each requires justifying comment or removal.
- `as T` direct cast vs type guard — prefer `is T` predicate functions over `as T`. Flag `as T` where a `typeof`/`in`/`instanceof` guard would work.
- `// @ts-expect-error` triage — see next section.

### Justified-vs-TODO `@ts-expect-error` triage

Every escape hatch (`@ts-expect-error`, `@ts-ignore`, `eslint-disable`, `# type: ignore`, `#[allow]`, `unsafe`) must have one of:

- (a) link to upstream issue (`// @ts-expect-error — DefinitelyTyped#12345`),
- (b) commented invariant proving safety (`// SAFETY: caller validated non-null at L42`),
- (c) explicit TODO with owner + date (`// TODO(alice 2026-06-01): remove after lib v3 ships`).

Anything else = bug. Audit must list bare suppressions under P1 with fix = "remove or annotate".

### Error-rate cross-ref

Zip audit output against error-tracker hotspots (Sentry, Honeybadger, Rollbar, Datadog Errors):

1. Export top-N files by error event count from tracker (last 30d).
2. Inner-join against audit's per-file finding count.
3. Files with HIGH `any`/cast/unsafe count AND HIGH error rate = priority queue. These are where escape hatches are already causing prod pain.
4. Output extra table `## Priority queue (audit × error-tracker)` with columns: file, findings, error events, suggested order.

If no error tracker configured, skip section and note `error-tracker: none configured`.

---

## Auto-chain

- Flagged `any` / `# type: ignore` / `unsafe` block has no test exercising the path → auto-fire `/coverage-map` to confirm, then `/tdd` to add a regression test before tightening the type.

## When to re-run

- Before a release.
- After merging a feature branch.
- Monthly hygiene pass.
- After onboarding a new contributor (catch drift early).
