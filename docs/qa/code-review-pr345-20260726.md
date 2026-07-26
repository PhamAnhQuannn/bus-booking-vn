CODE REVIEW — PR #345 "fix(lint): make import-x/no-cycle gate actually detect cycles (#333)" @ d6603e5b
────────────────────────────────
Diff scope: 2 files, +27 / -8 lines (`eslint.config.mjs`, `CLAUDE.md`)
Base: `master` · Head: `fix/333-no-cycle-resolver` @ `d6603e5bd535ceb48cf134be42b572e8ac8b884e`
Mode: PR (standalone — no auto-comment)

## Empirical verification performed (read-only)

The core claim of this PR is behavioural, so it was verified by execution rather than by reading the diff.

| Probe | master | PR #345 |
|---|---|---|
| `npx eslint .` exit code | 0 | 0 |
| `import-x/no-cycle` findings | **0** (rule at `error`) | **11** (rule at `warn`) |
| Total errors / warnings | 0 / 43 | 0 / 54 |
| Injected 2-file cycle under `lib/catalog/__cyctest` | **silent** (0 messages) | **fires** — `import-x/no-cycle :: Dependency cycle detected` on both files |
| `boundaries/entry-point` probe (cross-domain deep import) | fires (sev 2) | fires (sev 2) |
| `npx eslint .` wall time | 34.8 s | 46.6 s |

Conclusions:
1. **The gate was genuinely vacuous on master** — rule active at `error`, zero output, and an injected cycle produced nothing. #333 is confirmed, not theoretical.
2. **The fix genuinely works** — the injected cycle now reports, and the 11 surfaced cycles match issue #343's claim exactly (booking / payment / ledger). This is a real fix, not a re-skin.
3. **No collateral damage to the sibling barrel rule** — removing the legacy `import-x/resolver` object form did not weaken `boundaries/entry-point`; it still fires identically on both branches. (This was the main regression risk of the resolver swap, since `eslint-plugin-boundaries` also resolves specifiers.)
4. All 11 findings are `severity: 1` and total errors stay at 0, so **CI will not break for the other 8 open PRs** (#344, #346, #347, #355, #356, #357, #358, #301). Blast radius on the merge train is nil.

Probe files were removed and the branch restored to `master`; the working tree is unmodified.

---

PRIORITY 1 — Block push, fix first:

  [CORRECTNESS / GATE INTEGRITY] eslint.config.mjs:176
    `"import-x/no-cycle": ["warn", ...]` combined with a bare `eslint` lint
    script means the gate **detects but never blocks**. `package.json:9` is
    `"lint": "eslint"` with no `--max-warnings`; CI (`.github/workflows/ci.yml:43`)
    and the pre-commit hook both run `pnpm lint`, and warnings do not affect the
    exit code — verified: the PR branch emits 11 cycle warnings and still exits 0.

    Net enforcement before this PR: zero (rule was `error` but blind).
    Net enforcement after this PR: still zero (rule sees, but cannot fail a build).

    The PR therefore fixes *detection* but not *enforcement*, while the config
    comment and CLAUDE.md both read as though the gate is now operational. For the
    duration of #343 — unbounded — any of the 8 queued PRs can introduce cycle #12
    and land it green. That is the same end-state #333 describes, reached by a
    different mechanism.

    Fix (preserves a real ratchet without requiring the #343 burn-down first):
    keep `no-cycle` at `error` globally and add a scoped override demoting ONLY the
    three domains that legitimately cycle today —

        { files: ["lib/booking/**", "lib/payment/**", "lib/ledger/**"],
          rules: { "import-x/no-cycle": ["warn", { maxDepth: Infinity, ignoreExternal: true }] } }

    New cycles anywhere else then hard-fail, and #343 shrinks the override until it
    can be deleted. `--max-warnings 0` is NOT a viable alternative here — 40
    pre-existing `no-unused-vars` warnings would trip it immediately.

PRIORITY 2 — Fix before merge:

  [TEST / RISK PATH] eslint.config.mjs (no test added in this diff)
    The defect class being fixed is a **silently self-disabling gate**, and the
    fix has no automated guard that it stays fixed. Both `import-x/extensions`
    and `import-x/resolver-next` are load-bearing: delete or typo either one and
    the rule reverts to walking an empty graph, reporting zero, and looking
    healthy — indistinguishable from a clean tree. There is no test, CI step, or
    fixture in this diff that would catch that.

    This is the exact failure the PR's own new CLAUDE.md rule warns about
    ("prove any graph-walking rule actually FIRES by injecting a known violation
    ... BEFORE trusting a green result"). The rule is documented but not
    automated, so the next reader is asked to remember to do by hand what a
    5-line CI step could assert.

    Fix: add a CI step (or a `pnpm` script) that writes a 2-file cycle to a temp
    dir, runs `eslint --format=json` on it, and asserts `import-x/no-cycle`
    appears — failing the build if it does not. This is the only construct that
    detects re-inertion.

  [FAILURE MODE / SIGNAL] eslint.config.mjs:176
    The 11 cycle warnings land in an existing noise floor of 43 warnings
    (40 × `@typescript-eslint/no-unused-vars`, 3 × directive), for 54 total.
    Nothing visually or exit-code-wise distinguishes a cycle warning from unused-var
    churn, so "did this PR add a cycle?" is not answerable by looking at `pnpm lint`
    output — it requires diffing counts between branches by hand.

    Fix: pairs with the P1 — a scoped `error` makes new cycles self-announcing.
    Failing that, a `--format` filter or a dedicated `lint:cycles` script that runs
    only this rule and exits non-zero above a pinned baseline count (11).

PRIORITY 3 — Address when convenient:

  [READABILITY / TRACEABILITY] eslint.config.mjs:106, 174-175
    Neither comment names the burn-down issue. Line 106 says "until those are
    burned down (follow-up issue)" and line 175 says "see ... issue #333" — but
    #333 is the *detection* bug this PR closes, not the flip-back tracker. The
    tracker is **#343**, named only in the PR body. A reader of the config has no
    path to the issue that removes the `warn`.
    Fix: cite `#343` at both sites. Same omission exists in the CLAUDE.md entry
    ("pending a burn-down follow-up").

  [CORRECTNESS / PORTABILITY] eslint.config.mjs:130
    `createTypeScriptImportResolver({ project: "./tsconfig.json" })` resolves
    `./` against the **process CWD**, not the config file's directory. Lint run
    from any subdirectory silently gets no TS project — which degrades to the same
    class of silent inertness this PR fixes. The pattern is inherited from the
    removed legacy block so it is not a regression, but it is being carried into
    the new API where `import.meta.dirname` is available.
    Fix: `project: new URL("./tsconfig.json", import.meta.url).pathname` or
    `path.join(import.meta.dirname, "tsconfig.json")`.

  [PERFORMANCE / DX] eslint.config.mjs:137
    Now that the graph is actually walked, `npx eslint .` goes 34.8 s → 46.6 s
    (+34%, +11.8 s) — measured on this machine, both branches, warm. The
    pre-commit hook runs `pnpm lint && pnpm tsc --noEmit` on every commit, so this
    is a per-commit cost, not just CI. Expected and arguably the price of a working
    gate; flagged so it is a known trade rather than a surprise. `maxDepth: Infinity`
    is the main lever if it becomes painful.

  [DOCS] CLAUDE.md:135
    The entry is accurate against the final diff — it correctly describes both
    config gaps, names the `warn` severity, and states the 11-cycle count that this
    review independently reproduced. No documentation drift. Two nits: it is a
    single ~1,900-character paragraph (the longest in the log), and like the config
    it omits the #343 reference. Content is correct; only navigability suffers.

SUMMARY: 1 P1, 2 P2, 4 P3

RECOMMENDED NEXT STEPS:
  → P1 is the merge-train-relevant one: this PR is the queue head, and shipping it
    as-is leaves cycle regressions unblockable for every PR behind it. The scoped
    `error` override is a ~4-line addition to this PR and does not depend on #343.
  → P2 (fire-test in CI) is the durable fix for the whole bug class and is worth
    doing here rather than as a follow-up, since the follow-up would itself be
    unguarded.
  → P3s can ride this PR or defer; the #343 citation is a one-word change.
