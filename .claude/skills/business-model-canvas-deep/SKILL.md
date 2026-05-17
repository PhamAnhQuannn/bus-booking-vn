---
name: business-model-canvas-deep
description: Strategyzer Business Model Canvas — 9 boxes with evidence per cell. Outputs to `docs/inception/bmc-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "BMC", "business model canvas", "9 boxes", "/business-model-canvas-deep", or after `/lean-canvas`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /business-model-canvas-deep — BMC Deep

## Why you'd care

A BMC with assumptions in every cell is a hallucination dressed as strategy; investors and partners spot it instantly. Filling each box with cited evidence is what makes the canvas a defensible artifact instead of a workshop souvenir.

Invoke as `/business-model-canvas-deep`. Strategyzer 9-box. Each cell needs evidence, not assumption.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP (lean-canvas enough)
2. Read `docs/inception/lean-canvas-<project>.md` (BMC = expanded next step).

## Inputs
- Lean canvas output.
- Customer interview findings.
- Cost / pricing models.

## Process
1. **9 boxes — fill each with evidence-tier**:
   - **Customer Segments** — who; tier: interviewed / surveyed / inferred
   - **Value Propositions** — what; tier: validated / tested / hypothesis
   - **Channels** — how reach; tier: tested / planning / aspirational
   - **Customer Relationships** — what kind (self-serve / personal / community); tier: live / planned
   - **Revenue Streams** — pricing model + per stream; tier: collecting / piloted / hypothesis
   - **Key Resources** — what assets; tier: have / acquiring / need
   - **Key Activities** — what we do; tier: doing / will do
   - **Key Partnerships** — who; tier: signed / discussed / target
   - **Cost Structure** — fixed + variable per `/cost-model`
2. **Evidence color-coding** — green (validated), yellow (tested partial), red (assumption).
3. **Coherence check** — segments + VP + channels + revenue must align (not "enterprise + free + viral").
4. **Pivot triggers per box** — if X box turns red after evidence, what changes?

## Output
Write `docs/inception/bmc-<project>.md`:

```markdown
# Business Model Canvas — <project>
**Date:** <YYYY-MM-DD>

## 9-box (with evidence tiers)

### 1. Customer Segments [GREEN / YELLOW / RED]
- Primary: <X> (interviewed N=12) GREEN
- Secondary: <Y> (surveyed N=200) YELLOW
- Adjacent (future): <Z> RED

### 2. Value Propositions [GREEN / YELLOW / RED]
- Primary VP: <one sentence> — validated by <evidence>
- Secondary VP: <one sentence> — partially tested
- Pain relievers: <list>
- Gain creators: <list>

### 3. Channels [GREEN / YELLOW / RED]
- Awareness: SEO (yellow) + community (green)
- Eval: free trial (green)
- Purchase: self-serve checkout (green)
- Delivery: cloud SaaS (green)
- After-sales: in-app + email (yellow)

### 4. Customer Relationships [GREEN / YELLOW / RED]
- Self-serve (green) for SMB
- Concierge (yellow) for enterprise pilots
- Community (red — not built yet)

### 5. Revenue Streams [GREEN / YELLOW / RED]
- Subscription Pro $40/mo (green — collecting)
- Subscription Team $150/mo (yellow — 3 sold)
- Enterprise custom (red — hypothesis)

### 6. Key Resources [GREEN / YELLOW / RED]
- Codebase (green)
- Brand (red — early)
- Founder credibility (yellow)
- Customer data (yellow — accumulating)
- IP (n/a)

### 7. Key Activities [GREEN / YELLOW / RED]
- Product dev (green)
- Sales (yellow — founder-led)
- Customer success (red — not staffed)
- Marketing/content (yellow)

### 8. Key Partnerships [GREEN / YELLOW / RED]
- Stripe (green) — payments
- Postmark (green) — email
- AWS (green) — hosting
- <integration partner> (red — none signed)

### 9. Cost Structure [per cost-model]
- Fixed: $<X>/mo
- Variable: $<Y>/user
- Major buckets: infra, founder, tools

## Coherence check
- Segments × VP: ✓ — VP solves stated pain
- Segments × Channels: ⚠ — SMB likes self-serve but enterprise needs sales — channel mix needs splitting
- Revenue × Cost: ✓ — gross margin 78%
- Resources × Activities: ⚠ — no CSM resource, but plan has CS activity
- Partnerships × Channels: ✗ — no partner channel built; over-reliant on direct

## Pivot triggers per box
- If Segments shrink (red): re-do problem-validation
- If VP fails (red): pivot solution
- If Channels fail: re-do channel-fit-matrix
- If Revenue red: re-do pricing-model

## Overall verdict
**MODEL-COHERENT / PARTIAL / INCOHERENT**
```

## Verification
- All 9 boxes filled with evidence tier.
- Coherence checks (segments × channels, revenue × cost) done.
- Pivot triggers per box.
- Color-coded green/yellow/red.
