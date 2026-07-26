SECURITY-DEEP REVIEW (ROUND 2) — PR #346 "fix(notifications): idempotency key for email dispatch (#335)"
──────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/346
Base/Head: master ← fix/335-email-idempotency @ 658f930e
Decision:  (none) · Author: PhamAnhQuannn · Labels: none
Fix commit under review: `658f930` "fix(notifications): key idempotency per attempt, not per row"
Round-1 report: `docs/qa/security-deep-pr346-20260726.md` @ c966f846
Generated: 2026-07-26

CI at review time: **all 12 checks green** on `658f930` — including Unit, Integration, Lint &
Typecheck, Secret Scanning (gitleaks), Data Leak Audit, and Greppable Invariants.

Findings: 4  (P1: 0 · P2: 1 · P3: 3)

---

## SCOPE OF ATTACK-SURFACE DELTA

This diff is small and entirely inside an already-authenticated, server-only outbound path. There is
**no new endpoint, no new file under `app/api/**`, no new handler, no new user-reachable input, and
no crypto**. The change is:

1. `SendEmailInput` gains an optional `idempotencyKey?: string`.
2. `sendViaResend` forwards it as the second (options) argument to `resend.emails.send`.
3. `dispatchRow` constructs it as `` `${row.id}:${row.attemptCount}` ``.

Categories 1 (crypto), 2 (threat-model delta — new surface), 4 (audit log) and 5 (authz) are
therefore structurally clean; the residual findings are in Cat 3 (abuse/cost envelope) and Cat 6
(privacy), plus one forward-looking sink note under Cat 2.

---

## P1 — BLOCKING

**None.**

---

## P2 — SHOULD FIX

  `lib/notification/dispatchNotifications.ts:122`  ⚠️  **P2 [Cat 3 — abuse / cost envelope changed, undisclosed]**

    Per-attempt keying raises the **worst-case number of real, billable emails one
    `NotificationLog` row can produce from 1 to `MAX_ATTEMPTS` (5)**.

    Under the previous bare-`row.id` design, the vendor-side dedupe made the row's send count
    exactly 1 no matter how many times the dispatcher retried. Now each attempt presents a key
    Resend has never seen, so the vendor-side cap is gone and the only remaining cap is the
    application's `attemptCount < MAX_ATTEMPTS` predicate.

    That is fine in the intended case (a definite vendor rejection — nothing was sent, so re-sending
    is correct). It is **not** fine in the case `sendViaResend` cannot distinguish: a request that
    Resend accepted but whose response the client never saw (timeout, socket reset, 5xx after
    enqueue). `sendViaResend` returns `{ ok: false, error: 'resend_exception' }` from its `catch`
    and the loop re-keys. During a Resend latency incident affecting many rows at once, the whole
    due batch (`BATCH_SIZE = 50`, cron `* * * * *` per `vercel.json`) can amplify to 5x on both the
    email bill and the recipient's inbox.

    Security framing: this is a **self-inflicted amplification** with no external actor required —
    a vendor-side degradation is the trigger. It is bounded (5x, not unbounded) and the trade is
    the right one versus permanent non-delivery of a paid-booking confirmation, so this is P2 not
    P1. But the source comment states "Crash-safety is preserved…" and does not disclose that the
    per-row send cap moved from a vendor guarantee to an application counter.

    The information needed to fix it is already present and thrown away — `sendViaResend` has two
    distinct failure branches (`if (error)` = definite rejection; `catch` = unknown outcome) and
    flattens both to `{ ok: false }`.

    **Fix:** return a discriminated failure (`{ ok:false, outcome:'rejected' | 'unknown' }`) and have
    `dispatchRow` reuse the **same** key after an `'unknown'` failure (so Resend still dedupes) and
    rotate only after a `'rejected'` one. This matches the repo's own established pattern
    (CLAUDE.md 2026-05-19 Issue 013 — discriminated results from the service layer, not flattened
    sentinels). Minimum acceptable: state the amplification bound in the comment.
    Mirrors `docs/qa/code-review-pr346-20260726-round2.md` P2-a.

---

## P3 — ADVISORY

  `lib/notification/email.ts:71-78` (`SendEmailInput.idempotencyKey`)  ℹ️  **P3 [Cat 2 — new
  unvalidated string reaches an HTTP header sink; safe today, sharp for the next caller]**

    The new field is a public, optional, **unvalidated** `string` on an exported function, and its
    doc block invites callers to supply one. It flows to
    `headers.set("Idempotency-Key", options.idempotencyKey)` (`node_modules/resend/dist/index.mjs:1130`)
    — an HTTP header sink.

    **Not exploitable as written, and not exploitable today:**
    - The only caller that passes a key is `dispatchRow`, and both components are server-generated:
      `NotificationLog.id` is `@default(cuid())` (`prisma/schema.prisma:443`) and `attemptCount` is
      `Int @default(0)`. Neither is attacker-influenced at any point.
    - Even a hostile value cannot inject headers: the SDK uses the Fetch `Headers.set()` API, which
      **throws `TypeError` on CR/LF or other invalid header bytes** rather than emitting them. The
      throw lands in `sendViaResend`'s `catch`.
    - The key never crosses a trust boundary inbound — it is authenticated by our own
      `RESEND_API_KEY`, so no third party can present a key to suppress or replay our mail.

    **Why it is still worth a line of defence:** the failure mode of a bad value is not injection, it
    is **guaranteed non-delivery** — `Headers.set` throws → `ok:false` → the loop burns all five
    attempts throwing on the same malformed key → row permanently `failed`, silently. And this repo
    has a documented history of exactly the shape that would produce one: CLAUDE.md 2026-07-23
    (SePay ref-case) records reconstructing an internal DB key from a **webhook memo**. A future
    caller doing `sendEmail({ …, idempotencyKey: bookingRefFromMemo })` is entirely plausible and
    would fail closed and silently.

    **Fix (cheap):** either narrow the doc block to "MUST be server-generated and header-safe
    (`/^[A-Za-z0-9:_-]{1,256}$/`); never derive from external input", or assert it at the top of
    `sendViaResend` and drop the key (log + send anyway) rather than throwing into the retry loop.

  `lib/notification/dispatchNotifications.ts:122` → third-party egress  ℹ️  **P3 [Cat 6 — privacy /
  cross-border; negligible delta, but on an integration whose DPA is still unconfirmed]**

    The `Idempotency-Key` header transmits an internal `NotificationLog` primary key to Resend (US
    processor) on every email send. Assessment:
    - **Not PII on its own** — an opaque cuid plus a small integer, not directly identifying, and
      not derived from `buyerPhone` / `contactEmail` / `bookingRef`.
    - **Incremental delta is negligible** — Resend already receives the recipient address and the
      fully rendered ticket/booking body on the same request. A row PK adds effectively nothing to
      what that processor can correlate.
    - Verified the key is **not** logged: the diff adds no `logger.*` call, and the existing
      `logger.error({ template, err })` / `logger.info({ template, externalRef })` in
      `sendViaResend` are unchanged. No redact-list obligation is triggered (contrast CLAUDE.md
      2026-05-18 Issue 007, which requires new sensitive fields to join the redact list in the same
      commit — this field is not sensitive).

    Raised only because this PR makes the Resend integration **more load-bearing**, while
    `documentation/feature-implementation/FI-014-notifications/README.md` still lists
    "**MEDIUM — Resend DPA + CDTIA**: Required for email compliance under PDPL 2025; not confirmed
    as done" as an open Known Gap, and `.env.production.local` has `EMAIL_PROVIDER="resend"` — i.e.
    the integration is **live in production now**. Pre-existing and explicitly the user's own track
    (MEMORY: "User handles CDTIA"); flagged so the dependency is recorded against this PR, not as a
    finding caused by it. **No action required in this PR.**

  `lib/notification/__tests__/email.test.ts:32, :78`  ℹ️  **P3 [Cat 6 — credential-shaped test
  literals; verified clean]**

    Two credential-shaped literals appear in the diff: `RESEND_API_KEY: 'test_key'` in the
    `@/lib/core/config` mock and no real key elsewhere (`'re_test'` appears in PR #347's env test,
    not here). Both are obvious placeholders, neither is a valid-length Resend key, and
    **Secret Scanning (gitleaks) and Data Leak Audit both pass** on `658f930`. Recorded as
    checked-and-clear, not as a finding.

---

## CATEGORIES VERIFIED CLEAN

| Cat | Check | Result |
|-----|-------|--------|
| **1 — Crypto** | `createCipher`/`createCipheriv` with literal IV, `Math.random()` for token/secret/nonce, MD5/SHA-1 near password/hmac/jwt, ECB, weak bcrypt/pbkdf2/scrypt params, AEAD-less CBC | **No crypto primitive in the diff at all.** The idempotency key is a dedupe token on an already-authenticated outbound channel, not a security token: it authorizes nothing, is not a bearer credential, and unpredictability is not a security property of it. |
| **2 — New attack surface** | New route/handler files, upload paths, `searchParams`/`req.query` → SQL / shell / HTML / `fetch` URL, open redirect, `eval`/`Function`/`vm`, unvalidated `JSON.parse` of network input | **None.** Zero new files under `app/api/**`. No new user-reachable input of any kind. The only new sink is the header noted in P3-a, reachable only from server-generated values. |
| **3 — Rate limit** | New auth/email/sms/otp endpoint without throttle; new POST/PUT/DELETE without limit; paid external action without quota | **No new endpoint.** The paid external action (Resend send) remains gated by the pre-existing cron bounds — `BATCH_SIZE = 50` per tick, `attemptCount < MAX_ATTEMPTS = 5` per row, `withAdvisoryLock('notify-dispatch')` serializing ticks. Envelope change is the P2 above, not a missing control. |
| **4 — Audit log** | New mutation in `app/api/admin/**`, `app/api/payment/**`, role/permission/owner/transfer paths missing the project's audit-log call | **N/A.** No admin, payment, role, or ownership mutation in the diff. The dispatcher's existing failure telemetry (`logger.warn('notify.dispatch.failed')` + `captureException({ area:'notification', notificationId, channel })`) is untouched and still PII-free — `recipient` is deliberately excluded, per the Issue 061 comment. |
| **5 — Authz** | New handler lacking the sibling-directory authz helper | **N/A.** No new handler. `sendEmail`'s new parameter is optional and does not widen any caller's authority. |
| **6 — PII** | New unredacted `logger.*` on email/phone/address/user; new PII DB column without at-rest notation | **Clean.** No new logging, no schema change, no migration. `prisma/schema.prisma` is not in the diff. |

---

## MISTAKE-LOG CROSS-CHECK (security-relevant entries)

| Entry | Match? |
|-------|--------|
| **2026-05-18 Issue 007** — new sensitive field must join the logger redact list in the same commit | **N/A.** `idempotencyKey` is an opaque row PK + integer, not a token/proof/credential, and is never passed to `logger`. |
| **2026-07-21** — vendor auth header / ack shape inferred rather than transcribed; greppable smell = no vendor-doc URL near the boundary | **SATISFIED for the email branch** — the fix cites `https://resend.com/docs/dashboard/emails/idempotency-keys` at the call site and quotes both load-bearing clauses (24h retention; replay returns the original response "even if the original returned an error"). Independently corroborated against the installed SDK: `resend@6.12.4` sets the header at `dist/index.mjs:1130` and types it at `dist/index.d.mts:177-183`. **NOT satisfied for the SMS sibling** three lines below (bare `row.id` as the eSMS `RequestId`, same guarantee asserted, no citation) — carried in the code-review report as P2-c. |
| **#328** — `NotificationLog` unique on `(bookingId, template)`; never enqueue a parallel same-template row | **CLEAN.** Zero `notificationLog.create` / `createNotificationLog` / `enqueuePendingNotification` in the diff. Idempotency is vendor-side, outside Postgres — no new P2002-in-`$transaction` sweep-abort path. |
| **2026-07-23** — no recovery logic in a `catch` inside `prisma.$transaction` | **CLEAN.** `dispatchRow` runs strictly outside any transaction; `claimDueRows`' `$transaction` is untouched by this PR. |
| **2026-07-24 Bug B round 3** — a hold/retry state whose release condition is a pure function of immutable inputs is a permanent state | **CLEAN, and this fix is the antidote.** The round-1 defect was precisely that shape: a cached vendor failure with no release path, producing permanent non-delivery. Salting with `attemptCount` makes the release condition depend on a mutable, monotonically advancing column, and `MAX_ATTEMPTS` bounds it. Correct direction. |

---

RECOMMENDED NEXT:
  - No P1. Nothing here blocks merge on security grounds.
  - Address P2 (discriminated `rejected` vs `unknown` failure, or at minimum document the 5x
    amplification bound) — it is the same underlying item as code-review P2-a, so one fix closes both.
  - P3-a (constrain or document `idempotencyKey` as server-generated / header-safe) is a two-line
    doc-block edit and closes the only forward-looking sink in the diff.
  - P3-b requires no action in this PR; it is a standing FI-014 compliance item on the user's own track.

SUMMARY: 0 P1 · 1 P2 · 3 P3 · pinned to 658f930e
