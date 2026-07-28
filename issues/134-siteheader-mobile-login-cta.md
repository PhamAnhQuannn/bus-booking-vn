---
depends-on: []
type: BUG
wave: 3
---

## Parent PRD

Plan: `C:\Users\mrimp\.claude\plans\with-all-the-issues-reactive-llama.md` — PR 6. GitHub #369.

## What to fix

Follow-up to merged PR #355, which closed #349 with only half the fix delivered.

`components/layout/SiteHeader.tsx` relabels the header CTA to "Đăng nhập nhà xe" so customers
aren't sent to the operator admin login under a generic "Đăng nhập / Đăng ký". But that relabel
only renders at `xl` and above (≥1280px), inside `<div className="hidden flex-1 items-center xl:flex">`
(`SiteHeader.tsx:179`).

Below `xl` — which includes the `mobile-390` viewport CI tests against, and the overwhelming
majority of Vietnamese traffic — the header CTA is an **icon-only** `size-11` circular pill
(`SiteHeader.tsx:266-278`) with the label present only as `aria-label`. A customer on a phone taps
an unlabelled orange button and lands on "Đăng nhập — Quản trị viên / VD: PB-0001".

The drawer entry (`SiteHeader.tsx:327-339`) *does* render `{LOGIN.label}` as visible text next to
the icon — so the fix is not absent on mobile, it just isn't where the tap happens.

The `xl` breakpoint itself is deliberate and documented (`SiteHeader.tsx:176-178`): the full nav
needs ~1240px, and at 1024 the button label wraps to four lines. So do **not** simply drop the
breakpoint — either give the sub-`xl` CTA the drawer's pill treatment
(`h-11 … gap-2 rounded-full px-4`) or de-emphasise it below `xl` and rely on the drawer.

### Also not delivered from #349

The issue prescribed two remedies. The second — move the CTA into the partner/operator group,
mirroring `SiteFooter` — was not implemented and not mentioned in the PR body. That is the
prominence half: relabelling alone still gives an operator-only action top-level placement on a
customer-facing site.

## Acceptance criteria

- [ ] At `mobile-390`, the header login affordance is either labelled or de-emphasised such that a
      customer is not invited to tap into the operator admin login.
- [ ] The `xl`-and-above layout is unchanged (the breakpoint exists for a measured reason).
- [ ] First test coverage for `SiteHeader` — it has **zero** today (no match in `e2e/` or any
      `__tests__`), and this string has already drifted once
      (`docs/design/mockup-home-spec.md:100,227` prescribed the new label while master shipped the
      old one). Add a `mobile-390` assertion.
- [ ] Decide and record: is the operator CTA staying top-level, or moving to the partner group?

Note: Playwright runs only two viewports — `chromium` at 1280×720 (exactly the `xl` boundary) and
`mobile-390`. Nothing covers 391–1279px.

## Blocked by

- none

## Files

- `components/layout/SiteHeader.tsx`
- new `e2e/` spec or component test

## Severity

P2 — customer-facing conversion path on the dominant viewport. No functional break.
