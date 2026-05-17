---
name: d-and-o-insurance-pick
description: Founder / CFO / general counsel responsibility — D&O insurance pick — Side A/B/C structure, limits by round, NVCA model-doc requirements, carriers, tail coverage, director/officer personal exposure. Outputs to `docs/inception/d-and-o-insurance-pick-<project>.md`. Use when user says "D&O", "directors and officers", "board insurance", "term sheet insurance ask", "Side A", "runoff", "tail coverage", "general counsel D&O", "CFO D&O bind", "/d-and-o-insurance-pick", or before first VC term sheet.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /d-and-o-insurance-pick — D&O Is The Policy That Saves The Founder's House. Bind It Before The First Term Sheet Closes.

D&O ≠ "insurance for big companies". D&O = personal liability shield for founders + directors + officers against claims that survive corporate bankruptcy. The entity can't indemnify when it's insolvent. Without Side A, a down-round lawsuit hits the founder's personal balance sheet directly. Bind before first VC closes — term sheets routinely require it.

## Why you'd care

Directors increasingly refuse to join boards without D&O — and NVCA model docs require it. Binding the right Side A/B/C structure before the first term sheet is what makes the board addition possible at all.

## Pre-flight
Run before first priced round close OR before adding first outside board director OR before any of: ESOP > 10%, headcount > 10, ARR > $1M. Pairs with `/insurance-policy-pick`, `/board-of-directors-setup`, `/founders-agreement`, `/term-sheet-literacy`.

## Inputs
- Funding stage (pre-seed SAFE / priced seed / Series A / Series B+).
- Board composition (founder-only / +investor director / +independent).
- Cap table size (SAFE holders + priced investors + ESOP recipients).
- Headcount (drives EPL exposure overlap with EPLI).
- Customer concentration (top-customer % of revenue — drives securities-claim exposure on misstatement).
- State of incorporation (Delaware = standard, drives indemnification-statute baseline).

## Process
1. **Confirm trigger** — first VC term sheet, first outside director, first independent board seat.
2. **Pick coverage structure** — Side A / B / C combined limit; ABC vs Side-A-only DIC.
3. **Set limits by round** — calibrate to round size + cap table + VC term-sheet ask.
4. **Pick carrier** — Vouch / Embroker / Founder Shield bundled OR Travelers / Chubb / AIG direct via broker.
5. **Negotiate endorsements** — entity coverage, employment-practices wrap, fiduciary, outside-directorship.
6. **Confirm exclusions** — insured-vs-insured carve-back, prior-acts, fraud-after-final-adjudication.
7. **Plan tail (runoff) coverage** — 6-yr at acquisition / exit / dissolution.
8. **Document founder personal exposure scenarios** — what's covered + what isn't.
9. **Document + lock at `docs/inception/d-and-o-insurance-pick-<project>.md`.**

## Output
Write `docs/inception/d-and-o-insurance-pick-<project>.md`:

```markdown
# D&O Insurance Pick — <project>
**Owner:** founder / CFO / General Counsel
**Date:** <YYYY-MM-DD>
**Stage:** <pre-seed / seed / Series A / Series B+>
**State of incorporation:** Delaware
**Effective date:** <YYYY-MM-DD>
**Term:** 12 months

## Why D&O exists separate from general business insurance
- D&O covers **personal** liability of directors and officers (founder is both).
- Entity-only policies (GL / BOP) don't cover suits against individuals.
- When the entity is insolvent (down-round wipe-out / Ch 7 / acquisition wash), entity indemnification fails — Side A is the only thing standing between a securities suit and the founder's personal assets.
- VC term sheets require it. NVCA model docs Section 6.1 reference D&O.
- First-time founder personal exposure scenarios: down-round suit, employee class action, customer securities suit (if public claims about financials), shareholder derivative.

## Trigger — when to bind
- ✅ First priced VC round (Series A almost always, often Series Seed)
- ✅ First outside / independent board director seat
- ✅ First investor director seat (term sheet requires)
- ✅ Headcount > 10 OR ARR > $1M (EPL exposure rises sharply)
- ✅ Pre-revenue SAFE-only: optional, often skipped — but bind before first board meeting

**Our trigger:** <which one fired>
**Date triggered:** <YYYY-MM-DD>

## Coverage structure — Side A / B / C
D&O is a stack. Understand each side before sizing.

| Side | Covers | When it pays | Why it matters |
|------|--------|--------------|----------------|
| **Side A** | Director/officer directly | Entity can't indemnify (insolvency, public-policy bar, derivative suit) | **The founder-saver.** Only Side A pays when the company is bankrupt. |
| **Side B** | Entity reimbursement for indemnifying directors/officers | Entity advances defense costs, gets reimbursed by carrier | Cash-flow cushion for company during litigation |
| **Side C** | Entity itself | Securities claims against the entity (private = limited, public = broad) | Private-co Side C = "private company side C" = limited to specific enumerated claims |

**Our stack:** Combined Side A/B/C with shared limit. (Standard for private VC-backed.)
**Side A DIC (Difference-in-Conditions) bolt-on:** Recommended at Series A+ — separate Side-A-only tower that drops down when ABC limit is exhausted or denied.

## Limits by round
Calibrate to round size + cap table breadth + VC ask. Term sheets typically specify a minimum.

| Stage | Combined ABC limit | Side A DIC | Retention (deductible) | Annual premium estimate |
|-------|-------------------:|-----------:|-----------------------:|------------------------:|
| **Pre-seed SAFE-only** | $0 (skip) or $1M | — | $25k | $0 or $2-4k |
| **Priced Seed ($1-5M)** | $1M – $3M | optional $1M | $25-50k | $3-6k |
| **Series A ($5-20M)** | $3M – $5M | $2-3M | $50-100k | $8-15k |
| **Series B ($20-50M)** | $5M – $10M | $5M | $100-250k | $20-40k |
| **Series C+ ($50M+)** | $10M+ | $5-10M | $250k-$1M | $50-150k |
| **Pre-IPO** | $20M-$50M+ | $10M-$25M | varies | $100k-$500k+ |

**Our pick:** $<X>M combined ABC + $<Y>M Side A DIC (if applicable)
**Retention:** $<Z>k per claim
**Premium estimate:** $<P>k / year

## Carriers
**Bundled (tech-broker model):**
- **Vouch** — Series-A-friendly, fast bind, online quote. Bundles GL + cyber + E&O + D&O. Best for $1M-$5M ABC limits.
- **Embroker** — similar; strong on D&O specifically; better for $3M-$10M tower.
- **Founder Shield** — VC-network broker, deep D&O relationships, good for $5M+ towers and complex cap tables.

**Direct carriers (via traditional broker — Marsh / Aon / Lockton / Newfront):**
- **Travelers** — mainstream carrier, broad appetite, good Side A pricing.
- **Chubb** — premium carrier, strict underwriting, best for clean cap tables.
- **AIG** — broad capacity, common at Series A+.
- **Berkley** — competitive Series A pricing.
- **Allianz / Beazley** — strong at Series B+ towers.

**Our pick:** <carrier(s)>
**Broker:** <name>
**Why this carrier:** <fit: stage / pricing / customer-required / VC-relationship>

## Endorsements to ask for
- ✅ **Entity coverage for securities claims (Side C)** — standard but confirm scope.
- ✅ **Employment practices wrap (or separate EPLI)** — see `/insurance-policy-pick`.
- ✅ **Fiduciary liability wrap** — covers ERISA / 401k plan fiduciary exposure (relevant post-401k rollout).
- ✅ **Outside-directorship coverage** — if any founder/officer sits on another board.
- ✅ **Investigation costs sub-limit** — pre-claim investigations are common; not always covered by default.
- ✅ **Crisis management / PR expense sub-limit** — useful at Series A+.
- ✅ **Spousal / domestic-partner coverage** — extends to spouse if named in suit.
- ✅ **Estate coverage** — extends to estate of deceased director/officer.
- ✅ **Innocent insured carve-back** — coverage continues for non-culpable directors if one director commits fraud.

## Exclusions to watch
- ❌ **Insured-vs-insured (IvI) exclusion** — bars claims by one insured against another. **Critical carve-backs:** derivative suits, claims by former directors/officers, bankruptcy trustee, whistleblower retaliation.
- ❌ **Prior-acts exclusion** — bars claims arising from acts before the policy inception. Negotiate full prior-acts coverage at first bind; lose continuity = gap forever.
- ❌ **Fraud / dishonesty exclusion** — applies only **after final adjudication** (not interim). If it triggers on "allegation" or "in fact", reject.
- ❌ **Bodily injury / property damage** — D&O is not GL; this is correct and expected.
- ❌ **Bankruptcy / insolvency exclusion** — some carriers carve this; **reject** — Side A specifically must respond in insolvency.
- ❌ **Major shareholder exclusion** — bars claims by >5%/10%/15% holders. If carrier insists, narrow to 15% + carve back VC investors.
- ❌ **Antitrust exclusion** — narrow if possible.
- ❌ **Regulatory action exclusion** — narrow; SEC / FTC investigations need defense costs covered.

## Tail (runoff) coverage
D&O is **claims-made** — a claim filed today against acts from 3 years ago is covered only if policy was continuously in force *and* a tail extends past dissolution.

| Event | Tail required | Standard term | Cost |
|-------|---------------|---------------|------|
| **Acquisition** | Yes — buyer assumes liability but tail protects pre-close acts | 6 years | 175-300% of expiring premium, one-time |
| **IPO** | Yes — convert to public-co D&O + 6-yr tail on pre-IPO | 6 years | varies |
| **Dissolution / Ch 7** | Yes — directors personally exposed for years post-wind-down | 6 years | 200% expiring premium |
| **Founder departure** | Only if entity allows — usually entity policy continues, departing officer covered for prior acts |

**Plan now:** Tail cost is the largest one-time premium event in the policy's life. Reserve cash at acquisition / exit. **Insist on tail rights in policy language** — some carriers require negotiation at renewal, not at exit.

## Founder personal exposure scenarios — what's covered
| Scenario | Side A | Side B | Side C |
|----------|:------:|:------:|:------:|
| Down-round suit by SAFE holders / preferred holders | ✅ | ✅ | ✅ |
| Employee discrimination class action (also EPLI) | ✅ | ✅ | (EPLI primary) |
| Customer claim of material misstatement (post-deal) | ✅ | ✅ | ✅ |
| Shareholder derivative suit on board breach of fiduciary | ✅ | (IvI carve-back) | — |
| Bankruptcy trustee claw-back of director comp | ✅ | (IvI carve-back) | — |
| Co-founder suing over founder dispute | ✅ | (IvI carve-back) | — |
| SEC investigation of fundraising claims | ✅ | ✅ | ✅ |
| FTC investigation of marketing claims | ✅ | ✅ | ✅ |
| Vendor / customer breach-of-contract | ❌ (GL/E&O) | ❌ | ❌ |
| IP infringement claim | ❌ (E&O/cyber) | ❌ | ❌ |
| Cyber breach customer class action | partial | partial | partial (cyber primary) |

## NVCA model-doc references
- Investor Rights Agreement Section 4.4 — D&O insurance covenant ("Company shall use reasonable best efforts to maintain D&O insurance with coverage and amounts customary for similarly situated companies")
- Voting Agreement Section 4 — board indemnification baseline
- Charter Article — indemnification + advancement language
- Indemnification Agreement (per director) — separate doc, references D&O policy

**Action:** Add D&O policy declarations to data room. Investors diligence it.

## Investor-director-specific concerns
Investor directors will ask for:
- Minimum limit floor (often $3M Series A, $5M Series B+)
- Notice obligations on claim filing
- Renewal notification
- Carrier rating minimum (A.M. Best A-VII or better)
- Confirmation of full prior-acts coverage
- Confirmation of innocent-insured carve-back

Pre-bind: share quote summary + endorsement list with lead investor counsel.

## Premium budget by stage
| Stage | Combined ABC premium | Side A DIC premium | Total D&O annual |
|-------|---------------------:|-------------------:|------------------:|
| Pre-seed (if bound) | $2-4k | — | $2-4k |
| Seed | $3-6k | — | $3-6k |
| Series A | $8-15k | $3-6k | $11-21k |
| Series B | $20-40k | $10-20k | $30-60k |
| Series C+ | $50-150k | $25-75k | $75-225k |

Hard market (2022-2023 surge) pushed premiums 30-100% higher. Soft market (2025-2026 trending) eases. Re-quote every renewal — don't auto-renew.

## Renewal discipline
- 90 days before expiration: broker requests renewal application.
- 60 days: gather updated financials, cap table, headcount, claims history, litigation disclosure.
- 45 days: receive renewal terms — compare to market quote.
- 30 days: bind renewal OR shop alternate carriers (every 2-3 years minimum to avoid lazy renewal premium creep).
- Trigger to re-shop: premium increase >15% YoY without claims; carrier downgrade; coverage form change.

## Common founder mistakes
- ❌ Skip D&O entirely until first lawsuit lands
- ❌ Bind too late — first VC term sheet specifies it, founder scrambles to bind in 5 days
- ❌ Buy ABC-only with no Side A DIC at Series A+ — exposed when entity can't indemnify
- ❌ Accept default IvI exclusion without derivative-suit carve-back
- ❌ Accept prior-acts exclusion — lose retro coverage forever
- ❌ No tail at acquisition — founder personally exposed for 6 years post-exit
- ❌ Auto-renew without re-quote — pay 30% premium creep over 3 years
- ❌ No fiduciary wrap after 401k rolled out
- ❌ Carrier rating too low (B+ / non-rated) — investors balk at diligence
- ❌ Limits below VC term-sheet minimum — covenant breach

## Anti-patterns
- ❌ D&O bound after first claim filed (carriers don't backdate)
- ❌ ABC-only at Series A+ with no Side A DIC tower
- ❌ Insured-vs-insured exclusion without derivative-suit carve-back
- ❌ Prior-acts gap from lapsed renewal
- ❌ Fraud exclusion triggered on "allegation" not "final adjudication"
- ❌ Bankruptcy/insolvency exclusion accepted as written
- ❌ Major-shareholder exclusion at any threshold without VC carve-back
- ❌ No tail planned for acquisition — last-minute scramble
- ❌ Wrong carrier rating (< A-VII) — fails investor diligence
- ❌ Premium auto-renewed without market check 2+ cycles

## Pre-bind checklist
- [ ] Trigger event confirmed
- [ ] Coverage structure picked (ABC + Side A DIC if Series A+)
- [ ] Limit calibrated to round + cap table + VC ask
- [ ] Carrier selected (rating A-VII or better)
- [ ] Endorsements requested (fiduciary, outside-directorship, spousal, estate, innocent-insured)
- [ ] Exclusions negotiated (IvI carve-back, full prior-acts, fraud-after-final-adjudication, no bankruptcy exclusion)
- [ ] Tail rights baked into policy form
- [ ] Quote shared with lead investor counsel
- [ ] Premium reserved in budget
- [ ] Renewal date calendared 90 days pre-expiry

## Hand-off
- Risk umbrella + bundle context → `/insurance-policy-pick`
- Tech E&O / SaaS-bug liability → `/e-and-o-insurance-pick`
- Cyber / breach response → `/cyber-insurance-pick`
- Board formation + indemnification agreements → `/board-of-directors-setup`
- Founders' indemnification covenants → `/founders-agreement`
- Term-sheet covenants on D&O → `/term-sheet-literacy`
- Renewal cadence → `/operating-rhythm`
```

## Verification
- Trigger event named.
- ABC structure + Side A DIC sized per stage.
- Carrier picked (rating ≥ A-VII).
- Endorsements + exclusions negotiated explicitly.
- Tail rights in policy language.
- Founder personal exposure scenarios mapped.
- NVCA covenants tied back to investor diligence.
- Renewal cadence calendared.
