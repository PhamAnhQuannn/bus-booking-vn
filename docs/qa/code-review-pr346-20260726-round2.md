CODE REVIEW (ROUND 2) — PR #346 "fix(notifications): idempotency key for email dispatch (#335)" @ 658f930e
────────────────────────────────
Diff scope: 4 files, +123 / -20 lines (cumulative vs master)
  lib/notification/dispatchNotifications.ts                +26 /  -5
  lib/notification/email.ts                                +21 /  -9
  lib/notification/__tests__/email.test.ts                 +51 /  -3
  lib/notification/__tests__/dispatchNotifications.test.ts +25 /  -3

Base: master · Head SHA pinned: 658f930ef891880039831cbb7554214b3c6eff72 · State: OPEN (ready)
Round-1 report: `docs/qa/code-review-pr346-20260726.md` @ c966f846
Fix commit under review: `658f930` "fix(notifications): key idempotency per attempt, not per row"

Per CLAUDE.md 2026-07-24 (Bug B round 3): the fix is reviewed as new code, not merely as a delta.

---

## ROUND-1 FINDING DISPOSITION

| # | Round-1 finding | Status @ 658f930 |
|---|-----------------|------------------|
| **P1** | Vendor contract untranscribed; if Resend caches error responses the bare `row.id` poisons attempts 2-5 → permanent non-delivery | **FIXED** — docs transcribed + cited at the call site; key salted to `` `${row.id}:${row.attemptCount}` ``, exactly the remediation round 1 named |
| P2-1 | `dispatchNotifications.int.test.ts` untouched — nothing asserts the *real DB-assigned* id reaches the adapter | **NOT ADDRESSED** — see P2-b |
| P2-2 | `process.env.EMAIL_PROVIDER = undefined` writes the literal `"undefined"`; order-dependent suite break | **FIXED** — `if (prevProvider === undefined) delete …` |
| P2-3 | `vi.mock('resend')` `send: (...a: unknown[])` accepts any arity/shape — mock cannot fail | **NOT ADDRESSED** — unchanged |
| P3-1 | Whole-barrel `vi.mock('@/lib/core/config')` instead of `importOriginal`-spread | **NOT ADDRESSED** |
| P3-2 | `vi.mock('resend')` factory closes over a later `const`; works only via the dynamic import | **NOT ADDRESSED** |
| P3-3 | Three OTP callers pass no key with no recorded rationale | **PARTIALLY** — recorded in the PR body ("deliberately pass none"), still not at the three call sites |
| P3-4 | "cannot double-send" overstated — omits the 24h window and the `EMAIL_PROVIDER=resend` precondition | **PARTIALLY** — the window is now stated in the comment; the stub-path precondition is only in the PR body, not the source |

---

## ANSWER TO THE CENTRAL QUESTION: IS CRASH-SAFETY ACTUALLY PRESERVED?

**Yes — traced, and it holds. Verified against the real claim predicate, not the PR body's summary.**

The claim rests on "`attemptCount` is only incremented once the attempt's outcome is persisted."
That is **true and structurally enforced**, not incidental:

- **Success write** (`dispatchNotifications.ts:151-162`) sets `status:'sent'` **and**
  `attemptCount: row.attemptCount + 1` in a **single** `prisma.notificationLog.update`. There is no
  intermediate state in which the counter has advanced but the status has not — one statement, one
  round trip, atomic at the row.
- **Failure write** (`:165-177`) likewise sets `status:'failed'`, `attemptCount: nextAttempt`, and
  `nextAttemptAt` in one `update`.
- **Nothing else in the repo writes `NotificationLog.attemptCount`** — the two updates above are the
  only writers.

So the answer to "is there any path where the row is re-claimed with a DIFFERENT `attemptCount`
after a successful send but before the status write?" is **no**. A crash at any point between
`sendEmail` returning and that `update` committing leaves the row byte-identical to how it was
claimed: `status` still `pending|failed`, `attemptCount` still N, `nextAttemptAt` untouched.

**Claim predicate re-read** (`claimDueRows`, `:82-95`):
```sql
WHERE status IN ('pending','failed')
  AND attemptCount < 5                                  -- MAX_ATTEMPTS
  AND (nextAttemptAt IS NULL OR nextAttemptAt <= now)
  AND (scheduledFor IS NULL OR scheduledFor <= now)
```
Every column in that predicate is unchanged by a crash, so the row is immediately re-due and is
re-claimed at the **same** `attemptCount` → `dispatchRow` rebuilds the **identical** key → Resend
replays the cached success. No duplicate. `MAX_ATTEMPTS` gating is also safe: the counter did not
advance, so a crash cannot consume an attempt.

**Timing margin is comfortable, and I checked it rather than assuming it.** `vercel.json` schedules
`/api/cron/dispatch-notifications` at `* * * * *` — **every minute**. Re-claim after a crash happens
within ~60s, against a 24h key retention window. Even the full retry span the PR body cites
(2+4+8+16+30 ≈ 60 min) is three orders of magnitude inside it.

**Concurrency (the harder case) also converges.** `claimDueRows`' transaction **commits and releases
the `FOR UPDATE SKIP LOCKED` row locks before any network I/O** — the file's own header documents
this and says the advisory lock `'notify-dispatch'` is what actually serializes ticks. So if that
lock ever failed to serialize (manual trigger racing a scheduled tick), two dispatchers could hold
the same row concurrently. Per-attempt keying is *safe* here, and in fact safer than a naive scheme:
both ticks read the same `attemptCount`, so both build the **same** key, so whichever request Resend
processes first defines the cached response and the other replays it. Both then write the same
`attemptCount + 1`. No divergence, no double-send.

**The one class of coverage this fix gives up** is not the crash case — it is the
*success-at-the-vendor-but-failure-at-the-client* case. See P2-a. That is a real narrowing, it is
the correct trade, and the diff does not name it.

---

## OTHER VERIFICATIONS REQUESTED

**Does the key stay within 256 chars?** — **YES, with ~10x margin.**
`NotificationLog.id` is `String @id @default(cuid())` (`prisma/schema.prisma:443`) → 25 chars.
`attemptCount` is `Int @default(0)` gated at `< MAX_ATTEMPTS = 5` → 1 digit. Key = `25 + 1 + 1 = 27`
chars, always. Not close to the limit under any input.
*Nit:* the source comment justifies this with "cuid ids are **alphanumeric**, so this stays well
under Resend's 256-char limit" — alphanumeric is a charset property, not a length property. The
conclusion is right; the stated reason does not support it. See P3-a.

**Does anything else construct or depend on this key format?** — **NO. Verified by grep.**
`grep -rn 'idempotencyKey' lib app e2e scripts` returns matches only in:
- `lib/ledger/refund.ts`, `lib/ledger/withdrawal.ts`, `lib/jobs/reconcilePayments.ts` — a **completely
  separate namespace**: those are Postgres `LedgerEntry.sourceEventId` keys (`refund_out:<k>`,
  `withdraw-key:<k>`, `oversold:<bid>:<txn>`). They never reach an HTTP header and no code path
  connects them to the Resend key.
- `lib/notification/email.ts` / `dispatchNotifications.ts` — the producer and the sole consumer.

The key is **write-only from the app's perspective**: it is constructed, passed to the SDK, and never
parsed back apart, never persisted, never compared. `externalRef` stores Resend's *returned message
id*, not the key. So the format is free to change without breaking any reader — but also means there
is no audit trail of which key a given delivery used (P3-b).

**Is `dispatchNotifications.int.test.ts` still valid, given it was NOT updated?** — **YES, it remains
valid and passing; it is simply blind to this change.** Read in full at the head SHA:
- Every `enqueue()` defaults to `channel: 'sms'` and the file's own `beforeEach` scopes to rows it
  created, so the email branch is not exercised at all.
- It runs under the unit/int env where `EMAIL_PROVIDER` is unset → `emailStubbed()` returns true
  (`email.ts`) → `sendViaResend` is never reached → `idempotencyKey` is dropped before any SDK call.
- Its documented properties ("re-run does NOT double-send", "two concurrent dispatchers do not
  double-claim", `@@unique([bookingId, template])`, `scheduledFor` / `nextAttemptAt` gating) all rest
  on the claim SQL and DB constraints, none of which this PR touches.

So: **not invalidated, and not a stale test.** But it is exactly the file round-1 P2-1 asked to
extend, and it is the only place the "one producer, two consumers" rule could be honoured. Still
open — P2-b.

---

PRIORITY 1 — Block merge, fix first:

  **NONE.** The round-1 P1 is genuinely resolved, resolved the right way (vendor docs transcribed
  and cited at the call site, per the 2026-07-21 SePay rule), and the resulting key change does not
  break the crash-safety property #335 exists to provide. No new correctness, security, or
  failure-mode defect is introduced on a risk path.

---

PRIORITY 2 — Fix before merge:

  [FAILURE MODE / UNNAMED COVERAGE REGRESSION — a definite-vendor-rejection and an unknown-outcome
   are collapsed into the same `ok:false`, and only one of them is safe to re-key]
  lib/notification/email.ts:181-191 → lib/notification/dispatchNotifications.ts:122

    The fix is correct in the direction it moves, but it silently gives up a class the old key
    covered, and neither the comment nor the PR body names it.

    `sendViaResend` already distinguishes the two failure kinds — and then throws the distinction
    away:
    ```ts
    if (error) {                                   // ← Resend ANSWERED and REJECTED.
      return { ok: false, error: error.message };  //   The send definitely did not happen.
    }
    ...
    } catch (err) {                                // ← network error / timeout / socket reset.
      return { ok: false, error: 'resend_exception' };  //   Outcome is UNKNOWN — the message
    }                                                   //   may already be queued at Resend.
    ```
    Both collapse to `ok:false` → `attemptCount` N→N+1 → the next attempt uses key `:N+1`, a key
    Resend has never seen → **it sends again**. For the `if (error)` branch that is exactly right
    (and is the whole point of the fix). For the `catch` branch it is a **genuine duplicate customer
    email** on `customerBookingPaid` / `ticketReady`, and the bare-`row.id` design this PR replaces
    would have deduped it.

    Net effect: dedupe coverage narrows from "any retry of this row" to "re-claims of the same
    attempt only". That is the **right trade** — permanent non-delivery of a paid-booking
    confirmation is strictly worse than an occasional duplicate — but the source comment asserts
    "Crash-safety is preserved because attemptCount is a persisted column…" and reads as though
    coverage is unchanged. A future reader (or a future `MAX_ATTEMPTS` bump) will believe a
    guarantee that no longer exists in the timeout case.

    Also relevant: there is **no explicit timeout** on the Resend call (no `AbortSignal.timeout`,
    SDK default only), so the unknown-outcome branch is not hypothetical under a slow vendor.

    Fix (either, in ascending cost):
    (a) Minimum — state it. Add to the `dispatchRow` comment: "a client-observed failure whose
        server-side outcome is unknown (the `catch` branch in `sendViaResend`) re-keys and may
        therefore duplicate; a vendor-rejected send (`if (error)`) is safe to re-key." That converts
        a hidden regression into a recorded trade-off.
    (b) Better — carry the distinction. Return a discriminated result from `sendViaResend`
        (`{ ok:false, retryable:'rejected' | 'unknown' }`) and have `dispatchRow` reuse the SAME key
        when the previous failure was `'unknown'`, re-key only after a definite rejection. This is
        the repo's own established pattern (CLAUDE.md 2026-05-19 Issue 013: "idempotent operations
        must use a **discriminated result** from the service layer, not a thrown sentinel"), and the
        information is already sitting in the two branches — it just needs to survive the return.

  [TEST / ROUND-1 P2 CARRIED FORWARD — both sides of the assertion are still hand-typed, and the
   key got MORE complex without a real-DB guard]
  lib/notification/__tests__/dispatchNotifications.test.ts:118-149 · `dispatchNotifications.int.test.ts` untouched

    Round 1 raised this against a one-component key. The fix made the key **two** components, so the
    hand-typed-on-both-sides surface grew rather than shrank:
    ```ts
    row({ id: 'log-e', channel: 'email', attemptCount: 3 })   // producer: hand-typed
    expect(...).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'log-e:3' }), // consumer: hand-typed
    );
    ```
    Prisma is mocked, so nothing proves the value reaching the adapter is the **actual persisted
    cuid** of a real row, nor that `attemptCount` read back from the DB is the same integer the
    update wrote. This is the 2026-07-23 SePay ref-case rule verbatim ("one producer, two consumers,
    never a hand-typed shape on both sides") — the rule that exists in this repo precisely because
    33 green tests once proved nothing while 100% of bank transfers failed.

    **And the more important half of the property has no test at all.** The new test proves keys
    **differ** across attempts. Nothing proves keys are **stable within** an attempt — which is the
    property #335 is actually about and the one this review had to establish by reading the update
    statements by hand. A test that claims a row, asserts the key, simulates the crash (no status
    write), re-claims, and asserts the **same** key would have made that self-evident.

    Fix: extend `dispatchNotifications.int.test.ts` — enqueue a real `channel:'email'` row, spy the
    adapter, run the job, and assert the captured key `=== `${dbRow.id}:${dbRow.attemptCount}`` read
    back from `prisma.notificationLog.findFirst`. Then re-run without persisting the outcome and
    assert the key is unchanged. Add the differs-across-attempts case as the third assertion.

  [CONSISTENCY / THE SIBLING CALL 3 LINES BELOW NOW LOOKS AUDITED AND IS NOT]
  lib/notification/dispatchNotifications.ts:126-128 (SMS branch, unchanged)

    The fix commit added a vendor-doc URL, a retention-window figure, and an explicit
    cached-error analysis above the email branch. Three lines below it, the SMS branch still reads:
    ```ts
    // channel === 'sms' — row.id is the eSMS RequestId (idempotency key) so a
    // cron re-run of the same row cannot double-send.
    return sendSmsBody({ ..., requestId: row.id });
    ```
    — a **bare `row.id`, asserting the identical guarantee, with no vendor-doc citation and no
    retention-window figure**, i.e. exactly the pre-fix email code. `lib/notification/esms.ts:229-230`
    repeats the claim in prose, also uncited.

    The eSMS `RequestId` question is the same question this PR just answered for Resend: does eSMS
    replay a cached response for a repeated `RequestId`, and does it do so for **errors** too? If it
    does, the SMS channel has the identical permanent-non-delivery bug the fix commit just removed
    from email — and the templates are the same customer-facing ones. If it does not, the "cannot
    double-send" claim on the SMS branch is unfounded in the other direction.

    Strictly this is pre-existing and outside `#335`'s scope. It is raised at P2 because the fix
    **changed the local reading**: a maintainer scanning `dispatchRow` now sees one branch with a
    cited vendor contract and one without, and will reasonably infer the second was checked and
    found fine. That inference is unsupported. This is the greppable smell named in CLAUDE.md
    2026-07-21 ("a webhook route whose auth-header parse and success-response shape have no
    vendor-doc URL within a few lines of them"), applied to the send direction.

    Fix (cheap): one line in the SMS comment — "eSMS RequestId semantics not yet transcribed from
    vendor docs; tracked in <issue>" — or transcribe them and mirror the email treatment. Do **not**
    silently leave the asymmetry; NOTIFY_STUB=true today means it is currently inert, which makes
    now the cheap moment.

  [TEST / ROUND-1 P2-3 CARRIED FORWARD — the vendor-boundary mock still cannot fail]
  lib/notification/__tests__/email.test.ts:19-23

    Unchanged from round 1:
    ```ts
    vi.mock('resend', () => ({
      Resend: class { emails = { send: (...a: unknown[]) => emailsSendMock(...a) }; };
    }));
    ```
    `(...a: unknown[])` accepts any arity and any shape, so the two idempotency tests assert against
    a mock the test itself defines. If Resend moved `idempotencyKey` into the payload object,
    renamed it, or changed the options position, both tests stay green. The real guard is `tsc`
    against `resend@6.12.4`'s `send(payload: CreateEmailOptions, options?: CreateEmailRequestOptions)`
    — which I re-verified holds (`node_modules/resend/dist/index.d.mts:1609`, `IdempotentRequest.idempotencyKey`
    at `:177-183`, and the runtime does set the header at `dist/index.mjs:1130`). So the contract is
    checked — just not by the tests that appear to check it.

    This matters more after the fix than before: the PR body now leans on the tests as the evidence
    ("14/14 pass", "New test asserts the same row at a later attemptCount produces a different key"),
    and one of the two vendor-boundary tests is self-referential.

    Fix: type the mock's `send` as `(payload: CreateEmailOptions, options?: CreateEmailRequestOptions) => …`
    so an SDK contract change breaks the test, not only the build.

---

PRIORITY 3 — Address when convenient:

  [COMMENT / REASONING DOES NOT SUPPORT THE CONCLUSION]
  lib/notification/dispatchNotifications.ts:120

    "cuid ids are alphanumeric, so this stays well under Resend's 256-char limit" — the charset is
    irrelevant to the bound. Say the number: "cuid is 25 chars + `:` + a single digit (`attemptCount
    < MAX_ATTEMPTS = 5`) = 27 chars, against Resend's 256 limit." Cite `schema.prisma:443`
    (`@default(cuid())`) so a future switch to a longer id type has a tripwire.

  [OBSERVABILITY / THE KEY IS NEVER RECORDED]
    The key is constructed, sent, and discarded — not persisted, not logged. `externalRef` holds
    Resend's returned message id, not the key. If a duplicate-delivery complaint arrives there is no
    way to reconstruct which key each attempt used without replaying `attemptCount` history that the
    row does not keep (it stores only the current count). Cheap mitigation: include the key in the
    existing `logger.warn({ logId, channel, template, attempt }, 'notify.dispatch.failed')` at
    `:178-181` — the components are already there, and it is not PII.

  [DOC / STUB-PATH PRECONDITION STILL MISSING FROM THE SOURCE (round-1 P3-4, partial)]
  lib/notification/dispatchNotifications.ts:104-121 and `email.ts` `SendEmailInput.idempotencyKey` doc block

    The comment now covers the 24h window (good — that was the round-1 ask) but still omits that the
    entire mechanism is **inert unless `EMAIL_PROVIDER === 'resend'`**: `emailStubbed()` short-circuits
    in `sendEmail` before `sendViaResend` and the key is dropped. The PR body says this under "Not
    delivered"; the source does not. Note that `.env.production.local` **does** set
    `EMAIL_PROVIDER="resend"`, so this PR is live in prod on merge and inert everywhere else — which
    is worth one clause in the comment, because it also explains why no local/CI run can exercise it.

  [SCOPE / ROUND-1 P3-3 CARRIED FORWARD]
  lib/account/customerOtp.ts:102 · lib/auth/operatorLoginOtp.ts:100 · lib/auth/sendOtp.ts:70

    The PR body now records the decision ("the three OTP callers deliberately pass none") but the
    three call sites still do not. The parameter is optional, so nothing forces a future caller to
    decide. One-line comment at each site: `// no idempotencyKey: each OTP send is a distinct
    operation — deduping would suppress a legitimately new code.`

  [TEST / ROUND-1 P3-1, P3-2 CARRIED FORWARD]
  lib/notification/__tests__/email.test.ts:24-26 and :19-23

    Whole-barrel `vi.mock('@/lib/core/config', () => ({ getEnv: ... }))` (should be the repo's
    092b `importOriginal`-spread form), and the `vi.mock('resend')` factory closing over the later
    `const emailsSendMock` — which works **only** because `email.ts` reaches the SDK through a
    dynamic `await import('resend')` inside `getResendClient()`. Convert that to a static import and
    this file dies with "Cannot access 'emailsSendMock' before initialization". Make it explicit with
    `vi.hoisted()`.

---

## CLAUDE.md MISTAKE-LOG CROSS-CHECK (auto-P1 on match)

| Entry | Match? |
|-------|--------|
| **#328** — second `NotificationLog` row for the same `(bookingId, template)` | **CLEAN.** Zero `notificationLog.create` / `createNotificationLog` / `enqueuePendingNotification` in the diff. The key is derived from an already-persisted PK; idempotency lives at the vendor, outside Postgres. No new P2002-in-`$transaction` path. |
| **2026-07-23** — recovery logic in a `catch` inside `prisma.$transaction` | **CLEAN.** `dispatchRow` runs strictly outside any transaction by design; `claimDueRows`' `$transaction` is untouched. |
| **2026-07-21** — vendor contract inferred, not transcribed; fixture re-encodes the assumption on both sides | **HALF-CLEARED.** The *contract* half is now fully satisfied (doc URL + quoted retention + quoted error-replay semantics at the call site) — this is the model of what the rule asks for. The *fixture* half is not: the resend mock still cannot fail (P2-d) and the key assertion is hand-typed on both sides (P2-b). |
| **2026-07-23** — "a test that asserts ambiguity resolves *somehow* is not a safety test" | **PARTIAL.** The new test asserts the right *direction* (keys differ per attempt) but the safety property (keys are *stable within* an attempt) is untested — see P2-b. |
| **PII / logger redact list** | **CLEAN.** The key is an opaque row PK + a small integer, already logged unredacted as `logId` / `notificationId` in this same file. Not a credential. Not passed to `logger` by the new code. |
| **2026-07-24 Bug B round 3** — "any HOLD/retry state whose release condition is a pure function of immutable inputs is a permanent state" | **CLEAN, and this fix is the inverse.** The round-1 defect *was* that shape (a permanently-cached failure with no release path); salting with `attemptCount` makes the release condition a function of a **mutable, monotonically advancing** column. Correct direction. |

---

SUMMARY: 0 P1, 4 P2, 5 P3

FIX VERDICT: **Crash-safety is genuinely preserved, and I verified it structurally rather than
taking the PR body's word.** The success and failure writes each set `status` and `attemptCount` in
one atomic `prisma.notificationLog.update`, those two statements are the **only** writers of
`attemptCount` in the repo, and every column in the claim predicate is untouched by a crash — so a
re-claim after a crash reads the identical `attemptCount` and rebuilds the identical key. The cron
runs **every minute** (`vercel.json`), so re-claim lands ~60s into a 24h key window. Concurrent
dispatchers converge for the same reason. The round-1 P1 is fixed the right way, with the vendor
contract transcribed and cited. What the fix does **not** preserve, and does not disclose, is dedupe
for the *unknown-outcome* failure (Resend accepted but the client saw a timeout) — a real narrowing
that the code already has the information to fix properly (P2-a). Round-1's int-test and mock P2s
are still open, so the property remains established by reading, not by testing.

RECOMMENDED NEXT STEPS:
  → No P1 blocks merge.
  → P2-a is the one with real production consequence: at minimum document the re-key-on-unknown
    duplicate window; ideally return a discriminated `{retryable:'rejected'|'unknown'}` so the key is
    only rotated after a definite vendor rejection.
  → P2-b (int-test with a real DB-assigned id + a stability assertion) is the guard this repo's own
    mistake log says is the only thing that catches this class.
  → P2-c (SMS branch asymmetry) is a one-line comment now, or the same bug rediscovered later when
    `NOTIFY_STUB` flips to false.
