ARCHITECT REVIEW (ROUND 2 — re-audit after fix commit) — PR #345
"fix(lint): make import-x/no-cycle gate actually detect cycles (#333)" @ 8bcaf74f
─────────────────────────────
Base: `master` (cd08dcb) · Head: `fix/333-no-cycle-resolver` · State: open (ready, not draft)
URL: https://github.com/PhamAnhQuannn/bus-booking-vn/pull/345
Mode: PR (standalone — no auto-comment, no PR mutation)
Round-1 report: `docs/qa/architect-review-pr345-20260726.md` (@ `d6603e5b`) — preserved, not overwritten.

**Pre-flight deviation (deliberate, stated).** The skill's PR mode checks the PR ref out in the
working tree and refuses on a dirty tree. Both were avoided: the main tree is dirty *and* carries
other people's in-flight work, so the audit ran from an isolated `git worktree` pinned to
`origin/fix/333-no-cycle-resolver` @ `8bcaf74fcb7a5e6feccccfab4ca80b9393fb7381`, with
`node_modules` junctioned from the main checkout. **The main working tree was never checked out,
never stashed, and is left on `fix/333-no-cycle-resolver` exactly as found.** The worktree was
removed on exit.

Scanned: 671 source files (lib + app + components, non-test), 38 `lib/` domains, 41 graph modules.

---

## 1. Graph effect of this PR: still exactly zero

`git diff cd08dcb..8bcaf74 --name-only` → `CLAUDE.md`, `eslint.config.mjs`. **Zero source files.**
The dependency graph at this HEAD is byte-identical to `master` and to round 1's. Categories 1–3
and 6 (cycles, coupling spread, module depth, drift) therefore carry over unchanged from round 1;
they are summarised, not re-derived, below.

What `8bcaf74` changed is the *enforcement topology* of an architectural invariant, which is the
only thing this round re-audits in depth.

## 2. Enforcement topology — measured, not assumed

`8bcaf74` replaces one uniform posture with a two-tier one. Effective severity of
`import-x/no-cycle`, read from `eslint --print-config` at PR HEAD:

| Scope | Severity | Files |
|---|---|---|
| `lib/{booking,payment,ledger}/**/*.{ts,tsx}` (non-test) | `warn` (1) | **59** |
| all other `lib/**`, `app/**`, `components/**` (non-test) | `error` (2) | **~612** |
| any `**/__tests__/**`, `**/*.test.{ts,tsx}` | **rule not configured** | — |
| `.mts` / `.cts`, `scripts/**`, `e2e/**`, `prisma/**` | **rule not configured** | — |

Carve-out footprint: **3 of 38 `lib/` domains, ~8.8% of linted source.**

Behavioural probes (all executed against the pinned worktree):

| Probe | Result |
|---|---|
| Clean tree | 0 errors, 54 warnings (11 `no-cycle`), **exit 0** |
| 2-file cycle planted in `lib/catalog` (unscoped) | **2 errors, exit 1** ✅ |
| Cycle planted crossing `lib/notification` ↔ `lib/booking` | **2 errors** (notification side) + 3 warnings (booking side), **exit 1** ✅ |
| 2-file cycle planted wholly inside `lib/payment` (scoped) | 0 errors, 2 warnings, **exit 0** ⚠️ |
| All 8 other open PRs merged in, then `eslint .` | 0 errors, 54 warnings, **exit 0** — no blast radius |

**Containment property, confirmed.** The carve-out cannot be used to launder new coupling in from
outside. `no-cycle` reports on every member file of a cycle, and every member outside the three
domains retains severity `error` — so any new cycle with even one foot outside booking/payment/
ledger fails the build. The exemption's blast radius is bounded to edges *wholly internal* to that
three-domain cluster. That is the correct containment shape and it is the strongest thing to say in
this PR's favour.

---

PRIORITY 1 — Block push, fix first:

  [CYCLE] booking ↔ payment ↔ ledger (3-domain SCC) — **carried unchanged from round 1**
    SCC members: `lib/booking`, `lib/payment`, `lib/ledger`. 11 file-level reports across 10 files.
    Value edges (re-confirmed from the gate's own output at this HEAD):
        lib/payment/adapters/bankTransfer.ts:24   → @/lib/booking
        lib/payment/applyPaidTransition.ts:28     → @/lib/booking
        lib/payment/processWebhook.ts:53          → @/lib/booking
        lib/booking/createCashBooking.ts:19       → @/lib/payment
        lib/booking/initiateOnlineBooking.ts:30   → @/lib/payment
        lib/ledger/refund.ts:46                   → @/lib/payment
        lib/payment/index.ts:9                    → @/lib/ledger
    Pre-existing; **not introduced by #345 and not a reason to block it.** Tracked by #343. The
    round-1 recommendation stands and is unchanged by `8bcaf74`: relocating `BOOKING_REF_REGEX`
    and `legalPredecessors` into `lib/core` deletes the payment→booking edge and drops `booking`
    out of the SCC without any barrel refactor.

---

PRIORITY 2 — Fix before next release:

  [INVARIANT SCOPE INVERSION — new, created by 8bcaf74] eslint.config.mjs:187-197
    The carve-out is defined by *domain*, not by *known cycle*. Its practical effect is that
    booking, payment and ledger now hold a standing, unbounded licence to acquire new import
    cycles silently (probe above: new intra-payment cycle → exit 0).

    Architecturally this inverts the invariant's targeting. ADR-016's stated rationale for
    cycle-freedom is that mutual imports "make domains inseparable" — and the three domains now
    exempted are the money path, the most correctness-critical and, on the current queue
    (#301 rewrites `lib/ledger`, #357 rewrites `lib/payment`), the highest-churn cluster in the
    repo. The invariant is now strictest where coupling pressure is lowest and absent where it is
    highest. The concrete hazard is a require-time `undefined` inside the payment path, which is
    exactly the class of bug the repo's mistake log is full of.

    This is *not* a regression against `master` — master enforced nothing anywhere, so every file
    is weakly better or equal, and it is a deliberate, documented, one-block-deletable hold rather
    than the unbounded implicit hold the 2026-07-24 mistake-log entry warns about. It is flagged
    because the hold has **no ratchet**: nothing detects cycle #12.

    Fix (cheapest sufficient ratchet, does not depend on #343): pin the warning baseline —
    `"lint": "eslint --max-warnings 54"` in package.json. A 12th cycle then fails the build.
    Alternative: narrow the override `files` to the 10 paths that actually report today. Either
    converts a standing licence into a ratchet.

  [TAXONOMY DUPLICATION — new, created by 8bcaf74] eslint.config.mjs:15-49, 118-123, 188-192
    `eslint.config.mjs` now carries **three independent notions of "domain"**, none derived from
    another and none cross-checked:
      1. `LIB_DOMAINS` — a hand-maintained 33-name array driving `no-restricted-imports` (rule 4)
      2. `boundaries/elements` — a generic `lib/*` folder capture driving `boundaries/entry-point`
      3. the new override's `files` array — a hand-maintained 3-path list driving `no-cycle` severity
    Any domain rename, split, or merge must now be applied in three places, and a miss in list 3
    fails **open** (enforcement silently relaxes or tightens with no diagnostic). This is the same
    silent-failure shape as #333 itself: a config list whose staleness produces no symptom.

    The specific drift already scheduled: when #343 burns down partially — say `ledger` goes clean
    first — nothing removes `ledger` from the override. The exemption persists indefinitely, and
    the only evidence would be a warning count that nobody is asserting on.
    Fix: add a one-line comment on #343 requiring the override list to shrink as each domain
    clears, and prefer the `--max-warnings` ratchet above, which self-corrects as the count drops.

  [ADR GOVERNANCE — escalated from round 1] ADR-016 is now *structurally* stale, not just
    temporally stale.
      `documentation/architecture-decisions/ADR-016-module-boundaries/README.md:98`
        lists `import/no-cycle` as an active constraint scoped to "**All source files**"
      `…/README.md:113`
        "**Cycle-free** — `import/no-cycle` prevents the mutual-import coupling that makes domains
        inseparable"
    Round 1 flagged this as a transient posture note (rule globally demoted to `warn`).
    `8bcaf74` changed the nature of the divergence: the scope column is now *factually wrong* —
    the constraint applies to ~91% of source files and three named domains are carved out by an
    explicit block in the config. A permanent-until-deleted, domain-named exemption from a
    recorded architectural constraint is ADR-material in its own right, not a status footnote.
    Fix: amend ADR-016 to record (a) the two-tier scope, (b) the three exempt domains and why,
    (c) #343 as the removal trigger. Overlaps `pr-review-pr345`'s spec-drift finding — count once.

---

PRIORITY 3 — Track on roadmap:

  [SNAPSHOT COLLISION — new observation] `docs/qa/arch-graph.json` is a single mutable global.
    The snapshot in the working tree is now `{"mode":"pr","pr":357,...,"generated":"…T09:07:46Z"}`
    — a PR #357 run overwrote the pr345 round-1 snapshot **on the same day**, and with it the
    `sccs_value` / `sccs_including_type` methodology split that round 1 had deliberately added
    (the current file has a single undifferentiated `sccs` key listing 8 type-inclusive domains).
    Because every PR-mode run writes the same path, "drift vs prior snapshot" actually means
    "drift vs whichever PR was audited most recently", which is not a meaningful baseline when
    several PRs are audited per day.
    **This run deliberately did NOT write `arch-graph.json`** — the graph at PR #345's HEAD is
    provably identical to `master` (zero source files in the diff), so writing it would destroy the
    pr357 baseline while adding no information. That is a deviation from the skill's "always write"
    step, taken knowingly.
    Fix: key the snapshot by mode/ref (`arch-graph.json` for master, `arch-graph-pr<N>.json` for PR
    runs), or refuse to write when the audited diff contains no source files.

  [ENFORCEMENT HOLE — new, minor] `.mts` / `.cts` are declared in `import-x/extensions`
    (eslint.config.mjs:137) but appear in neither block's `files` array (both are `.{ts,tsx}`).
    Such files are visible to the graph as *dependencies* but are never *lint targets*, so a cycle
    whose only reporting member is a `.mts` file is invisible. Zero impact today — the only `.mts`
    in the repo is `scripts/smoke/*.mts`, which is outside all `files` globs anyway.

  [DEAD CONFIG — new] eslint.config.mjs:193 — the override's
    `ignores: ["**/__tests__/**", "**/*.test.{ts,tsx}"]` is inert: the main block (line 114)
    already excludes those paths, so `no-cycle` is *unconfigured* for test files repo-wide
    (`--print-config` on `lib/booking/__tests__/bookingRef.test.ts` → `undefined`). Answering the
    question directly: this line changes **nothing** about how tests are linted for cycles, before
    or after. It is misleading as written, since it implies tests in these domains stay at `error`.

  [LAYERING — carried unchanged from round 1] `lib/logger.ts`, `lib/utils.ts`,
    `lib/withErrorHandler.ts` (15.9% fan-in, 107 importers) are bare files directly under `lib/`
    and match no `boundaries/elements` entry (`mode: "folder"`), so the barrel rule constrains
    them in neither direction. Unaffected by `8bcaf74` — and note `no-cycle` walks the resolved
    import graph regardless of `boundaries` classification, so cycles *through* these files are
    still detected at `error`.

  [SHALLOW MODULE / CYCLE AMPLIFIER — carried unchanged from round 1] `lib/booking/index.ts` (23
    exports), `lib/auth/index.ts` (23), `lib/admin/index.ts` (21). Barrel width is the mechanism
    that converts a domain-level dependency into a file-level cycle. The round-1 warning stands and
    is now *more* load-bearing: with the three widest-coupled domains exempted, the temptation to
    "fix" #343 by widening the `boundaries/entry-point` allowlist is unchanged, and that allowlist
    exists for client-safety reasons (2026-06-04 operator-portal outage). #343 must state that
    deep-import exceptions are not an acceptable burn-down mechanism.

  [GOD MODULE / LAYER VIOLATIONS] None. Highest fan-in `lib/core/db/client` at 27.7%, well under
    the 70% threshold. No `components/**` file imports `lib/core/db` or Prisma directly; no payment
    signature verification outside the webhook routes. Clean — not a finding.

---

SUMMARY: 1 P1 (carried, pre-existing), 3 P2, 6 P3
Graph snapshot: **not rewritten** — see the SNAPSHOT COLLISION P3 for the rationale. Graph at this
HEAD is identical to `master` (diff contains zero source files).

RECOMMENDED NEXT STEPS:
  → The P1 SCC is pre-existing and does not block #345. `8bcaf74` strictly improves the repo's
    architectural posture: 91% of source files went from zero cycle enforcement to hard `error`,
    and the exemption is provably containment-bounded (a cycle with one foot outside the three
    domains still fails the build).
  → Close the last hole with a ratchet before merge: `--max-warnings 54` is one word in
    package.json and converts the standing licence (P2 #1) into a tripwire.
  → Amend ADR-016 to record the two-tier scope — this is now a recorded-decision divergence, not
    a footnote.
  → Add to #343: (a) shrink the override list per domain as it clears, (b) do not burn down by
    widening the `boundaries/entry-point` allowlist, (c) the two-symbol `lib/core` extraction is
    the cheapest first move.
