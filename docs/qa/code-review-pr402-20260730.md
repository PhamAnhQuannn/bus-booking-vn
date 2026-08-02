CODE REVIEW — PR #402 "fix(home): remove every invented figure from the landing page" @ 7d63e785
────────────────────────────────
Diff scope: 7 files, +87 / −233 (1 commit, base `master`, head `7d63e78581661e95740fdfb45f3c996b7431ce9f`)
Mode: PR (read-only; no checkout, no worktree, no install)
Reviewed against: CLAUDE.md Mistake Log (auto-P1 on match), AGENTS.md, `docs/design/mockup-home-spec.md`

The change is directionally right and the deletions are clean — no orphaned import
survived, no still-needed symbol was removed with them, and the real price/duration
path is untouched. The findings below are about what the sweep did **not** reach and
about statements the merged tree would still be making.

---

PRIORITY 1 — Block merge, fix first:

  [CORRECTNESS / FALSE CUSTOMER-FACING CLAIM — sibling defect not swept]
  lib/notification/esms.ts:94  (reached from lib/jobs/reconcilePayments.ts:596 and :673)

    The PR removes `1900 xxxx` from the footer. The identical literal is still
    exported as `SUPPORT_HOTLINE` and interpolated into **customer-facing payment
    notifications**:

        lib/notification/esms.ts:94   export const SUPPORT_HOTLINE = '1900 xxxx';
        lib/notification/esms.ts:140  `Ho tro: ${payload.supportEmail} / ${payload.hotline}.`
        lib/notification/esms.ts:148  `hoac ${payload.hotline} de duoc ho tro.`
        lib/jobs/reconcilePayments.ts:596  customerPaymentReview   → hotline: SUPPORT_HOTLINE
        lib/jobs/reconcilePayments.ts:673  customerPaymentUnverified → hotline: SUPPORT_HOTLINE

    Both templates go to the buyer's own email/SMS (`recipient: booking.buyerEmail ??
    booking.buyerPhone`), and both fire in the *worst* situation the platform has —
    money has left the customer's account and the booking is unmatched or expiring.
    The customer is told, verbatim, to call `1900 xxxx`.

    This is the exact pattern the Mistake Log already charges (CLAUDE.md, 2026-07-30):
    *"When you fix a 'raw value outranks the sourced value' bug, grep every other field
    that reads from the same merge layer in the same breath — the defect is per-field,
    and fixing the one that was reported leaves the siblings armed."* One `grep -rn
    "1900 xxxx"` would have surfaced this; that grep was not run, or its result was not
    acted on. Auto-P1 per the severity table.

    Compounding: the PR body and commit message both list the hotline under "Removed"
    with no qualifier. Read literally, that is a false claim about a placeholder
    removal — the same defect class the PR exists to correct, committed in the PR that
    corrects it.

    Fix: either delete `SUPPORT_HOTLINE` and drop the `/ hotline` clause from both
    templates (support email alone is real and monitored), or make the hotline
    `undefined`-able and have `renderTemplate` omit the clause when absent. Do not
    scope this to a follow-up while claiming the placeholder is gone.

  [DEAD RATIONALE / SELF-CONTRADICTING FILE — CLAUDE.md 2026-07-30 auto-P1]
  components/layout/SiteFooter.tsx:3-16

    The file header docstring was not walked forward with the change and is now false
    in four places, one of which contradicts a constant added 13 lines below it:

      :9   "…brand column (logo + blurb + social chips)…"        — chips deleted by this commit
      :9   "…the last of which is a support-hotline block…"      — hotline deleted by this commit
      :12  "⚠ PLACEHOLDERS in this file — the hotline number, its hours,
            THE SUPPORT EMAIL, and the social links are all invented."
      :15  "Replace or remove all four before this ships."

    versus, at :22-29, added by this same commit:

      "Real, monitored support address."  const SUPPORT_EMAIL = 'hotro@lenxevn.com';

    So the merged file states, in one place, that `hotro@lenxevn.com` is invented and
    must not ship, and in another that it is real and monitored. A reader has no way to
    know which survived. (For the record: the address IS real — independently declared
    at `lib/notification/esms.ts:93` as the ops/support inbox and asserted as the
    `opsUnmatchedPayment` recipient in `lib/jobs/reconcilePayments.int.test.ts:380`. The
    header is the wrong one. But that took three files to establish.)

    This is verbatim the logged rule: *"a comment explaining why a file or branch exists
    is not evidence that it still runs. When a policy changes ('flag it' → 'drop it'),
    grep for the code the old policy justified and check whether it is still reachable —
    dead code with a live rationale beside it reads as working."*

    Fix: rewrite lines 3-16 to describe the footer as it now is. A PR whose entire
    thesis is "remove statements the codebase cannot back" cannot merge leaving a
    ⚠-flagged block asserting the opposite of the code beneath it.

---

PRIORITY 2 — Fix before merge:

  [DUPLICATE SOURCE OF TRUTH / SILENT DRIFT]
  components/layout/SiteFooter.tsx:29

    `const SUPPORT_EMAIL = 'hotro@lenxevn.com'` is a **second** hardcoded copy of a
    value already exported at `lib/notification/esms.ts:93` (and re-exported through the
    `lib/notification` barrel at `index.ts:9`). Rotating the support inbox now takes two
    edits in two domains, and missing the footer is silent — nothing compares them. Same
    family as the logged "one producer, two consumers" rule.

    Note for whoever fixes it: **do not import `@/lib/notification` here.** `SiteFooter`
    is `'use client'`, and the barrel pulls server-only transitives into the client
    bundle — that is the 2026-06-04 operator-portal 500 incident exactly. The correct
    fix is a client-safe leaf module (e.g. `lib/support/contacts.ts`) that both
    `esms.ts` and `SiteFooter.tsx` deep-import.

  [DEAD CODE CREATED BY THIS DIFF — Working Principle 3]
  components/home/NewsletterBand.tsx (whole file, 60+ lines)

    Confirmed against the head tree: the file still exists and, after this PR, has
    **zero importers**. `app/(customer)/page.tsx` dropped both the import (:22) and the
    mount (:444). CLAUDE.md Working Principle 3 requires removing what *your* change
    made unused — this change made it unused. It also carries its own documented
    `⚠ KNOWN CONTRAST FAILURE` (white-on-orange below WCAG AA, :13-17), so it is a
    non-compliant component sitting one `import` away from returning.

    Separately, the PR body lists NewsletterBand under "**Removed** rather than emptied"
    and "Also removed — controls that did nothing". It was **unmounted**, not removed.
    Either delete the file or correct the body; as written the body overstates the diff.

  [CLAIM TRUE OF THE MECHANISM, FALSE OF THE LIVE DATA]
  app/(customer)/page.tsx:60-65  +  prisma/seed.ts:98,111,124

    The new tile — "Nhà xe được xác minh / Mỗi nhà xe đều được duyệt trước khi mở bán
    vé" — is enforced in code (full verification below, it checks out). But
    `prisma/seed.ts` writes `status: 'APPROVED'` directly at three sites, bypassing
    review entirely, and the PR body itself states that the live production DB was
    populated from that seed and still contains `TEST PAYMENT VERIFY` as an APPROVED,
    customer-visible operator.

    So on the day this merges, the homepage asserts every operator was vetted, on the
    same page as a card for a payment-test artifact that was not. The replaced claim
    ("nationwide network") was false about *scale*; the new one is false about
    *provenance* of the one row on screen — and it is the stronger, more auditable
    assertion of the two.

    The PR is explicit that it does not fix the data, which is honest. But sequencing
    matters here: land the operator purge/replacement first, or hold this tile until it
    does. Merging the tile ahead of the data makes the page more precisely wrong.

  [TEST / NEW BRANCH UNCOVERED]
  components/home/OperatorShowcase.tsx:70-84

    `COLUMN_CLASS` + the `??` fallback is new branching logic (5 outcomes: 1, 2, 3, 4,
    fallback ≥5) plus a `cards.length === 0 → null` guard. There is no test file for
    this component anywhere in the repo, and this diff adds none. Non-risk path, so P2
    rather than P1, but this is the only *new logic* in a 233-line-deletion PR and it is
    the one thing a reviewer cannot verify by reading the deletions.

---

PRIORITY 3 — Address when convenient:

  [COMMENT CONTRADICTS CODE] components/home/OperatorShowcase.tsx:67-76
    The comment states the rule as "Cap the track count at the number of cards we
    actually have." `COLUMN_CLASS[1]` is `'grid-cols-1 sm:grid-cols-2'` — a two-track
    grid for one card. With exactly one operator (the launch state the comment is
    written for) the card renders at ~half the max-w-7xl container with an empty cell
    beside it: the same "stranded card" the comment says it prevents, at 1/2 instead of
    1/5. Either use `grid-cols-1` for the 1 case, or restate the rule honestly as
    "cap at min(cards, 4), floor 2 so a lone card is not full-bleed".

  [DEAD FIELD] lib/home/getPublicOperators.ts:8, :20, :36
    `PublicOperator.provinceName` now has zero consumers — `ShowcaseCard.subline` was
    its only one, and the PR removed it. (Worth noting for the record: `subline` was
    genuinely dead *before* this PR too — `OperatorCard` on master never rendered it.
    Removing it lost nothing. That check passes.) The field is still SELECTed from the
    DB and serialized to the client for nothing. Drop it from the select, or leave with
    a note — pre-existing-adjacent, so Working Principle 3 arguably says leave it.

  [PR BODY ACCURACY] PR description, "This does not fix the data" §1
    "all **16** deletes are unfiltered `deleteMany()`" — `scripts/prod/purge-demo-catalog.ts`
    contains **15** `deleteMany` occurrences, not 16. The other two halves of that
    paragraph verify clean: there is no `where` clause anywhere in the file, and it does
    hard-abort on `LedgerEntry` rows with `process.exit(1)` (:64, :120). Correct the
    count — the body uses it to justify the ordering of a destructive production
    operation, and an off-by-one in that context invites a reader to assume the rest is
    approximate too.

  [SPEC TRAILS CODE] docs/design/mockup-home-spec.md:26, :199, :222
    §4's per-element disposition table still lists the star ratings, "N+ tuyến",
    "N+ chuyến/ngày", the hotline column and the VI switcher as open decisions. They are
    now decided and executed. The spec that the PR's own comments cite as authority is
    the one document not updated.

  [EMPTY WRAPPER] components/home/PopularDestinations.tsx:54-57
    Removing the "Xem tất cả" link leaves `<div className="flex items-center gap-3">`
    wrapping only a `hidden md:flex` block — an empty flex container below md. Same
    shape at `OperatorShowcase.tsx:88`, where `<div className="mb-6">` now wraps a lone
    `<h2>` (the `flex items-end justify-between` was correctly dropped). Cosmetic.

---

CHECKS RUN THAT CAME BACK CLEAN — recorded so they are not re-run:

  Orphaned imports — all correctly swept, none over-swept:
    · `Star` removed from `OperatorShowcase` and `PopularTrips` lucide imports; no other use.
    · `ChevronDown` removed from `SiteHeader`; `LogInIcon/MenuIcon/XIcon` retained and used.
    · `Phone`, `Share2`, `MessageCircle`, `AtSign`, `Music2` removed from `SiteFooter`;
      `Mail` retained and used by the new mailto anchor.
    · `SOCIALS` array deleted with its only consumer.
    · `NewsletterBand` import removed from `page.tsx`.
    · `Link` correctly RETAINED in `OperatorShowcase` (used by `OperatorCard`'s href
      branch, :58-64), in `PopularDestinations` (card links) and in `PopularTrips`.
      A naive sweep would have dropped these — it did not.
    · `toInitials` still reachable via `toCard`.
    · `ChevronLeft`/`ChevronRight` retained in both carousels.
    · No `homePlaceholders` reference remains anywhere in the head tree (verified against
      the git tree at 7d63e785, not just the diff).

  Tailwind class generation — NOT a risk here, contrary to the standing concern.
    Every value in `COLUMN_CLASS` is a contiguous string literal in source, so v4's
    scanner extracts all candidates; nothing is assembled from fragments. The only
    interpolation is `` `grid gap-4 ${columns}` ``, where `grid`/`gap-4` are literal and
    `columns` resolves to a whole pre-written literal. Additionally every class used
    (`sm:grid-cols-2`, `lg:grid-cols-3`, `lg:grid-cols-4`, `xl:grid-cols-5`) already
    appears elsewhere in the tree (e.g. `app/(customer)/page.tsx:417`,
    `components/home/ContractCarRental.tsx:72`), so even a stale per-file rescan (the
    2026-07-18 incident) could not blank them.

  Fallback reachability — correct. `if (cards.length === 0) return null` precedes the
    lookup, so the `??` branch is reachable for exactly `cards.length >= 5` and the
    map covers 1-4 with no gap.

  A11y — no dangling references. The removed social `<a>`s carried self-contained
    `aria-label`s (no `aria-labelledby` pointed at them from anywhere). The removed VI
    pill was `aria-hidden="true"` — deleting it removes nothing from the a11y tree; the
    surviving `ml-auto flex items-center gap-5` still holds the login `<Link>`, so no
    empty landmark. `<footer>`/`contentinfo` still holds four labelled `<nav>` regions
    plus the support block. No heading is left with no content beneath it —
    `OperatorShowcase`'s `<h2>` still has its card grid, `PopularTrips`/`PopularDestinations`
    keep theirs.

  Footer grid balance — INTACT. The footer did not lose a column. The social `<ul>` was
    removed from *inside* the brand column, and the hotline column was retitled
    ("Tổng đài hỗ trợ" → "Hỗ trợ khách hàng"), not deleted. The
    `lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr]` track list at :83 still receives exactly
    five children: brand + 3 × FOOTER_COLUMNS + support. Unchanged and still balanced.
    The support block also improved — the email is now a real `mailto:` anchor with a
    focus ring, where it was an inert `<span>`.

  Tests referencing removed code — none exist. No unit or e2e test references
    `homePlaceholders`, `NewsletterBand`, `OperatorShowcase`, `PopularTrips`,
    `PopularDestinations`, the social chips, the VI pill or "Xem tất cả". The only
    footer assertion is `e2e/site-header.spec.ts:87-89`, which targets
    `contentinfo a[href="/op/login"]` in the "Hợp tác" column — untouched by this diff,
    still passes. (The `'1900 xxxx'` hits in `lib/jobs/__tests__/reconcilePayments.test.ts:67`
    and `lib/notification/__tests__/esms.test.ts:51,66` are the P1 above, not this file.)

  Diff hygiene — clean. No `console.log`, no `debugger`, no `.only`/`.skip`, no
    commented-out code blocks added, no lockfile or generated file, no unrelated
    formatting churn. Every removal is annotated with a dated comment explaining what
    stood there and what would justify restoring it — that convention is good and
    should stay.

---

ANSWERS TO THE TWO GATING QUESTIONS:

  ▸ Did real price/duration data survive?  **YES.** Verified end to end:
      · `lib/core/db/getActiveRoutes.ts:37-38` — `MIN(t.price)::int AS "minPrice"` and
        `MIN(r."durationMinutes")::int AS "minDurationMinutes"` — file not in the diff.
      · `app/(customer)/page.tsx:175-188` — still awaits `getActiveRoutes()` and builds
        the `prices` / `durations` records keyed by `routeKey`. Not in the diff.
      · `app/(customer)/page.tsx:389` — still `<PopularTrips prices={prices} durations={durations} />`.
        The only page.tsx edits are the FEATURES tile and the NewsletterBand removal.
      · `PopularTrips.tsx` retains the `liveRoutes` filter on `prices[key] != null`, the
        `Clock` + `formatDuration(duration)` row, `Từ {formatVnd(price)}`, and the
        price-bearing `aria-label`. The diff touched only the sibling rating `<span>`
        and flipped the row wrapper from `justify-between` to `justify-end`.
    No regression. "Từ …" still renders from `MIN(t.price)`.

  ▸ Is the new FEATURES claim true?  **YES on the mechanism — with a live-data caveat
    that is P2 above, not a defect in the claim itself.**
      · `prisma/schema.prisma:70` — `status OperatorStatus @default(PENDING_REVIEW)`.
        New applicants cannot start approved.
      · `lib/onboarding/operatorCapabilities.ts:80-82` — `SEARCH_VISIBLE_STATUSES` is
        *derived* from `getOperatorCapabilities`, not a hand-typed literal, and today
        resolves to exactly `{APPROVED}`. `BOOKABLE_STATUSES` likewise from `canSell`.
      · Enforced at three independent points: customer search
        `lib/trips/searchTrips.ts:176`; the homepage rail itself
        `lib/home/getPublicOperators.ts:15`; and a re-check at booking initiate
        `lib/booking/initiateOnlineBooking.ts:117` closing the suspend-after-search race.
      · The only writer of `APPROVED` on the application path is
        `lib/admin/createOperatorAccount.ts:118`, inside an admin-authenticated
        `$transaction` with a `FOR UPDATE` lock and an `AdminAuditLog` row.
      · `lib/admin/createOperator.ts` (CLI) writes no status → inherits PENDING_REVIEW.
    So "duyệt trước khi mở bán vé" describes a gate that genuinely exists, is genuinely
    enforced, and is genuinely what makes trips bookable. This is **not** one false
    claim swapped for another.
    Caveat (P2 above): `prisma/seed.ts:98,111,124` bypasses it, and the live DB the PR
    body describes still holds a seeded APPROVED `TEST PAYMENT VERIFY`.

SUMMARY: 2 P1, 4 P2, 5 P3

VERDICT: **NEEDS-CHANGE** — do not merge as-is.

  The two P1s are both small edits and neither undermines the PR's premise, which is
  sound and well executed. But merging now would ship a page that stopped printing
  `1900 xxxx` while the payment-failure email still prints it, and a file whose header
  calls the support address invented eleven lines above the line calling it real. Both
  are the PR's own thesis applied to the PR.

RECOMMENDED NEXT STEPS:
  → P1-1: `grep -rn "1900 xxxx"` and finish the sweep. Delete `SUPPORT_HOTLINE` and the
    `/ hotline` clause from both `esms.ts` templates, update the two tests that assert
    it (`reconcilePayments.test.ts:67`, `esms.test.ts:51,66`). Same commit.
  → P1-2: rewrite `SiteFooter.tsx:3-16` to match the file's actual contents.
  → P2: delete `NewsletterBand.tsx` (or correct the body's "removed"); extract a
    client-safe shared support-contact constant; add a test for `COLUMN_CLASS`;
    sequence the operator-data purge relative to the FEATURES tile.
  → Body: fix "16 deletes" → 15, and soften "removed" → "unmounted" for NewsletterBand.
    This body becomes the permanent squash-merge commit message (CLAUDE.md 2026-07-24) —
    the inaccuracies become history.
  → P3s can ride this PR or defer.
