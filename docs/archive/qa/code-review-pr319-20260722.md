CODE REVIEW — PR #319 "feat(landing): rebuild homepage, new hero photo, glass navbar, uppercase BBVN brand" @ fb843975
────────────────────────────────
Diff scope: 59 files (26 text, 33 binary), +1846 / -495 lines of code

PRIORITY 1 — Block push, fix first:
  (none)

  Checked and clear: no Category 2 findings at all — the diff contains no auth,
  payment, crypto, SQL, redirect or user-input-to-sink path. No secrets added.
  No new dependencies. CLAUDE.md Mistake Log patterns checked individually:
    - no static image imports (Logo.tsx keeps string src + explicit w/h) — PR #302
    - no `loading.tsx` added, no `useSearchParams` in a client layout — 2026-07-17
    - no Date.now()/Math.random() in an RSC body — homePlaceholders.ts uses an
      FNV-1a hash of a stable key precisely to avoid this
    - no self-fetch from a server component

PRIORITY 2 — Fix before merge:
  [CORRECTNESS / ASSET COUPLING] components/home/ContractCarRental.tsx:58
    Renders /hero/landing-golden-1280.jpg — the MOBILE HERO variant — as a
    288x128 thumbnail. This PR changed that file from 1280x640 (aspect 2.000) to
    768x1397 (aspect 0.550), landscape to portrait. In a 2.250-aspect box under
    object-cover, only ~24% of the image's height now survives, taken from the
    vertical centre. It also pulls a 187KB portrait hero to paint a thumbnail.
    Fix: point this at a purpose-cut image (public/tourism/* already exists and
    is what this component used before), or at minimum a landscape asset. The
    coupling is the real defect — a hero recut silently reframes an unrelated
    section.

  [FAILURE MODE / SILENT NO-OP] components/home/NewsletterBand.tsx:41-61
    The form is `onSubmit={(e) => e.preventDefault()}` with no handler, no
    action and no user feedback. A visitor types an email, clicks "Đăng ký", and
    nothing happens — no error, no confirmation. That reads as a successful
    signup and is worse than having no form. The file documents the intent
    honestly, but the rendered behaviour still misleads.
    Fix: disable the control with a "sắp ra mắt" state, or remove the band until
    a backend exists. Do not ship an input that silently discards what it takes.

  [TEST / NEW BRANCH] components/home/homePlaceholders.ts:38-41
    placeholderReviewCount() branches on n >= 1000 to switch between "1.2k" and
    "980" formatting. New logic, no test in this diff.
    Non-risk path (display-only placeholder data explicitly marked for deletion),
    so noted rather than pressed.

PRIORITY 3 — Address when convenient:
  [READABILITY / MAGIC + DUPLICATION] components/layout/SiteHeader.tsx:63, 96
    `const headerH = window.innerWidth >= 1024 ? 84 : 72;` appears twice, and
    hardcodes in JS the height the bar declares in Tailwind at line 151
    (`h-18 ... lg:h-21`). Three places must agree; nothing enforces it. Changing
    the class silently desyncs both the scroll handler and the observer's
    rootMargin.
    Fix: one module-scope constant pair, named, with a comment pointing at the
    class it mirrors.

  [READABILITY / MAGIC] components/home/NewsletterBand.tsx:25
    bg-[#f26b1c] is a raw hex where --primary exists as a token. Deliberate (it
    matches the mockup's band, which differs from --primary) but undocumented as
    a deviation at the call site.

  [PERF / MINOR] components/layout/SiteHeader.tsx:61
    document.getElementById('search') runs on every scroll event. Passive and
    cheap, but the node could be cached in the effect closure alongside the
    observer's.

SUMMARY: 0 P1, 3 P2, 3 P3

RECOMMENDED NEXT STEPS:
  → No P1. Not blocked.
  → The ContractCarRental asset coupling is the one worth fixing before merge —
    it is a visible wrong-crop, not a style nit.
  → NewsletterBand is a product decision as much as a code one; flag to the owner
    rather than silently patching.
