---
name: msa-template
description: Master Services Agreement template — services + SOW pattern, payment terms, IP ownership, warranties + liability cap, indemnification, termination + survival, governing law. Outputs to `docs/inception/msa-template-<project>.md`. Use when user says "MSA", "master services agreement", "services contract", "consulting agreement", "/msa-template", or before first paying customer or contractor engagement.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /msa-template — MSA Is Scaffolding. SOW Is The Work. Get Cap, IP, And Termination Right.

## Why you'd care

Operating without an MSA + SOW pattern means every services deal is a custom contract negotiation that takes weeks, and the IP/liability clauses drift. The template makes deals close at speed and on consistent terms.

MSA ≠ one-shot contract. MSA = umbrella governing all engagements, with per-engagement SOW for scope + price + timeline. Wrong defaults locked in MSA = every SOW inherits them. Set liability cap, IP allocation, termination, payment terms, and warranty disclaimers in the baseline, redline once, sign many.

## Pre-flight
Run before first paying customer / first vendor engagement / first contractor hire. Pairs with `/dpa-template`, `/ip-assignment-agreement`, `/nda-template`, `/contractor-vs-employee-decision`.

## Inputs
- Direction (we provide services / we receive services).
- Customer type (enterprise / SMB / consumer — consumer rarely uses MSA).
- Scope type (one-time project / ongoing retainer / hybrid).
- Regulated data (PHI / PCI / EU PII → DPA required as exhibit).
- Counterparty leverage (Fortune 500 demands their paper / startup uses yours).

## Process
1. **Decide direction** — provider MSA template vs customer MSA template (different defaults).
2. **MSA + SOW pattern** — MSA governs ongoing terms, SOW per engagement.
3. **Payment terms** — net-X, late fees, deposit, milestone vs subscription.
4. **IP allocation** — deliverables, pre-existing IP, residual rights.
5. **Warranty + liability cap** — capped at fees paid, super-cap exceptions.
6. **Indemnification** — IP infringement mutual + carve-outs.
7. **Termination + survival** — convenience vs cause, wind-down obligations.
8. **Boilerplate** — governing law, force majeure, assignment.
9. **Per-deal SOW template** — scope, price, timeline, acceptance criteria.

## Output
Write `docs/inception/msa-template-<project>.md`:

```markdown
# MSA Template — <project>
**Owner:** founder / counsel
**Date:** <YYYY-MM-DD>
**Direction:** provider (we deliver services) / customer (we receive services) / both
**Counsel review:** <date + firm>
**Version:** 1.0

## Why MSA + SOW pattern
- MSA signed once → SOWs signed many (low friction per engagement)
- MSA holds long-tail terms (IP / liability / law) — high-stakes negotiation
- SOW holds deal terms (scope / price / timeline) — fast turnaround
- Versioned: MSA v1.0 + SOW #1 / SOW #2 / ...

## Document structure

### Master Services Agreement (this doc)
- Parties + recitals
- Definitions
- Services framework (governed by SOWs)
- Payment terms
- IP ownership
- Confidentiality
- Warranties + disclaimers
- Liability cap
- Indemnification
- Term + termination
- Boilerplate

### Statement of Work (template — one per engagement)
- Scope of services
- Deliverables + milestones
- Timeline
- Fees + payment schedule
- Acceptance criteria
- SOW-specific overrides (if any)

### Exhibits
- Exhibit A: Pricing schedule
- Exhibit B: DPA (if data processed)
- Exhibit C: SLA (if uptime committed)
- Exhibit D: Security addendum (if regulated)

## Parties + Recitals
- Provider = <legal entity name>, <state of incorporation>, <address>
- Customer = <counterparty>
- Recital: "Provider provides [services category]. Customer wishes to procure such services. The parties agree as follows."

## Definitions
- **"Services"** — work described in any SOW
- **"Deliverables"** — output of Services
- **"Pre-existing IP"** — IP owned before this MSA / SOW
- **"Confidential Information"** — see Confidentiality
- **"Effective Date"** — date of full execution
- **"SOW"** — Statement of Work executed under this MSA

## Services framework
- Each engagement = separate SOW
- Each SOW references and incorporates this MSA
- Conflict between MSA and SOW: **SOW controls only if explicitly stated**; otherwise MSA controls
- Changes to SOW = written change order signed by both parties
- No work performed without signed SOW

## Payment terms

### Standard (provider's preferred default)
- **Fees:** as specified in SOW
- **Invoicing:** monthly in arrears for time-and-materials, milestone-based for fixed-fee
- **Payment due:** Net 30 from invoice
- **Late fee:** 1.5%/month or max permitted by law, whichever lower
- **Deposit:** 25-50% upfront for fixed-fee engagements
- **Expenses:** pre-approved expenses reimbursed at cost, no markup
- **Disputed amounts:** Customer pays undisputed portion, disputes in writing within 15 days of invoice

### Customer-favored alternatives (push back)
- Net 60-90 — counter with 2% discount for Net 15
- "Pay when paid" clause (Customer's customer pays first) — REFUSE
- Right to withhold without dispute notice — REFUSE
- Caps on hourly rate increases — accept narrow inflation-indexed cap

### Subscription / SaaS variant
- Annual prepaid or monthly
- Auto-renewal with 30-60 day notice to cancel
- Price increase capped (e.g., CPI + 5% / year) after Year 1

## IP ownership

### Pre-existing IP
- Each party retains its own
- Provider's pre-existing tools / libraries / templates remain Provider's
- License to Customer to use Pre-existing IP solely as embedded in Deliverables

### Deliverables IP (negotiation point)

**Option A — Provider keeps IP, Customer gets license (default for SaaS/product co)**
- All Deliverables remain Provider's IP
- Customer receives perpetual, non-exclusive, royalty-free license to use Deliverables for internal business purposes
- Use case: standard product / SaaS — your IP, customer leverages it

**Option B — Customer-owned (work-for-hire) (consulting / agency default)**
- All Deliverables are work-for-hire under 17 U.S.C. §101
- To the extent not work-for-hire, Provider assigns all rights to Customer upon full payment
- Provider retains license to Pre-existing IP and Residual Knowledge
- Use case: bespoke consulting, content creation, custom dev

**Option C — Joint ownership (RARELY recommended — causes disputes)**
- Each party owns 50% of Deliverables
- Each can use without accounting to other
- Avoid unless specific reason

**Our default:** <pick A or B based on direction>

### Residual knowledge
- Provider retains general skills, know-how, ideas, methods learned during engagement
- NOT specific Customer Confidential Information
- Allows Provider to do similar work for other customers

### Open source
- Provider discloses any OSS used in Deliverables
- Provider warrants compliance with OSS licenses
- Customer accepts OSS components subject to their licenses (Exhibit lists components + licenses)

### Feedback license
- If Customer provides feedback / suggestions: perpetual royalty-free license to Provider to incorporate without obligation

## Confidentiality
- Either reference standalone NDA (see `/nda-template`) OR embed equivalent terms here
- Term: 5 years post-termination + indefinite for trade secrets
- Permitted use: solely to perform / receive Services

## Warranties

### Provider warranties (standard)
- Provider has authority to enter Agreement
- Services performed in professional and workmanlike manner consistent with industry standards
- Deliverables conform to specifications in SOW
- No OSS / third-party IP in Deliverables that would impose obligations beyond Customer's notice
- No knowing infringement of third-party IP

### Customer warranties
- Customer has authority
- Materials provided by Customer are owned by Customer or licensed
- Customer's use of Deliverables complies with law

### Disclaimer (provider's friend)
> "EXCEPT FOR THE EXPRESS WARRANTIES IN THIS SECTION, PROVIDER DISCLAIMS ALL OTHER WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND TITLE."

ALL CAPS by convention (conspicuousness for UCC enforceability).

## Liability cap

### Standard provider cap
> "EACH PARTY'S TOTAL LIABILITY UNDER THIS AGREEMENT IS LIMITED TO THE FEES PAID OR PAYABLE BY CUSTOMER TO PROVIDER UNDER THE APPLICABLE SOW IN THE 12 MONTHS PRECEDING THE CLAIM."

### Super-cap exceptions (uncapped or higher cap)
- Breach of confidentiality
- IP indemnification obligations
- Gross negligence / willful misconduct
- Fraud
- Death / personal injury / property damage (where applicable)
- Indemnification under certain sections

### Customer-demanded super-cap items (negotiate)
- Data breach (counter: cap at 2-3× standard cap, require cyber insurance)
- Regulatory fines (counter: only those caused by Provider's breach)

### Consequential damages waiver
> "NEITHER PARTY IS LIABLE FOR INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, PUNITIVE, OR EXEMPLARY DAMAGES, OR FOR LOST PROFITS / REVENUE / DATA, EVEN IF ADVISED OF THE POSSIBILITY."

Mutual + ALL CAPS.

## Indemnification

### Provider indemnifies Customer
- Third-party IP infringement claims arising from Deliverables
- Carve-outs: Customer's modification, combination with non-approved third-party tools, use outside scope

**Procedure:**
- Customer gives prompt notice (delay only bars claim to extent prejudicial)
- Provider controls defense + settlement (no admission of liability binding Customer without consent)
- Customer cooperates at Provider's expense

**Remedies (Provider's choice):**
- Procure right for Customer to continue using
- Modify Deliverable to non-infringing
- Replace with non-infringing equivalent
- Refund unamortized fees (for terminated portion)

### Customer indemnifies Provider
- Customer's content / data / materials infringing third-party rights
- Customer's misuse of Deliverables outside scope
- Customer's violation of law in use

### Mutual indemnification (data breach if shared liability)
- Each indemnifies other for its own negligence causing breach

## Term + termination

### Term
- MSA effective until terminated
- Each SOW has its own term

### Termination for convenience
- Either party with 30 days written notice (terminates MSA)
- SOW termination: per SOW terms — typically 30 days with kill fee for fixed-fee work in progress

### Termination for cause
- Material breach uncured 30 days after written notice
- Insolvency / bankruptcy / assignment for benefit of creditors (immediate)
- Repeated breach (3+ events) without cure

### Effects of termination
- Customer pays for Services performed through termination date
- Customer pays for non-cancellable third-party costs Provider committed to
- Provider delivers Work in Progress
- Each party returns or destroys other's Confidential Information

### Wind-down period (for ongoing services)
- 30-90 day transition period at then-current rates
- Knowledge transfer to Customer or successor

### Survival
Following sections survive termination:
- IP ownership (perpetual)
- Confidentiality (per term)
- Warranty disclaimers
- Liability cap
- Indemnification (for pre-termination claims)
- Governing law + dispute resolution
- Boilerplate

## Boilerplate

### Governing law + venue
- State law of <state> (provider's home state)
- Exclusive venue in <county>, <state>
- Waiver of jury trial
- Federal courts also available for DTSA / federal claims

### Dispute resolution
- **Pre-suit:** mandatory 30-day good-faith negotiation between executives
- **Mediation:** non-binding, before arbitration / suit (optional)
- **Arbitration vs litigation:** decide per template. Arbitration = faster, private, hard to appeal. Litigation = jury risk + public.
- **Default (provider):** AAA Commercial Rules, single arbitrator, seat in <city>
- **Class action waiver** (US): "Disputes resolved on individual basis"
- **Carve-outs for injunctive relief:** either party may seek injunctive relief in court for confidentiality / IP

### Force majeure
- Standard list: acts of god / war / terrorism / pandemic / government action / utility failure
- Excused performance for duration
- Termination right if force majeure > 90 days
- NOT excuses: financial inability, Provider's own subcontractor failure (unless force majeure on subcontractor)

### Assignment
- No assignment without other party's consent
- Exception: assignment to acquirer / successor in merger or sale of substantially all assets (notice required)

### Independent contractor relationship
- Not partnership / joint venture / employer-employee
- Provider's employees are not Customer's employees (workers' comp, taxes, benefits = Provider's responsibility)

### Subcontractors
- Provider may use subcontractors with Customer notice
- Provider remains responsible for subcontractor performance
- Subcontractors bound by equivalent confidentiality / IP terms

### Insurance (per SOW or here)
- Provider maintains:
  - Commercial general liability: $1-2M per occurrence
  - Professional liability (E&O): $1-5M per claim
  - Cyber liability: $1-5M per claim (if data handled)
  - Workers' comp (if employees, jurisdiction required)
- Certificate of insurance on request

### Publicity
- Either party may use other's name / logo on customer list / marketing with consent
- Mutual approval over press releases

### Audit (enterprise customer demand)
- Once per year, with 30 days notice, during business hours
- Books + records related to Services only
- Provider's confidentiality maintained (auditor under NDA)

### Notices
- Written (email accepted)
- Effective on receipt
- Addresses per signature block

### Entire agreement
- Supersedes prior oral / written
- Amendments in writing signed by both
- Order of precedence: signed amendment > SOW (if explicit) > MSA > exhibits

### Severability
- Invalid clause severed, rest remains in force

### Counterparts + signatures
- Electronic signatures acceptable (DocuSign / HelloSign)
- Counterparts effective as original

## SOW Template (Exhibit A — fill per engagement)

```
Statement of Work #<N>
Under MSA dated <date>

Customer: <name>
Provider: <name>
SOW Effective Date: <date>

1. Scope of Services
   <describe>

2. Deliverables
   <list with descriptions>

3. Timeline / Milestones
   <table>

4. Fees
   - Fee structure: fixed-fee / time-and-materials / monthly retainer
   - Total: $<amount>
   - Payment schedule: <milestone breakdown>
   - Hourly rates (if T&M): <table>

5. Acceptance Criteria
   - Customer reviews each Deliverable within 10 business days
   - Acceptance / written rejection with specific reasons
   - Failure to respond = deemed accepted

6. Roles + Responsibilities
   - Provider: <named team / lead>
   - Customer: <named sponsor / contact>

7. SOW-Specific Terms (overriding MSA)
   <none / list>

8. Acceptance signature blocks
```

## Customer-favored vs provider-favored term tradeoffs

| Term | Provider-favored | Customer-favored |
|------|------------------|------------------|
| IP ownership | Provider owns, license to Customer | Customer owns Deliverables |
| Liability cap | 1× annual fees | 2-3× fees + uncapped data breach |
| Indemnification cap | At liability cap | Uncapped IP indemnification |
| Payment terms | Net 30 | Net 60-90 |
| Termination for convenience | Mutual, both 30 days | Customer 30 days, Provider 90 days |
| Warranty term | 90 days post-delivery | 1 year + |
| Governing law | Provider's state | Customer's state |
| Dispute forum | Arbitration | Court (Customer can use leverage of public action) |
| Insurance | $1M GL + $1M E&O | $5M + cyber + employer's |
| Audit rights | None | Annual financial + security audit |
| Subcontractors | Provider's discretion | Consent required for each |

## Common counterparty redlines (and your response)

| Their ask | Your default response |
|-----------|----------------------|
| Uncap liability for breach of contract | Counter: super-cap items only (confidentiality, IP, gross negligence) |
| Add their privacy/security addendum verbatim | Counsel review — often non-negotiable for enterprise |
| Most-favored-nation pricing | REFUSE — kills pricing flexibility |
| Source code escrow | Accept if enterprise, define release triggers narrowly |
| Right to audit | Accept once/year + 30-day notice + NDA |
| Insurance > $5M | Acceptable for enterprise; price reflects cost |
| Indemnification uncapped for IP | Accept (industry standard) |
| Class action waiver | Accept (favors provider) |
| Customer-owned IP for everything | Push back: only for bespoke deliverables, not for Provider's product/platform |
| Termination for any reason 0 day | REFUSE |
| Auto-renewal cancel only with 90 day notice | Accept with rate cap on increase |

## Red flags
- ❌ "Cost is whatever Provider charges" — needs structure
- ❌ No liability cap (catastrophic exposure)
- ❌ No IP allocation (ambiguity disaster)
- ❌ No termination clause (forever contract)
- ❌ "Customer may use Deliverables for any purpose forever" without payment requirement
- ❌ Indemnification without procedure / control of defense
- ❌ Most-favored-nation pricing
- ❌ Acceptance "in Customer's sole discretion" without reasonable standard
- ❌ Pay-when-paid (contingent payment)
- ❌ Personal guarantee from founder

## Special situations

### Customer demands their MSA
- Standard for Fortune 500 procurement
- Counsel review essential
- Negotiate: liability cap, IP carve-out for your Pre-existing IP, payment terms, jurisdiction
- Walk if: unlimited liability, full IP assignment of your product, exclusivity

### Subscription / SaaS MSA variant
- Different defaults: subscription fee, uptime SLA, auto-renewal, data ownership clarity
- See `/terms-of-service-pre` for click-through alternative

### Government / public sector
- FAR / DFARS / state procurement rules apply
- Different IP defaults (often "government purpose rights")
- Specific cybersecurity (FedRAMP / CMMC) requirements
- Often non-negotiable terms

### International (cross-border)
- Choice of law more contested
- Translations may be required
- Tax withholding obligations
- Bank wire fees + currency
- Data sovereignty (DPA addendum)

### Pro-bono / discounted work
- Same MSA, fees adjusted in SOW
- Don't disclaim warranty / indemnification just because discounted
- "Discounted Services" clause optional

## Storage + execution
- Counsel-reviewed baseline MSA in `docs/contracts/templates/`
- Signed MSAs + SOWs in `docs/contracts/executed/`
- Index spreadsheet: counterparty / MSA date / open SOWs / next renewal
- Redlines log per counterparty (see `/nda-template`)

## Pre-launch checklist
- [ ] Counsel-reviewed baseline MSA
- [ ] SOW template
- [ ] Liability cap defined (and super-cap exceptions)
- [ ] IP allocation defaults (per direction)
- [ ] Payment terms set (Net 30 / late fee)
- [ ] Indemnification + procedure
- [ ] Termination + survival clauses
- [ ] Governing law + dispute resolution
- [ ] Insurance baseline defined
- [ ] DPA exhibit ready if data handled
- [ ] SLA exhibit ready if uptime committed
- [ ] Storage + execution workflow

## Anti-patterns flagged
- ❌ No liability cap
- ❌ IP ambiguous (no clear ownership clause)
- ❌ No SOW pattern (every deal re-negotiates everything)
- ❌ No survival clause (terms expire on termination)
- ❌ No counsel review baseline
- ❌ Sign customer's MSA without redline
- ❌ Personal guarantee from founder
- ❌ Most-favored-nation pricing accepted

## Next
- NDA → `/nda-template`
- DPA → `/dpa-template`
- IP assignment → `/ip-assignment-agreement`
- ToS / privacy → `/terms-of-service-pre`, `/privacy-policy-pre`
- Insurance → `/insurance-policy-pick`
```

## Verification
- MSA + SOW pattern.
- Liability cap + super-cap exceptions.
- IP allocation (default + alternatives).
- Indemnification mutual + procedure.
- Termination + survival.
- Governing law + dispute resolution.
- Insurance baseline.
- SOW template.
- Counsel-reviewed baseline.
