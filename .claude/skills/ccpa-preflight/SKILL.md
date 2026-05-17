---
name: ccpa-preflight
description: CCPA / CPRA preflight — applicability check, consumer rights mapping, "Do Not Sell" / "Limit Use" links, opt-out signals (GPC), 12-mo lookback, vendor contracts, fines. Outputs to `docs/inception/ccpa-preflight-<project>.md`. Use when user says "CCPA", "CPRA", "California privacy", "Do Not Sell", "Limit Use", "Global Privacy Control", "/ccpa-preflight", or before any product launch touching California residents.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /ccpa-preflight — California Counts If You Touch Any CA Resident. Preflight Now, Not After The First Right-To-Know Request.

## Why you'd care

The first CCPA right-to-know request from a California resident starts a 45-day clock you don't get to extend, and CPPA is now actively enforcing. Retrofitting opt-out plumbing, the GPC signal handler, and 12-month lookback into a live app costs ten times what scoping it pre-launch does.

CCPA ≠ "we'll handle it later". CCPA = effective when you touch California residents at all (no minimum CA-revenue threshold for some triggers). CPRA added the California Privacy Protection Agency with active enforcement. Map applicability, rights, and signals now — retrofitting opt-out plumbing into a live app costs 10x.

## Pre-flight
Run before public launch OR before any data collection that could reach a California resident OR before integrating ad-tech / behavioral analytics. Pairs with `/gdpr-preflight`, `/pii-inventory-pre`, `/privacy-by-design-charter`, `/lawful-basis-mapping`.

## Inputs
- Business size (annual gross revenue, # of CA consumer records, % revenue from selling/sharing PI).
- Data flows (what's collected, who it goes to).
- Categories of personal info collected (CCPA's 11 categories + 9 sensitive PI).
- Vendor list (anyone you share PI with).
- Ad-tech presence (pixels, Meta, Google Ads, etc.).

## Process
1. **Applicability test** — do CCPA thresholds apply?
2. **Map PI categories** — CCPA 11 + sensitive 9.
3. **Map consumer rights** — Know / Delete / Correct / Opt-out of Sale/Share / Limit Use / Portability / No-discrimination.
4. **"Do Not Sell or Share My Personal Information" + "Limit the Use of My Sensitive PI"** — required links + plumbing.
5. **Opt-out signals (GPC)** — Global Privacy Control header honoring.
6. **Vendor contracts** — service-provider vs third-party vs contractor language.
7. **12-month lookback** — required disclosure of what you collected/sold/shared.
8. **Notice at collection** — pre-collection notice content.
9. **Children (under 16)** — opt-in required.
10. **Enforcement + fines** — CPPA + AG + private right of action for data breach.

## Output
Write `docs/inception/ccpa-preflight-<project>.md`:

```markdown
# CCPA / CPRA Preflight — <project>
**Owner:** founder / DPO / counsel
**Date:** <YYYY-MM-DD>
**Status:** in scope / out of scope / borderline

## Applicability test

CCPA/CPRA applies to a for-profit business doing business in California AND meeting **one or more** of:
- [ ] Annual gross revenue > $25M (last calendar year)
- [ ] Annually buys/sells/shares PI of ≥ 100,000 CA consumers or households
- [ ] Derives ≥ 50% annual revenue from selling/sharing PI

**Also applies** to:
- Service providers / contractors handling PI on behalf of covered businesses
- Joint ventures / common-controlled entities

**Even if below thresholds**, expect contractual flow-down from B2B customers + ad-tech vendors that will require CCPA-grade controls.

**Our determination:** <in scope / out of scope / borderline>
**Reasoning:** <plain language>

If borderline: build to CCPA spec anyway. Cost of compliance < cost of retrofit.

## PI categories (CCPA 11)
For each, check ✓ if collected:
1. [ ] Identifiers (name, email, IP, account ID)
2. [ ] Customer records (Cal. Civ. Code § 1798.80 list — name, signature, SSN, etc.)
3. [ ] Protected classifications (race, sex, etc.)
4. [ ] Commercial info (transactions, purchase history)
5. [ ] Biometric info
6. [ ] Internet/network activity (browsing, search, ad interactions)
7. [ ] Geolocation
8. [ ] Sensory data (audio, visual, thermal, olfactory)
9. [ ] Employment info
10. [ ] Education info
11. [ ] Inferences (profiles derived from above)

## Sensitive PI (CPRA, 9 categories)
- [ ] SSN, driver's license, passport, state ID
- [ ] Account credentials
- [ ] Precise geolocation
- [ ] Race / ethnicity / religion / union membership
- [ ] Mail / email / text contents
- [ ] Genetic data
- [ ] Biometric for ID
- [ ] Health
- [ ] Sex life / sexual orientation

If any sensitive PI collected → **"Limit the Use of My Sensitive Personal Information"** link required.

## Consumer rights (must honor + plumb)

| Right | What it means | Implementation |
|-------|---------------|----------------|
| **Know** | Categories + specific pieces of PI collected, sources, purposes, who shared with, last 12 mo | Self-serve export + manual fulfillment path |
| **Delete** | Delete PI subject to exceptions | `/data-export` + retention-policy hooks |
| **Correct** | Correct inaccurate PI | Account settings + manual fulfillment |
| **Opt-out of Sale/Share** | Stop selling/sharing PI | "Do Not Sell or Share My PI" link |
| **Limit Use of Sensitive PI** | Restrict to disclosed purposes | "Limit Use of My Sensitive PI" link |
| **Portability** | Receive PI in portable format | `/data-export` JSON |
| **Non-discrimination** | No worse service for exercising rights | Policy + audit |
| **Opt-in for under-16** | Affirmative consent (13-15) or parental (under 13) | Age gate + consent flow |

**Response timing:** confirm within 10 business days, fulfill within 45 days (extendable to 90 with notice).
**Verification:** must verify identity for Know/Delete/Correct (2-3 data points or signed declaration).
**Authorized agents:** must accept requests from agents w/ power of attorney.

## "Do Not Sell or Share My Personal Information"
Required if you "sell" or "share" PI (broad definition — includes ad-tech sharing for cross-context behavioral advertising).

**Plumbing:**
- Footer link on every page: "Do Not Sell or Share My Personal Information"
- Link → 1-click opt-out (no account required)
- Opt-out propagates to: Meta Pixel, Google Ads, all ad-tech vendors
- State preserved for 12+ months
- Re-opt-in only via affirmative action

## "Limit the Use of My Sensitive PI"
Required if sensitive PI used for any purpose beyond providing the requested service.

**Plumbing:**
- Footer link: "Limit the Use of My Sensitive Personal Information"
- Link → opt-out flow
- Honored in real-time across systems

## GPC (Global Privacy Control)
California regulators have explicitly stated GPC must be honored as a valid opt-out signal.

**Plumbing:**
- Detect `Sec-GPC: 1` request header
- Server treats as opt-out of sale/share
- Set durable preference for the visitor
- Display confirmation if signed-in user

## Notice at collection (pre-collection)
Before/at point of collection, must disclose:
- Categories of PI being collected
- Purposes of use
- Whether sold or shared
- Categories of sensitive PI + purposes
- Length of retention per category (or criteria)
- Links to privacy policy + DNS / Limit Use

**Surfaces requiring notice:**
- Account signup
- Checkout
- Newsletter form
- Cookie banner (if behavioral cookies)
- Any data-collection form

## Privacy policy required content (CCPA-specific)
Add to `/privacy-policy`:
- Each CCPA right + how to exercise
- Categories of PI collected in last 12 mo
- Categories sold/shared in last 12 mo + recipient categories
- Categories disclosed for business purpose + recipients
- Sources of PI
- Purposes
- Retention per category
- DNS / Limit Use links
- Authorized agent process
- Contact for privacy inquiries
- Date last updated
- Metrics (annual, if > 10M CA consumers): requests received, granted, denied, avg response time

## Vendor contracts
Every vendor handling PI must be one of:
- **Service Provider** — contract restricts use to your purposes; CCPA flow-down required
- **Contractor** — like service provider, with audit rights
- **Third Party** — anyone else; sharing PI to a third party = "sale/share" unless exempt

**Required contract clauses (service-provider / contractor):**
- Restrict to specific business purpose
- No further selling / sharing
- No combining with other sources except as permitted
- CCPA-grade security
- Subcontractor flow-down
- Audit rights
- Cooperation with consumer requests

**Inventory vendors:** name, role, PI categories shared, contract status.

| Vendor | Role | PI shared | Contract status |
|--------|------|-----------|-----------------|
| Stripe | Payment processor (Service Provider) | name, email, card token | DPA + SP terms ✓ |
| Sentry | Error tracking | IP, user agent | DPA pending |
| Meta Pixel | Ad-tech (Third Party — counts as "share") | hashed email, events | needs LDU mode or opt-out wiring |

## 12-month lookback
At any time, a consumer can request what you collected/sold/shared in last 12 months.

**Build:**
- Audit log of PI collection events (or category-level inference)
- Vendor sharing log
- Sale/share log if applicable
- Capability to filter by consumer + date range

## Children
- Under 13: opt-in by parent (COPPA also applies federally)
- 13-15: opt-in by the minor
- 16+: opt-out applies (standard)
- Default: no behavioral ads to known under-16 users
- Age gate + verification for sensitive products

## Cookies + tracking
- Cookie banner not strictly required by CCPA but ad-tech cookies often = "share"
- If using behavioral cookies → opt-out via DNS link
- Recommend: cookie banner + DNS link in footer for defense-in-depth

## Data breach + private right of action
- Limited private right of action for breaches of unencrypted/unredacted PI
- $100-750 per consumer per incident statutory damages OR actual damages
- Notify CA AG + affected consumers per breach notification law
- See `/incident-runbook` + `/post-mortem`

## Enforcement
- **California Privacy Protection Agency (CPPA):** investigative + admin enforcement
- **CA Attorney General:** civil enforcement
- **Fines:** up to $7,500 per intentional violation, $2,500 per unintentional, per consumer
- No 30-day cure period under CPRA (CCPA's old cure period removed)

## Documentation to maintain
- This preflight doc (refresh annually)
- Data inventory (`/pii-inventory-pre`)
- Vendor list w/ contracts
- Consumer request log (anonymized)
- Privacy policy version history
- Notice-at-collection screenshots
- Cookie consent records (if applicable)
- Retention proof per category

## Pre-launch checklist
- [ ] Applicability determination written
- [ ] PI categories mapped
- [ ] Sensitive PI noted (drives Limit Use plumbing)
- [ ] Consumer rights flows built (Know / Delete / Correct / Portability)
- [ ] "Do Not Sell or Share" link + plumbing live
- [ ] "Limit Use of Sensitive PI" link if applicable
- [ ] GPC honored
- [ ] Notice at collection at every collection point
- [ ] Privacy policy CCPA-content complete
- [ ] Vendor contracts SP / Contractor terms
- [ ] 12-mo lookback feasible
- [ ] Under-16 opt-in flow if applicable
- [ ] Breach notification plan
- [ ] Annual refresh scheduled

## Anti-patterns
- ❌ "We don't sell data" stated without auditing ad-tech (sharing = sale equivalent)
- ❌ DNS link buried / dark-patterned
- ❌ Opt-out applies to website only, leaves ad-tech firing
- ❌ Verification too aggressive (deters lawful requests)
- ❌ Vendor sharing without SP/Contractor contract
- ❌ Privacy policy = legal blob nobody reads
- ❌ Ignoring GPC because "we don't have to" (you do, in California)
- ❌ Treating CCPA as US-only and GDPR as EU-only — they overlap; design once
- ❌ Annual refresh skipped → categories drift → notice goes stale

## Coordination with adjacent frameworks
- **GDPR (`/gdpr-preflight`):** much overlap; build to higher standard then comply both
- **HIPAA (`/hipaa-preflight`):** if health data, HIPAA may preempt parts of CCPA
- **COPPA:** federal under-13 rules — additive to CCPA
- **Other states:** Colorado, Connecticut, Virginia, Texas, Oregon, Montana, etc. — similar but not identical. Build CCPA + GDPR core, then state-specific add-ons.

## Annual refresh
- Re-test applicability thresholds
- Re-inventory PI + vendors
- Update 12-mo lookback view
- Update privacy policy
- Audit DNS / Limit Use opt-out propagation
- Review consumer requests handled vs denied + reasons

## Next
- PII inventory → `/pii-inventory-pre`
- Privacy policy → `/privacy-policy`
- Data export endpoint → `/data-export`
- Retention rules → `/retention-policy`
- GDPR coordination → `/gdpr-preflight`
- Threat model → `/threat-model-pre`
```

## Verification
- Applicability determination written.
- PI categories + sensitive PI mapped.
- Consumer rights flows planned.
- DNS / Limit Use links + plumbing scoped.
- GPC honored.
- Vendor contracts inventoried.
- Notice at collection covered.
- Annual refresh scheduled.
