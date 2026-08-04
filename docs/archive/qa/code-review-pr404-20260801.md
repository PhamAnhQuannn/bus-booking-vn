# CODE REVIEW — PR #404 "fix(theme): light-orange page field so white cards separate from it" @ `ef0fbacd`

**Mode:** PR · **Base:** `master` · **Head:** `feat/page-field-orange`
**Diff scope:** 1 file (`app/globals.css`), +29 / −9 · **CI:** 13/13 pass · **Date:** 2026-08-01

Seven `:root` tokens retinted: `--background`, `--secondary`, `--muted`, `--accent`, `--border`,
`--input`, `--sidebar`. No selector changes, no new tokens, no `!important`, no JS.

---

## PRIORITY 1

None.

---

## PRIORITY 2 — Fix before merge, or accept explicitly

### [A11Y / CONTRAST] `text-primary` is link text at 3.29:1 — below the 4.5 AA floor for normal text, and this PR moves it 0.20 further away

The comment at `app/globals.css` justifies the new field partly with:

> `text-primary 3.28 (graphics floor 3.0)`

That is the **wrong floor for this token's actual use**. `text-primary` appears at **119 call
sites**, and the dominant pattern is body-size underlined link text, not iconography:

```
app/(customer)/auth/login/page.tsx:89       text-primary underline-offset-4 hover:underline
app/(customer)/auth/register/page.tsx:277   text-primary underline-offset-4 hover:underline
app/(customer)/booking/bank-transfer/page.tsx:157  font-medium text-primary underline
```

WCAG 2.2 AA requires **4.5:1** for text under 18.66 px / 24 px bold. 3.0 is the *non-text* contrast
floor (SC 1.4.11) and does not apply to a link label.

**Measured, before → after this PR:**

| Pairing | Before | After | Δ |
|---|---:|---:|---:|
| `primary` link text on page field | 3.49 | **3.29** | −0.20 |
| `primary` link text on `secondary` | 3.24 | **3.09** | −0.15 |
| `primary` link text on white card | 3.59 | **3.59** | unchanged |
| `muted-foreground` on field | 5.36 | 5.06 | −0.30 |
| `primary-strong` on field | 5.08 | 4.79 | −0.29 |
| **`card` vs field** (the PR's goal) | 1.03 | **1.09** | **+0.06** |

**This is pre-existing and systemic, not introduced here** — and that distinction is why it is P2
rather than P1. `primary` fails 4.5 on a **pure white card** too (3.59), so every link in the app
already sits below the floor regardless of field colour. This PR does not create the failure; it
moves the field-hosted subset from 3.49 to 3.29.

The PR's own goal is real and measurable — card-vs-page separation genuinely improves 1.03 → 1.09,
which is what `landing-page-scan §2.1` asked for.

**Fix (either is fine, but pick one deliberately):**
- Darken `--primary` toward `--primary-strong` for text use, or route link text through
  `text-primary-strong` (4.79 on the field — passes), leaving `--primary` for fills and borders
  where 3.0 is the correct floor; **or**
- Accept it explicitly and correct the comment, which currently reads as though 3.28 clears its
  floor. Something like *"`--primary` as text is 3.29 here and 3.59 on white — both below the 4.5
  AA text floor. Pre-existing; tracked in `<issue>`. This token is intended for fills/strokes,
  where 3.0 applies."*

Flagging the comment specifically because it is the mechanism by which this stays invisible: a
justification citing a floor the token does not have to meet reads to the next person as a passing
measurement.

---

## PRIORITY 3

### [MAINTAINABILITY] `primary-strong` on `secondary` passes AA by 0.004, and the warning is on only one of the two tokens

Measured **4.5039** against the 4.5 floor — a margin of 0.09%. The comment on `--secondary`
correctly warns:

> `primary-strong 4.51 — the latter is a bare pass, so do not darken this`

But the constraint is **bidirectional**. `--primary-strong` is defined ~10 lines earlier with its
own comment block that says nothing about `--secondary`, so someone tuning the orange while reading
only that block would silently break the floor. Same shape as the `CLAUDE.md` 2026-07-30 entry
about a rule living in one renderer and going stale in the other.

**Fix:** one line in the `--primary-strong` comment naming the pairing and the 4.50 figure.

At this margin it is also worth noting that different contrast implementations disagree by ±0.02,
so a browser devtools or axe run may report 4.49 and flag it.

---

## Verified clean

- **No dark-mode leak.** All seven changed tokens have their own `.dark` overrides — checked one by
  one against `origin/feat/page-field-orange:app/globals.css`. This was the specific risk worth
  testing: retinting `:root` without a `.dark` counterpart would push orange into dark mode.
- **Every numeric claim in the comments verifies.** Recomputed oklch → sRGB → WCAG relative
  luminance independently:

  | Comment claims | Measured |
  |---|---|
  | `--background` = `#fef3ec` | `#fef3ec` exact |
  | `--secondary` = `#faece0` | `#faece0` exact |
  | card vs field 1.09 | 1.09 |
  | secondary vs field 1.06 | 1.06 |
  | border vs field 1.24 | 1.24 |
  | muted-foreground on field 5.04 | 5.06 |
  | primary-strong on field 4.79 | 4.79 |
  | muted-foreground on secondary 4.75 | 4.75 |

  All within ±0.02, i.e. colour-space rounding. This is an unusually well-evidenced CSS change and
  the comments are trustworthy — the one problem is the *floor selected* for `text-primary`, not
  the arithmetic.
- **`muted-foreground` stays comfortable** at 5.06 on the field and 4.75 on the tinted bands.
- **Diff hygiene clean** — no `!important`, no selector churn, no commented-out code, no unrelated
  whitespace, single file.
- **Not verified through the browser, deliberately.** `CLAUDE.md` records twice (2026-07-18 and the
  2026-07-31 addendum) that a served stylesheet can be stale *per token* after a multi-token edit,
  and once more (2026-08-01) that Turbopack's on-disk cache survives a restart after a branch
  switch. Measuring these values through `:3001` would describe a cache, not this diff. The source
  values are computed above instead.

---

```
SUMMARY: 0 P1, 1 P2, 1 P3
```

## RECOMMENDED NEXT STEPS

1. The P2 does not block this merge — the failure predates the PR and exists on white cards too.
   But **fix the comment** in this PR or the next one, because a stated "graphics floor 3.0" on a
   token used for link text is how a real AA failure stays unexamined.
2. File the `text-primary` link contrast as its own issue; it is a global token decision affecting
   119 call sites and does not belong inside a page-field change.
3. P3 is one comment line and can ride either.
