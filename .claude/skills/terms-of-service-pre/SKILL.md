---
name: terms-of-service-pre
description: Pre-launch Terms of Service draft — variant per product type (SaaS / consumer / fintech / marketplace / API), liability cap, warranty disclaimer, AUP, DMCA, arbitration + class-action waiver, age gates, click-wrap enforceability, jurisdiction landmines. Outputs to `docs/inception/terms-of-service-pre-<project>.md`. Use when user says "ToS", "terms of service", "terms of use", "user agreement", "/terms-of-service-pre", or before public launch.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /terms-of-service-pre — ToS Decided Pre-Launch So You Don't Ship A Click-Wrap That Won't Hold In Court.

ToS is not boilerplate. It is the contract between you and every user — and the difference between an enforceable click-wrap and a browse-wrap that gets thrown out is in the wiring, not the words. Draft pre-launch so the first 1000 users are bound, not the first 1000 lawsuits.

## Why you'd care

ToS borrowed from a competitor's site routinely cite the wrong jurisdiction, miss DMCA safe-harbor language, and embed a class-action waiver that won't survive a Massachusetts court. Drafting per product type up-front is what makes the document actually enforceable.

## Pre-flight
Run before public launch OR before signup flow ships. Pairs with `/privacy-policy-pre`, `/eula-pre`, `/dpa-template`, `/aup-design`, `/jurisdiction-pick`.

## Inputs
- Product type (SaaS B2B / SaaS B2C / consumer app / game / marketplace / fintech / API-as-product / scraper-tool).
- Target jurisdictions (US-only / EU / UK / global / state-by-state).
- User age range (13+ / 16+ / 18+ / mixed).
- Payment model (free / freemium / subscription / one-time / marketplace fees).
- UGC presence (user-generated content yes/no).
- Account model (account required / anonymous / both).

## Process
1. **Pick variant** — SaaS / consumer / fintech / marketplace / API / scraper map to different ToS shapes.
2. **Wire click-wrap correctly** — "I agree" checkbox + scrollable text + dated version. No browse-wrap.
3. **Identify mandatory clauses per jurisdiction** — EU cancellation right, California auto-renew, Utah/TX age verification, COPPA U13.
4. **Liability cap + warranty disclaimer** — ALL CAPS for UCC conspicuousness.
5. **Arbitration + class-action waiver** — Epic v. Apple aftermath, mass-arbitration risk.
6. **AUP** — what gets users banned.
7. **DMCA designated agent** if hosting UGC — register with Copyright Office.
8. **Termination + account suspension grounds** — for cause vs convenience.
9. **Age gate** — COPPA U13 hard block, GDPR-K 13-16 parental consent.
10. **Governing law + venue** — match jurisdiction-pick output.
11. **Versioning + notice procedure** — how users get told ToS changed.
12. **Lawyer review before launch** — drafting from template, not signing without review.

## Output
Write `docs/inception/terms-of-service-pre-<project>.md`:

```markdown
# Terms of Service (Pre-launch Draft) — <project>
**Owner:** founder / General Counsel
**Date:** <YYYY-MM-DD>
**Version:** 0.1 (pre-launch draft)
**Status:** DRAFT — lawyer review required before launch
**Jurisdictions targeted:** <US / EU / UK / global>
**Effective date:** <YYYY-MM-DD upon launch>

## Why this exists pre-launch
- Click-wrap must be wired into signup flow at v1, not retrofitted (retrofit = unenforceable for legacy users)
- First user sues → ToS you wished you had doesn't apply
- Jurisdiction-specific mandatory clauses can void entire ToS if missing (EU 14-day cancel, CA auto-renew, etc.)
- Arbitration + class-action waiver = single most impactful clause for downside protection (must be conspicuous)
- DMCA designated agent registration is paperwork — file before UGC opens, not after first takedown
- Age gate baked in pre-launch avoids COPPA $50k/violation fines

## Variant pick

| Product type | ToS shape | Key clauses |
|--------------|-----------|-------------|
| **SaaS B2B** | Master + user terms (paid plan = MSA/SOW separately) | SLA, data ownership, no-poach, audit rights |
| **SaaS B2C / consumer** | Single ToS click-wrap | Auto-renew, cancel, refund, content moderation |
| **Consumer game / app** | ToS + EULA + virtual-goods-policy | Virtual currency, lootbox, IAP, account loss, age gate |
| **Marketplace (two-sided)** | Buyer ToS + Seller ToS + platform AUP | Fees, escrow, dispute, KYC, fraud, prohibited items |
| **Fintech** | ToS + e-sign + cardholder/depositor agreements (bank partner usually owns) | Reg E, Reg Z, dispute, fraud liability, ID verification |
| **API-as-product** | Developer ToS + AUP + rate-limit policy | API key revocation, downstream user flowdown, fair-use, deprecation |
| **Scraper / data tool** | ToS + AUP heavy on prohibited targets | hiQ v. LinkedIn, CFAA risk, no-circumvention, no-PII-scraping |

**Our pick:** <variant>

## Click-wrap wiring (the non-negotiable)
- "I agree to the Terms of Service and Privacy Policy" checkbox, **unchecked by default**
- Both links open scrollable, full-text versions (not buried PDFs)
- Submit button **disabled** until checkbox checked
- Account record stores: ToS version, timestamp, IP — for evidentiary trail
- Click-wrap on every signup flow (web, iOS, Android, partner-embed)
- Re-acceptance required on material change (see Versioning below)

**Browse-wrap (footer-link-only) is unenforceable** — Specht v. Netscape (2002) and progeny. Do not rely on it.

## Mandatory clauses by jurisdiction

| Jurisdiction | Mandatory inclusion |
|--------------|---------------------|
| **EU (consumer)** | 14-day right of withdrawal (Consumer Rights Directive) — but digital content exception if user expressly waives + product delivered. Cancel-anytime if subscription. |
| **EU (B2B)** | Unfair Contract Terms Directive limits exclusions — review with EU counsel. |
| **UK** | Consumer Rights Act 2015 — quality / fit-for-purpose can't be disclaimed for consumers. |
| **California** | Auto-renewal disclosure (Cal. BPC §17602): clear & conspicuous, separate consent, cancellation mechanism, post-purchase email confirmation. SB 313 amendments. |
| **California (kids)** | SB 976 (2024) age-appropriate design for users U18. |
| **Utah** | Social Media Regulation Act — age verification + parental consent for U18 (litigation pending). |
| **Texas** | HB 18 SCOPE Act — minors require parental consent. |
| **NY** | SAFE for Kids Act addictive feeds restrictions U18. |
| **Federal (US)** | COPPA U13 hard block or verifiable parental consent. CAN-SPAM (commercial email opt-out). |
| **Brazil** | CDC consumer code — pro-consumer interpretation; cancellation 7 days online purchases. |
| **Quebec** | Quebec consumer law + French language requirement (Charter of French Language / Bill 96). |

## Section-by-section template

### 1. Acceptance + scope
- Who is "we" (legal entity, address, contact)
- Who is "user" / "you" (account holder; if business, authorized rep)
- Acceptance via signup + click + continued use
- ToS governs use of <Service> (define narrowly)

### 2. Eligibility + age
- Must be ≥18 (or local majority) to enter binding contract
- U13 prohibited (COPPA)
- 13-16 / 13-18 = parental consent required (jurisdiction-dependent)
- Sanctioned jurisdictions prohibited (OFAC, EU, UK sanctions lists)

### 3. Account
- Accurate registration info required
- User responsible for account credentials
- One account per person (unless multi-account explicitly allowed)
- Suspension grounds + appeal path

### 4. License grant
- We grant: limited, non-exclusive, revocable, non-transferable, non-sublicensable license to use Service for permitted purposes
- User grants: license to user content (see UGC section)
- No reverse engineering, no scraping, no resale, no white-label without permission

### 5. Acceptable Use Policy (AUP)
Prohibited:
- Illegal use
- Harassment, doxing, CSAM, terrorism content
- Malware, phishing, exploits
- Spam, unsolicited bulk messaging
- Unauthorized scraping, bot abuse, rate-limit evasion
- Reverse engineering, decompilation (except where law permits)
- Reselling, sublicensing, white-labeling
- Impersonation, identity fraud
- Circumventing technical / access controls
- Violating intellectual property rights

Enforcement: warning → suspension → termination → legal action (we pick remedy).

### 6. User-generated content (if applicable)
- License grant FROM user: worldwide, royalty-free, sublicensable, transferable license to host / display / distribute UGC for Service purposes (and reasonable adjacent purposes: marketing, AI training if disclosed)
- User retains ownership
- User represents they have rights to upload
- Content moderation discretion reserved
- DMCA designated agent (see Section 13)
- AI training carve-out: explicit if using UGC for training (FTC enforcement post-2024)

### 7. Fees + payment + auto-renewal (if paid)
- Pricing per pricing page (or order form)
- Billed [monthly / annually / per-use]
- **Auto-renewal** disclosure box (Cal. BPC §17602 conspicuous): "Your subscription will automatically renew at [$X] every [period]. You can cancel anytime at [URL]."
- Refund policy (or "no refunds except as required by law")
- Tax responsibility
- Failed payment → suspension after [N] days

### 8. Termination + suspension
- User can terminate anytime (account deletion path documented)
- We can terminate / suspend:
  - For breach of ToS / AUP
  - For non-payment
  - For legal compulsion
  - For convenience with [30] days notice (B2B)
  - Immediately for material breach / safety / legal risk
- Effect of termination: license revoked, data export window [30] days, then deletion (per Privacy Policy / DPA)
- Survival clause: which sections survive

### 9. Intellectual property
- We own the Service (code, designs, trademarks)
- User owns user content
- Feedback assignment (free perpetual license back to us)
- Trademark use restricted

### 10. Disclaimers + warranties (ALL CAPS REQUIRED for UCC §2-316 conspicuousness)
- "AS IS" + "AS AVAILABLE"
- No implied warranties (merchantability, fitness, non-infringement, accuracy, uptime)
- No guarantee against bugs / interruption / data loss
- Force majeure
- Third-party services not warranted

### 11. Limitation of liability (ALL CAPS REQUIRED)
- No consequential / incidental / special / indirect damages
- Aggregate cap: lesser of (a) fees paid in trailing 12 mo OR (b) $100 USD for free users
- Carve-outs: cannot exclude where prohibited by law (gross negligence / fraud / death+injury / consumer rights / etc. — list jurisdiction-specific)
- Apportionment in case of multiple users from same org (B2B)

### 12. Indemnification
- User indemnifies us for: user breach, user content, user illegal use, third-party claims arising from user's misuse
- We indemnify B2B / enterprise customers for IP infringement (per MSA)
- Procedure: notice, control of defense, cooperation

### 13. DMCA + IP takedown (UGC products only)
- Designated agent: <name, address, email, phone>
- Registered with U.S. Copyright Office at <URL>
- Takedown procedure: 17 USC §512(c)(3) elements
- Counter-notice procedure: §512(g)
- Repeat-infringer policy + account termination

### 14. Dispute resolution + arbitration
- Informal resolution attempt first ([30] days)
- **Binding arbitration** (AAA Consumer Rules / Commercial Rules) — individual basis
- **Class action waiver** — conspicuous, separate signature recommended
- Mass-arbitration provision (batching to prevent procedural-leverage attack)
- Carve-outs: small claims court, injunctive relief for IP
- Opt-out window (30 days from acceptance) — increasingly required post-Epic v. Apple
- Severability if arbitration unenforceable in user's jurisdiction (EU / UK consumer disputes go to court)

### 15. Governing law + venue
- Governing law: <State / country>
- Exclusive jurisdiction venue: <court / city>
- UN CISG excluded
- Carve-out: user's mandatory consumer protections in own jurisdiction

### 16. Modifications + versioning
- We can modify ToS
- Material changes: [30] days notice via email + in-app + posted version
- Continued use = acceptance
- Material change re-acceptance: re-click required for major shifts (price, scope, arbitration)
- Version history archived at <URL>

### 17. General
- Entire agreement (this + Privacy Policy + DPA + applicable Order Form)
- Severability
- No waiver
- Assignment: user can't, we can (to affiliate or acquirer)
- Notice procedure (email + in-app for us; email or written to <address> for legal notice to us)
- Force majeure
- No third-party beneficiaries
- Independent contractors (no agency / partnership / joint venture)
- Survival: Sections [list]

### 18. Contact
- Legal notices: <address>
- General contact: <email>
- DMCA agent: <email>
- Privacy: <email> (or per Privacy Policy)

## Click-wrap evidentiary record
Store per acceptance:
- User ID
- ToS version + hash
- Privacy Policy version + hash
- Timestamp (UTC)
- IP address
- User agent
- Acceptance event ID (signup / re-acceptance on material change)

Retention: lifetime of account + statute of limitations after termination (typically 6 yr US, varies).

## Versioning + change-control procedure
- Version numbers (semantic: major.minor)
- Major = material change → 30-day notice + re-acceptance flow
- Minor = clarification / typo → notice only, no re-acceptance
- Changelog public + linked from ToS
- Lawyer review for any major version

## Variant addenda

### SaaS B2C add
- Auto-renewal box (CA conspicuous)
- Cancel-anytime mechanism + UI link
- 14-day EU withdrawal (or digital-content waiver)
- Refund policy
- Subscription change effective date

### Consumer game / IAP add
- Virtual currency: no real-world value, non-refundable, non-transferable
- IAP terms + parental controls
- Account suspension = loss of virtual goods (state up front)
- Lootbox disclosure (BE / NL / DE legal landmines)
- Age gate + parental consent for U13
- China age limits + playtime caps if shipping CN

### Marketplace add
- Two ToS sets: Buyer / Seller
- Platform is not a party to buyer-seller transaction (or is, if escrow — pick model)
- Fees + payout schedule
- KYC / tax docs (1099-K, DAC7 for EU)
- Prohibited items list (firearms, drugs, NSFW, IP-infringing, etc.)
- Dispute resolution between buyer-seller
- Section 230 protection language (US) — careful with EU DSA

### Fintech add
- Bank partner agreement reference (cardholder / depositor agreement)
- Reg E (electronic fund transfers) + Reg Z (TILA) disclosures
- Dispute window (60 days under Reg E)
- Fraud liability (zero / limited / unlimited per Reg E timing)
- ID verification (KYC / BSA / AML)
- Sanctions screening (OFAC)
- E-sign consent (ESIGN Act + UETA)

### API-as-product add
- API key revocation discretion
- Rate limits + fair use
- Deprecation policy + sunset notice ([12] months for breaking changes)
- Downstream user flowdown ("you ensure your end users accept terms consistent with these")
- Data usage / training rights
- Service tier separation (free / paid / enterprise)

### Scraper / data-tool add
- Lawful use only
- Prohibited targets: PII without basis, GDPR special categories, content behind auth, sites with explicit no-scrape ToS (hiQ v. LinkedIn unsettled CFAA but state-law claims survive)
- robots.txt respect (recommended, not mandatory)
- No circumvention of access controls (DMCA §1201 / CFAA)
- Indemnification heavy (user indemnifies us for their scraping)

## Anti-patterns
- ❌ Browse-wrap (footer link only) — unenforceable
- ❌ ToS hidden behind PDF download
- ❌ Class-action waiver without conspicuous formatting
- ❌ ALL CAPS warranty/liability sections written in normal case
- ❌ Auto-renewal without CA-conspicuous disclosure → state AG enforcement
- ❌ No DMCA designated agent registered for UGC product
- ❌ No age gate → COPPA $50k/violation
- ❌ Material change without re-acceptance flow
- ❌ One-sided indemnification with no carve-outs
- ❌ Mandatory arbitration without opt-out (jurisdiction-dependent unenforceability)
- ❌ Conflicting clauses across ToS / Privacy / DPA / EULA
- ❌ Drafted by founder without lawyer review pre-launch

## Pre-launch checklist
- [ ] Variant picked + variant-specific clauses included
- [ ] Click-wrap wired into signup (web + mobile + partner embeds)
- [ ] Evidentiary record stored per acceptance
- [ ] ALL CAPS warranty + liability sections
- [ ] Class-action waiver + opt-out window (if arbitration)
- [ ] DMCA agent registered (if UGC)
- [ ] Auto-renewal box (if subscription + CA users)
- [ ] Age gate enforced (if consumer)
- [ ] Jurisdiction-mandatory clauses included
- [ ] Versioning + changelog page live
- [ ] Privacy Policy + DPA + EULA cross-referenced
- [ ] Lawyer reviewed pre-launch (not optional)

## Anti-patterns flagged
- ❌ Browse-wrap reliance
- ❌ No evidentiary record
- ❌ No lawyer review
- ❌ Missing CA auto-renewal disclosure
- ❌ No DMCA agent
- ❌ Class-action waiver buried
- ❌ Age gate missing

## Next
- Privacy Policy → `/privacy-policy-pre`
- EULA → `/eula-pre`
- DPA → `/dpa-template`
- AUP detail → `/aup-design`
- Jurisdiction pick → `/jurisdiction-pick`
- DMCA process → `/dmca-process`
```

## Verification
- Variant picked + variant-specific clauses present.
- Click-wrap wiring documented + evidentiary record fields enumerated.
- Liability + warranty in ALL CAPS.
- Class-action waiver + arbitration + opt-out window.
- DMCA agent (if UGC).
- Age gate + COPPA + state-minor laws.
- Auto-renewal disclosure (if CA + subscription).
- Jurisdiction-mandatory clauses checked.
- Versioning + re-acceptance procedure.
- Lawyer review flagged pre-launch.
