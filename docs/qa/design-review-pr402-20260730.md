---
review-date: 2026-07-30
scope: PR #402 — fix(home): remove every invented figure from the landing page
branch: fix/landing-page-real-data-only → master
status: yellow — needs-change (one P1), nothing visually broken
reviewer: design-review (visual/layout pass)
---

# Design Review — PR #402 — 2026-07-30

## Method

The Vercel preview for this PR is behind SSO (302 → `vercel.com/login`), so no after-screenshot
exists. Instead: the **live production page** (`https://lenxevn.com/`, pre-PR state) was loaded in a
real browser at 1440×900 and 390×844, and the PR's removals were then applied to the live DOM —
same stylesheet, same fonts, same real data — to produce a measured after-state. Every number below
is a `getBoundingClientRect()` reading from that page, not an estimate.

The `PopularTrips` section **does not render on production today** (`liveRoutes.length === 0` → the
component already returns `null`, `PopularTrips.tsx:49`). Its card change was therefore judged by
injecting a before/after card pair built from the real classes into the live page.

### What production actually contains right now

| Section | Live state |
|---|---|
| Hero + search | unchanged by this PR |
| FEATURES strip | 4 tiles |
| `Nhà xe đối tác uy tín` | **5 cards** — 1 real (`TEST PAYMENT VERIFY`) + 4 fabricated, each 237px |
| `Tuyến đường phổ biến` | **absent** — no priced routes exist |
| `Dịch vụ thuê xe` (ContractCarRental) | unchanged |
| `Điểm đến được yêu thích` | 5 photo cards + `N+ chuyến/ngày` |
| `NewsletterBand` | full-bleed **orange band**, 93px — the page's closing element |
| Footer | brand col + 4 social chips, 3 link cols, hotline col with orange `1900 xxxx` |

---

## What the page looks like now

**The page is honest and noticeably barer, and in one place the barer-ness has tipped into
looking unfinished.**

Read top to bottom after the change: the hero is untouched and still carries the page. The four
feature tiles are unchanged in weight — the third tile's new copy (`Nhà xe được xác minh` / `Mỗi nhà
xe đều được duyệt trước khi mở bán vé`) wraps to two lines exactly like its neighbours, so that
substitution is invisible and is a straight upgrade. `Điểm đến được yêu thích` becomes photo +
name, which is a clean, conventional destination-card pattern and reads as *intentional*, not
stripped. The footer loses its social chips and its hotline; what remains is well-formed, and the
orange `mailto:` link keeps a single accent alive in the upper slab. The header's right cluster,
now just the login button flush right, reads better than it did with the inert VI pill beside it.

Two honest losses worth naming plainly. First, the page no longer **closes**: `NewsletterBand` was
a full-bleed orange band that separated the last white section from the dark footer, and without it
the destinations carousel runs straight into the footer. It is not broken, but the page now stops
rather than ends, and there is no closing CTA anywhere below the hero. Second, every trust signal
is gone — ratings, review counts, partner count, hotline, social presence. What replaces them is
one verification claim in a feature tile. That is the trade the author knowingly made and it is the
right one, but the page's persuasive weight now rests almost entirely on the hero and the price
figures.

The one place it tips over is `Nhà xe đối tác uy tín`. With production's single operator, that
section renders as a heading reading *"reputable partner operators"* (plural) above **one card
616px wide holding a 44px chip and the words `TEST PAYMENT VERIFY`** — roughly 210px of ink in a
616px card, with a further **616px empty grid track beside it**. Measured, not estimated. It is the
only element on the page that looks like a bug rather than a decision, and it is also the element
that now gives the fake operator name the most prominence it has ever had.

---

## Findings

### P1 — must fix before merge

**1. `OperatorShowcase.tsx:74-79` — `COLUMN_CLASS[1]` does not do what its own comment says, and n=1 is the production case.**

The comment above the lookup states the intent precisely:

> *"without padding a lone real operator would render as one narrow card stranded in a five-column
> track. Cap the track count at the number of cards we actually have."*

But the entry for one card is `'grid-cols-1 sm:grid-cols-2'` — it caps at **two** tracks, not one.
Measured on the live page at 1440 with the PR's classes applied:

| | value |
|---|---|
| grid width | 1248px |
| card width | **616px** |
| card height | 76px |
| ink inside the card (chip + name) | ~210px |
| **empty grid track to the right** | **616px** |
| section height | 216px |

So the fix intended to stop a card being stranded in a 5-track grid strands it in a 2-track grid
instead. Every breakpoint from `sm` (640px) up is affected; **mobile is fine** (`grid-cols-1`,
card fills 343px, no overflow — verified at 390px).

Note this is *not* fixed by changing `1:` to `'grid-cols-1'` — that produces a 1248px-wide card
holding one line of text, which is worse. The card is horizontal by design (`flex items-center`),
so it needs a **bounded width**, not a track count. See the combined fix under finding 2.

---

### P2 — should fix

**2. `OperatorShowcase.tsx:44-53` — the card lost its second line, and two real DB fields that could fill it are already fetched and now unused.**

The removal of the placeholder rating and `N+ tuyến` left `OperatorCard` rendering a single line
(the operator name). That is *why* the 616px card looks empty — it is a two-line card layout with
one line in it.

`getPublicOperators()` already selects and returns both `provinceName` **and** `routesSummary`
(`lib/home/getPublicOperators.ts:8-9,20-21,36-37`). Both are real, operator-authored columns
(`prisma/schema.prisma:60,64`). After this PR **neither is rendered** — `routesSummary` is now
fetched on every homepage request and thrown away, and `provinceName` was dropped along with the
unused `subline` field (`OperatorShowcase.tsx:24,46` pre-PR — it was assigned but never rendered,
so removing it was correct; the point is the *data* is still there).

The project's own design spec already decided this. `docs/design/mockup-home-spec.md:222`:

| Element | Real data? | Verdict |
|---|---|---|
| `"N+ tuyến"` per operator | Derivable but launch-scale tiny | **REDUCE** → `routesSummary` free text (`schema.prisma:60`) |

The spec's disposition is **REDUCE to `routesSummary`**, not DROP. Every other element this PR
touches matches its spec verdict exactly (see the Spec Conformance table below); this is the one
that diverges, and it is the one that left a hole.

Suggested combined fix for P1 + P2, no new data plumbing:

```tsx
// second line, real data, honest:
{card.subline && (
  <p className="mt-0.5 truncate text-xs text-muted-foreground">{card.subline}</p>
)}
// where subline = op.routesSummary ?? op.provinceName

// and bound the card width instead of the track count:
<div className="flex flex-wrap gap-4">   // replaces the grid + COLUMN_CLASS lookup entirely
  ... each card: className="... w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(20%-0.8rem)] lg:min-w-56"
```

A flex-wrap with a per-card basis degrades correctly at **every** count, which the lookup does not
(see P3 finding 6).

**3. `OperatorShowcase.tsx:92` — heading is plural and asserts `uy tín` above a single, unrated card.**

`Nhà xe đối tác uy tín` — "reputable partner operators". The PR's own body identifies this heading
as the aggravating factor for the fabricated ratings:

> *"a genuine partner was shown a fabricated score under a heading that calls them **uy tín**
> (reputable)"*

The score is gone; the word is not. With the ratings removed there is now **nothing on the page
backing the claim** — it is the same category of unbacked assertion as the
`"Hợp tác cùng nhiều nhà xe chất lượng trên toàn quốc"` tile this PR correctly rewrote three files
away, and it is plural above one card. Suggest `Nhà xe đối tác` alone, or `Nhà xe đang khai thác`
("operators currently running"), which is literally what the section lists.

**4. `SiteFooter.tsx:12-15` — the file docstring still describes the elements this PR deleted, and contradicts the PR on whether the support email is real.**

The header comment survives untouched:

> *"⚠ PLACEHOLDERS in this file — the hotline number, its hours, **the support email**, and the
> social links are all **invented**. … Replace or remove all four before this ships."*

and line 8 still describes the brand column as *"logo + blurb + social chips"*. After this PR:
the hotline, hours and socials are gone, and 14 lines below, `SiteFooter.tsx:23-29` asserts the
opposite about the fourth item — *"Real, monitored support address"*. One file now says
`hotro@lenxevn.com` is invented **and** that it is real.

For the record the new comment is the correct one: `lib/notification/esms.ts:93` exports
`SUPPORT_EMAIL = 'hotro@lenxevn.com'` and it is already the live recipient for ops alerts and is
printed in customer transactional email (`lib/notification/__tests__/emailBody.test.ts:91`). The
address is genuine; only the docstring is wrong.

This is the project's own logged failure mode — *"a comment explaining why a file or branch exists
is not evidence that it still runs … dead code with a live rationale beside it reads as working"*
(CLAUDE.md, 2026-07-30). Cheap to fix and directly in this PR's scope, since this PR is what made
the comment false.

**5. `docs/design/mockup-home-spec.md:223,282` — spec still says the footer email is unshippable, and puts it in a different column than the PR does.**

Two drifts against the source-of-truth spec:

- §4 marks the footer email **`OPEN (§6) — omit until confirmed`**, and §6 item 1 says *"until
  confirmed, no email ships."* It is now confirmed (esms.ts, above). The spec row should be flipped
  to SHIP so the next reader does not "correct" the footer by deleting the address.
- §3 says that if a mailbox is confirmed *"it goes in the footer **brand column**"* and that
  *"the 4th column remains the support-links group"* — i.e. the spec expects **four** columns with
  the email tucked under the brand blurb. The PR instead keeps a **five**-column grid
  (`SiteFooter.tsx:83`, `lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr]`) with a dedicated
  `Hỗ trợ khách hàng` column holding one email link.

Measured, the five-column version is **not broken** — tracks come out 272 / 194 / 194 / 194 / 233px
and all five stretch to 148px, so there is no ragged column. But the widest-but-one track now holds
the least content, because 1.2fr was sized for a `text-xl font-bold` phone number that no longer
exists. Either follow the spec (fold the email into the brand column, drop to four tracks) or
retune the track list; both are one-line changes. Not a merge blocker.

---

### P3 — polish / follow-up

**6. `OperatorShowcase.tsx:74-79,86-87` — the lookup only covers 1–4, and the ≥5 fallback re-creates the same stranded card.**

`COLUMN_CLASS` has no entry for 5+, so any count ≥5 falls through to
`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5`. The pre-PR `.slice(0, 5)` cap was also
removed (`cards = operators.map(toCard)`), so the row now renders every approved operator. At n=6
that is 5 cards then **one lone card in a 5-track row** — the exact defect the lookup was written
to prevent, returning at n=6, 7, 9, 11… A flex-wrap with a per-card basis (P2) has no such holes.

**7. `SiteHeader.tsx:185` — comment still reasons about the deleted VI pill.**

> *"This also lands **"VI"** at nav size and keeps the button label one step larger than the nav,
> both as measured."*

`text-sm` on the nav is still correct for the second clause; the `"VI"` justification is dead.
Same class as finding 4.

**8. `SiteFooter.tsx:29` — third hardcoded copy of the support address.**

`const SUPPORT_EMAIL = 'hotro@lenxevn.com'` now exists in `SiteFooter.tsx` *and*
`lib/notification/esms.ts:93` (as `SUPPORT_EMAIL`) *and* `esms.ts:102` (as `OPS_ALERT_EMAIL`).
`docs/qa/backcompat-pr326-20260724.md:80` already asked for *"exactly one `OPS_EMAIL` concept in the
codebase"*. If support ever moves address the footer will silently keep showing the old one.

**Do not fix by importing `@/lib/notification/esms` into `SiteFooter.tsx`** — the footer is
`'use client'`, and pulling a `lib/` barrel or server module into a client component is precisely
the 2026-06-04 mistake-log incident that 500'd the whole operator console. It needs a client-safe
shared constant module, which is more than this PR should carry. Log it, don't do it here.

**9. Vestigial wrappers left by the removals.** None affect rendering; all are one-line cleanups.
- `PopularDestinations.tsx:97` — `<div className="flex flex-col gap-0.5">` now wraps a single
  `<span>`; the `gap-0.5` is inert.
- `PopularDestinations.tsx:54` / `PopularTrips.tsx:63` — `<div className="flex items-center gap-3">`
  header clusters that can now render completely empty (below `md`, and for `PopularTrips` whenever
  `useCarousel` is false, which is the current production state).
- `PopularTrips.tsx:150` — `flex items-center justify-end gap-2` around a single child; `gap-2` and
  `items-center` are both inert.
- `SiteHeader.tsx:222` — `<div className="ml-auto flex items-center gap-5">` now has one child;
  `gap-5` is inert.

**10. `components/home/NewsletterBand.tsx` is now an orphan.** Unmounted at
`app/(customer)/page.tsx:401-405` but the file remains with zero importers. Consistent with the PR's
stated "don't touch adjacent dead code" policy, and it does resolve the silent-no-op finding filed
at `docs/qa/code-review-pr319-20260722.md:29`. Worth a deletion follow-up so it is not re-mounted by
someone who finds it and assumes it works.

**11. The page has no closing element.** Removing `NewsletterBand` (a 93px full-bleed orange band)
means `Điểm đến được yêu thích` now runs directly into the dark footer, and nothing below the hero
asks for an action. Not broken — section padding keeps the transition clean — but if a closing band
is wanted back, it needs real content, not a reinstated newsletter. Product decision, not a code one.

---

### ✅ Pass — checked and fine

- **`PopularTrips` card balance — no issue found.** This was the specific concern raised; measured,
  it does not exist. The rating and the `Tìm vé` chip shared **one** row under `justify-between`, so
  removing the rating removes no row: injected before/after cards measured **301px tall in both
  cases, delta 0**. There is no dead vertical space and no height inconsistency with neighbouring
  cards. What remains is a 79px CTA right-aligned in a 268px row (189px empty to its left), which is
  an ordinary card-footer pattern and reads as deliberate. Optional polish only: make the CTA
  full-width, or move `Từ 250.000 ₫` down beside it to restore a two-item `justify-between`.
- **`PopularDestinations` — no height inconsistency.** All five names are single-line, so cards stay
  uniform; photo + name is a standard destination tile. Nothing neighbours it that it must align to.
- **Mobile (390px) — clean throughout.** Operator card fills 343px; footer collapses to a single
  343px column; `document.scrollWidth` 375 vs viewport 390 → **no horizontal overflow**. The P1 is
  desktop-only.
- **`SiteHeader` right cluster** — login CTA flush right at the `px-6` gutter; no alignment or
  spacing artifact from the VI pill's removal. Reads cleaner than before.
- **FEATURES tile substitution** (`app/(customer)/page.tsx:60-65`) — two-line sub, same visual weight
  as its three neighbours; verified in the after-render. Copy change is a strict improvement.
- **Footer column count and heights** — 5 tracks, all 148px, no orphan or ragged column (see P2 #5
  for the track-width nit).
- **Real data preserved** — `Từ <price>` and durations still render from
  `getActiveRoutes()`; nothing real was removed alongside the placeholders.

---

## Spec Conformance — `docs/design/mockup-home-spec.md` §4 "Data reality table"

The deleted `homePlaceholders.ts` pointed at this table as *"the per-element disposition the honest
version would use"*. Scoring the PR against it:

| Element | Spec verdict | PR does | |
|---|---|---|:-:|
| Route-card star rating | DROP | dropped | ✅ |
| Fabricated operator names | DROP | dropped | ✅ |
| Operator rating | DROP | dropped | ✅ |
| `N+ tuyến` per operator | **REDUCE → `routesSummary`** | **dropped** | ⚠️ P2 #2 |
| `N+ chuyến/ngày` per destination | DROP | dropped | ✅ |
| Hotline + hours | DROP | dropped | ✅ |
| Footer email | OPEN — omit until confirmed; then **brand column** | ships, in its **own column** | ⚠️ P2 #5 |
| Social chips (4) | OPEN — omit until real | omitted | ✅ |
| Newsletter signup | DROP | dropped | ✅ |
| VI language pill | DROP | dropped | ✅ |
| Route from-price / duration | SHIP | kept | ✅ |
| Payment marks | REDUCE → real methods, monochrome | untouched (already compliant) | ✅ |

**10 of 12 exact; 2 drifts, both documented above.** The PR is closely faithful to a spec written
before it — which is the strongest evidence that its removals were the right ones.

---

## Deployment-order caveat (not a code finding)

On merge, production renders `Nhà xe đối tác uy tín` as **one 616px card reading
`TEST PAYMENT VERIFY`**. Before this PR that row was 1 of 5 cards at 237px; after, it is the entire
section at 2.6× the width. The PR removes the fabricated operators but structurally **promotes** the
remaining real-but-embarrassing row.

The PR body already documents the purge as a separate ordered operation, including that
`scripts/prod/purge-demo-catalog.ts` has no `WHERE` clause and hard-aborts on any `LedgerEntry` row.
That ordering is the deciding factor for the visual outcome: **merge this together with the data
purge + real-operator onboarding, or the landing page's partner section is a single wide card
advertising a payment-test artifact.**

---

## Verdict

**Status: yellow — needs-change. Nothing is visually broken; one element is visually unfinished.**

Nothing on the page renders incorrectly, overflows, misaligns, or breaks at either breakpoint. The
`PopularTrips` and `PopularDestinations` concerns raised for this review were measured and are
non-issues. The header and footer absorb their removals cleanly. The page is barer and less
persuasive than it was — knowingly and correctly so — and only one section crosses from *sparser*
into *looks like a bug*.

Required before merge:
- **P1 #1 + P2 #2 together** — bound the operator card's width instead of the track count, and
  render `routesSummary ?? provinceName` as the card's second line. Both are small, and the spec
  already nominates the field. Fixing one without the other leaves either a half-width card or a
  one-line card.

Strongly recommended in the same commit (all one-liners, all made stale *by this PR*):
- P2 #3 — retitle the section away from the unbacked plural `uy tín`.
- P2 #4 — rewrite the `SiteFooter` docstring; it currently contradicts the PR 14 lines below itself.
- P3 #7 — drop the dead `"VI"` clause in `SiteHeader.tsx:185`.

Follow-ups (separate issues): P2 #5 spec update, P3 #6 grid generality, #8 email constant
deduplication (client-safe module — do **not** import `lib/notification` into the footer), #9
vestigial wrappers, #10 delete `NewsletterBand.tsx`, #11 closing-section product decision.

## Re-review trigger

Re-run against a viewable preview once the operator card renders a second line, and again after the
production data purge — the section's real appearance depends on operator count and on
`routesSummary` being populated for the first real operator.
