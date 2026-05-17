---
name: pricing-page-draft
description: Draft the pricing page — tier cards, comparison table, FAQ, CTAs. Outputs to `docs/inception/pricing-page-<project>.md`. Use when user says "pricing page", "pricing copy", "tier cards", "comparison table", "/pricing-page-draft", or after `/packaging-tiers` + `/price-anchor-design`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /pricing-page-draft — The Page That Closes The Sale

The page after the homepage that decides whether they pay. Wireframe + copy + FAQ + objection handling.

## Why you'd care

The pricing page is the highest-stakes copy on your site — every objection a buyer has surfaces here. A draft built from anchors + tiers + FAQ does the objection-handling before sales has to.

## Pre-flight
Run after `/packaging-tiers`, `/price-anchor-design`, `/free-vs-trial-vs-freemium-pick`. Pairs with `/onboarding-flow`.

## Inputs
- Tier names + prices (from `/packaging-tiers`).
- Anchor strategy (from `/price-anchor-design`).
- Trial / freemium choice (from `/free-vs-trial-vs-freemium-pick`).
- Top 5 customer objections.

## Process
1. **Page structure** — hero promise → tier cards → comparison table → social proof → FAQ → final CTA.
2. **Tier card copy** — for each tier: name, price, 1-line role, 4-6 features, CTA. Highlight target tier visually.
3. **Comparison table** — features by tier, max 15 rows. Group by category (Core / Integrations / Admin / Security).
4. **Monthly/annual toggle** — annual 2 months free, default to whichever has higher revenue per visitor.
5. **CTA copy** — "Start free trial" beats "Sign up". "Talk to sales" only on Enterprise.
6. **Social proof above the fold** — logos or specific outcome quote.
7. **FAQ** — 5-8 objections answered. Top objections: "Can I switch tiers?", "What if I exceed my limit?", "Is there a contract?", "Refunds?", "Discounts for nonprofits / startups?".
8. **Mobile order** — tier cards stack target tier first on mobile (not Starter).
9. **Loss-frame test** — A/B copy for hero: "Save $X" vs "Costs $Y".

## Output
Write `docs/inception/pricing-page-<project>.md`:

```markdown
# Pricing Page Draft — <project>
**Date:** <YYYY-MM-DD>
**Pre-reqs:** packaging-tiers, price-anchor, free-vs-trial decisions in place

## Page structure (top to bottom)
1. Hero — promise + monthly/annual toggle
2. 3 tier cards + Enterprise card
3. Detailed comparison table (collapsible)
4. Social proof (logos + 1 quote)
5. FAQ (5-8 Qs)
6. Final CTA strip

## Hero copy
**H1:** Ship faster. Catch regressions before your users do.
**Sub:** Parallel test runners + flake detection. Teams cut CI minutes 40% in week one.
**Toggle:** [ Monthly | **Annual — save 2 months** ]
**CTA:** Start 14-day trial — no card required

## Tier cards

### Starter — $19/mo
For: solo dev, side projects
- 500 CI minutes/mo
- 2 parallel runners
- Email support
**CTA:** Start free

### **Pro — $49/mo** ⭐ Most popular
For: 2-10 dev teams
- Unlimited CI minutes
- 8 parallel runners
- GitHub + GitLab + Bitbucket integration
- Flake detection
- Chat support
**CTA:** Start 14-day trial

### Business — $99/mo
For: 10-50 dev teams
- Everything in Pro
- 32 parallel runners
- API access
- Analytics export
- 99.5% uptime SLA
- Priority support
**CTA:** Start 14-day trial

### Enterprise — Custom
For: 50+ devs, regulated
- Everything in Business
- Unlimited runners
- SSO / SAML
- SOC 2 + DPA
- Dedicated AM
- 99.9% SLA
**CTA:** Talk to sales →

## Comparison table (collapsible — default closed on mobile)
| Feature | Starter | Pro | Business | Enterprise |
|---------|---------|-----|----------|------------|
| CI minutes / mo | 500 | unlimited | unlimited | unlimited |
| Parallel runners | 2 | 8 | 32 | unlimited |
| GitHub integration | ✓ | ✓ | ✓ | ✓ |
| GitLab / Bitbucket | — | ✓ | ✓ | ✓ |
| Flake detection | — | ✓ | ✓ | ✓ |
| Custom Docker images | — | ✓ | ✓ | ✓ |
| Test analytics | — | ✓ | ✓ | ✓ |
| Analytics export | — | ✓ | ✓ | ✓ |
| API access | — | — | ✓ | ✓ |
| SSO / SAML | — | — | — | ✓ |
| SOC 2 / DPA | — | — | — | ✓ |
| Dedicated AM | — | — | — | ✓ |
| Uptime SLA | — | — | 99.5% | 99.9% |
| Support | email | chat | priority | dedicated |
| Onboarding | self | self | guided | white-glove |

## Social proof strip
> "Our CI was 22 minutes. Now it's 7. The Pro tier paid for itself in a sprint."
> — Priya, Staff Engineer, Lumière Labs (12-dev team)

Logos: GitHub • GitLab • Vercel • Datadog

## FAQ
**Can I switch tiers anytime?** Yes — upgrade or downgrade in-app. Pro-rated.
**What happens if I exceed my limit?** We notify at 80%. Soft cap — no surprise bills.
**Is there a contract?** Monthly is month-to-month. Annual is 12 months.
**Refunds?** 30-day money-back. No questions.
**Discounts for OSS / startups?** Yes — free for OSS repos, 30% off Pro for YC/early-stage.
**What integrations work?** GitHub, GitLab, Bitbucket, Slack, Linear, Stripe (billing).
**Do you store source code?** No — runners pull at build time, nothing persisted after job.
**SOC 2 / GDPR?** SOC 2 Type II on Enterprise. GDPR + DPA available.

## Final CTA strip
**H2:** Stop waiting on red builds. Start your 14-day free trial.
**Sub:** No credit card. Cancel anytime.
**CTA:** Start free → | Talk to sales →

## Mobile order (top to bottom)
1. Hero
2. **Pro card first** (target tier — not Starter)
3. Starter card
4. Business card
5. Enterprise card
6. Comparison table (collapsed)
7. Social proof
8. FAQ
9. CTA

## A/B test plan
- Hero copy A: "Stop waiting on red builds"
- Hero copy B: "Cut CI minutes 40% with zero config changes"
- Hypothesis: A (loss frame) converts 1.4× on cold traffic
- Run: 2 weeks, 1000 visitors each arm

## Pitfalls flagged
- [ ] Target tier highlighted, not just middle
- [ ] CTA verbs concrete ("Start free trial" not "Sign up")
- [ ] Pricing visible above fold on desktop
- [ ] Mobile reorders to put target tier first
- [ ] FAQ answers top 5 objections directly
- [ ] No "Contact us" gate before Enterprise tier
- [ ] Annual save framed in dollars, not percentages

## Next
- Onboarding flow → `/onboarding-flow`
- Trial expiry emails → `/transactional-email`
- Page testing → A/B with tools after launch
```

## Verification
- Hero promise + sub + CTA copy drafted.
- 4 tier cards with prices + features + CTAs.
- Full comparison table built.
- FAQ answers 5-8 specific objections.
- Mobile ordering puts target tier first.
- A/B test variant noted.
