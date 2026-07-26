# PR REVIEW (ROUND 2) — PR #356 "fix(ci): G6 barrel-leak guard derives server-only domains dynamically (#348)" @ `898ab249`

─────────────────────────────
**Mode:** PR mode (standalone — no `/commit-split` chain, no PR comment posted)
**Head:** `898ab2498f6cae4d19458ef3a51fbf46d02f1107` (round-1 head was `55d70773`)
**Base:** `master` @ `cd08dcbd`
**Diff scope:** 1 file, +85 / −8 lines (77 net), 2 commits
**State:** open, ready-for-review (not draft)
**Reviewed:** 2026-07-26
**Prior round:** `docs/qa/pr-review-pr356-20260726.md` (0 P1, 3 P2, 4 P3)

---

## Shape scorecard

| Category | Result |
|---|---|
| **1 — Scope discipline** | ✅ Single intent (`fix(ci)` ×2), single file, single issue. Exemplary. |
| **2 — Diff size** | ✅ 77 net lines / 1 file. Far inside budget. |
| **3 — Commit messages** | ✅ Both conventional, both carry a WHY body. One subject over length (P3). |
| **4 — Negative space** | ❌ No committed self-test for a safety gate that has now shipped 3 distinct silent-pass modes (**P1**). No schema / env / dep / flag / cron triggers — all N/A. |
| **5 — Rollback path** | ✅ Script-only, no irreversible ops. `git revert` is a complete rollback. |
| **6 — PR description** | ⚠️ Rewritten this round against the final diff (credit — follows the repo's 2026-07-24 rule). One factual error remains (**P2**), plus omissions (**P2**). |
| **7 — Body negative space** | ⚠️ No flags / deps / irreversible ops to document. Guard blind spots undocumented (**P2**). |

---

## PRIORITY 1 — Block merge, fix first

### [NEGATIVE SPACE / UNTESTED SAFETY GATE] no test file in diff — **escalated from round-1 P2**

This PR modifies a CI guard whose *entire* value is that it fails when it should, and ships
**zero** automated proof that it does. Issue #348's own Verify step asks for exactly this. The
PR body now discloses the gap honestly:

> "No committed planted-violation test ships with this PR — the verification above was run
> manually. A permanent self-test for the guard is worth a follow-up."

Honest disclosure is good PR shape and is credited — but it does not reduce the risk, and the
evidence for escalating this from round 1's P2 is now concrete:

- **Round 1** found a silent-pass hole (empty derivation ⇒ `PASS`). Found only by manual probing.
- **Round 2** fixed it — and introduced a *new*, narrower silent-pass hole: the count floor has
  6 domains of headroom, so dropping any ≤6 domains (including `payment` and `auth`) still
  prints `PASS` with a live violation on disk. Found only by manual probing (see
  `docs/qa/code-review-pr356-20260726-round2.md` P1-3).

Three rounds, three silent-pass modes, all three discovered by hand. A committed self-test —
plant a `'use client'` fixture importing a required barrel, assert the script exits 1, remove it,
assert exit 0 — is ~15 lines and would have caught all three automatically. This is precisely the
repo's own **2026-07-24 "Bug B round 3"** lesson: *fixing a review finding is itself a change that
can introduce a worse one — re-run the adversarial review on the FIX.* A self-test is the
mechanised form of that rule.

**Fix:** add the self-test to this PR (e.g. `scripts/audit/__tests__/g6-guard.test.sh` invoked
from the same CI job, or a `--self-test` flag on the script), or explicitly accept the risk and
open the follow-up issue *before* merge so it is tracked rather than aspirational.

---

## PRIORITY 2 — Fix before merge

### [PR DESC / ACCURACY] "Not delivered" bullet 2 misdiagnoses a real coverage gap

> "The pass-2 fixpoint currently promotes 0 of 37 domains … It is dead code today, not a
> regression — **`lib/einvoice` is the live example that stays untainted.**"

The "0 of 37" half is **correct** (verified: only `lib/ratelimit/index.ts` contains any
`from '@/lib/…'` in a barrel, and it imports `@/lib/logger`, which is not a `lib/*/index.ts`
domain). The `einvoice` half is **wrong**, in a way that matters:

`lib/einvoice/index.ts` re-exports only relative paths (`./misaClient`, `./issueInvoice`,
`./types`) — it contains **no** `from '@/lib/<domain>'` at all, so pass 2 could never taint it
under any implementation. `einvoice` stays untainted because **pass 1** cannot see it: it reaches
secrets via `lib/einvoice/misaClient.ts:12` → `import { getEnv } from '@/lib/core/config'`, which
is neither `server-only` nor `@/lib/core/db`.

That is the *same* criterion the PR uses to justify adding `config` to `EXTRA_SERVER_ONLY`. So a
money/PII-adjacent domain that qualifies for the new explicit list is instead filed under a
benign dead-code note about a different mechanism. The body's framing tells a future reader "pass
2 is inert but harmless" when the actual message should be "the explicit list is incomplete."

**Fix:** correct the bullet, and either add `einvoice` to `EXTRA_SERVER_ONLY` or state why it is
excluded. Matters more than usual because this body squash-merges into permanent history.

### [PR DESC / OMISSION] The body documents the floor as a fix, not its blind spot

`## Fix` presents the floor assertion as closing the vacuous-pass hole:

> "the check hard-fails below a floor of 20 domains, instead of degrading to an empty alternation
> that matches nothing and prints PASS."

True for *total* collapse. The body never states that the floor is a **count** proxy with 6
domains of slack, so a partial shrink — including of `payment` or `auth`, which `master` covered
unconditionally via the hardcoded literal — still prints `PASS`. Nor does it note that
`EXTRA_SERVER_ONLY` fails **open** on a name drift (verified: `geo`→`geoRENAMED` ⇒ silent skip,
`PASS`, exit 0).

Per the repo's **2026-07-24** rule — *on a squash-merge the PR body becomes the permanent master
commit message, so stale/wrong guidance ships into history* — a body that describes a guard's
strength without its known residual limits is the same defect class that rule was written for.

**Fix:** add one paragraph stating the floor's scope (catches total collapse, not partial) and
the `EXTRA_SERVER_ONLY` fail-open, or fix both in code (a required-name assertion does both) and
say so.

### [ROLLBACK / OPERABILITY] G6 still has no exemption escape hatch — **round-1 P2, unaddressed**

Every other check in this script ships a documented escape hatch:

```
 21:    | grep -v '// I7-exempt:'            ← G1
 58:    | grep -v "// self-fetch-exempt:"    ← G2
103:    | grep -v '// bigint-exempt:'        ← G4
131:    | grep -v '// rsc-exempt:'           ← G5
```

**G6 has none**, and this PR takes its blast radius from 6 barrels to 26. There is now no way to
land a legitimate exception without editing the guard itself, and the one plausible false
positive is already latent: the inline type modifier
(`import { fn, type T } from '@/lib/admin'`) is not excluded by `grep -v 'import type'`. The
"rollback" for a spurious G6 failure is therefore "modify the guard under time pressure," which
is how gates get quietly weakened.

**Fix:** add `| grep -v '// g6-exempt:'` to the inner scan, matching the file's established
convention.

---

## PRIORITY 3 — Address when convenient

### [PR DESC] Title is 76 chars (limit 70) — round-1 P3, unaddressed
`fix(ci): G6 barrel-leak guard derives server-only domains dynamically (#348)`
Suggest: `fix(ci): G6 guard derives server-only barrels dynamically (#348)` (63).

### [COMMIT MSG] Commit 1 subject is 76 chars (limit 72)
`55d7077` — same string as the title. Commit 2 (`898ab24`, 65 chars) is fine. Both commits carry
proper WHY bodies; no `wip`/`fixup`/`asdf` subjects. Format compliance is otherwise 2/2.

### [COMMIT MSG] Commit 1's body carries superseded figures into the squash
`55d7077` states "leaving **18** other server-only `lib/<domain>` barrels unchecked" and repeats
the perf rationale round 1 flagged as wrong ("timed CI out on Windows" — the PR body has since
been softened to "measurably slower in CI", but the commit message was not). Commit 2 says 26.
If the merge concatenates commit messages rather than using the PR body, history gets 18 / 24 / 26
in one message plus a perf claim the author has already retracted. Squash with the PR body as the
message, or amend commit 1.

### [PR DESC] No literal `## Summary` / `## Test plan` headings — round-1 P3, low value
The body uses `## Problem` / `## Fix` / `## Verify` / `## Not delivered`. Functionally equivalent
and arguably better; `## Verify` is a genuine verification table. Noting only for checklist
completeness — **no change recommended.**

---

## Rollback assessment — clean

No migration, no schema change, no payment mutation, no queue/storage deletion, no `rm -rf`.
The change is one bash function; `git revert 898ab24 55d7077` is a complete and safe rollback.

One informational nuance, not a finding: reverting narrows G6 coverage 26 → 6 **silently** — the
`derived server-only barrels (N)` log line disappears along with the derivation, so a revert
leaves no trace that ledger/op/trips/config/geo went unguarded again. Worth a sentence in the PR
body's rollback framing if one is added.

---

## PR-body verification-table audit — all rows hold

Every claim in the `## Verify` table was independently re-run at `898ab249`:

| Body claim | Verdict |
|---|---|
| Clean tree → PASS, 26 derived, all 6 originally-listed retained | ✅ confirmed |
| `'use client'` + ledger / op / trips → FAIL | ✅ confirmed (all three listed in output) |
| `'use client'` + config → FAIL | ✅ confirmed |
| `'use client'` + geo → FAIL | ✅ confirmed |
| Forced-collapse derivation + live violation → FAIL (floor) | ✅ confirmed (`0 tainted domain(s), expected >= 20`) |
| Exit 1 on violation, 0 on clean tree | ✅ confirmed |
| "26 — 24 by marker scan plus config and geo"; issue #348's "6 of 21" undercounted | ✅ confirmed (37 domains, 24 marker-tainted, +2 explicit) |
| "Full script runs ~20s" | ✅ 16.7s local, 8s on CI |

**The verification table is accurate and the round-1 count discrepancy (PR said 24, issue said 21)
is now explicitly reconciled in the body.** That round-1 P3 is resolved. The only body defect is
the `einvoice` attribution above.

---

## SUMMARY: 1 P1, 3 P2, 4 P3

Shape is otherwise excellent — one file, one intent, 77 net lines, two well-formed commits, a
body that was correctly rewritten against the final diff. The P1 is a negative-space finding, not
a code defect: a safety gate with three demonstrated silent-pass modes across three review rounds
still ships without an automated proof that it fires.

## RECOMMENDED NEXT STEPS
  → Add the self-test (P1), or open + link the follow-up issue before merge so it is tracked.
  → Correct the `einvoice` bullet and decide whether it joins `EXTRA_SERVER_ONLY` (P2).
  → Document the floor's partial-collapse blind spot in the body, or close it in code (P2).
  → Add `// g6-exempt:` to match the other four checks (P2) — carried unaddressed from round 1.
  → Squash using the PR body as the commit message; shorten title to ≤70 chars (P3).
