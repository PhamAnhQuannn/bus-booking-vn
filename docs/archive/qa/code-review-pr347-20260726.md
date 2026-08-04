CODE REVIEW — PR #347 "feat(config): boot-warn when email is silently stubbed (#337)" @ ee313268
────────────────────────────────
Diff scope: 4 files, +99 / -2 lines
  lib/config/env.ts                                          +13 / -0
  lib/config/__tests__/env.test.ts                           +76 / -0  (new)
  documentation/design-specifications/DS-006-background-jobs/README.md   +9 / -1
  documentation/feature-implementation/FI-014-notifications/README.md    +1 / -1

Base: master · Head SHA pinned: ee3132686bc3e36c2b22d08a9c0a297302dc7a8e · State: OPEN

Reviewed against the CLAUDE.md Mistake Log (auto-P1 on match). Two entries apply directly
(2026-06-21 WT-20 a/b — `lib/config/env.ts` CI scope guards + superRefine/ci.yml parity) and
two apply by pattern (2026-05-19 Issue 013 "declared but never fires = silently un-enforced AC";
2026-07-23 "a test that asserts ambiguity resolves somehow is not a safety test").

---

PRIORITY 1 — Block merge, fix first:

  [CORRECTNESS / CONFIG — branch unreachable in the only deployment that exists]
  lib/config/env.ts:588 (new warn gate)

    The gate is `if (!_env.NOTIFY_STUB && _env.EMAIL_PROVIDER !== 'resend')`. It requires an
    explicit `NOTIFY_STUB=false`. But:
      - the schema default is `'true'` (env.ts:157-160),
      - `.env.production.local` sets `NOTIFY_STUB="true"` (SMS is stubbed in prod today),
      - FI-014 Known Gaps still lists eSMS brandname registration as an unstarted HIGH blocker
        ("2-4 week hard blocker … must start the process"), so `NOTIFY_STUB=false` has never
        been a live configuration and is not near-term reachable,
      - the launch is explicitly email-first — `lib/payment/processWebhook.ts:409` and
        `lib/jobs/reconcilePayments.ts:438` both carry the comment "operators were blind under
        the email-first launch"; #339/#342 shipped customer + operator email as the primary channel.

    Net: the warn cannot fire in production. Worse, the configuration that actually destroys
    customer mail in THIS deployment — `NOTIFY_STUB=true` (as prod is) plus `EMAIL_PROVIDER`
    unset or reverted to `stub` — is precisely the combination the gate suppresses. #326
    decoupled email from SMS; this warn silently re-couples them, and inherits the same blind
    spot #337 was filed to close.

    Realistic trigger: a new Vercel environment (preview/staging), a lost/rotated env var, or a
    fresh deploy where only `EMAIL_PROVIDER` is missed. Email is then logged and marked `sent`
    with zero signal — the exact #337 harm — while this PR reports "handled".

    Fix: gate on the email flag alone — `if (_env.EMAIL_PROVIDER !== 'resend')` — optionally
    scoped to a real deployment (`process.env.NODE_ENV === 'production'` or `!_env.PAYMENTS_STUB`)
    so local/dev stub work stays quiet. `NOTIFY_STUB` must not appear in an email-severity predicate.

  [TEST / SAFETY PROPERTY — green test ratifies the dangerous config as intended behaviour]
  lib/config/__tests__/env.test.ts:69-76

    `it('does NOT warn when NOTIFY_STUB=true (SMS also stubbed — consistent)')` asserts that
    prod's actual flag combination produces silence, and names it "consistent". After #326 that
    reasoning no longer holds: SMS-stubbed says nothing about email, and this repo runs
    SMS-stubbed + email-live. The test does not verify a safety property — it encodes the
    author's framing of where the danger is and locks it in green, the same failure mode as the
    2026-07-23 Mistake Log entry ("the fixture is a verbatim description of the bad case, and by
    asserting the benign outcome I encoded it as intended behaviour").

    Fix: invert this case — with `EMAIL_PROVIDER` unset, assert the warn DOES fire regardless of
    `NOTIFY_STUB`. Keep a no-warn case only for `EMAIL_PROVIDER=resend`.

---

PRIORITY 2 — Fix before merge:

  [FAILURE MODE / LIFECYCLE] lib/config/env.ts:572-583 — "boot warn" is a misnomer
    `getEnv()` is lazy and memoized (`if (_env) return _env`), and nothing calls it at server
    start: `instrumentation.ts register()` initializes Sentry only and never touches `getEnv()`.
    So this is not a boot check — it fires on whichever request path first needs env inside each
    serverless instance, once per cold start, interleaved into request logs. A deploy of a
    misconfigured environment produces no signal at deploy time; the signal appears (if at all)
    only after traffic arrives, in whichever function warmed first. The PR title, PR body, code
    comment, DS-006 and FI-014 all call it a boot warn.
    Fix: either call `getEnv()` from `instrumentation.register()` so validation genuinely runs at
    startup (this also makes the existing `throw` a real fail-fast, which the file header at
    env.ts:4 already claims — "Parsed once at module-load time so misconfigured deploys fail
    fast" — and which is likewise not true today), or drop the "boot" framing everywhere.

  [OBSERVABILITY] lib/config/env.ts:589-591 — `console.warn` is unalertable
    The stated rationale (keep this foundational zod-only module dependency-free, matching the
    plain `throw`) is legitimate for the module, but the consequence is that the single signal
    for a silent customer-email outage is an unstructured stdout string. It is not JSON, does not
    carry the `logger` event-name field every other operational event uses (`reconcile.*`,
    `env.*`), is not routed through Sentry (`lib/observability/sentry.ts`), and matches no
    existing log-based alert. Combined with the P1, the practical detection probability is zero.
    Fix: emit the structured `logger.warn` from a caller that is allowed the dependency — the
    natural site is the same `instrumentation.register()` boot hook proposed above.

  [CORRECTNESS / STALE COMMENTS IN THE EDITED FILE] lib/config/env.ts:146-153 and :333-334
    The PR updates DS-006 and FI-014 to the two-flag reality but leaves the pre-#326 model
    asserted twice inside the file it is editing, ~250 lines above the new warn:
      - L147-153: "When NOTIFY_STUB="true" … the SMS/email channel adapters record + log the
        dispatch" and "Email has no real provider yet, so a real-mode deploy still stubs email".
        Resend has been wired since #080/#326; this is false.
      - L333: `// EMAIL_PROVIDER="stub" (default) → NOTIFY_STUB covers; no real send.`
        "NOTIFY_STUB covers" is exactly the false belief #337 exists to correct, and it is the
        belief that produced the P1 gate above.
    A future reader hits these comments before the warn. Fix in this PR — the docs edits are
    incomplete without them.

  [SPEC / SEVERITY — warn vs hard fail] lib/config/env.ts superRefine (unchanged by this PR)
    Every other real-mode credential gap in this schema is a boot **failure**: ESMS (L372-382),
    S3 (L384-394), SePay (L396-404), MISA (L486-503), and Resend's own `RESEND_API_KEY`
    (L506-514). Email is now the primary customer-facing channel for booking confirmation and
    the primary operator channel for new bookings, on a site taking real money
    (`PAYMENTS_STUB="false"` in prod). A production env with `EMAIL_PROVIDER !== 'resend'` is
    therefore closer in kind to those hard-fail cases than to a warn. The PR body's justification
    ("SMS-only deployments are legitimate") is true in the abstract but not true of this
    deployment, which has no SMS at all.
    Recommendation: make it a `superRefine` error under `NODE_ENV === 'production'` and keep a
    warn (or nothing) elsewhere. **If you do this, WT-20(b) applies**: the ci.yml E2E job builds
    with `NODE_ENV=production`, so `EMAIL_PROVIDER` + `RESEND_API_KEY` placeholders must be added
    to that job's env block in the SAME commit or the E2E build fails the Zod gate. As the PR
    stands (no superRefine change) CI is unaffected — see CI-ENV note below.

---

PRIORITY 3 — Address when convenient:

  [TEST] lib/config/__tests__/env.test.ts — the "one-time" claim is untested
    Both the code comment ("Boot warn (once — _env is cached)") and the PR body assert
    once-per-process. No test calls `getEnv()` twice and asserts
    `expect(warnSpy).toHaveBeenCalledTimes(1)`. Cheap to pin; today a refactor that moves the
    warn above the `_env` assignment would log on every call and stay green.

  [TEST] lib/config/__tests__/env.test.ts — only the *unset* EMAIL_PROVIDER case is covered
    `EMAIL_PROVIDER='stub'` explicitly set exercises the same branch and is the shape a real
    `.env` file usually has (see `.env.example` / SI-002 §5.3, which document `stub` as the
    written-out dev value). Add it as a parity case.

  [TEST HYGIENE] lib/config/__tests__/env.test.ts:36 — `process.env = savedEnv`
    Reassigning `process.env` replaces Node's magic env object with a plain object for the rest
    of that worker's lifetime, dropping value-to-string coercion and native env propagation for
    any test file that runs after this one in the same worker. Prefer `vi.stubEnv(...)` +
    `vi.unstubAllEnvs()` in `afterEach`, or restore individual keys.

  [READABILITY / ASSERTION SOURCE] lib/config/env.ts:590 vs env.test.ts:41
    The event code `env.email.silently_stubbed` is embedded in a ~250-char inline string literal
    and the test matches it by re-typing the substring. Repo rule (Mistake Log, Issue 003):
    assertions on emitted output should reference the exported constant, not a re-typed copy —
    a rename in the source leaves the test green against a string that is no longer emitted.
    Fix: `export const EMAIL_STUB_WARN_CODE = 'env.email.silently_stubbed';` and use it on both
    sides.

---

CLEAN (checked, no finding):
  - Cat 2 Security: no secrets in diff, no new endpoint/authz surface, no user input, no sink.
    The warn text names no credential value.
  - Cat 6 Hygiene: no `console.log`/`debugger`/`.only`/`.skip`/commented-out code; no lockfile or
    generated-file churn; no unrelated formatting churn. The `console.warn` is intentional and
    documented (see P2 above for the tradeoff); repo has no `no-console` ESLint rule and
    `scripts/audit/*.sh` has no console guard.
  - Cat 4 Coverage: the new branch does have tests, and they are real (not stubs) — the defect is
    in what one of them asserts (P1 #2), not in their absence.
  - RSC purity: the warn adds no `Date.now()` / `Math.random()` / `crypto.randomUUID()` at module
    scope or in a render path. `console.warn` inside a memoized function is a side effect, not a
    non-determinism, and `react-hooks/purity` does not flag it. No purity regression.
  - Test BASE fixture is self-sufficient: `HOLD_SECRET` satisfies the 64-hex-char regex
    (env.ts:15-18); `PAYMENTS_STUB`/`STORAGE_STUB=true` and the three `ESMS_*` values clear every
    superRefine branch reachable at `NODE_ENV=test`; the production-required list (L533) is gated
    on `NODE_ENV==='production'` and correctly not needed.
  - No collateral noise: grep finds no other test that sets `NOTIFY_STUB='false'` or asserts on
    `console.warn`, so the new warn cannot break or pollute an existing suite.

SUMMARY: 2 P1, 4 P2, 4 P3

CI-ENV CHECK (WT-20 a + b):
  - (a) Scope guards: PR adds NO new var to the Zod schema — `EMAIL_PROVIDER`, `RESEND_API_KEY`,
    `EMAIL_FROM` and `NOTIFY_STUB` all pre-exist (env.ts:157, 338, 340, 342). Checked
    `scripts/audit/data-leak-grep.sh` (A1-A7) and `scripts/audit/greppable-invariants.sh`: the
    only name-scoped guard is A7 on `OTP_PEEK_ENABLED`. No guard on any var this PR touches.
    Also A3 (`use client` importing a server barrel) is untouched — no client file changed.
    → PASS, no CI audit exposure.
  - (b) superRefine parity: the PR makes NO change to the `NODE_ENV === 'production'` required
    list (env.ts:533) or to any superRefine branch, so no `.github/workflows/ci.yml` E2E env
    placeholder is required. → PASS, no ci.yml change needed for this diff.
    Caveat: this only holds because the PR chose warn over hard fail. If the P2 "warn vs hard
    fail" recommendation is adopted, (b) becomes mandatory in the same commit.

RECOMMENDED NEXT STEPS:
  → Fix P1 #1 (drop `NOTIFY_STUB` from the gate) and P1 #2 (invert the third test) together —
    they are one root cause and the test is what would otherwise re-approve the bug.
  → Decide P2 "warn vs hard fail" explicitly; if hard fail, add the ci.yml E2E placeholders in
    the same commit per WT-20(b).
  → Fold the P2 stale-comment fix (env.ts:147-153, :333) into this PR — the documentation edits
    are the PR's stated deliverable and are incomplete without them.
  → Re-run /code-review on the FIX, not just the original defect (Mistake Log, 2026-07-24 round-3
    corollary: fixing a review finding is itself a change that can introduce a worse one).
