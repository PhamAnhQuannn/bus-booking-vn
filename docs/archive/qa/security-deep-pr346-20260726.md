# SECURITY-DEEP REVIEW — PR #346 "fix(notifications): idempotency key for email dispatch (#335)"

```
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/346
Base/Head: master ← fix/335-email-idempotency @ c966f846
Decision:  (none)          State: OPEN, ready
Generated: 2026-07-26
Scope:     lib/notification/email.ts, lib/notification/dispatchNotifications.ts, + 2 __tests__
```

**Findings: 2 (P1: 0 · P2: 0 · P3: 2)**

---

## P1 — BLOCKING

None.

---

## P2 — SHOULD FIX

None.

---

## P3 — ADVISORY

### `lib/notification/email.ts` — `SendEmailInput.idempotencyKey` → outbound HTTP header, no boundary validation

ℹ️ **P3 (Cat 2 — new value reaching a sink).** The PR adds a public, optional, unconstrained `string` to the exported `SendEmailInput` contract, and forwards it verbatim to a sink that is an **HTTP header value**:

```ts
idempotencyKey?: string;          // public API surface, any string
...
await client.emails.send({ ... }, idempotencyKey ? { idempotencyKey } : undefined);
// → SDK emits it as the `Idempotency-Key` request header
```

There is no charset, length, or format guard anywhere between the caller and the header.

**Not exploitable today.** The only caller that supplies it is `dispatchRow`, passing `row.id` — a `NotificationLog.id`, `@default(cuid())` (`prisma/schema.prisma:443`), read out of `claimDueRows`' `SELECT "id" FROM "NotificationLog"`. Fully server-generated, `[a-z0-9]`-only, never attacker-influenced. No untrusted input reaches this sink in the current diff.

**Why it is still worth a guard.** This repo has an established, live pattern of reconstructing internal keys from third-party input — `lib/payment/adapters/bankTransfer.ts` rebuilds a `bookingRef` out of a SePay webhook memo (mistake log, 2026-07-23). A future caller keying idempotency on such a value (e.g. `` `booking:${bookingRef}` ``) would put externally-derived bytes into a header with no validation. Both outcomes are bad:

- **CRLF / invalid header bytes** — `undici` rejects the header and throws, which lands in `sendViaResend`'s existing `catch` and returns `{ ok: false, error: 'resend_exception' }`. The dispatcher then burns all 5 attempts and leaves the row permanently `failed`: a **silent notification loss** with an opaque error string, not a visible crash.
- **Key collision / pre-burn** — because the key is now the *sole* dedupe token, whoever controls it controls whether the genuine send happens. Server-derived keys make this a non-issue; caller-controlled keys would turn it into a cross-record suppression primitive.

**Fix (cheap, forward-looking):** validate at the boundary in `sendEmail` before forwarding — reject/strip anything not matching `/^[A-Za-z0-9_-]{1,256}$/` — or narrow the type from `string` to a branded `NotificationLogId`. Either makes the "server-derived only" invariant explicit instead of incidental.

### `lib/notification/dispatchNotifications.ts` — internal row PK now crosses the processor boundary

ℹ️ **P3 (Cat 6 — data minimisation / cross-border).** `NotificationLog.id` is now transmitted to Resend (US) on every send and retained in their idempotency store for the key's validity window. cuid is timestamp-prefixed and counter-ordered, so the value discloses approximate row-creation time and per-process sequence ordering to the vendor.

**Marginal in practice** — Resend already processes the recipient address, subject, and full rendered HTML body for the same message, which is strictly more sensitive than an opaque internal id. This is not a leak of anything the processor cannot already infer.

**Why it is logged here:** it is a *new* internal identifier crossing the trust boundary, and the project's cross-border transfer assessment (Vietnam PDPL 2025, CDTIA — owner-handled) and PII inventory were not updated. **No code change needed** — a line in the PII inventory / processor record is sufficient.

---

## Verified clean (per category)

**Cat 1 — Crypto correctness: CLEAN.** No crypto primitive appears in the diff. No `createCipher`/`createCipheriv`, no `createHash`, no `Math.random()`, no KDF, no key material. The idempotency key is a **uniqueness** token, not a secret or an authenticator: it grants nothing, authenticates nothing, and has no unpredictability requirement — a primary key satisfies it exactly. `Math.random()`-for-token and weak-KDF patterns do not apply.

**Cat 2 — Threat-model delta: CLEAN apart from the P3 above.** No new file under `app/api/**`. No new route handler, server action, upload path, `eval`/`Function`/`child_process`, raw-SQL template, `dangerouslySetInnerHTML`, or redirect. No `searchParams`/`req.query`/`request.body` value flows anywhere new. `claimDueRows`' `$queryRaw` is untouched and already parameterised via `Prisma.sql`.

**Cat 3 — Rate-limit + abuse: CLEAN.** No new endpoint, so no rate-limit obligation is triggered. The change moves in the *protective* direction on the paid-external-action axis: retries of the same `NotificationLog` row now collapse at the vendor instead of each billing a fresh send. No new quota surface, no new unauthenticated trigger — dispatch is cron-only, serialised by the `notify-dispatch` advisory lock and `FOR UPDATE SKIP LOCKED`.

**Cat 4 — Audit-log emission: CLEAN.** No admin, payment, role-change, or ownership-transfer mutation is added. The existing failure telemetry in `dispatchNotifications` — `logger.warn({ logId, channel, template, attempt })` plus `captureException(..., { area: 'notification', notificationId, channel })` — is untouched, and still correctly excludes `recipient` per the Issue 061 AC5 comment.

**Cat 5 — Authz surface: CLEAN.** No new handler; no sibling-handler authz asymmetry introduced. The dispatcher performs no `Booking` writes (AC5 decoupling preserved).

**Cat 6 — PII in logs: CLEAN; no redact-list change required.** The diff adds **zero** `logger.*` / `console.*` calls. `idempotencyKey` does **not** belong on the redact list: it is a `NotificationLog.id`, which pre-existing code already emits unredacted as `logId` (`dispatchNotifications.ts:150`) and `notificationId` (`:163`). It is not a token, proof, credential, or PII, so the CLAUDE.md rule "new sensitive fields (tokens, proofs) must be added to the logger redact list in the same commit" is **satisfied by not applying**. Verified against the full redact path list at `lib/logger.ts:53-80`.

**Secret material in the diff: CLEAN.** The new test hardcodes `RESEND_API_KEY: 'test_key'` inside a `vi.mock('@/lib/core/config', ...)` factory — a non-credential placeholder that never reaches a network call (the `resend` module is itself mocked). CI `Secret Scanning (gitleaks)` and `Data Leak Audit` are both green on `c966f846`.

**Availability regression class from mistake-log #328: NOT REINTRODUCED.** The #328 defect was a security-adjacent availability failure — a duplicate `(bookingId, template)` insert raising P2002 *inside* `reconcilePayments`' `$transaction`, aborting the whole transaction (`25P02`) and killing the entire sweep and `processWebhook`. This PR adds **no** `notificationLog.create` / `createNotificationLog` / `enqueuePendingNotification` call, creates no second same-template row, and does not alter the `@@unique([bookingId, template])` semantics (`prisma/schema.prisma:462`). The idempotency mechanism lives entirely at the vendor, outside Postgres. The charter exemption (#367, NULL `bookingId`) is not implicated — `lib/charter/**` is not in the diff.

---

## RECOMMENDED NEXT

- No security blocker. Both findings are advisory and neither requires a code change to merge safely.
- If addressing P3 #1, the one-line boundary regex in `sendEmail` is the whole fix; it also converts a future silent-notification-loss failure mode into a caller-side error.
- The substantive risk on this PR is **not** security — it is the uncited Resend retry-after-failure contract raised as P1 in `docs/qa/code-review-pr346-20260726.md`. Resolve that first.

**SUMMARY: 0 P1 · 0 P2 · 2 P3 · pinned to `c966f846`**
