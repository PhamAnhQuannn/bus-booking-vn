CODE REVIEW (ROUND 2) — PR #347 "feat(config): boot-warn when email is silently stubbed (#337)" @ 204d5159
────────────────────────────────
Diff scope: 4 files, +137 / -13 lines (cumulative vs master)
  lib/config/env.ts                                                    +35 / -11
  lib/config/__tests__/env.test.ts                                     +93 /  -1  (new)
  documentation/design-specifications/DS-006-background-jobs/README.md  +8 /  -1
  documentation/feature-implementation/FI-014-notifications/README.md   +1 /  -0

Base: master · Head SHA pinned: 204d5159985be40f673a8009d61d13b19cd19832 · State: OPEN (ready)
Round-1 report: `docs/qa/code-review-pr347-20260726.md` @ ee313268
Fix commit under review: `204d515` "fix(config): make the email-stub warn reachable (gate on EMAIL_PROVIDER alone)"

CI at review time: **all 12 checks green** on `204d515` — Unit, Integration, Lint & Typecheck, E2E
(chromium + mobile-390), Data Leak Audit, Greppable Invariants, gitleaks, Dependency Audit, Vercel.
This corroborates the "6/6 pass" claim and confirms the newly-reachable warn breaks no existing suite.

Per CLAUDE.md 2026-07-24 (Bug B round 3): "fixing a review finding is itself a change that can
introduce a worse one — re-run the adversarial review on the FIX, not just the original defect."
This pass reviews the fix as new code, not just as a delta against the round-1 findings.

---

## ROUND-1 FINDING DISPOSITION

| # | Round-1 finding | Status @ 204d515 |
|---|-----------------|------------------|
| P1-1 | Gate `!NOTIFY_STUB && EMAIL_PROVIDER !== 'resend'` unreachable in every environment that exists | **FIXED** — `env.ts:601` is now `if (_env.EMAIL_PROVIDER !== 'resend')` |
| P1-2 | Test `does NOT warn when NOTIFY_STUB=true` ratified the dangerous config as intended | **FIXED** — inverted to `warns when NOTIFY_STUB=true and EMAIL_PROVIDER is unset (prod flag combo)`, asserts `warned() === true` |
| P1-3 (pr-review) | `Closes #337` overclaims while the gate cannot fire | **FIXED by consequence** — the gate now fires; body rewritten |
| P2 | `.env.example` still teaches the pre-#326 model, twice | **NOT ADDRESSED** — see P2-b below |
| P2 | PR body rationale becomes permanent squash history | **FIXED** — body rewritten, now describes the final gate and carries a "Not delivered" section |

---

## VERIFICATION OF THE PR'S OWN CLAIMS

**Claim: "Restoring the old `!NOTIFY_STUB &&` condition fails 3 of the 6."** — **VERIFIED** by
truth-table, and it is exactly 3, not "about 3". `NOTIFY_STUB` is `z.string().default('true').transform(v => v === 'true')`
(env.ts:159-162), so `!_env.NOTIFY_STUB` is a genuine boolean negation, not a truthy-string trap:

| # | Test | NOTIFY_STUB | EMAIL_PROVIDER | expects warn | old gate emits | verdict |
|---|------|-------------|----------------|--------------|----------------|---------|
| 1 | `NOTIFY_STUB=false` + unset | false | (unset→`stub`) | true | true | PASS |
| 2 | `EMAIL_PROVIDER=resend` (real email wired) | false | resend | false | false | PASS |
| 3 | prod flag combo | true | (unset→`stub`) | true | **false** | **FAIL** |
| 4 | explicit `EMAIL_PROVIDER='stub'` | true | stub | true | **false** | **FAIL** |
| 5 | resend regardless of NOTIFY_STUB | true | resend | false | false | PASS |
| 6 | warns only once | true | (unset→`stub`) | 1 call | **0 calls** | **FAIL** |

3 of 6. The tests are a real guard, not a restatement of the implementation. Good.

**Claim: "warns only once."** — **QUALIFIED PASS.** It is once *per parse*, not once per process.
`_env` memoizes (env.ts:583) and the warn sits after the assignment, so repeated `getEnv()` is silent.
`_resetEnvCache()` re-arms it — but grep confirms **zero non-test callers** (`lib/config/env.ts:586`
is the only definition; the only callers are `lib/storage/__tests__/storage.{test,int.test}.ts`,
`lib/jobs/__tests__/cronJobs.int.test.ts`, `lib/jobs/__tests__/retentionSweeper.int.test.ts`).
So "once per process" holds in production. Serverless caveat is disclosed in the PR body's
"Not delivered" (fires on first cold-start request, not at deploy) — accurate.

**Claim: no CI-env / audit-scope obligation (WT-20).** — **VERIFIED.** `grep -rn 'EMAIL_PROVIDER|NOTIFY_STUB|RESEND'
scripts/audit/*.sh .github/workflows/*.yml` returns **zero matches**. No scope guard, no superRefine
change, no new Zod var. Nothing owed to `ci.yml`.

**Blast-radius check on the widened gate (the new-code review):**
- `getEnv()` is not reachable from Edge middleware — `grep getEnv proxy.ts instrumentation.ts` → no match.
  A `console.warn` in an Edge isolate would have been a per-invocation log; it is not.
- `getEnv()` is not reachable from any `'use client'` file — the client-import cross-check
  (`'use client'` files importing `@/lib/config` or `@/lib/core/config`) returns **zero**. No 2026-06-04
  operator-smoke class regression.
- No `no-console` ESLint rule exists, and no CI step gates on empty stderr / warning count, so the
  new emission cannot break the pipeline.

---

PRIORITY 1 — Block merge, fix first:

  **NONE.** The root-cause defect is genuinely fixed, the fix is the one round-1 recommended
  (gate on the email flag alone), and it introduces no new correctness, security, or failure-mode
  defect. The inverted test now asserts the safety property rather than the author's framing.

---

PRIORITY 2 — Fix before merge:

  [FAILURE MODE / ALERT FATIGUE — the control is now unconditionally true in every dev process]
  lib/config/env.ts:601

    `EMAIL_PROVIDER` defaults to `'stub'` (env.ts:342), so the widened gate fires in **local dev,
    every `pnpm test` worker that parses the real schema, every `next build` render worker, and
    every CI E2E job** — not only in a real deployment. Round-1's own fix text offered the scope
    ("optionally scoped to a real deployment — `process.env.NODE_ENV === 'production'` or
    `!_env.PAYMENTS_STUB` — so local/dev stub work stays quiet"); the fix took the widening and
    dropped the scoping.

    Why this is not cosmetic: this warn is a *detection control* for a silent-outage class. A
    control that is 100% true in the environment developers look at every day is the textbook
    mechanism by which the control stops being read — and by the time it appears in the one log
    where it means something, it is visually identical to the noise everyone already filters. The
    PR's own "Not delivered" concedes it is "matched by no alert", so a human reading logs is the
    ONLY consumer, which makes signal-to-noise the entire value of the control.

    Practical measure of the noise: `next build` spawns multiple render workers and `_env` is
    memoized per process, so a single build emits the line once per worker, interleaved with the
    build output.

    Fix: keep the `NOTIFY_STUB` decoupling (that part is correct and must not be undone) and add a
    deployment scope instead —
      `if (_env.EMAIL_PROVIDER !== 'resend' && process.env.NODE_ENV === 'production')`
    or `&& !_env.PAYMENTS_STUB`. Either keeps it firing in preview/staging/prod (both build with
    `NODE_ENV=production`) while silencing local dev and the unit suite. If the author deliberately
    wants dev noise, say so in the comment at env.ts:587-600 — right now the comment argues only
    against the `NOTIFY_STUB` AND and is silent on why no scope at all is correct.

  [NEGATIVE SPACE / ROUND-1 P2 CARRIED FORWARD UNADDRESSED]
  .env.example:112-114 and :137-138  (verified present at head SHA 204d515)

    The fix commit corrected the pre-#326 belief in `env.ts` (two comments), `DS-006`, and `FI-014` —
    but `.env.example`, the file an operator actually copies to stand up an environment, still
    states it twice:
      - `# NOTIFY_STUB default-on ("true"): SMS/email are logged, never sent`
      - `# EMAIL_PROVIDER: "stub" (default, NOTIFY_STUB covers) | "resend" (real Resend API).`

    This is the closed loop the warn creates: the operator sees
    `env.email.silently_stubbed: … Set EMAIL_PROVIDER=resend + RESEND_API_KEY`, opens the env
    template to act on it, and is told there that `NOTIFY_STUB` already covers email. The one
    surface the warn drives traffic to is the one surface still carrying the falsehood #337 exists
    to kill. The PR body's "Also corrected two comments in the same file … both ~250 lines above the
    new warn" reads as a completed sweep; it is a partial one.

    Fix: correct both `.env.example` comment blocks in this PR — it is a 2-line change in the file
    the PR is already about, not scope creep.
    (Adjacent, pre-existing, flag only — NOT this PR's job: `.env.example:141` documents
    `EMAIL_FROM="noreply@busbookvn.com"` while the schema default and `sendViaResend`'s fallback are
    both `noreply@lenxevn.com`.)

---

PRIORITY 3 — Address when convenient:

  [OBSERVABILITY / UNSTRUCTURED SIGNAL — disclosed, not hidden]
  lib/config/env.ts:602

    `console.warn` is not captured by `lib/observability/sentry.ts` and matches no alert, so a
    silent-email outage is now *visible* but still not *alertable*. The PR body discloses this
    honestly under "Not delivered" and routes it to #143, which is the right handling — noted here
    only so the residual is tracked in the review record and not re-discovered as a finding later.
    The `console.warn`-over-`logger` choice itself is defensible and correctly justified at the call
    site (keeps `lib/config` dependency-free, matching the plain `throw` 15 lines above).

  [TEST HYGIENE / GLOBAL ENV RESTORE BY WHOLESALE REASSIGNMENT]
  lib/config/__tests__/env.test.ts:35 (`beforeEach`) / :40 (`afterEach`)

    `savedEnv = { ...process.env }` then `process.env = savedEnv` replaces the live `process.env`
    object reference rather than reverting the individual keys the test mutated. Node re-materializes
    the env on assignment so this works, but it is heavier than needed and discards anything another
    module wrote to `process.env` during the test. Vitest's default per-file isolation contains the
    blast radius today, so this is a style note, not a defect.
    Fix (if touched): mutate back the three keys the tests actually set (`NOTIFY_STUB`,
    `EMAIL_PROVIDER`, and the `BASE` block) — the pattern `if (prev === undefined) delete …` that
    PR #346 introduced in `email.test.ts` for exactly this hazard.

  [CONSISTENCY / DOC SURFACE NOT SWEPT]
  documentation/ — DS-006 and FI-014 were corrected; `.env.example` was not (see P2-b). Worth a
  one-line grep in the PR: `grep -rn "NOTIFY_STUB covers\|SMS/email are logged" . --exclude-dir=node_modules`
  should return zero after this PR. It currently returns `.env.example` twice.

---

SUMMARY: 0 P1, 2 P2, 3 P3

FIX VERDICT: The round-1 P1 is **genuinely and correctly fixed**, not papered over. The gate is now
reachable in every environment including the prod flag combination that motivated #337; the test that
ratified the defect is inverted and now asserts the safety property; the "3 of 6 fail on the old
condition" claim is verified exactly by truth-table; the two stale `env.ts` comments carrying the same
pre-#326 belief were corrected. The fix introduces **no new P1** — no Edge or client reachability, no
CI gate breakage, no `_resetEnvCache` production caller that would re-arm the warn. Residual: the warn
is unscoped and therefore unconditionally true in dev/test/CI (P2-a, the way this control degrades),
and round-1's `.env.example` P2 is still open (P2-b), leaving the warn's own remediation target
carrying the falsehood it is warning about.

RECOMMENDED NEXT STEPS:
  → Fix P2-a (scope the warn to a real deployment) and P2-b (`.env.example`, 2 lines) before merge;
    both are small and inside this PR's existing scope.
  → No P1 blocks. On a squash-merge the rewritten body is accurate against the final diff — see
    `docs/qa/pr-review-pr347-20260726-round2.md` for the shape pass.
