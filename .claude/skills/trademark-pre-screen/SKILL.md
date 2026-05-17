---
name: trademark-pre-screen
description: Pre-file trademark screen — USPTO TESS, EUIPO, WIPO, domain, social handle, common-law clearance. Outputs to `docs/inception/trademark-prescreen-<project>.md`. Use when user says "trademark check", "name clearance", "TM search", "/trademark-pre-screen", or before naming a company/product.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /trademark-pre-screen — Don't Build A Brand You Can't Own

A 30-minute screen before legal filing kills 70% of bad names. Final clearance still needs a lawyer — this is the gate before paying one.

## Why you'd care

Picking a name that's already trademarked means a cease-and-desist on launch week, a forced rebrand, and a wasted SEO investment. A pre-screen at the naming stage is twenty dollars of upside per hundred-thousand-dollar downside.

## Pre-flight
None. Pairs with `/tagline-shortlist`, `/logo-brief`.

## Inputs
- 3-5 candidate names (output of brainstorm or `/tagline-shortlist`).
- Goods/services classes (Nice classification — usually 9 software, 35 advertising, 42 SaaS, 41 education).
- Target geographies (US, EU, UK, CA, AU minimum).

## Process
1. **Per name, run 8 checks**:
   - USPTO TESS exact + phonetic + visual
   - EUIPO eSearch plus
   - WIPO Global Brand Database
   - .com / .ai / .io domain availability
   - Instagram / X / TikTok / LinkedIn handle
   - Google "<name>" + "<name> + category"
   - Trademarkia / Justia common-law check
   - App Store + Play Store
2. **Score risk per name (low/med/high)** — any "high" → kill or rename variant.
3. **Class conflict test** — different class same name often OK (e.g., DELTA airlines vs DELTA faucets). Confirm with TM attorney before filing.
4. **Phonetic confusion** — say name aloud, swap vowels, drop letters. Check confusables.
5. **Cultural / linguistic gotcha** — translate top 10 markets. Native speakers test for slang.
6. **Generic / descriptive trap** — pure descriptive ("Best Bookings") = unregistrable. Need fanciful / arbitrary / suggestive.
7. **Shortlist 2 names** for attorney clearance + filing.

## Output
Write `docs/inception/trademark-prescreen-<project>.md`:

```markdown
# Trademark Pre-Screen — <project>
**Date:** <YYYY-MM-DD>
**Goods/services classes:** <e.g., 9, 42>
**Target geos:** <US, EU, UK, CA, AU>

## Candidate matrix
| Name | USPTO | EUIPO | WIPO | .com | .io/.ai | IG | X | TikTok | Common-law | App stores | Phonetic | Translation | Risk |
|------|-------|-------|------|------|---------|-----|---|--------|------------|------------|----------|-------------|------|
| AlphaName | ✓ clear | ✓ | ✓ | ✗ taken | ✓ | ✗ | ✓ | ✓ | 1 hit (food) | clear | clear | clear | **MED** |
| BetaName | ✗ conflict (class 9) | ✓ | ✗ class 42 | ✓ | ✓ | ✓ | ✓ | ✓ | clear | clear | clear | "bad" in PT-BR | **HIGH** |
| GammaName | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | clear | clear | clear | clear | **LOW** |

## Risk notes per name
**AlphaName:** .com gone, IG handle gone → workable with .ai + AlphaApp handle. TM clear.
**BetaName:** USPTO conflict same class → KILL. Also PT-BR slang issue.
**GammaName:** clean across all axes → primary candidate.

## Distinctiveness check
| Name | Fanciful / Arbitrary / Suggestive / Descriptive / Generic |
|------|-----------------------------------------------------------|
| AlphaName | Suggestive — registrable |
| BetaName | Arbitrary — registrable (but dead per risk) |
| GammaName | Fanciful — strongest TM protection |

## Shortlist for attorney
1. **GammaName** (primary) — fanciful, all axes clean
2. **AlphaName** (backup) — domain compromise acceptable

## Attorney brief
- Classes: <Nice classes>
- Geos: <list>
- Budget: $<X> initial filing per geo
- Timeline to filing: <weeks>

## Risks
- Common-law user surfaces after launch → opposition risk
- ICANN domain dispute (UDRP) if cybersquat
- Foreign-language slur missed despite check

## Next
- File with attorney → out of scope
- Brand voice → `/brand-voice-charter`
- Logo brief → `/logo-brief`
- Domain purchase + handle reservation today
```

## Verification
- 3+ names screened across 8 axes each.
- Risk tagged low/med/high per name.
- Distinctiveness category per name.
- Shortlist of 2 with attorney brief.
- Cultural / phonetic check explicit, not skipped.
