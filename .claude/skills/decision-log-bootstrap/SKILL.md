---
name: decision-log-bootstrap
description: Bootstrap a decision log — every load-bearing decision captured with context, alternatives, rationale, reversibility. Outputs to `docs/inception/decision-log-<project>.md`. Use when user says "decision log", "why did we pick X", "decision archive", "/decision-log-bootstrap", or week 1 of any project.
output_size:
  XS: 30m
  S: 30m
  M: 30m
  L: 30m
  XL: 30m
---

# /decision-log-bootstrap — Remember Why You Picked X So Future-You Doesn't Rewrite It

## Why you'd care

Eighteen months in, a new engineer asks "why aren't we using Postgres?" and nobody remembers the three real reasons — so the team relitigates the call from scratch, half-believes the new framing, and migrates to the original wrong answer at a cost of 6 sprints. A decision log captured at the moment of choice (context, alternatives, rationale, reversibility) is what turns institutional memory from "ask the person who's left" into a one-grep lookup, and it pays back disproportionately during diligence when investors ask why architecture choice X was made.

A decision log is cheap to start, priceless 18 months later. Bootstrap it on day 1.

## Pre-flight
Run after `/idea-capture`. Pairs with `/adr-writer`, `/founders-agreement`.

## Inputs
- Decisions already made (verbal, mental, in chats).
- Decisions you're about to make.

## Process
1. **Two-tier system:**
   - **Lightweight log** — every load-bearing decision, 1 paragraph in `decision-log.md`
   - **ADR** — full architecture decision records, separate file per decision, `/adr-writer`
2. **Lightweight entry template:**
   - Date
   - Decision (1 sentence)
   - Why (1-3 sentences)
   - Alternatives considered
   - Reversibility (one-way vs two-way door)
   - Owner
3. **What counts as load-bearing:**
   - Anything affecting cap table / equity
   - Anything affecting legal entity / jurisdiction
   - Stack picks (DB, framework, auth, deploy target)
   - Pricing decisions
   - Hiring decisions
   - Investor decisions (lead, valuation, terms)
   - Co-founder agreements
   - Product scope decisions (in/out)
   - Naming + brand
4. **What doesn't count:** day-to-day eng decisions inside a feature.
5. **Two-way vs one-way:**
   - **Two-way** — easy to reverse → decide fast, log lightly
   - **One-way** — hard to reverse (legal entity, name, equity grant) → ADR + sign-off
6. **Review cadence** — quarterly: any decisions to revisit?
7. **Storage** — `docs/inception/decision-log.md` (lightweight) + `docs/adr/` (ADRs).

## Output
Write `docs/inception/decision-log-<project>.md`:

```markdown
# Decision Log — <project>
**Owner:** Founder A
**Cadence:** Add per decision, review quarterly

## How this works
- Every load-bearing decision (legal, equity, stack, pricing, hiring, brand) gets a 1-paragraph entry below.
- High-stakes decisions also get a full ADR under `/adr-writer` linked here.
- Reversibility flagged: 🔁 two-way (cheap to undo), 🚪 one-way (expensive to undo).

## 2026 entries

### 2026-04-12 — Legal entity: Delaware C-Corp 🚪
**Why:** VC-readiness; standard for institutional investors; well-understood by all advisors and law firms.
**Alternatives:** LLC (better for bootstrap, harder to take VC); Wyoming C-Corp (no advantage at our stage).
**Owner:** Founder A
**Linked ADR:** `docs/adr/0001-legal-entity.md`

### 2026-04-15 — Co-founder equity: 50/50 with 4-yr vest, 1-yr cliff 🚪
**Why:** Equal contribution; vesting protects against partner walking; standard structure.
**Alternatives:** 51/49 (unnecessary tie-breaker complexity); no vesting (creates founder-leaves-with-equity risk).
**Owner:** Both founders
**Linked ADR:** `docs/adr/0002-cofounder-equity.md`

### 2026-04-20 — Stack: Next.js + Prisma + Postgres + Vercel 🔁
**Why:** Founder A's strongest stack; fastest to MVP; can refactor later.
**Alternatives:** Rails (slower iteration); Django+React (more setup); SST/AWS (more infra time).
**Owner:** Founder A
**Linked ADR:** `docs/adr/0003-stack-pick.md`

### 2026-04-25 — Pricing v1: $99 / $499 / $2,000 per month (3 tiers) 🔁
**Why:** Pattern from comp scan; Van Westendorp survey suggests viable; supports SMB + mid-market.
**Alternatives:** Single tier (loses upsell), 4 tiers (decision paralysis at this stage).
**Owner:** Founder B
**Linked doc:** `docs/inception/pricing-model-<project>.md`

### 2026-04-28 — Fundraise: post-money SAFE @ $8M cap 🔁
**Why:** $500k from 4-6 angels; no lead; priced round overkill; YC 2024 default.
**Alternatives:** Priced seed (too early, dilutive), convertible note (debt complexity), bootstrap (too slow).
**Owner:** Founder A
**Linked doc:** `docs/inception/safe-vs-priced-<project>.md`

### 2026-05-01 — Name: "Loomwork" (trademark cleared, .com bought) 🚪
**Why:** Memorable; describes weaving cross-functional work; .com available; TM clean in classes 9/42.
**Alternatives:** "Crosswork" (TM conflict), "Threadly" (consumer associations).
**Owner:** Both founders
**Linked doc:** `docs/inception/trademark-pre-screen.md`

### 2026-05-05 — First hire: senior eng month 4, 1.0% equity 🔁
**Why:** Backend bottleneck post-MVP; 1% standard for first eng at seed.
**Alternatives:** Hire later (slows shipping), hire designer first (eng is the bottleneck).
**Owner:** Founder A
**Linked doc:** `docs/inception/first-hire-plan-<project>.md`

## Quarterly review template
- Any 🚪 decisions causing regret? (one-way doors hardest to undo)
- Any 🔁 decisions overdue for revisit?
- Any new decisions made informally that need logging?

## Pitfalls flagged
- [ ] Every load-bearing decision logged within 48 hours
- [ ] Reversibility marked (🔁 vs 🚪)
- [ ] Why captured (not just what)
- [ ] Alternatives listed (shows the option space)
- [ ] One-way doors get full ADRs
- [ ] Quarterly review on calendar

## Next
- First ADR → `/adr-writer`
- Equity formalization → `/founders-agreement`
- Risk register pairing → `/risk-register`
```

## Verification
- 2-tier system (lightweight log + ADR for one-way doors).
- 5-7 entries pre-seeded.
- Reversibility flagged each entry.
- Why + alternatives + owner per entry.
- Quarterly review cadence.
