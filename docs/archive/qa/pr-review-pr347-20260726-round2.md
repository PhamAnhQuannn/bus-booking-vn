PR REVIEW (ROUND 2) — PR #347 "feat(config): boot-warn when email is silently stubbed (#337)" @ 204d5159
─────────────────────────────
Diff scope: 4 files, +153 / -5 lines, 2 commits
Branch: fix/337-email-stub-boot-warn → master
PR exists: yes · State: OPEN (ready, not draft) · reviewDecision: none · labels: none
Head SHA pinned: 204d5159985be40f673a8009d61d13b19cd19832
URL: https://github.com/PhamAnhQuannn/bus-booking-vn/pull/347

Shape review only — line-level findings are in `docs/qa/code-review-pr347-20260726-round2.md`.
Round-1 shape report: `docs/qa/pr-review-pr347-20260726.md` @ ee313268.

---

## ROUND-1 SHAPE FINDING DISPOSITION

| Round-1 finding | Status @ 204d515 |
|-----------------|------------------|
| **P1** `Closes #337` overclaims — the gate cannot fire, yet merging closes the issue and writes "handled" into permanent squash history | **FIXED** — the gate now fires (`EMAIL_PROVIDER !== 'resend'` alone); `Closes #337` is now truthful |
| **P2** `.env.example` not updated — still asserts the pre-#326 model twice | **NOT ADDRESSED, AND NOW UNACKNOWLEDGED** — see P2-a below |
| **P2** PR body rationale becomes permanent history | **PARTIALLY FIXED** — body rewritten and now correct on the gate, but it dropped coverage of 2 of the 4 changed files; see P2-b |

---

## PR-BODY-vs-FINAL-DIFF AUDIT

Per CLAUDE.md 2026-07-24: "before squash-merging a multi-commit PR, re-read the PR body and any
safety doc against the FINAL diff — they were written against the first commit." The body **was**
rewritten for the fix, so this pass checks it claim-by-claim against `204d515`, not against `ee31326`.

| # | Body claim | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | `getEnv()` warns when `EMAIL_PROVIDER !== 'resend'` | **ACCURATE** | `lib/config/env.ts:601` |
| 2 | First revision shipped `!NOTIFY_STUB && EMAIL_PROVIDER !== 'resend'` | **ACCURATE** | `git show ee31326^..ee31326 -- lib/config/env.ts` |
| 3 | `NOTIFY_STUB` defaults to `'true'`; `.env.production.local` sets `"true"` | **ACCURATE** | schema `env.ts:159-162`; `.env.production.local` → `NOTIFY_STUB="true"` |
| 4 | So `!NOTIFY_STUB` is false in every environment that exists | **ACCURATE** | FI-014 still lists eSMS brandname as an unstarted HIGH blocker |
| 5 | "Also corrected two comments in the same file" | **ACCURATE** — exactly two (`env.ts:148-156`, `env.ts:334-338`) | diff |
| 6 | `6/6 pass` on the fix | **CORROBORATED BY CI** — `gh pr checks 347`: all 12 checks green on `204d515`, including **Unit Tests**, Integration, Lint & Typecheck, Data Leak Audit, Greppable Invariants, gitleaks. (Not re-run locally — no branch checkout permitted this session.) Also verified *statically* that all six should pass: `BASE` supplies the `ESMS_*` creds the `NOTIFY_STUB=false` superRefine (`env.ts:376-382`) requires, `HOLD_SECRET: 'a'.repeat(64)` is hex-valid, `PAYMENTS_STUB`/`STORAGE_STUB` are stubbed so their credential refinements pass, `DATABASE_URL` comes from `vitest.setup.ts`, and `NODE_ENV=test` skips the production-required block. No missing-var failure path found. |
| 7 | "Restoring the old condition **fails 3 of the 6**" | **VERIFIED — exactly 3** | Truth table in the code-review round-2 report; tests 3, 4 and 6 fail, tests 1, 2 and 5 pass |
| 8 | Coverage added for prod flag combo / explicit `'stub'` / warn-fires-once | **ACCURATE** | `env.test.ts` tests 3, 4, 6 |
| 9 | Previous test was inverted | **ACCURATE** | old `does NOT warn when NOTIFY_STUB=true` → new `warns when NOTIFY_STUB=true … (prod flag combo)` |
| 10 | CI-env check: no new Zod var, no `superRefine` change, no scope-guarded var | **VERIFIED** | `grep -rn 'EMAIL_PROVIDER\|NOTIFY_STUB\|RESEND' scripts/audit/*.sh .github/workflows/*.yml` → **0 matches**; both named scripts exist |
| 11 | "Not delivered": `instrumentation.ts` `register()` does not call `getEnv()` | **VERIFIED** | `instrumentation.ts` only touches `process.env.SENTRY_DSN` / `NEXT_RUNTIME` and `Sentry.init` |
| 12 | "Not delivered": `console.warn` not captured by `lib/observability/sentry.ts`, matched by no alert | **VERIFIED** | no console/breadcrumb capture in `sentry.ts`; `beforeSend` only scrubs |

**Net: the rewritten body contains no false claim.** The round-1 failure mode (a body describing a
mechanism the final diff no longer has) is not repeated, and the new "Not delivered" section is
honest about three real residuals rather than overclaiming closure. That is the right shape.

Two gaps below are about what the body *stopped* saying, not what it says wrongly.

---

PRIORITY 1 — Block merge, fix first:

  **NONE.**

  Negative-space audit clean: no schema/migration change, no new env var (all four touched vars
  pre-exist in `.env.example` and the Zod schema), no new route handler or server action, no new
  runtime dependency, no cron job, no external API call, no feature flag. Category 5 (rollback path)
  is not triggered — there is no irreversible operation in this diff; the change is a single additive
  `console.warn` and comment/doc text. Revert path is a plain `git revert`, no data implication.

---

PRIORITY 2 — Fix before merge:

  [NEGATIVE SPACE / ROUND-1 P2 NEITHER FIXED NOR ACKNOWLEDGED]
  `.env.example:112-114` and `:137-138` — unchanged at head SHA

    Round-1 raised this as P2 and the fix commit did not act on it. Ordinarily a carried-forward P2
    is just "still open" — but here the rewrite made it worse in shape terms. The round-1 body
    claimed "Docs updated to the two-flag reality"; the rewritten body **removed that claim
    entirely** and now says only "Also corrected two comments in the same file". So the permanent
    squash-merge message will assert that the false belief was corrected in `env.ts` while being
    silent that the same false belief survives in the one file an operator copies to stand up an
    environment:
      - `# NOTIFY_STUB default-on ("true"): SMS/email are logged, never sent`
      - `# EMAIL_PROVIDER: "stub" (default, NOTIFY_STUB covers) | "resend" (real Resend API).`

    The warn's own remediation text points the reader at exactly this file. A reader of the merged
    history cannot tell whether `.env.example` was consciously deferred or simply missed.

    Fix (either is acceptable): correct both `.env.example` comment blocks in this PR — 2 lines,
    squarely inside the PR's existing scope — **or** add one line to "Not delivered" stating that
    `.env.example` still carries the pre-#326 wording and naming the follow-up. Silently dropping
    the claim is the one option that should not ship.

  [PR DESCRIPTION / BODY UNDER-DESCRIBES THE FINAL DIFF]
  PR body vs `gh pr diff 347 --name-only`

    The diff changes 4 files. The rewritten body describes 2 of them (`lib/config/env.ts`,
    `lib/config/__tests__/env.test.ts`) and never mentions the other 2:
      - `documentation/design-specifications/DS-006-background-jobs/README.md` (+8/-1 — splits the
        single "Notifications / NOTIFY_STUB" integration row into separate SMS and Email rows and
        adds a blockquote on the two-flag reality)
      - `documentation/feature-implementation/FI-014-notifications/README.md` (+1 — annotates the
        NOTIFY_STUB Known Gap)

    These are substantive spec edits to two numbered spec series, not typo fixes, and per AGENTS.md
    the `documentation/` series are the product spec library that later work reads by prefix ID. On
    a squash-merge this body is the permanent record; a future reader grepping master history for
    "when did DS-006's integration table change" finds a commit message that does not mention DS-006.

    This is the mirror image of the round-1 finding: round 1 was a body claiming a mechanism the
    diff no longer had; this is a diff carrying changes the body no longer claims. Both violate the
    same rule (2026-07-24: keep the body current with the FINAL diff).

    Fix: restore a short "## Docs" line naming DS-006 and FI-014 and what changed in each. Two
    sentences. It also makes the `.env.example` omission above visible rather than implicit.

---

PRIORITY 3 — Address when convenient:

  [COMMIT MSG / SUBJECT LENGTH]
  `204d515` — subject is 78 chars (limit 72):
    `fix(config): make the email-stub warn reachable (gate on EMAIL_PROVIDER alone)`
    GitHub already truncates it in the PR commit list ("…gate on EMAIL_PROVID…"). Low impact under a
    squash-merge (the body wins), but it will read truncated in `git log --oneline` if this ever
    lands as a merge or rebase. Fix: `fix(config): gate email-stub warn on EMAIL_PROVIDER alone` (56).
    The other commit (`ee31326`, 61 chars) is fine. Both commits carry a WHY-body — good.

  [COMMIT MSG / FIRST COMMIT NOW DESCRIBES A DESIGN THE PR NO LONGER HAS]
  `ee31326` message body still reads: "an env with NOTIFY_STUB=false but EMAIL_PROVIDER unset
  silently stubs email … getEnv() now emits a one-time console.warn … for that combination."
    That is the defect, not the shipped behaviour. Harmless **iff** this merges as a squash (only the
    PR body survives). Flagged because the merge method is the load-bearing assumption: if this is
    ever merged with `--merge` or rebased, a commit describing the unreachable gate enters master
    permanently, directly under a commit that fixes it. Fix: squash-merge (the repo's stated norm),
    or reword `ee31326` before a rebase-merge.

  [PR DESCRIPTION / SECTION HEADINGS]
    No literal `## Summary` / `## Test plan` headings. `## Problem` + `## Fix` cover summary and
    `## Verify` covers test plan in substance, so this is a naming nit only — no action needed.
    `Closes #337` is present and now truthful. Title is 61 chars (limit 70). Body is non-empty and
    unusually complete for its size.

---

## SHAPE CHECKS PASSED

- **Scope discipline** — 1 intent (`fix(config)` on top of `feat(config)` for the same change), plus
  the docs that belong to it. No unrelated domain rides along. Clean.
- **Diff size** — 153/-5 across 4 files, well inside the ≤400/≤20 band. Trivially reviewable and
  bisectable.
- **Commit count** — 2, both with substantive WHY-bodies. The second explains the defect, the
  mechanism, the fix, and cites the CLAUDE.md rule it violates. Exemplary.
- **Rollback** — no irreversible operation; `git revert` is complete and side-effect-free.
- **Linked issue** — `Closes #337`, now accurate.

---

SUMMARY: 0 P1, 2 P2, 3 P3

RECOMMENDED NEXT STEPS:
  → No P1 blocks merge. Both P2s are documentation-shape, both fixable in under 5 lines inside this PR.
  → Fold P2-a (`.env.example`) together with the code-review's P2-b — they are the same omission seen
    from the line level and the shape level.
  → Merge as a **squash** so the accurate rewritten body becomes the permanent message and `ee31326`'s
    now-obsolete rationale does not enter master (P3-b).
