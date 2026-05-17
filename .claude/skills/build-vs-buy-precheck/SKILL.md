---
name: build-vs-buy-precheck
description: Per-component fast triage — build, buy SaaS, OSS, or defer. Pre-vendor-eval, pre-architecture-sketch. Catches expensive build commitments BEFORE they enter the architecture or capacity plan. Outputs to `docs/inception/build-vs-buy-<project>.md`. Fires EARLY in inception (right after `/mvp-scope`, before `/architecture-sketch`). Use when user says "build vs buy", "make or buy", "should I write this", "should we use a vendor", "what to outsource", "/build-vs-buy-precheck", or before `/vendor-eval` per item, or before `/architecture-sketch` to constrain candidate components.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /build-vs-buy-precheck — Cheap Triage Before Deep Eval

## Why you'd care

Deciding to build auth, billing, or search yourself adds a permanent maintenance team you didn't budget for. A 30-minute triage up front catches the expensive build commitments before they enter the architecture sketch and quietly become "ours forever."

`/vendor-eval` is heavy. Run this first to filter which components even need that depth.

**Fires EARLY** — right after `/mvp-scope` and BEFORE `/architecture-sketch`. Catching a "we should buy this" decision before architecture lands saves rewriting the sketch later. Skipping = teams default to BUILD, then re-justify mid-build under sunk-cost pressure.

## Pre-flight
1. Run after `/mvp-scope` so component list reflects only Must-haves.
2. Run BEFORE `/architecture-sketch` so the sketch is constrained by BUY/BUILD picks.
3. Feeds `/vendor-eval` per BUY item, `/feasibility-spike` per uncertain BUILD item.

## Inputs
- Architecture sketch component list.

## Process
1. **List every component** from architecture sketch — auth, billing, email, queue, search, observability, etc.
2. **Score per component** on 5 axes 1-5:
   - **Core to moat?** (5 = is the product, 1 = utility)
   - **Commodity available?** (5 = many mature options, 1 = no off-shelf)
   - **Switching cost later?** (5 = trapped, 1 = trivial swap)
   - **Time-to-build estimate** (5 = months, 1 = day)
   - **Run cost vs buy cost** (5 = buy way cheaper, 1 = build way cheaper)
2. **Decision matrix:**
   - Core to moat + Commodity available LOW → BUILD
   - Not core + Commodity HIGH → BUY-SAAS
   - Not core + open-source mature → OSS
   - Defer-OK + not blocking → DEFER (don't decide yet)
3. **Lock-in flag** — any BUY with switching-cost ≥ 4 → re-evaluate or design escape hatch.
4. **Bundle scan** — does one vendor cover 3+ components? Bundle discount, single throat to choke.

## Output
Write `docs/inception/build-vs-buy-<project>.md`:

```markdown
# Build vs Buy Pre-check — <project>
**Date:** <YYYY-MM-DD>

## Matrix
| Component | Moat (1-5) | Commodity (1-5) | Switch cost (1-5) | TTB (1-5) | Cost-buy-vs-build (1-5) | Decision |
|-----------|------------|-----------------|-------------------|-----------|-------------------------|----------|
| Auth | 1 | 5 | 3 | 4 | 5 | BUY-SAAS (Clerk/Auth0/NextAuth) |
| Billing | 1 | 5 | 4 | 5 | 5 | BUY-SAAS (Stripe) |
| <core feature> | 5 | 1 | — | — | — | BUILD |
| Search | 2 | 4 | 2 | 4 | 4 | OSS (Meili/Typesense) or DEFER |
| ... | ... | ... | ... | ... | ... | ... |

## High-lock-in items (switch cost ≥ 4)
| Component | Vendor candidate | Escape hatch |
|-----------|------------------|--------------|
| Billing | Stripe | Abstract behind `lib/payments` interface |
| ... | ... | ... |

## Bundle candidates
- <vendor> covers <list components> — investigate bundle pricing

## Deferred decisions
- <component> — defer until <trigger>

## Next
- BUY items → `/vendor-eval` per item
- BUILD items → feasibility check via `/feasibility-spike`
- High-lock-in BUY → design abstraction layer
```

## Verification
- Every architecture component listed.
- 5-axis score per row.
- Decision matches scores (no orphan picks).
- Lock-in items have escape hatch.
