SECURITY-DEEP REVIEW — PR #358 "feat(admin): surface orphan-payment backlog + split dead vs retrying alerts (#327)"
──────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/358
Base/Head: `master` ← `feat/orphan-backlog-metric-327` @ `027c8292`
Decision:  (none) · State: OPEN, ready · Labels: none
Generated: 2026-07-26

CI note: `E2E (mobile-390) = FAILURE` on run `30179356272` is
`##[error]Docker pull failed with exit code 1` — infra flake, excluded from findings.

Findings: 4  (P1: 0 · P2: 1 · P3: 3)

---

P1 — BLOCKING:

  (none)

---

P2 — SHOULD FIX:

  app/admin/(console)/page.tsx:231-235  ⚠️  P2: Role-scope drift — a payments-reconciliation
  signal is rendered outside the page's ONLY role control.

    The new "Giao dịch chưa khớp" (unmatched transfers) tile is placed in the ungated
    Failure-alerts grid, not inside the `canSeeFinance` branch
    (`ctx.role === 'SUPER_ADMIN' || ctx.role === 'FINANCE'`, page.tsx:89). The `AdminRole` enum
    is `SUPER_ADMIN | FINANCE | SUPPORT` (`prisma/schema.prisma:612-614`), so SUPPORT sees it.

    What makes this worth a P2 rather than a nit: **there is no second layer that would catch
    it.** `lib/auth/requireAdminPage.ts:42-62` performs authentication and TOTP enforcement
    only — it verifies the JWT, rejects `totpVerified !== true`, and then simply RETURNS
    `payload.role`. It applies no role check of its own (the header comment is explicit:
    "pages call this purely for role-aware RENDERING"). So the in-page `canSeeFinance` ternary
    IS the entire role-based access control for this page. A tile placed outside it has no
    fallback gate.

    The spec is self-contradictory and this PR resolves it silently in the permissive
    direction:
      - ROLE MATRIX table, page.tsx:20 — "Failure alerts | yes | yes | yes (operational health)"
        → grants SUPPORT the whole section.
      - Rationale immediately below, page.tsx:22-24 — "SUPPORT triages operators/customers/
        notifications but does not see money figures (GMV/revenue) or **money-flow failures
        (disputes/payouts)**."
    An unmatched inbound bank transfer is a money-flow failure by that rationale. Note master
    already has the same tension (`failures.failedPayouts` sits ungated in this grid while the
    action-queue payout card at page.tsx:195-209 IS gated) — so this PR extends a pre-existing
    inconsistency into the payments domain rather than inventing one. It does not update the
    ROLE MATRIX block to record the three new tiles or the decision.

    Magnitude, stated honestly: the disclosure is a single integer to an authenticated,
    TOTP-verified, internal SUPPORT admin. No amounts, no payer identities, no transaction
    detail. This is a policy/least-privilege finding, not an exploitable exposure.

    Fix: either wrap the orphan tile in `canSeeFinance ? … : null` (matching the treatment the
    same page already gives disputes and payouts), or amend the ROLE MATRIX block to state
    explicitly that SUPPORT is granted payment-reconciliation counts and why. Do one of the
    two — leaving the matrix contradicting the code is what produced this ambiguity.

---

P3 — ADVISORY:

  app/admin/(console)/page.tsx:257-259  ℹ️  P3: `lastError` is rendered UNMASKED and can echo the
  very recipient the adjacent code masks. **Pre-existing — NOT introduced by this diff.**
    Two lines apart:
      page.tsx:256  {maskRecipient(f.recipient)}          ← deliberately masked
      page.tsx:258  <span …>{f.lastError}</span>          ← rendered raw
    `lastError` is populated at `lib/notification/dispatchNotifications.ts:145` from
    `result.error`, which for the email channel is `error.message` straight off the Resend SDK
    (`lib/notification/email.ts:171`). Resend validation errors routinely quote the offending
    address (`Invalid \`to\` field … is not valid: <address>`), so the masked-recipient control
    can be defeated by the error string sitting beside it.
    Not XSS: React escapes interpolated children, and there is no `dangerouslySetInnerHTML`
    anywhere in the diff or the file. This is information disclosure only.
    Flagged despite being outside the `+` lines because this PR is the owner of this panel and
    #332 (orphan PII has no retention/redaction path) is open on the adjacent concern.
    Fix (follow-up): truncate/allow-list `lastError` at render, or store a normalized error code
    separate from the provider's free-text message.

  lib/logger.ts:53-84  ℹ️  P3: Forward obligation on the redact list — no action needed in THIS PR.
    The redact `paths` array covers phone/email/otp/tokens/passwords/`*.accountNumber` but has no
    entry for `rawBody`, `payload`, or `lastError`. **This PR triggers no obligation**: the diff
    adds zero logging statements (verified line-by-line across all four files).
    It becomes an obligation the moment the deferred "alert" half of #327 lands (see
    `docs/qa/pr-review-pr358-20260726.md` P2 — the issue asks for "a counter/metric **on orphan
    creation**", which would instrument `recordUnmatchedPaymentEvent`,
    `lib/payment/processWebhook.ts:110-135`). That site currently logs only
    `{ adapter, providerTxnId }` — correctly excluding `rawBody` — and that discipline must hold.
    Per the project rule, any new sensitive field goes into the redact list in the SAME commit.

  lib/admin/getFailureAlerts.ts:61  ℹ️  P3: Weak configuration oracle (low magnitude, noted for
  completeness).
    `count({ where: { bookingId: null } })` aggregates three distinct orphan classes, one of
    which is the Issue-334 `account_mismatch` write at
    `app/api/payments/bank_transfer/webhook/route.ts:78-91` — a transfer that landed in an
    account that is NOT the configured `VIETQR_ACCOUNT_NUMBER`. A sustained climb in this single
    number is therefore an indirect signal that the receiving-account configuration is wrong (or
    that someone is spoofing deliveries), surfaced to SUPPORT alongside the P2 above.
    No amounts, no account numbers, no payer data — the number alone. Recorded because the tile
    is being introduced as an ops signal and this is a property of what it actually measures;
    splitting the classes (also recommended in the code-review P2) resolves it as a side effect.

---

CLEAN — explicitly checked, with evidence:

  **Cat 6 — Privacy / PII (the headline check for this PR): CLEAN.**
  - **No `PaymentEvent.rawBody` reaches the UI or the logs.** The diff's only PaymentEvent access
    is `prisma.paymentEvent.count({ where: { bookingId: null } })`, which returns a scalar.
    `rawBody` (`@db.Text`, holding the raw SePay payload — payer name, amount, memo — and tracked
    by #332 as having no retention/redaction path) is never selected, never rendered, never
    logged, never passed to a client component. The #332 exposure is not widened by one byte.
  - **No `NotificationLog.payload` reaches the UI or the logs.** Not in the `select`, not
    referenced anywhere in the diff.
  - **`select` whitelist is byte-identical to master** — `id, template, recipient, createdAt,
    lastError` (getFailureAlerts.ts:67-73). The Issue 001 rule ("select whitelist = exactly the
    UI contract fields, no filter-only columns") holds: the three columns the new predicates
    filter on — `status`, `attemptCount`, `bookingId` — are all `where`-only and none leaked into
    the returned payload.
  - **Zero new logging statements** across all four changed files, so no unredacted-PII log risk
    is created and no redact-list update is owed by this commit.
  - **No new PII column** — `prisma/schema.prisma` is not in the diff.
  - **No secret literal** — no key, token, password, JWT, or certificate material in the `+` lines.

  **Cat 1 — Crypto correctness: N/A, no crypto in diff.**
  - The diff contains no cipher, hash, KDF, MAC, or randomness primitive of any kind: no
    `createCipher`/`createCipheriv`, no `createHash`, no `randomBytes`, no `bcrypt`/`scrypt`/
    `pbkdf2`/`argon2`, no `Math.random()`, no token/nonce/salt generation. Nothing to review, and
    nothing that could drift from a project-declared crypto standard.

  **Cat 2 — Threat-model delta: ZERO new attack surface.**
  - No new file under `app/api/**` or any route directory; no new route handler, no new server
    action, no new exported mutation. The four changed files are one RSC, one read-only lib
    function, its unit test, and a one-line barrel re-export.
  - **No user input is consumed anywhere in the diff.** No `searchParams.get(`, no `req.query`,
    no `request.json()`/`formData()`, no route params, no headers read. Every value that reaches
    the rendered page originates from a Prisma aggregate over server-side state. There is
    therefore no source to trace into any sink.
  - No `$queryRaw`/`db.execute`/`knex.raw` added → no SQL-injection surface (both new predicates
    are typed Prisma `where` objects, parameterized by construction).
  - No `eval(`, `Function(`, `vm.runIn*`, `child_process.exec/spawn` → no RCE surface.
  - No `redirect(`/`Response.redirect(` added → no open-redirect surface.
  - No `dangerouslySetInnerHTML`/`innerHTML` → no XSS sink; React escapes all interpolated
    strings on this page.
  - No upload path (`multer`/`formidable`/`busboy`/`formData()`), so no file-size/mime gap.
  - No `JSON.parse` of network input, no external `fetch`, no SDK init → no deserialization or
    SSRF surface, and no timeout/size-cap obligation.

  **Cat 3 — Rate-limit + abuse: N/A.**
  - No new endpoint of any method, so nothing to throttle. The changed surface is a GET-only RSC
    behind an authenticated + TOTP-verified admin session.
  - No paid external action introduced — the diff sends no email, no SMS, and calls no payment
    processor. No per-user quota obligation.
  - (For reference, the existing `proxy.ts` rate-limit layer covers non-safe `/api/*`; this PR
    neither adds to nor bypasses it.)

  **Cat 4 — Audit-log emission: no gap.**
  - Project pattern located: `writeAdminAuditLog` → `prisma.adminAuditLog.create`
    (`lib/audit/adminAuditLog.ts:29`). Applied consistently across admin **mutations** —
    `app/api/admin/auth/login/route.ts:62,79`, `auth/totp/verify/route.ts:67`,
    `finance/chargeback/route.ts:55`, `finance/payouts/[id]/approve/route.ts:62`,
    `finance/payouts/[id]/retry/route.ts:52`, `finance/refund-out/route.ts`.
  - **This PR adds no mutation** — it is a read-only counter plus presentation.
  - Grep of `app/admin/**` confirms NO admin page READ emits an audit entry anywhere in the
    project. So a read-only tile addition creates no divergence from sibling behaviour, and the
    Cat-4 "sibling pattern exists but new handler omits it" trigger does not fire.

  **Cat 5 — Authz gate presence: correct and layered.** (Role *granularity* is the P2 above; the
  gate itself is sound.)
  - **Layer 1 — Edge middleware**, `proxy.ts:256`: guards `pathname === '/admin' ||
    pathname.startsWith('/admin/')`. Verifies the `bb_admin_access` JWT via `jose` with a
    cross-realm check (`payload['scope'] !== 'admin'` → reject, proxy.ts:157) and a
    `totpVerified` claim check; missing/invalid/unverified → `redirect('/admin/login')`.
    **Zero DB reads** — state is encoded in JWT claims, exactly as the project rule for
    cross-cutting Edge gates requires.
  - **Allowlist is exact-match, not prefix-match**: `ADMIN_AUTH_FREE_PATHS = new Set(['/admin/login',
    '/admin/enroll-totp'])` (proxy.ts:114), with the Issue 010 rationale in the comment above it.
    A path like `/admin/login-bypass` is NOT auth-free. Rule satisfied.
  - **Layer 2 — in-process RSC guard**: `requireAdminPage()` at page.tsx:85 re-reads the cookie
    via `next/headers` and re-verifies (`lib/auth/requireAdminPage.ts:42-62`) — defense in depth,
    and correctly in-process rather than self-fetching (AGENTS.md Issue 002/003).
  - Documented, intentional gap noted for the record, unchanged by this PR:
    `requireAdminPage` deliberately skips the `AdminUser` ACTIVE-status re-read that
    `requireAdminAuth` performs; the access-token TTL bounds the disabled-admin window and all
    mutations route through `/api/admin/*` where the authoritative check runs
    (`requireAdminPage.ts:16-20`).

---

RECOMMENDED NEXT:
  - No P1 — nothing here blocks merge on security grounds. The PR's core PII claim ("Counts only
    — no rawBody/PII (#332)") is verified accurate.
  - Resolve the P2 with a one-line decision: gate the orphan tile behind `canSeeFinance`, or
    amend the ROLE MATRIX to grant SUPPORT payment-reconciliation counts explicitly. Because
    `requireAdminPage` enforces no role, that ternary is the whole control — worth being
    deliberate about.
  - The two PII advisories (`lastError` echo, redact-list forward obligation) belong with #332 /
    the deferred #327 alert half rather than in this slice.

SUMMARY: 0 P1 · 1 P2 · 3 P3 · pinned to `027c8292`
