# CODE REVIEW — PR #403 "fix(hero): sharpen the bus, real BBVN livery, DPR-tiered delivery" @ `3915282c`

**Mode:** PR · **Base:** `master` · **Head:** `feat/hero-sharpen`
**Diff scope:** 19 files, +1130 / −35 (of which ~5.3 MB is binary) · **CI:** 13/13 · **Date:** 2026-08-01

One source file (`app/(customer)/page.tsx`), four new Python tools, two smoke scripts, 9 image
variants, a 2.3 MB design master, and two docs. Roster: `/code-review` + `/pr-review` — no `lib/**`
domains, no schema/auth/payment, no route handlers, no dependency change.

---

## PRIORITY 1 / PRIORITY 2

None.

---

## PRIORITY 3

### [CI / UNWIRED GATE] `scripts/hero-verify.py` is a gate that nothing runs

Its docstring describes a real gate — exact-dimension check, low-frequency SSIM for composition
drift, Laplacian variance on the bus region for sharpness — and the `hero-master/README.md`
pipeline diagram terminates in it:

```
  |  python scripts/hero-verify.py <dir-of-previous-variants>
  v
gate: dimensions, low-frequency SSIM, bus sharpness
```

`grep -icE 'hero'` over this branch's `.github/workflows/ci.yml` returns **0**. It is a manual
tool, and calling it a *gate* in a diagram overstates what it can enforce.

Unlike the equivalent finding in #399 (`test_xep_hang.py`, which was wired into CI in that PR),
this one **cannot simply be added to a job**: it needs a directory of the *previous* variants to
diff against, which CI does not have. It also carries a `--self-test` mode, which is the part that
*is* CI-able without any prior artifact.

**Fix (optional, cheap):** either run `python scripts/hero-verify.py --self-test` in the
`python-syntax` job, or change the README's word "gate" to "manual check, run before committing a
re-cut". The second is one word and removes the overstatement.

### [PERF] At two of four breakpoints the 1× JPEG fallback is *heavier* than the 2× WebP

From `public/hero/CREDITS.md`, cross-checked against the blob sizes in git:

| Breakpoint | 1× JPEG | 2× WebP | |
|---|---:|---:|---|
| mobile `<768` | 212 KB | 272 KB | 1× lighter ✓ |
| md `768–1023` | **390 KB** | **319 KB** | 1× is 22% heavier |
| lg `1024–1919` | 434 KB | 480 KB | 1× lighter ✓ |
| 3xl `≥1920` | **459 KB** | **400 KB** | 1× is 15% heavier |

So a DPR-1 desktop user downloads more than a DPR-2 user at md and 3xl. Not a defect — it falls out
of WebP compressing better than JPEG at the same visual quality — but it means the *fallback* path
is the expensive one, and the hero is the LCP element.

The population affected is narrow and shrinking: the JPEG is served to browsers that cannot parse
`image-set()`, chiefly Safari < 17, which *can* decode WebP. A WebP 1× candidate would serve them
better, at the cost of leaving nothing for browsers with neither. **Worth measuring before acting;
recorded rather than recommended.**

### [HISTORY] 5.3 MB of binaries become permanent

Nine served variants (~3.0 MB) plus `docs/design/hero-master/landing-golden-master-1672x941.png`
at 2.3 MB. Git history cannot be trimmed later without a rewrite.

**The master's inclusion is justified and I am not asking for it to be removed** — its README
records that the file was previously *not in the repo or its history*, had to be recovered from a
Downloads folder, and was identified among four near-identical generations by resampling each and
diffing against the shipped variant (mean abs diff 2.479 vs 20.979 / 22.988 / 24.822). Losing it
again would make every crop underivable. That is a better reason than most binaries get. Noted only
so the size is a known cost rather than a surprise.

---

## Verified clean

The interesting risk in this diff is that the preload hints and the CSS could disagree, which
silently doubles the LCP download. Checked mechanically rather than by eye:

- **All four `imageSrcSet` values match their CSS `image-set()` layer exactly** — parsed both out of
  `page.tsx` and compared as normalised sets. 4/4 identical, so the preload scanner fetches the same
  candidate the CSS later picks.
- **Preload media queries tile the range with no gap and no overlap** — `≤767`, `768–1023`,
  `1024–1919`, `≥1920`.
- **Those queries match the Tailwind breakpoints the layers actually switch on.** `md`/`lg` are the
  defaults (768/1024) and `--breakpoint-3xl: 120rem` = **1920px**, matching `(min-width: 1920px)`.
  A mismatch here would preload one asset and display another.
- **Each class-based fallback URL is that layer's 1× candidate** — all four arbitrary-value
  background-image classes on those layers
  are the JPEGs, so a browser without `image-set()` support fetches a file that was already
  preloaded rather than a fifth one.
- **The two-declaration technique is correct and correctly explained.** React's `style` is a JS
  object, so the usual duplicate-property CSS fallback is impossible; the class carries the plain
  `url()` and the inline style carries `image-set()`, which wins where it parses and is dropped
  wholesale where it does not. The comment also warns to keep the multi-URL value out of the
  Tailwind arbitrary value, which is the escaping trap.
- **Omitting `type` on the preload is deliberate and right** — one link carries one MIME for the
  whole srcset and this srcset is mixed JPEG + WebP, so any value would be wrong for one candidate.
  The comment cites the open WebKit bug for `image-set()`'s `type()`.
- **No secrets or PII** in the diff (`AIza|sk-|ghp_|AKIA|+84[0-9]{9}|password|secret` over added
  lines → nothing).
- **All four new `.py` files parse** — and they now go through the `python-syntax` CI job that
  #399 added, so they are covered from the moment this merges.
- **`CREDITS.md` self-corrects rather than quietly updating.** It records that every row of the
  previous table had been wrong since commit `e384d1a` re-cut the variants while the credits were
  last touched in the earlier `62d7314`, and adds the rule that the job table and this table change
  in the same commit. That is the 2026-07-30 renderer-drift lesson applied without being asked.

## Not reviewed

- Visual result. `CLAUDE.md` (2026-08-01) records that Turbopack's on-disk cache survives a restart
  after a branch switch, so a `:3001` measurement taken now would describe a cache rather than this
  diff. The geometric claims in the comments (crop windows, bus width percentages) are design
  judgement and not checkable from source.
- Whether the SSIM/sharpness thresholds in `hero-verify.py` are well-chosen — it is a manual tool
  and its own `--self-test` is the right place for that.

---

```
SUMMARY: 0 P1, 0 P2, 3 P3
```

## RECOMMENDED NEXT STEPS

1. Nothing blocks merge.
2. **Merge WITHOUT `--delete-branch`** — PR #405 is based on `feat/hero-sharpen`, and deleting the
   base auto-closes it with no way to reopen (`CLAUDE.md`, 2026-07-28).
3. The "gate" wording in `hero-master/README.md` is a one-word fix worth making whenever this area
   is next touched.
