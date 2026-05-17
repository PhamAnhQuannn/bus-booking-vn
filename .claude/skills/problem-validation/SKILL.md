---
name: problem-validation
description: Validate a product idea's underlying problem is real before any build. Forces 5 categories of evidence (interviews, search/forum signal, competitor traction, willingness-to-pay, personal pain) and outputs a weighted score with verdict KILL / PIVOT / PASS / STRONG-PASS. Pairs with `/grill-me` for evidence extraction. Reads `/project-classify` to skip XS. Outputs to `docs/inception/validation-<project>.md`. Use when user says "validate problem", "is this real", "kill or pass", "should I build this", "/problem-validation", or after `/lean-canvas` flags a weak Problem box.
output_size:
  XS: 30m
  S: 30m
  M: 1h
  L: 1h
  XL: 2h
---

# /problem-validation — Kill / Pivot / Pass Gate

Invoke as `/problem-validation`. Forces evidence on the table before any code gets written. Outputs a verdict, not a vibe.

---

## Why you'd care

Founders are wrong about which problems are real about 70% of the time on first guess. Five categories of evidence is the cheapest way to find out before you spend a year and a salary building the wrong thing.

## Pre-flight

1. Read `docs/classify/<project>.md` if exists.
   - Class **XS** → **SKIP** ("XS = throwaway, validation theatre. If it costs nothing, just build it.")
   - Class S/M/L/XL → continue.
2. **Front-load mode**: if class=M AND domain in {scrape, PII, payments}, expect parallel `/regulatory-preflight` (+ `/tos-violation-screen` / `/scraper-ethics-pre` / `/gdpr-preflight` / `/pii-inventory-pre` as applicable) running ALONGSIDE this skill — do not block on it, but flag if regulatory verdict lands KILL before your verdict, then abort validation.
3. Read `docs/inception/canvas-<project>.md` if exists — pulls "riskiest assumption" as the validation target.
4. If user has not described evidence yet, run `/grill-me` with prompt: "Extract evidence the problem is real — interviews, search data, competitors, willingness-to-pay, personal pain. Push back on hand-waving."

---

## Evidence checklist (5 categories, weighted)

| Category | Weight | What counts | What doesn't |
|---|---:|---|---|
| **A. Direct interviews** | 30% | ≥5 target users describe the pain unprompted | "my friend said it sounds cool" |
| **B. Search / forum signal** | 20% | active Reddit / HN / SO threads, Google Trends, search volume | one tweet from 2019 |
| **C. Competitor traction** | 20% | ≥1 competitor charging money + has paying customers | "no one does this" (often = no demand) |
| **D. Willingness-to-pay** | 20% | pre-orders, paid alternatives in use, stated $ willing to pay | "people would totally pay" without ask |
| **E. Personal / advisor pain** | 10% | you or someone you trust deeply has the problem now | "I imagine someone might…" |

Score each 0–4. Multiply by weight. Sum.

> Auto-calc reminder: total = (A×0.30) + (B×0.20) + (C×0.20) + (D×0.20) + (E×0.10). Compute explicitly — don't eyeball.

| Score range | Verdict |
|---|---|
| 0.0–1.0 | **KILL** — insufficient evidence; do not build |
| 1.1–2.0 | **PIVOT** — problem unclear; reframe and re-validate |
| 2.1–3.0 | **PASS** — proceed but ship MVP fast and re-validate after launch |
| 3.1–4.0 | **STRONG-PASS** — proceed with confidence; problem proven |

Hard floors: if **A = 0** (zero interviews), max verdict = PIVOT regardless of other scores.
If **C = 0 AND D = 0** (no competitor + no payment signal), max verdict = PIVOT.

---

## Per-category rubric

### A. Direct interviews (0–4)
- 0 — none
- 1 — 1–2 informal chats
- 2 — 3–4 structured interviews
- 3 — 5–9 structured, multiple unprompted mentions of pain
- 4 — 10+ structured, pain mentioned without prompting in 70%+

### B. Search / forum signal (0–4)
- 0 — no signal anywhere
- 1 — scattered mentions
- 2 — active discussion in 1–2 communities
- 3 — recurring topic across multiple communities, rising trend
- 4 — dedicated subreddit / forum / hashtag exists with 1k+ members

### C. Competitor traction (0–4)
- 0 — no competitor
- 1 — competitor exists but free / abandoned
- 2 — paid competitor with unclear traction
- 3 — paid competitor with public revenue or > 100 paying users
- 4 — multiple paid competitors with $1M+ revenue

### D. Willingness-to-pay (0–4)
- 0 — no signal
- 1 — interviewees say "maybe"
- 2 — interviewees state a specific $ they'd pay
- 3 — pre-orders or LOIs from ≥3 buyers
- 4 — paid pilots running

### E. Personal / advisor pain (0–4)
- 0 — neither you nor any trusted advisor has the pain
- 1 — you imagine the pain
- 2 — you have the pain occasionally
- 3 — you have the pain weekly / advisor has it
- 4 — you have the pain daily and have hacked together a workaround

---

## Output template

Write to `docs/inception/validation-<project-slug>.md`:

```markdown
# Problem Validation — <project name>

**Date: <YYYY-MM-DD>** | **Class: <from /project-classify>**
**Verdict: <KILL | PIVOT | PASS | STRONG-PASS>**
**Weighted score: <X.X> / 4.0**

## Riskiest assumption being validated
<one sentence>

## Evidence by category

| # | Category | Score | Weight | Weighted | Evidence |
|--:|---|---:|---:|---:|---|
| A | Direct interviews   | X | 0.30 | X.XX | <bullet evidence> |
| B | Search/forum signal | X | 0.20 | X.XX | <bullet evidence> |
| C | Competitor traction | X | 0.20 | X.XX | <bullet evidence> |
| D | Willingness-to-pay  | X | 0.20 | X.XX | <bullet evidence> |
| E | Personal pain       | X | 0.10 | X.XX | <bullet evidence> |
|   | **Total**           |   | 1.00 | **X.XX** | |

## Hard-floor checks
- A ≥ 1 (interviews exist)? <yes/no>
- C ≥ 1 OR D ≥ 1 (market signal)? <yes/no>

## Verdict rationale
<2–3 sentences explaining KILL / PIVOT / PASS / STRONG-PASS>

## Next step
- KILL → archive idea, free up runway
- PIVOT → reframe problem, re-run /problem-validation
- PASS → /lean-canvas (if not done) → /write-a-prd
- STRONG-PASS → /write-a-prd → /prd-to-issues

> If verdict = PASS **and** D-score < 3, recommend a paid landing-page test (or pre-order ask) before heavy build. WTP is the weakest leg; cheap to validate further.
```

---

## Anti-patterns to flag

If user offers any of these as "evidence", reject and downgrade score:
- "I think people would…"
- "everyone has this problem"
- "my mom liked it"
- "no competitor exists" (treat as RED flag, not green)
- "I'd pay for this" (you're not the customer unless class XS)
- "TAM is $10B" (TAM ≠ demand)

---

## When to re-validate

After 10 paying users, after major pivot, or every 6 months in market.

---

## Variants

### Variant A — One-page problem statement (instead of full validation)

Use when the problem isn't ambiguous but needs crisp articulation before solutioning. Outputs `docs/inception/problem-<project>.md`.

**Process:**
1. **WHO** — specific persona, not "people". Role, context, count in market.
2. **WHAT** — the job they're trying to do (verb + object). Use `/jtbd` form if available.
3. **WHEN** — trigger event. What happens immediately before the pain?
4. **MAGNITUDE** — quantify cost: $ lost, hours wasted, errors, churn, missed revenue. Cite source.
5. **CURRENT ALTERNATIVE** — what they do today (paper, spreadsheet, competitor, nothing). Workaround = strongest signal.
6. **WHY-NOW** — what changed in the world that makes this solvable / urgent now? (tech, regulation, behavior shift)
7. **EVIDENCE** — link to interview quotes, diary entries, ethnography notes.
8. **NEGATIVE space** — what's NOT the problem. Bound the scope.

**One-sentence template:** `<persona> can't <do X> when <trigger> because <current alternative is bad>, costing <magnitude>.`

**Verification:** statement fits in one sentence; magnitude has a number + source; why-now is concrete (specific event), not "AI is hot"; ≥3 verbatim quotes.

### Variant B — Hypothesis tree decomposition (when problem feels too big)

Big problems hide assumptions. Tree them out, test the riskiest leaf. Outputs `docs/inception/hypothesis-tree-<project>.md`.

**Process:**
1. **Root** — one-sentence problem at top.
2. **MECE branches** — break into 3–5 sub-problems that are Mutually Exclusive, Collectively Exhaustive.
3. **Leaf hypotheses** — each sub-problem → 1–3 falsifiable claims.
4. **Confidence rating** — per hypothesis: HIGH (evidence) / MEDIUM (anecdote) / LOW (guess).
5. **Risk score** — per hypothesis: how much does the project break if this is wrong? 1–5.
6. **Test design** — for each LOW-confidence × high-risk leaf, name a cheap test (interview, smoke ad, prototype).
7. **Prioritize** — top 3 (low confidence + high risk) → next test cycle.

**Verification:** 3–5 MECE branches at root; every leaf has Confidence + Risk + Test; top 3 ranked; MECE property checked (no overlap, nothing important missing).
