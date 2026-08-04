CODE REVIEW (ROUND 2 — re-review of fix commit) — PR #345
"fix(lint): make import-x/no-cycle gate actually detect cycles (#333)" @ 8bcaf74f
────────────────────────────────
Base: `master` (cd08dcb) · Head: `fix/333-no-cycle-resolver` @ `8bcaf74fcb7a5e6feccccfab4ca80b9393fb7381`
State: OPEN, ready-for-review · Mode: PR (standalone — no auto-comment)
Round-1 report: `docs/qa/code-review-pr345-20260726.md` (pinned @ `d6603e5b`) — preserved, not overwritten.
Cumulative diff scope: 2 files, +45 / -7 (CLAUDE.md +1, eslint.config.mjs +44/-7)
Fix commit `8bcaf74` alone: **1 file, +21 / -2 — `eslint.config.mjs` only.**

Reviewed from an isolated `git worktree` at `origin/fix/333-no-cycle-resolver`
(node_modules junctioned from the main tree). The main working tree was never checked
out and is left on `fix/333-no-cycle-resolver` as found.

---

## 1. Round-1 finding disposition

| # | Round-1 finding | Sev | Status @ 8bcaf74 |
|---|---|---|---|
| 1 | `no-cycle` at `warn` + bare `eslint` ⇒ detects but never blocks | P1 | **RESOLVED** for every domain except the three scoped ones (see P2-B) |
| 2 | No automated proof-of-firing guard | P2 | **NOT ADDRESSED** — carried forward |
| 3 | 11 cycle warnings buried in a 43-warning noise floor | P2 | **PARTIALLY RESOLVED** — new cycles outside the three domains are now errors and self-announcing; inside them the signal problem is unchanged |
| 4 | Neither comment cites the burn-down issue #343 | P3 | **PARTIALLY RESOLVED** — the new override block cites #343 (line 186); the older comment (98-109) and the CLAUDE.md entry still do not |
| 5 | `project: "./tsconfig.json"` is CWD-relative, not config-relative | P3 | **NOT ADDRESSED** — carried forward |
| 6 | `eslint .` wall time +34% now that the graph is walked | P3 | **NOT ADDRESSED** (accepted cost) |
| 7 | CLAUDE.md entry accurate against final diff | P3 (nit) | **REGRESSED → now a P1** — see below |

---

## 2. Independent empirical verification (executed, not trusted from the PR body)

| Probe | Expected | Observed |
|---|---|---|
| `eslint .` on clean PR head | 0 err / 54 warn | **0 errors, 54 warnings** (40 `no-unused-vars`, 11 `no-cycle`, 3 unruled) — exit **0** |
| Location of the 11 `no-cycle` reports | booking/payment/ledger only | confirmed — 10 files: `booking/{createCashBooking,index,initiateOnlineBooking}`, `ledger/{index,refund}`, `payment/{adapters/bankTransfer,applyPaidTransition,index,processWebhook,select}` |
| Planted 2-file cycle in `lib/catalog` (unscoped) | 2 errors | **2 errors, exit 1** ✅ |
| Planted cross-domain cycle `lib/notification` ↔ `lib/booking` | unscoped side must error | **2 errors** on both `lib/notification` files **+ 3 warnings** on the booking side — exit **1** ✅ |
| Planted 2-file cycle **wholly inside** `lib/payment` (scoped) | ? | **0 errors, 2 warnings — exit 0** ⚠️ |
| `--print-config` effective severity, `lib/booking/index.ts` | 1 | `1` |
| `--print-config`, `lib/payment/processWebhook.ts` | 1 | `1` |
| `--print-config`, `lib/ledger/calcPayout.ts` | 1 | `1` |
| `--print-config`, `lib/catalog/index.ts` | 2 | `2` |
| `--print-config`, `lib/notification/email.ts` | 2 | `2` |
| `--print-config`, `lib/jobs/reconcilePayments.ts` | 2 | `2` |
| `--print-config`, `app/api/holds/route.ts` | 2 | `2` |
| `--print-config`, `lib/booking/__tests__/bookingRef.test.ts` | ? | **`undefined`** (rule not configured at all) |

**Flat-config precedence — answered.** The override cannot silently widen. ESLint flat
config is last-match-wins *per matching config object*, and a config object only matches
files inside its own `files` globs. Every probed file outside `lib/{booking,payment,ledger}`
resolves to severity `2`, including `lib/jobs` and `lib/notification` — the two domains most
tightly coupled to the scoped three. There is no `plugins`-merge or `settings`-merge hazard
here either: the override declares neither, so it inherits the main block's `import-x`
plugin registration and resolver/extensions settings (confirmed by the options payload in
`--print-config`, which shows the same `{maxDepth:null, ignoreExternal:true}` shape on both
severities).

**Cross-boundary cycle — answered.** A cycle that crosses from an unscoped domain into a
scoped one still fails the build, because `no-cycle` reports on *every* file in the cycle
and the unscoped members keep severity `2`. Exit code 1. This is the property the override
comment claims, and it holds.

---

PRIORITY 1 — Block merge, fix first:

  [DOC DRIFT / CLAUDE.md-MISTAKE-LOG MATCH] CLAUDE.md:135 (last sentence of the #333 entry)
    The mistake-log entry added by `d6603e5` still ends:
        "Rule kept at `warn` pending a burn-down follow-up, then flip to `error`."
    `8bcaf74` falsified that sentence and touched **only** `eslint.config.mjs`
    (`git show 8bcaf74 --name-only` → one file). The prose was never walked forward.

    This is a verbatim repeat of the rule logged three entries above it in the same file
    (2026-07-24, "a squash-merge inherits the PR body + safety doc — keep them current
    with the final diff"), which makes it an auto-P1 under this skill's severity table
    ("Any pattern matched from CLAUDE.md Mistake Log").

    Aggravating factor specific to this file: CLAUDE.md is the always-loaded project
    instruction document. Round 1 explicitly graded this entry "accurate against the final
    diff — no documentation drift"; the fix commit made it inaccurate. A future agent
    reading it will conclude (a) the gate is non-blocking, and (b) the outstanding action
    is "flip to error" — when the gate IS blocking outside three domains and the actual
    outstanding action is "delete the scoped override block".

    Fix: rewrite the closing sentence to the final state, e.g.
      "Rule set to `error` globally with a scoped `warn` override for
       lib/{booking,payment,ledger}; #343 burns down the 11 and deletes the override."

---

PRIORITY 2 — Fix before merge:

  [DOC DRIFT / SELF-CONTRADICTION] eslint.config.mjs:98-109 vs 174-180
    Same class as the P1, inside the file the fix commit actually edited. The older
    comment block still reads:
        "It is kept at 'warn' until those are burned down (follow-up issue), then
         flipped back to 'error'."   (lines 104-106)
    Seventy lines below, the comment `8bcaf74` added reads:
        "'error' — a NEW cycle must FAIL the build, not merely be reported."  (line 174)
    and line 180 is `["error", …]`. Two comments in one file describing one rule, in
    direct contradiction. Whichever a reader reaches first wins, and the stale one is
    first. Round-1 P3 #4 (missing #343 citation) also survives here.
    Fix: rewrite lines 104-106 to describe the scoped override and cite #343.

  [ENFORCEMENT GAP — NEW, introduced by 8bcaf74] eslint.config.mjs:187-197
    Empirically confirmed: a brand-new 2-file cycle created wholly inside `lib/payment`
    yields `0 errors, 2 warnings, exit 0`. `pnpm lint` passes, CI passes, the pre-commit
    hook passes, and the only visible trace is the warning count moving 54 → 56 inside a
    54-warning noise floor.

    The override is scoped to three whole *domains*, not to the 11 known *cycles*. It
    therefore also blanket-exempts every cycle those domains acquire between now and #343
    landing — and #343 has no due date. Those three domains are the money path
    (booking / payment / ledger) and, judging by the open queue (#301 rewrites
    `lib/ledger`, #357 rewrites `lib/payment`), the highest-churn area in the repo.

    Judged against master this is not a regression — master enforced nothing anywhere, so
    every file is weakly better or equal. Judged against the PR's own claim it is an
    overstatement: the body says "the 11 known ones stay visible without blocking the
    queue", which reads as *only* the 11 being exempt. A 12th is equally invisible.

    Also worth naming explicitly, per the repo's 2026-07-24 "the fix for a review finding
    introduced a permanent hold" lesson: this override is a **hold state whose release
    condition is external** (#343). It is not self-releasing and nothing bounds it. It is
    a deliberate, documented, single-line-deletable hold rather than an unbounded backlog,
    so it does not repeat that mistake — but it is the same shape, and it deserves a
    ratchet.

    Fix options (pick one; all are small):
      (a) Freeze the count: `"lint": "eslint --max-warnings 54"` in package.json. A 12th
          cycle then fails the build without needing #343. (Round 1 correctly rejected
          `--max-warnings 0`; a pinned non-zero baseline was not considered.)
      (b) Narrow the override `files` to the 10 specific paths that report today.
      (c) Accept, and correct the PR body + config comment to state the gap in one line.

  [TEST COVERAGE OF DIFF — carried from round 1, unaddressed] eslint.config.mjs
    The defect class is a silently self-disabling gate; the fix still has no automated
    guard that it stays enabled. `import-x/extensions`, `import-x/resolver-next`, and the
    two `files` arrays are all load-bearing — break any one and the rule reverts to
    walking an empty graph, reporting zero, and looking *healthier* than before.
    `8bcaf74` did not add a guard, and it enlarged the surface: there are now two config
    objects whose `files` globs must both stay correct, and a mis-scoped glob would
    silently demote enforcement to `warn` repo-wide with no visible symptom.
    The PR's own CLAUDE.md rule mandates injecting a known violation before trusting a
    green result — currently a human ritual with no executable form.
    Fix: a `scripts/audit/` shell check (matching the existing `greppable-invariants.sh`
    pattern, which #356 is already touching) or a CI step that lints a 2-file fixture
    cycle in a scratch dir and asserts a non-zero exit.

---

PRIORITY 3 — Address when convenient:

  [DEAD CONFIG — NEW] eslint.config.mjs:193
    `ignores: ["**/__tests__/**", "**/*.test.{ts,tsx}"]` on the override block is a no-op.
    The main block (line 114) already carries the identical `ignores`, so
    `import-x/no-cycle` is not configured for test files at all — `--print-config` on
    `lib/booking/__tests__/bookingRef.test.ts` returns **`undefined`** for the rule.
    Directly answering the review question: this line changes **nothing** about how test
    files are linted for cycles, before or after `8bcaf74`. Its presence is misleading —
    it reads as "test files in these three domains stay at `error`", which is false; they
    are not linted for cycles in any domain. (Test files also cannot participate in an
    import cycle in practice, since nothing imports them.)
    Fix: delete the `ignores` key, or add "(mirrors line 114; no-op)" beside it.

  [PORTABILITY — carried from round 1, unaddressed] eslint.config.mjs:130
    `createTypeScriptImportResolver({ project: "./tsconfig.json" })` resolves `./` against
    the process CWD, not the config file's directory. Lint invoked from a subdirectory
    silently gets no TS project — degrading to the same class of silent inertness this PR
    exists to fix. Not a regression (inherited from the removed legacy block), but it is
    being carried into an API where `import.meta.dirname` is available.
    Fix: `project: path.join(import.meta.dirname, "tsconfig.json")`.

  [COVERAGE HOLE] eslint.config.mjs:111 and :188-192
    Both `files` arrays match only `.{ts,tsx}` while the new `import-x/extensions` setting
    (line 137) declares `.mts`/`.cts`. A `.mts`/`.cts` source under `lib/` would be visible
    as a *dependency* but never linted as a *target*. Zero impact today (`.mts` exists only
    under `scripts/smoke/`), flagged because the new block inherits the same gap.

  [STALE TRACKER SCOPE] issue #343
    Titled "Burn down 11 cross-domain barrel cycles (booking/payment/ledger), then flip
    no-cycle to error". The flip landed in this PR. #343's remaining work is "burn down
    the 11, then delete `eslint.config.mjs:187-197`". Worth a one-line comment on #343 so
    nobody closes it by re-doing the flip.

  [PERF — carried from round 1] `eslint .` wall time is up ~34% now that the graph is
    genuinely walked. Per-commit cost via the pre-commit hook. Accepted trade; noted so it
    is not a surprise.

---

Categories walked with no findings: Cat 1 (correctness — every semantic claim verified by
execution, above), Cat 2 (security — no runtime code, no secrets, no new runtime dep;
`eslint-import-resolver-typescript` was already installed as the backing resolver for the
removed legacy `import-x/resolver: { typescript }` form), Cat 3 (failure mode — n/a),
Cat 6 (diff hygiene — no `console.log`, no `.only`, no commented-out code, no unrelated
churn; every line of `8bcaf74` traces to the round-1 P1).

SUMMARY: 1 P1, 3 P2, 5 P3

RECOMMENDED NEXT STEPS:
  → The P1 is a one-sentence edit to CLAUDE.md and must land before squash-merge: the PR
    body becomes the master commit message and CLAUDE.md ships as permanent instruction.
  → Fold the eslint.config.mjs comment reconciliation (P2-A) into the same edit.
  → Make an explicit call on P2-B: `--max-warnings 54` is the cheapest true ratchet and
    closes the last enforcement hole without waiting on #343.
  → P2-C (proof-of-firing guard) is the durable fix for the whole bug class; acceptable to
    track on #343 provided #343 is updated to own it.
