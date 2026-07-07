ARCHITECT REVIEW — PR #259 "feat(auth): migrate OTP to email + enable customer auth (#168, #169, #170)" @ 026729fb
─────────────────────────────
Base: master  ·  Head: feat/customer-auth-enable  ·  State: OPEN
URL: https://github.com/PhamAnhQuannn/bus-booking-vn/pull/259

Mode note: the working branch was already checked out at `headRefOid` 026729fb when this
review ran (no fetch/temp-branch/restore cycle was needed — verified `git rev-parse HEAD`
== PR's `headRefOid` before starting). The pre-flight "dirty tree" refusal in the skill
exists to protect the branch-restore step; since no branch switch occurred, the dirty
working tree (uncommitted local edits to `documentation/**` and stray `docs/qa/*.md` /
screenshot files, unrelated to PR #259's diff) posed no risk and the audit proceeded.

Scanned: 60 files in the PR diff (+1368/-779) · 36 `lib/<domain>` modules repo-wide ·
~637 source files (app + components + lib) · no prior `docs/qa/arch-graph.json` snapshot
existed — this run establishes the baseline.

Attribution key: **[PR-259]** = introduced or actively touched by this PR's diff.
**[BASELINE]** = pre-existing in the repo at this HEAD, surfaced by the repo-wide scan,
NOT caused by this PR. Repo-wide review is intentionally not diff-scoped (that's what
`/code-review` and `/pr-review` are for), so baseline findings are reported for
awareness but should not block this specific PR.

PRIORITY 1 — Block push, fix first:

  [CYCLE] [BASELINE] lib/booking ↔ lib/payment ↔ lib/ledger
    SCC (3-node), hub = lib/payment. No direct booking↔ledger edge; payment closes the loop.
    Path A: lib/booking/createCashBooking.ts:19 → `@/lib/payment` (appendBookingPaidLedger)
            lib/booking/initiateOnlineBooking.ts:29 → `@/lib/payment` (getGatewayFor)
    Path B: lib/payment/applyPaidTransition.ts:28, lib/payment/processWebhook.ts:44
            → `@/lib/booking` (legalPredecessors)
    Path C: lib/payment/applyPaidTransition.ts:29-33, lib/payment/processWebhook.ts:45
            → `@/lib/ledger` (appendLedgerEntry, refundOut, ...)
    Path D: lib/ledger/refund.ts:46 → `@/lib/payment` (refundPayment)
    Full cycle: booking → payment → ledger → payment → booking.
    Not touched by PR #259 (none of the cycle's files are in this PR's diff). Pre-existing
    at HEAD; now recorded as the drift baseline for future runs.
    Fix: extract the shared "apply payment outcome to booking + ledger" orchestration into
    a new top-level coordinator (e.g. `lib/paymentOutcome/`) that booking/payment/ledger all
    depend on one-way, or invert one edge — e.g. have booking emit a domain event that
    payment/ledger subscribe to, rather than payment reaching back into booking.

  [LAYER VIOLATION] [BASELINE] 59 production files in `app/**` import `prisma` directly
    `import { prisma } from '@/lib/core/db/client'` inside route handlers and RSC pages,
    bypassing the `lib/<domain>` layer that CLAUDE.md's dependency-flow rule requires
    (`app/ → lib/<domain>/ → lib/core/`). Widespread and systemic (49 route handlers +
    10 server-component pages: admin CRUD, op console CRUD, charter, cron, payments
    webhook, sitemap) — reads as an accepted convention for simple CRUD/read endpoints
    rather than an isolated slip, but it contradicts the documented rule verbatim.
    Representative citations: app/api/admin/admins/route.ts:17, app/api/op/buses/[id]/route.ts:24,
    app/op/(console)/dashboard/page.tsx:28, app/op/(console)/layout.tsx:19,
    app/(customer)/charter/status/[ref]/page.tsx:29, app/sitemap.ts:2.
    Verified: none of PR #259's own touched files (app/api/auth/**, app/(customer)/account/**)
    are in this list — PR #259 does not add to this baseline.
    Fix: not actionable in this PR. Recommend either (a) a follow-up refactor issue that
    extracts thin `lib/<domain>` read functions for these 59 sites, or (b) if the team
    considers direct-prisma-in-route an accepted pattern for simple CRUD, amend CLAUDE.md's
    dependency-flow rule to say so explicitly and stop treating it as a violation — the
    current silent divergence between documented rule and actual practice is itself a
    smell (60+ exceptions is not "the rule with exceptions", it's a different rule).

PRIORITY 2 — Fix before next release:

  [ADR CONTRADICTION] [PR-259] Auth model reversal not recorded — ADR-003 still says the opposite
    `documentation/architecture-decisions/ADR-003-auth-architecture/README.md` documents two
    decisions that PR #259 directly reverses, with no ADR amendment/supersession in this PR
    (PR #259 touches zero files under `documentation/architecture-decisions/`):
      1. Section "Customer Authentication — OTP-Only (Passwordless)" (README.md:28-48):
         chosen model is "OTP-only (passwordless via phone)"; "Email + password" is listed
         as a REJECTED alternative ("Email low-importance for Vietnamese bus travelers...
         poor fit for 'Chị Lan' (no stable email)", README.md:33). The ADR's own
         "reality-check" addendum (README.md:47-48) even asserts `Customer.passwordHash`
         "exists but is not used in any auth flow — likely residual from earlier design
         iteration." PR #259 makes `passwordHash` the PRIMARY credential for both
         `register` and `login` (lib/auth/authService.ts:63-99, 105-121) via
         `lib/core/validation/auth.ts:29-32` (`loginInput = { email, password }`) — the
         exact "Email + password" model the ADR rejected, and the "residual, unused" claim
         is now false.
      2. Section "OTP Delivery Channel — Zalo ZNS Primary + SMS Fallback" (README.md:152-169):
         "Email OTP" is listed and explicitly rejected ("delivery to spam folder; not
         real-time; poor fit for time-sensitive OTP", README.md:158); chosen path is
         "Zalo ZNS primary + SMS fallback (Phase 2). Phase 1: eSMS (SMS) only." PR #259's
         entire purpose is switching OTP delivery to email (lib/account/customerOtp.ts,
         lib/auth/sendOtp.ts, lib/notification/email.ts `otpCode` template) — the exact
         channel the ADR rejected.
    `docs/issue-fix-order.md` (new in this PR) tracks the phase-2 "Customer Auth
    Enablement" flip at the issue-backlog level, but that's project-management tracking,
    not an architecture decision record — a future reader of ADR-003 has no way to know
    the documented rationale (phone-first personas, no-stable-email population, SMS-cost
    tradeoff) was overridden, or why.
    Fix: run `/adr-writer` to either amend ADR-003 in place (mark section 1 and section 6
    superseded, add a "Supersession — 2026-07" block citing #168/#169/#170 and the actual
    reason for the reversal) or add a new ADR (e.g. ADR-021) that supersedes those two
    sections. Do this before the next release that builds on this auth model — otherwise
    the next engineer who reads ADR-003 will design against a decision that's no longer true.

  [SHALLOW MODULE / GOD BARREL] [BASELINE, auth barrel touched by PR-259] 9 domain barrels exceed 20 exports
    `lib/ledger` (61), `lib/auth` (64 — +1 in this PR, `CustomerForgotPasswordVerifySchema`
    added at lib/auth/index.ts:52), `lib/onboarding` (51), `lib/booking` (38 — +1 in this
    PR), `lib/admin` (36), `lib/charter` (31), `lib/api` (30), `lib/trips` (25), `lib/op` (23).
    Per Category 3 rule (>20 exports flags regardless of size), these are re-export piles.
    In practice most back substantial real implementations (not pure pass-through), so the
    "shallow" label needs case-by-case judgment rather than uniform debt — but `lib/auth`
    at 64 exports spanning 4 auth realms (customer/operator/admin JWT signing, OTP, TOTP,
    sessions, password, CSRF, Zod schemas) is the most concerning: it is becoming the
    catch-all for "anything auth-adjacent" and this PR added to it rather than to a
    narrower sub-barrel.
    First run — no prior snapshot, so this is now the recorded baseline. Not a per-PR
    blocker, but flag for `/improve-codebase-architecture` if `lib/auth` keeps growing.
    Fix (future): consider splitting `lib/auth` into `lib/auth` (customer), `lib/auth/operator`,
    `lib/auth/admin` as separately-barreled sub-domains if it keeps accreting, or leave as-is
    if the team accepts "auth" as one domain by design — either is defensible, just decide
    explicitly rather than by accretion.

  [STRUCTURAL DEFECT] [BASELINE] `lib/utils.ts` file shadows `lib/utils/index.ts` domain barrel
    Both resolve to the bare specifier `@/lib/utils`. TS/Node module resolution picks the
    `.ts` file over the same-named directory's `index.ts`, so all 50 call sites that do
    `import { cn } from '@/lib/utils'` get the file — and `lib/utils/index.ts`'s only
    export, `useReducedMotion` (from `lib/utils/useReducedMotion.ts`), is unreachable via
    the documented barrel convention. Confirmed zero importers of `useReducedMotion`
    anywhere in app/components/lib — dead code, doubly so because its own barrel path is
    shadowed. Unrelated to PR #259, surfaced by the repo-wide module enumeration.
    Fix: rename one of the two — either move `cn` into `lib/utils/index.ts` (single real
    barrel) and delete the top-level `lib/utils.ts` file, or rename the directory to
    `lib/motion/` (or fold `useReducedMotion` into an existing UI-hooks module) so the two
    stop colliding on the same specifier.

  [INVARIANT SELF-CONTRADICTION] [BASELINE] `lib/core` re-exports a sibling domain, contradicting its own header
    `lib/core/index.ts:4-5` states "lib/core holds primitives imported BY domains; it
    imports NO domain." `lib/core/config/index.ts:9` does `export * from '@/lib/config'`,
    and `lib/config` is itself one of the 36 enumerated `lib/<domain>` barrels (not a
    core primitive) — re-exported transitively via `lib/core/index.ts:14`. Confirmed
    one-directional (lib/config does not import lib/core back), so not a cycle, but it
    violates the stated invariant. Unrelated to PR #259 (lib/config/env.ts changes in this
    PR are additive env vars, not the export-shape).
    Fix: either fold `env.ts` fully into `lib/core/config` and delete the `lib/config`
    domain classification, or stop re-exporting it from `lib/core` and have consumers
    import `@/lib/config` directly (it's a leaf module, so either resolution is cheap).

PRIORITY 3 — Track on roadmap:

  [LAYER-DIRECTION SMELL] [BASELINE, edge renamed by PR-259] `lib/auth` reaches into `lib/booking`
    lib/auth/authService.ts:14 imports `backfillGuestBookingsByEmail` from `@/lib/booking`
    (renamed in this PR from the phone-keyed `backfillGuestBookingsForCustomer` — the edge
    itself predates PR #259, this PR only swapped which function it calls). Not a cycle
    (lib/booking has zero imports from lib/auth), but auth — normally the lowest-level
    cross-cutting domain — reaching *up* into the booking business domain to backfill
    guest bookings at registration time is a layer-direction smell. Low risk today; worth
    revisiting if lib/auth needs to stay dependency-light (e.g. if it's ever extracted to
    a shared package).
    Fix (optional, not urgent): move the guest-booking-backfill call up a layer — have the
    `/api/auth/register` route call both `register()` (lib/auth) and
    `backfillGuestBookingsByEmail()` (lib/booking) itself, rather than having lib/auth call
    into lib/booking internally.

  [CONSISTENCY] [BASELINE] Two import paths to the same `getEnv` symbol inside `lib/notification`
    `lib/notification/esms.ts:14` and `lib/notification/esmsClient.ts:16` import `getEnv`
    from `@/lib/config` directly; `lib/notification/email.ts:19` imports the same symbol
    via `@/lib/core/config` (the core re-export from the finding above). Neither file was
    touched on this import line by PR #259. Cosmetic — pick one path and use it
    consistently within the domain.

  [SHALLOW MODULE] [BASELINE] `lib/geo` — 12 exports over 112 implementation lines (<200)
    Flags per the >10-exports-and-<200-lines rule. Caveat: the barrel's own comment notes
    `vnAdmin` statically imports a large (~690KB) data file not counted in the `.ts` line
    total, so the module's real "weight" is understated by line count. Unrelated to PR #259.

  [PR HYGIENE — not architecture, noted for completeness] `lib/config/env.ts` changes in
    this PR (VNPAY_ENABLED gate, VietQR bank BIN/account swap, TICKET_SECRET added to the
    production-required list) are unrelated to the "OTP phone→email" theme of this PR.
    Not an architecture defect, but worth a mental note for `/pr-review`/`/code-review`:
    scope-mixing makes the diff harder to bisect if the VietQR change needs an independent
    revert.

SUMMARY: 2 P1 (both pre-existing baseline, not introduced by PR #259), 4 P2 (1 introduced
by PR #259 — the ADR contradiction — 3 baseline), 4 P3 (all baseline)

PR-#259-attributable findings requiring action before/around this PR: 1 — the ADR-003
contradiction. Everything else is baseline debt surfaced by the repo-wide scan and does
not block this PR.

Graph snapshot updated → docs/qa/arch-graph.json

RECOMMENDED NEXT STEPS:
  → /adr-writer now, before merge if practical: amend or supersede ADR-003 sections 1 and
    6 to reflect email+password as the live customer auth model and email as the live OTP
    channel. This is the one finding this review considers a real gap in this PR's scope.
  → File a follow-up issue for the lib/booking↔payment↔ledger cycle (P1 baseline) —
    pre-existing, not urgent to fix this sprint, but should not be allowed to grow a 4th
    node.
  → File a follow-up issue (or explicitly bless the pattern in CLAUDE.md) for the 59
    direct-prisma-in-app-layer sites — currently a silent, undocumented exception to a
    documented rule.
  → /improve-codebase-architecture for the lib/utils.ts / lib/utils/index.ts collision —
    cheap, mechanical fix, removes dead code.
  → No action needed this cycle on the lib/geo, lib/notification getEnv-path, or
    lib/core/config re-export findings — tracked for awareness only.
