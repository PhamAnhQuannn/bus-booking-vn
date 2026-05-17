---
name: e-and-o-insurance-pick
description: Founder / CFO / general counsel responsibility — tech E&O / professional liability insurance pick — software-bug coverage, customer-MSA minimums, media liability wrap, IP infringement defense, carriers, limits by ARR. Outputs to `docs/inception/e-and-o-insurance-pick-<project>.md`. Use when user says "E&O", "tech E&O", "professional liability", "errors and omissions", "SaaS liability", "media liability", "general counsel E&O", "CFO E&O bind", "/e-and-o-insurance-pick", or before first paid customer contract.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /e-and-o-insurance-pick — Tech E&O Is What Pays When Your Bug Costs A Customer Money. Bind Before The First MSA.

E&O ≠ "general business insurance". Tech E&O = covers economic loss caused by a software bug, integration failure, missed SLA, data error, advice given, professional service rendered. GL won't pay for it. Cyber won't pay for it. Without E&O, a single customer claiming your bug cost them $500k goes against the company balance sheet. Bind before signing the first MSA — most enterprise customers require it as a contractual minimum.

## Why you'd care

Enterprise MSAs increasingly require tech E&O minimums; a customer signing without a policy in place becomes a stalled deal. Binding before first paid contract is what removes the procurement blocker.

## Pre-flight
Run before first paid customer contract OR before MSA negotiation OR before any of: ARR > $50k, first enterprise pilot, first integration partnership. Pairs with `/insurance-policy-pick`, `/cyber-insurance-pick`, `/msa-template`, `/terms-of-service-pre`.

## Inputs
- Product type (SaaS / API / managed service / consulting / hybrid).
- Customer segment (SMB / mid-market / enterprise / regulated industries).
- Revenue model (subscription / usage / one-time / services).
- Highest-stakes customer use case (mission-critical? regulated workflow? safety-critical?).
- Largest customer ACV (drives liability cap exposure).
- AI/ML in product? (drives "AI errors and omissions" rider need).
- Media / content / publishing exposure (drives media liability wrap).

## Process
1. **Map professional-services risk surface** — what your product/service does that can cause customer loss.
2. **Confirm customer-driven minimums** — MSA template + RFPs typically demand $1M-$5M E&O.
3. **Pick coverage form** — Tech E&O combined with Cyber (common) vs Tech E&O standalone.
4. **Set limits by ARR + customer ACV** — calibrate to largest-contract liability exposure.
5. **Add wraps** — media liability, IP defense, AI errors, contingent BI.
6. **Pick carrier** — Vouch / Embroker / Coalition (combined cyber+E&O) or specialty (Beazley / Chubb / Hiscox).
7. **Negotiate exclusions** — bodily injury, prior knowledge, known incidents, IP carve-outs.
8. **Document + lock at `docs/inception/e-and-o-insurance-pick-<project>.md`.**

## Output
Write `docs/inception/e-and-o-insurance-pick-<project>.md`:

```markdown
# Tech E&O / Professional Liability Insurance Pick — <project>
**Owner:** founder / CFO / General Counsel
**Date:** <YYYY-MM-DD>
**Stage:** <pre-revenue / paid pilots / paying customers / scaling>
**Largest customer ACV:** $<X>
**Effective date:** <YYYY-MM-DD>
**Term:** 12 months

## Why tech E&O exists separate from GL + cyber + D&O
- **GL** covers bodily injury + property damage — not economic loss from software failure.
- **Cyber** covers data breach + ransomware + network security — not "the product gave wrong output".
- **D&O** covers personal director/officer liability — not entity contract breach.
- **Tech E&O** covers: software bugs, integration failures, missed SLAs, bad data outputs, professional advice/service errors, IP infringement defense, media liability.
- Customer MSAs increasingly require $1M-$10M E&O minimums as standard. **No E&O = no enterprise contract.**

## Risk surface — what tech E&O covers
| Risk | Example scenario | E&O response |
|------|------------------|--------------|
| **Software bug causing customer loss** | Pricing engine miscalculates → customer overcharges users → class action | Defense + settlement |
| **Integration failure** | Webhook drops → customer's downstream system corrupted | Defense + economic loss |
| **Missed SLA** | 99.9% promised, delivered 99.0% → customer claims revenue impact | Defense + damages |
| **Bad data output** | ML model misclassifies → customer makes bad decision → loss | Defense + damages |
| **Professional advice** | Consulting deliverable wrong → customer acts on it → loss | Defense + damages |
| **IP infringement claim against you** | Patent troll sues for using algorithm X | Defense costs (key) |
| **Defamation / copyright in UGC** | User-generated content surfaces defamatory text → 3rd party sues you | Media liability wrap |
| **Failure to deliver** | Vaporware claim — customer paid, didn't get working product | Defense + restitution |
| **AI hallucination** | LLM-powered product gives wrong legal/medical/financial output → loss | AI E&O rider |

**Our top 3 risks:** <list>
**Highest-impact scenario:** <which one would tank the co>

## Customer-driven minimums
MSAs and RFPs specify minimum coverage. Check the deal pipeline before binding.

| Customer segment | Typical E&O minimum | Notes |
|------------------|--------------------:|-------|
| SMB ($0-50k ACV) | $1M | Often not specified |
| Mid-market ($50k-500k ACV) | $1M – $3M | Boilerplate MSA clause |
| Enterprise ($500k+ ACV) | $3M – $10M | Negotiable; some demand $25M |
| Fortune 500 / regulated | $5M – $25M | Non-negotiable; specific endorsements |
| Healthcare (HIPAA-touching) | $5M – $10M + cyber bundle | Plus BAA discipline |
| Financial services | $5M – $10M + crime + cyber | Plus SOC 2 |
| Government (state/fed) | varies | Often $10M minimum + bonds |

**Our pipeline check:**
- Largest pending MSA E&O minimum: $<X>M
- Highest-stakes industry: <industry>
- **Required limit floor:** $<X>M (matched to largest pending deal)

## Coverage structure pick
| Form | Pros | Cons | Recommended for |
|------|------|------|----------------|
| **Combined Tech E&O + Cyber (one carrier, shared limit)** | Simpler, fewer policies, single broker, single claim handler | Shared limit = one big claim eats both; gaps at coverage seam | Pre-Series-A SaaS, simple risk |
| **Separate Tech E&O + Cyber towers (separate carriers)** | Distinct limits — both can max out independently; specialty cyber carrier expertise | More cost, more renewals to manage | Series A+, regulated industries, high cyber exposure |
| **Tech E&O standalone (no cyber)** | Cheaper if cyber risk genuinely zero | Almost never the right answer for software co | Pure consulting w/o data handling |

**Our pick:** <form>
**Why:** <stage + customer mix + risk profile>

## Limits by stage + ARR
| Stage | ARR | E&O limit | Retention | Annual premium estimate |
|-------|-----|----------:|----------:|------------------------:|
| Pre-revenue | $0 | $1M | $5-10k | $1-2k |
| First paid customers | $0-100k | $1M | $5-10k | $1-3k |
| Early traction | $100k-1M | $1M – $2M | $10-25k | $3-7k |
| Growth | $1M-5M ARR | $2M – $5M | $25-50k | $7-15k |
| Scale | $5M-20M ARR | $5M – $10M | $50-100k | $15-40k |
| Mid-market | $20M+ ARR | $10M – $25M | $100-250k | $40-100k+ |

**Our pick:** $<X>M limit, $<Y>k retention, estimated premium $<P>k/year

## Wraps + endorsements
- ✅ **Media liability** — defamation, copyright, trademark infringement in product content. Critical if you publish anything (blogs, UGC, AI-generated content).
- ✅ **IP infringement defense** — defense costs for patent/copyright/TM claims against your product. **High-value sub-limit** ($1M-$5M typical).
- ✅ **Contingent bodily injury / property damage** — covers BI/PD that flows from your tech failure (e.g., your scheduling bug causes a worker safety incident).
- ✅ **AI errors and omissions rider** — if product uses AI/ML for recommendations, classifications, generations. Newer carriers (Vouch, Coalition, At-Bay) explicitly offer this.
- ✅ **First-party financial loss** — your own loss from your own error during service delivery.
- ✅ **Subcontractor coverage** — if your service depends on contractors, their errors flow through your E&O.
- ✅ **Failure to prevent unauthorized access** — overlaps with cyber; confirm no coverage gap.
- ✅ **Breach of warranty** — explicit warranty / SLA breach.
- ✅ **Vicarious liability** — for partners/resellers acting on your behalf.

## Exclusions to negotiate
- ❌ **Prior knowledge** — bars claims you knew about before binding. **Critical:** make full disclosure at bind; carrier can't deny later.
- ❌ **Prior acts** — bars claims from work done before policy inception. **Negotiate full prior-acts coverage at first bind**, or you're naked for everything you've already shipped.
- ❌ **Bodily injury / property damage carve-out** — standard for E&O (GL covers it), but ensure contingent BI/PD wrap exists.
- ❌ **Intentional acts** — standard, narrow to "intentional + with intent to cause harm" not "intentional act" (every action is intentional).
- ❌ **Antitrust** — narrow.
- ❌ **Patent infringement** — some carriers exclude patent specifically from IP defense. **Negotiate it in** or buy separate patent defense (rare carriers — Intellectual Property Insurance Services Corp / RPX).
- ❌ **Government / regulatory action** — narrow; defense costs for SEC/FTC/state-AG investigations should be covered.
- ❌ **Failure to maintain insurance** — bars claims if you let other insurance lapse. Standard but watch the cross-reference.
- ❌ **Express warranty / contractual liability without standard carve-back** — bars contract-claim coverage. Carve back: "to the extent liability would exist absent contract".
- ❌ **AI exclusion** — some legacy carriers exclude AI/ML outputs. **Confirm explicit AI inclusion** if product uses it.

## Carriers
**Bundled (tech-broker, cyber+E&O combined):**
- **Vouch** — strong on SaaS/tech, fast bind, online quote. $1M-$5M sweet spot. Bundle cyber+E&O.
- **Embroker** — solid Series-A through Series-B coverage, good MSA-compliant endorsements.
- **Coalition** — cyber-first carrier, strong cyber+E&O combo, includes incident response.
- **At-Bay** — similar to Coalition; security-led underwriting.
- **Cowbell** — cyber-led, growing E&O book.

**Specialty / traditional (via broker):**
- **Beazley** — gold-standard tech E&O carrier, $1M-$25M, broad form.
- **Chubb** — premium carrier, broad form, strict underwriting.
- **Hiscox** — SMB tech E&O leader, fast quote, good $1M limits.
- **Travelers** — mainstream, broad appetite.
- **AIG** — large limits, $10M+.
- **Tokio Marine HCC** — strong on combined towers.

**Our pick:** <carrier(s)>
**Bundle?** <combined w/ cyber, or separate>
**Why:** <fit: customer-required limits, AI rider, specialty industry, broker relationship>

## MSA compliance — what customers will ask for
Standard customer-MSA insurance schedule typically demands:
- ✅ Tech E&O $X minimum (per MSA — usually $1M-$10M)
- ✅ Cyber $X minimum (often combined)
- ✅ Additional insured status (customer named on certificate)
- ✅ Waiver of subrogation (carrier can't sue customer to recover)
- ✅ Primary and non-contributory (your insurance pays first, not customer's)
- ✅ 30-day notice of cancellation
- ✅ Carrier rating A.M. Best A-VII or better
- ✅ Certificate of insurance (COI) issued within 24-48 hr of request

**Work with broker to set up COI automation** — every new enterprise customer = COI request day 1.

## AI/ML-specific coverage
If product uses AI/ML for recommendations / classifications / generations:
- Confirm policy explicitly covers AI outputs (some carriers silent = exclusion risk).
- Look for "algorithmic bias", "AI hallucination", "model drift" carve-ins.
- Beazley, Vouch, Coalition, Munich Re lead on AI E&O wording (2025-2026).
- LLM-wrapper products: confirm coverage extends to upstream model errors (you may have indemnification from OpenAI/Anthropic; carrier shouldn't double-exclude).
- Premium loading: 10-30% extra for AI-heavy products vs deterministic SaaS (2026 market).

## Media liability wrap
Required if you publish:
- Blog content
- User-generated content
- AI-generated outputs (text/image/code) shown to users or distributed
- Marketing content with comparisons
- Documentation citing third parties

Covers: defamation, libel, copyright infringement, trademark infringement, privacy rights, misappropriation of ideas.

Typical sub-limit: $1M-$3M shared with E&O tower or separately.

## IP infringement defense
Patent troll suits average $1-2M in defense costs even when winning. Sub-limit critical.
- Standard E&O includes copyright/TM defense.
- **Patent defense often excluded** — negotiate in or buy separately.
- Specialty patent defense: IPISC / RPX (subscription model).
- Defensive patent aggregators: Unified Patents / LOT Network (membership, not insurance, but reduces claim frequency).

## Renewal discipline
- 90 days pre-expiry: broker requests renewal app.
- 60 days: update revenue, customer count, largest customer, highest-stakes use case, AI usage, claims history.
- 45 days: receive renewal terms; compare to market every 2-3 years.
- 30 days: bind.
- Re-shop trigger: >15% premium increase without claims; coverage form change; carrier downgrade; new customer segment (e.g., entered healthcare).

## Common founder mistakes
- ❌ No E&O until first enterprise MSA demands it — bind in panic in 5 days
- ❌ $1M limit for an enterprise deal that requires $5M (deal stalls / lost)
- ❌ Bundle cyber+E&O shared limit when a single claim could max both
- ❌ Skip media liability when product surfaces UGC or AI text
- ❌ Skip AI rider on AI-heavy product
- ❌ Accept patent exclusion without questioning
- ❌ No prior-acts coverage at first bind — naked for everything shipped to date
- ❌ Cheap carrier (B+ rating) — fails enterprise diligence
- ❌ Slow COI workflow — customer onboarding stalls
- ❌ Express-warranty exclusion uncarve-backed — kills SLA-claim coverage

## Anti-patterns
- ❌ Tech E&O bound after first MSA panic
- ❌ Limit below customer MSA minimum
- ❌ Combined cyber+E&O shared limit when separate towers needed
- ❌ AI exclusion accepted as written on AI product
- ❌ Patent defense excluded without alternative
- ❌ No prior-acts coverage
- ❌ Prior-knowledge exclusion not addressed at bind
- ❌ Media liability skipped on content-heavy product
- ❌ COI process manual and slow (>48 hr)
- ❌ Wrong carrier rating (< A-VII) — enterprise diligence fail

## Pre-bind checklist
- [ ] Risk surface mapped (top-3 scenarios)
- [ ] Customer MSA minimums surveyed (pipeline)
- [ ] Coverage form picked (combined cyber+E&O vs separate)
- [ ] Limit calibrated to ARR + largest pending MSA
- [ ] Wraps added (media, IP defense, AI rider, contingent BI)
- [ ] Exclusions negotiated (prior-acts, AI inclusion, patent, warranty carve-back)
- [ ] Carrier rating ≥ A-VII confirmed
- [ ] COI workflow set up with broker (24-48 hr turnaround target)
- [ ] Renewal calendared 90 days pre-expiry
- [ ] MSA-template insurance schedule cross-checked

## Hand-off
- Risk umbrella + bundle context → `/insurance-policy-pick`
- Cyber tower (paired with E&O) → `/cyber-insurance-pick`
- Director/officer personal liability → `/d-and-o-insurance-pick`
- MSA template clauses + insurance schedule → `/msa-template`
- SLA commitments backed by E&O coverage → `/non-functional-baseline`
- Data Processing Addendum + cyber crossover → `/dpa-template`
```

## Verification
- Risk surface mapped.
- Customer MSA minimums confirmed from pipeline.
- Coverage form picked (bundled vs separate).
- Limit ≥ largest customer MSA minimum.
- Wraps + endorsements negotiated.
- Prior-acts + AI inclusion explicit.
- Carrier rating ≥ A-VII.
- COI workflow defined.
- Renewal cadence calendared.
