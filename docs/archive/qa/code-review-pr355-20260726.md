CODE REVIEW — PR #355 "fix(header): relabel login CTA to operator login (#349)" @ 3ff15d82
────────────────────────────────
Base: `master` · Head: `fix/349-operator-login-cta` · State: OPEN, ready (not draft)
Diff scope: 1 file, +7 / -4 lines — `components/layout/SiteHeader.tsx`
Mode: PR (standalone — no auto-comment posted)

## The change

```diff
-const LOGIN = { href: '/op/login', label: 'Đăng nhập / Đăng ký' };
+const LOGIN = { href: '/op/login', label: 'Đăng nhập nhà xe' };
```
plus a rewritten 6-line rationale comment. `href` unchanged.

---

PRIORITY 1 — Block push, fix first:

  (none)

Checked and clear:
- **Cat 2 (security)** — no logic, no I/O, no trust boundary, no authz surface. A string constant.
- **CLAUDE.md mistake-log patterns** — the `'use client'` barrel rule (2026-06-04) is **satisfied**:
  line 1 is `'use client'` and the file imports only `@/components/brand/Logo` and `@/lib/utils`
  (`lib/utils` is boundary-exempt). No `@/lib/auth` barrel, no server-only transitive. The PR
  touches neither imports nor the directive.
- **Routing** — `/op/login` is not behind the Phase-1 410 gate; `proxy.ts:206-221` gates
  `/auth/`, `/api/auth/register`, `/api/auth/otp/`, … only. The unchanged `href` stays reachable.
- **Cat 1/3** — no branching, no async, no money, no dates. Nothing to get wrong.

---

PRIORITY 2 — Fix before merge:

  [CORRECTNESS / INCOMPLETE FIX — RESPONSIVE] components/layout/SiteHeader.tsx:264-274
    The relabel is **invisible below the `xl` breakpoint**, which includes the repo's
    `mobile-390` Playwright project (playwright.config.ts:20-23) and every width up to 1279px.
    The mobile cluster is `xl:hidden` and renders the login as an **icon-only** round button:

        <Link href={LOGIN.href} aria-label={LOGIN.label}
              className={cn('inline-flex size-11 ... rounded-full', CTA_CLASS)}>
          <LogInIcon className="size-5" />
        </Link>

    A sighted mobile customer sees a generic log-in glyph in the header's single **solid
    `--primary-strong` orange** affordance (`CTA_CLASS`, line 39-40) — the strongest visual
    "do this" signal on the page — and taps it into `Đăng nhập — Quản trị viên` with a
    `VD: PB-0001` operator-code field (`app/op/login/page.tsx:143,157`). That is issue #349's
    exact reported harm, unmitigated at the most common viewport. Only screen-reader users
    (via `aria-label`) and users who open the drawer (line 334, where the label does render)
    receive the new copy.
    Fix — one of:
      (a) show the text at ≥sm (`<span className="hidden sm:inline">{LOGIN.label}</span>`), or
      (b) demote the mobile button off `CTA_CLASS` to the desktop outlined treatment
          (`border-primary/40 bg-card`, line 255) so it stops reading as the primary
          customer action, or
      (c) drop the mobile icon CTA entirely and leave operator login in the drawer only —
          Phase 1 has no customer login, so a header-level login affordance earns little.

  [TEST / COVERAGE OF DIFF] components/layout/SiteHeader.tsx:35 — no test in this diff
    Zero automated coverage for the header CTA. Grep across `e2e/**` and all `*.test.tsx`
    returns **no file referencing `SiteHeader`, the CTA label, or the `/op/login` header link**.
    This is not hypothetical drift risk: `docs/design/mockup-home-spec.md:100,227` has
    prescribed `Đăng nhập nhà xe → /op/login` since it was written, and `master` shipped
    `Đăng nhập / Đăng ký` anyway — the string already drifted once, silently, and nothing
    stops it drifting back. The fix is a label constant with no guard.
    Fix: one assertion in an existing customer-facing spec that runs on both projects
    (e.g. `e2e/search.spec.ts`):
        await expect(page.getByRole('link', { name: 'Đăng nhập nhà xe' }))
          .toHaveAttribute('href', '/op/login');
    On `mobile-390` this resolves via the icon button's `aria-label`, so a single line
    covers both render paths — and would have failed on `master`.

---

PRIORITY 3 — Address when convenient:

  [READABILITY / RATIONALE DROPPED] components/layout/SiteHeader.tsx:32-38
    The deleted comment carried the only in-code explanation for the desktop button's
    styling — "The button keeps the mockup's outlined treatment". The replacement (6 lines,
    all about the label) drops it, while `border border-primary/40 bg-card` on line 255
    remains, now unexplained and now *contradicted* by `docs/design/mockup-home-spec.md:100`
    ("styled `bg-primary-strong` … the mockup's *outlined* auth button is noted but not
    adopted") — which describes the mobile variant, not the desktop one. Pre-existing
    confusion, but this PR is the moment that comment was rewritten.
    Fix: keep one clause noting desktop = outlined, mobile = filled, and why.

  [CONSISTENCY / DESTINATION COPY] components/layout/SiteHeader.tsx:35 → app/op/login/page.tsx:143
    The CTA now promises **"Đăng nhập nhà xe"** but the page it opens titles itself
    **"Đăng nhập — Quản trị viên"** (administrator, not carrier). The header is now honest
    about *who* the login is for; the landing page still speaks a different noun. A nhà xe
    owner arriving from this button reads "Quản trị viên" and may bounce.
    Fix (follow-up issue, not this PR): align `/op/login`'s title, or accept and note it.

  [DOC DRIFT] docs/design/mockup-home-spec.md:100,227
    Both cite `SiteHeader.tsx:26` for the LOGIN const and `:28-31` for the CTA class; the
    real lines post-PR are 35 and 39-40. The spec's target state is now finally implemented,
    so this is the natural moment to refresh the line cites.

---

## Verified correct (worth stating, since copy was the point)

- **Vietnamese copy** — `Đăng nhập nhà xe` is grammatical, correctly diacritised, and
  sentence-cased like the site's other CTAs. "Nhà xe" is the established site noun for a
  bus operator.
- **Terminology consistency — confirmed by grep, not assumed.** The identical string already
  ships in two other places pointing at the same href:
    - `components/layout/SiteFooter.tsx:54` → `{ href: '/op/login', label: 'Đăng nhập nhà xe' }`
    - `app/(customer)/auth/login/page.tsx:109` → `Đăng nhập nhà xe`
  and `SiteHeader.tsx:25` NAV already uses `Nhà xe` → `/op/register`. The PR makes the header
  agree with the footer rather than inventing new vocabulary. `documentation/frontend-design/
  FD-002-navigation-pattern/README.md:17` also maps `Dang nhap → /op/login`.
- **Direction of the fix** — correct per Phase-1 scope. Customer auth is 410-gated
  (`proxy.ts:206-221`), so relabelling (rather than wiring a customer login) is the only
  honest option, and the comment records the Phase-2 restore path.
- **Diff hygiene** — clean. One file, one commit, conventional-commit subject with issue ref,
  no `console.log` / `debugger` / `.only`, no whitespace churn, no generated files, no
  unrelated edits. Comment growth (3→6 lines) for a one-token change is verbose but it
  encodes the Phase-2 restore instruction, which is load-bearing.
- **Layout safety** — the new label is *shorter* (16 chars vs 19), so the xl-breakpoint
  geometry note at lines 168-175 ("logo + five items + pill + button need ~1240px") is
  relaxed, not stressed. In the 288px-wide drawer (`w-72`, line 289) the label at `text-sm`
  with icon fits on one line. No wrap regression at any breakpoint.

---

SUMMARY: 0 P1, 2 P2, 3 P3

RECOMMENDED NEXT STEPS:
  → No P1 — nothing blocks merge on correctness or security grounds.
  → P2-1 (mobile icon-only CTA) is the one that matters: the PR's stated goal is only
    half-achieved until the sub-`xl` render is addressed. Decide fix-in-place vs follow-up
    issue, but decide explicitly — merging as-is closes #349 while the reported symptom
    persists at 390px.
  → P2-2 (missing assertion) is cheap and would have caught the original drift; add it in
    this PR.
  → P3s are follow-up material.
