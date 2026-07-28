---
depends-on: []
type: BUG
wave: 2
---

## Parent PRD

Plan: `C:\Users\mrimp\.claude\plans\with-all-the-issues-reactive-llama.md` — PR 5. GitHub #368.

## What to fix

Follow-up to merged PR #346. Not a defect in what shipped — a disclosed trade-off to tighten.

`dispatchRow` keys the Resend Idempotency-Key as `` `${row.id}:${row.attemptCount}` ``
(`lib/notification/dispatchNotifications.ts:120`). Resend keys live 24h and a replayed key returns
the original response **even if it was an error**, so a bare `row.id` would make attempts 2–5
replay attempt 1's cached failure and never re-send. Salting with the attempt number fixes that.

The residual: `sendViaResend` (`lib/notification/email.ts:160-191`) distinguishes two failure kinds
and then flattens them —

- `if (error)` — a **definite** vendor rejection. The email was not sent. Re-keying is correct.
- `catch` — an **unknown** outcome (timeout, socket reset). Resend may or may not have accepted it.

Both return `{ok:false}`, so `attemptCount` increments either way and the next attempt gets a fresh
key. On the `catch` path that is a **real duplicate send** — which the old bare-`row.id` design
would have deduped — and it raises worst-case billable sends per row from 1 to `MAX_ATTEMPTS` = 5.

The trade favours delivery over duplicate-avoidance, which is right for a ticket confirmation. It
is just currently implicit.

### Fix

Return a discriminated result from `sendViaResend` (`{outcome: 'rejected' | 'unknown'}`) and only
advance the key salt on `rejected`. The information already sits in the two branches; it has to be
threaded through `SendEmailResult` → `dispatchRow`'s return type → the retry decision at
`dispatchNotifications.ts:159-172`, which today always retries regardless of failure kind.

### Also from the same review

- No real-DB guard on the key. `dispatchNotifications.int.test.ts` never references
  `idempotencyKey` — it asserts behavioural outcomes only, with Prisma mocked elsewhere. The new
  unit test proves keys **differ** across attempts; nothing asserts they are **stable within** an
  attempt, which is the actual #335 crash-safety property.
- The SMS branch three lines below still passes a bare `row.id`
  (`dispatchNotifications.ts:129`) asserting the identical guarantee, with no eSMS vendor-doc
  citation. The email fix makes that asymmetry read as "already audited" — either cite it or fix it.

Crash-safety of what shipped is sound and was verified structurally: the success write sets
`status` and `attemptCount` in one atomic update, those are the only writers of `attemptCount`, and
no claim-predicate column is touched by a crash — so a re-claim rebuilds the same key.

## Acceptance criteria

- [ ] `sendViaResend` returns `{outcome:'rejected'|'unknown'}` alongside `ok`.
- [ ] The key salt advances only on `rejected`; an `unknown` outcome reuses the key.
- [ ] Real-DB integration test asserts key **stability within** one attempt.
- [ ] The SMS branch's bare `row.id` is either justified with a vendor-doc citation or fixed.

## Blocked by

- none

## Files

- `lib/notification/email.ts`, `lib/notification/dispatchNotifications.ts`
- `lib/notification/__tests__/dispatchNotifications.int.test.ts`

## Severity

P2 — worst case is a duplicate confirmation email and up to 5× billable sends on a flaky network.
