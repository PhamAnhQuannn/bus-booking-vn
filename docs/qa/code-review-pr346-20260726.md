# CODE REVIEW — PR #346 "fix(notifications): idempotency key for email dispatch (#335)" @ `c966f846`

```
Base: master   Head: fix/335-email-idempotency @ c966f846fd50e1e0a6a3b291eafd11133eeac810
Diff scope: 4 files, +80 / -12
CI at review time: all 12 checks green (Lint & Typecheck, Unit, Integration, E2E, Data Leak Audit, gitleaks)
```

Changed files:

| File | +/- |
|------|-----|
| `lib/notification/email.ts` | +21 / -9 |
| `lib/notification/dispatchNotifications.ts` | +4 / -1 |
| `lib/notification/__tests__/email.test.ts` | +52 / -2 |
| `lib/notification/__tests__/dispatchNotifications.test.ts` | +3 / -0 |

---

## Verified clean (CLAUDE.md Mistake Log cross-check)

These were checked first because the Mistake Log makes them auto-P1 when matched. None matched.

- **#328 (`NotificationLog` `@@unique([bookingId, template])`, `channel` NOT in key)** — CLEAN. The diff adds **zero** `notificationLog.create` / `createNotificationLog` / `enqueuePendingNotification` calls. The idempotency key is *derived from* an already-persisted row's primary key (`row.id`); it neither creates a second same-`(bookingId, template)` row, nor changes the meaning of the unique key, nor makes a per-channel row necessary. The Resend key lives entirely outside Postgres.
- **2026-07-23 (no recovery logic in a `catch` inside `prisma.$transaction`)** — CLEAN. `dispatchRow` is invoked **outside** any transaction by design (the file's header documents the claim-then-dispatch outbox pattern: network I/O must not be held inside the advisory-lock tx). `claimDueRows`' `$transaction` is untouched by this PR.
- **Charter false-positive (#367)** — Not applicable; `lib/charter/charterStatus.ts` is not in the diff.
- **PII / logger redact list** — CLEAN, no change required. `idempotencyKey` is `NotificationLog.id`, an opaque row PK already logged unredacted in this very file as `logId` / `notificationId` (`dispatchNotifications.ts:150,163`). It is not a credential, token, or proof. It is never passed to `logger` by the new code.
- **Type-level vendor contract** — VERIFIED against the installed SDK. `resend@6.12.4` declares `send(payload: CreateEmailOptions, options?: CreateEmailRequestOptions)` (`node_modules/resend/dist/index.d.mts:1609`) and `interface CreateEmailRequestOptions extends PostOptions, IdempotentRequest` (`:596`), where `IdempotentRequest.idempotencyKey?: string` is documented as "will be sent as the `Idempotency-Key` header" (`:177-183`). `PostOptions` fields are all optional (`:220-225`), so `{ idempotencyKey }` is assignable. The PR body's "typed API in resend@6" claim is accurate and `tsc --noEmit` is a real guard on the call shape.

---

## PRIORITY 1 — Block merge

### [CORRECTNESS / VENDOR CONTRACT — Mistake Log 2026-07-21 pattern] `lib/notification/email.ts:171-180`

The retry loop's safety rests on an **untranscribed, uncited vendor claim**.

`dispatchNotifications` retries a failed row up to `MAX_ATTEMPTS = 5` with exponential backoff, and every retry now reuses the **same** `idempotencyKey = row.id`:

```ts
const { data, error } = await client.emails.send(
  { from, to, subject, html, text },
  idempotencyKey ? { idempotencyKey } : undefined,
);
```

Two vendor behaviours are load-bearing and neither is stated anywhere in the diff, the PR body, or a comment:

1. **Key retention window.** Resend keys are retained for a bounded period (documented as 24h). The dispatcher's worst-case retry span is `2 + 4 + 8 + 16 + 30 ≈ 60 min` (`backoffMs`, `BACKOFF_CAP_MINUTES = 30`, `MAX_ATTEMPTS = 5`), comfortably inside it — but that arithmetic is the whole reason the fix works and it is recorded nowhere. A future bump to `MAX_ATTEMPTS` or `BACKOFF_CAP_MINUTES` silently voids the guarantee with no tripwire.
2. **Retry-after-failure semantics.** If Resend caches *non-2xx* responses under the key (rather than only successful ones), then the first transient 5xx/network failure poisons the key: attempts 2-5 all return the cached error, `attemptCount` reaches `MAX_ATTEMPTS`, and the row is **permanently failed with the email never sent**. The affected templates include `customerBookingPaid` and `ticketReady` — payment-adjacent, customer-visible. Before this PR a transient failure retried cleanly; after it, the retry is only safe if the vendor behaves as assumed.

This is the exact shape of the 2026-07-21 SePay go-live entry: a third-party wire contract inferred rather than transcribed, with a test fixture that re-encodes the author's assumption on both sides (`vi.mock('resend', ...)` — see P2 #4) so green tests prove nothing about the vendor boundary. The type declarations retire the *shape* risk but say nothing about *semantics*.

**Fix (cheap, likely confirms the current design):** cite `https://resend.com/docs/dashboard/emails/idempotency-keys` in a comment adjacent to `client.emails.send`, quoting (a) the key retention window and (b) whether failed requests may be retried with the same key. In the same comment, state the dispatcher's max retry span and that it fits inside the window. If the docs say error responses *are* cached, the key must be salted per attempt (`` `${row.id}:${row.attemptCount}` ``) — which is a materially different fix, so this must be resolved before merge, not after.

---

## PRIORITY 2 — Fix before merge

### [TEST / MISSING INTEGRATION GUARD] `lib/notification/__tests__/dispatchNotifications.int.test.ts` — untouched

The PR ships unit tests only. The repo already has an integration file whose documented scope is precisely this behaviour:

```
 *  - enqueue a pending row → dispatch → status='sent', sentAt + externalRef set
 *  - re-run does NOT double-send (already 'sent' rows are not reclaimed)
 *  - the @@unique([bookingId, template]) idempotency guard ...
```

It was not extended. Per the #328 corollary, unit tests here mock the persistence layer, so both sides of the new assertion hand-type the **same** fixture id:

- `dispatchNotifications.test.ts` builds a mock row with `id: 'log-e'` and then asserts `idempotencyKey: 'log-e'`.

That proves the field name is threaded; it does not prove the value that reaches the adapter is the *actual persisted cuid* of a real `NotificationLog` row. This is the "one producer, two consumers, never a hand-typed shape on both sides" rule from the 2026-07-23 SePay ref-case entry, applied to an internal key.

**Fix:** in `dispatchNotifications.int.test.ts`, enqueue a real row, spy the email adapter, run the job, and assert the captured `idempotencyKey` `===` the id the DB assigned (read back from `prisma.notificationLog.findFirst`), not a literal.

### [TEST / ENV POLLUTION — order-dependent suite break] `lib/notification/__tests__/email.test.ts` (new `describe`, `prevProvider` capture + `afterEach`)

```ts
const prevProvider = process.env.EMAIL_PROVIDER;
...
afterEach(() => {
  process.env.EMAIL_PROVIDER = prevProvider;   // ← prevProvider is undefined
  _resetResendClient();
});
```

`vitest.setup.ts` sets only `DATABASE_URL` and `NOTIFY_STUB`; nothing sets `EMAIL_PROVIDER`. So under `pnpm test`, `prevProvider` is `undefined`, and `process.env.X = undefined` **coerces to the string `"undefined"`** — it does not delete the key. `process.env` is shared across test files within a vitest worker (module-registry isolation does not isolate `process.env`).

Downstream consequence is not cosmetic: `lib/config/env.ts:338` declares `EMAIL_PROVIDER: z.enum(['stub','resend']).default('stub')`. Zod's `.default()` applies only to `undefined` — the literal string `"undefined"` fails the enum. Any test scheduled after this file in the same worker that calls the real `getEnv()` will fail env validation. Currently green by scheduling luck.

**Fix:**
```ts
afterEach(() => {
  if (prevProvider === undefined) delete process.env.EMAIL_PROVIDER;
  else process.env.EMAIL_PROVIDER = prevProvider;
  _resetResendClient();
});
```

### [TEST / MOCK CANNOT FAIL] `lib/notification/__tests__/email.test.ts` — the `resend` module mock

```ts
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: (...a: unknown[]) => emailsSendMock(...a) };
  },
}));
```

`(...a: unknown[])` accepts any arity and any shape. If Resend moved `idempotencyKey` into the payload object, renamed it, or changed the options position, this test would still pass — it asserts against itself. The genuine guard is `tsc` (verified above), meaning the two new test cases add near-zero independent evidence at the vendor boundary while reading as if they do.

**Fix:** type the mock's `send` against the real exported types (`(payload: CreateEmailOptions, options?: CreateEmailRequestOptions) => ...`) so an SDK contract change breaks the test rather than only the build, and drop the `unknown[]` rest signature.

---

## PRIORITY 3 — Address when convenient

### [TEST / HYGIENE] `lib/notification/__tests__/email.test.ts` — whole-barrel config mock

`vi.mock('@/lib/core/config', () => ({ getEnv: () => ({ ... }) }))` replaces the entire barrel — which is `export * from '@/lib/config'` — with one symbol, for **every** test in the file including the pre-existing stub-path cases. Safe today (`email.ts` is the only file in `lib/notification/**` importing that specifier, and it imports only `getEnv`), but any future symbol silently becomes `undefined` at test time. The repo's own 092b remedy is the `importOriginal`-spread form:
```ts
vi.mock('@/lib/core/config', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getEnv: () => ({ RESEND_API_KEY: 'test_key', EMAIL_FROM: 'noreply@test.dev' }),
}));
```

### [TEST / HOISTING] `lib/notification/__tests__/email.test.ts` — factory closes over a later `const`

The `vi.mock('resend')` factory references `emailsSendMock`, a `const` that `vi.mock` hoisting places the factory above. This works **only** because `email.ts` reaches the SDK through a *dynamic* `await import('resend')` inside `getResendClient()`, so the factory runs at call time rather than at module-eval time. Convert a static import in `email.ts` and this file dies with "Cannot access 'emailsSendMock' before initialization". Make the ordering explicit with `vi.hoisted()`.

### [SCOPE / UNRECORDED DECISION] `lib/account/customerOtp.ts:102`, `lib/auth/operatorLoginOtp.ts:100`, `lib/auth/sendOtp.ts:70`

The three direct `sendEmail` callers pass no key, and the new param is optional so nothing forces a decision. Omission is almost certainly *correct* for OTP — each send is a distinct operation and deduping would suppress a legitimately new code — but that reasoning is nowhere in the source. A future caller inherits non-idempotent behaviour silently.

**Fix:** one-line `// no idempotencyKey: each OTP send is a distinct operation` at each site.

### [DOC / OVERSTATED GUARANTEE] `lib/notification/dispatchNotifications.ts` (new comment) and `lib/notification/email.ts` (`SendEmailInput.idempotencyKey` doc block)

> "…cannot double-send"

The guarantee is conditional on two things the comment omits: (a) `EMAIL_PROVIDER === 'resend'` — the stub path drops the key entirely, so under the current stub deployment this PR is a no-op; (b) the vendor key-retention window (P1). Qualify both.

---

## SUMMARY: 1 P1, 3 P2, 4 P3

## RECOMMENDED NEXT STEPS

1. Resolve P1 by transcribing the Resend idempotency-key doc into a call-site comment. If failed requests are *not* retryable under the same key, the key must be salted with `attemptCount` — that changes the fix, so settle it before merge.
2. Fix the `process.env.EMAIL_PROVIDER = undefined` restore (P2) — one-line, prevents a latent order-dependent suite failure.
3. Extend `dispatchNotifications.int.test.ts` to assert the real DB row id reaches the adapter (P2).
4. P3s can ride this PR or a follow-up.
