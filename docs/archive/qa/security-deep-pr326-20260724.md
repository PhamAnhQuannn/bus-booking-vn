SECURITY-DEEP REVIEW — PR #326 "feat(notifications): email customer confirmations + unmatched-payment notices"
────────────────────────────────────────────────────────────────────────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/326
Base/Head: fix/bank-transfer-reconcile-orphan ← feat/customer-email-notifications @ a55c3c6b
Decision:  (none yet)
Generated: 2026-07-24
Scope:     email delta only (gh pr diff 326 — base = fix/bank-transfer-reconcile-orphan, NOT master)

Findings: 3  (P1: 0 · P2: 0 · P3: 3)

No blocking (P1) or should-fix (P2) security findings. Three advisory notes below.

════════════════════════════════════════════════════════════════════════════════
ATTACK-SURFACE ASSESSMENT (per the six review points)
════════════════════════════════════════════════════════════════════════════════

1. PII IN LOGS — CLEAN.
   - lib/notification/email.ts `sendViaResend` (L151-176) logs only `{ template, externalRef }`
     on success and `{ template, err: error.message }` on API error. NOT `to`, NOT body, NOT payload.
   - `sendEmail` stub path (L191-198) logs `{ template, externalRef, subjectLen, bodyLen, recipientLen }`
     — lengths only, never the recipient value or body.
   - `enqueuePendingNotification` (reconcilePayments.ts L614-642) catch logs `{ template, err.message }` —
     no recipient/payload.
   - `createNotificationLog` (notificationLogRepo.ts) logs nothing.
   - Reconcile warn/error lines log `bookingRef`, `heldForMs`, `amountVnd`, `suspectedUnresolved` — no email/name.
   - Defense-in-depth confirmed: lib/logger.ts redact list already covers `buyerEmail` (L95),
     `*.recipient` (L96), and `RESEND_API_KEY` (L106). No new log line in the diff emits any of these.

2. OPS ALERT (opsUnmatchedPayment → hotro@lenxevn.com) — CLEAN, recipient hardcoded.
   - Recipient = `OPS_EMAIL` module constant `'hotro@lenxevn.com'` (esms.ts L92). NOT request-derived,
     NOT attacker-controllable.
   - Body carries `bookingRef` (server-generated), `amountVnd` (int), `providerTxnId` (numeric SePay txn id).
     No operator-controlled free text (route origin/dest are NOT in this template), so no phishing-injection
     vector into the ops inbox.

3. EMAIL HEADER / CONTENT INJECTION — CLEAN.
   - Adapter uses Resend's structured HTTP API: `client.emails.send({ from, to, subject, text })`
     (email.ts L160-165). No raw SMTP, no header concatenation. `subject` comes from the static
     SUBJECTS map (L85-116); `to` is a single buyerEmail string; body is a pre-rendered plain-text string.
   - Only `text:` is sent (no `html:`), so operator-controlled route strings in the body cannot become
     HTML/script in the recipient's mail client. A newline in buyerEmail cannot inject SMTP headers because
     transport is JSON-over-HTTPS, not SMTP.

4. ENV GATE — CORRECT.
   (a) superRefine blocks boot: env.ts L373-379 (unconditional) adds a ZodIssue when
       `EMAIL_PROVIDER=resend && !RESEND_API_KEY`. A second identical guard exists at L515-523. Boot fails fast.
   (b) No accidental real-send in dev/test: `emailStubbed()` (email.ts L129-134) returns true unless
       `EMAIL_PROVIDER === 'resend'`; default is `'stub'`. Real send requires explicit opt-in + a real key +
       the `resend` package. No default path reaches the network.
   (c) RESEND_API_KEY never logged: in redact list (L106); passed only to `new Resend(...)`; no log emits it.

5. CROSS-BORDER / CDTIA — FLAGGED, not blocking (see P3 #1). Resend is US-based; customer name+email now
   leave VN on every real send. Compliance obligation handled by the user (CDTIA), noted in the setup guide.

6. BLAST RADIUS — FLAGGED (see P3 #2). `EMAIL_PROVIDER=resend` activates ALL templates, including
   `operatorAccountCreated`, whose body carries a cleartext temp password
   (esms.ts L168/173: `Mat khau tam thoi: ${payload.tempPassword}`). Intended credential-delivery behavior,
   mitigated by forced password change on first operator login, but worth conscious sign-off before flipping.

════════════════════════════════════════════════════════════════════════════════
P3 — ADVISORY
════════════════════════════════════════════════════════════════════════════════

  documentation/guides/10-setup-resend.md  ℹ️ P3: Cross-border PII transfer (CDTIA).
    Enabling resend sends customer names+emails to Resend (US). This is a PDPL cross-border transfer.
    User owns the CDTIA assessment — no code change; recorded here for the compliance trail.

  lib/notification/esms.ts:168  ℹ️ P3: Blast radius — cleartext temp password now sends for real.
    Turning on EMAIL_PROVIDER=resend also activates `operatorAccountCreated`, which emails a plaintext
    temp password. Pre-existing template (not changed by this PR), but this PR is what makes it send.
    Acceptable given forced first-login change; confirm ops awareness before go-live.

  lib/notification/email.ts:173  ℹ️ P3: `catch` logs the full `err` object.
    `logger.error({ template, err }, 'email.resend.exception')` serializes the whole exception. The
    sibling api-error path (L167) and `enqueuePendingNotification` (L638) correctly log `err.message`
    only. A raw SDK error could nest request context (e.g. the recipient under a non-redacted key) that
    Pino's path-based redact would miss. Prefer `err: err instanceof Error ? err.message : String(err)`.

════════════════════════════════════════════════════════════════════════════════
NOTES (non-security)
════════════════════════════════════════════════════════════════════════════════
  - env.ts has TWO identical `EMAIL_PROVIDER=resend → RESEND_API_KEY required` guards (L373 and L515).
    Harmless redundancy; the L373 one is unconditional (stronger). Not a security defect — flag for cleanup.

RECOMMENDED NEXT:
  - No P1/P2 to clear. P3s are advisory: CDTIA is user-owned; consider the err.message tightening.

SUMMARY: 0 P1 · 0 P2 · 3 P3 · pinned to a55c3c6b
