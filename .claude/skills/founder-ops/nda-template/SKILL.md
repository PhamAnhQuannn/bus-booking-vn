---
name: nda-template
description: Founder / general counsel / BD lead responsibility — NDA template — mutual vs one-way decision, confidential-info definition + carve-outs, term, permitted use, residuals clause pushback, NLRB/Speak-Out-Act/Silenced-No-More compliance, redlines log. Outputs to `docs/inception/nda-template-<project>.md`. Use when user says "NDA", "non-disclosure", "confidentiality agreement", "mutual NDA", "general counsel NDA review", "BD partner NDA", "/nda-template", or before sharing material with investor/customer/partner/vendor.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /nda-template — NDA Is Trust Theater Unless Carve-outs Right. Sign Smart, Not Often.

NDA ≠ universal protection. NDA = narrow contract with specific carve-outs, term, and remedy. Wrong template signed = waived rights, leaked residuals, unenforceable injunctive relief. Decide mutual vs one-way, scope, and term per counterparty. Maintain a redlines log so you don't re-negotiate the same fights.

## Why you'd care

NDAs with residuals-clause sloppiness, broken Speak-Out-Act compliance, or missing carve-outs become evidence in court that you didn't know what you signed. A reviewed template is the price of admission to material conversations.

## Pre-flight
Run before first investor pitch / customer discovery / vendor eval / partnership talk. Pairs with `/ip-assignment-agreement`, `/msa-template`, `/dpa-template`, `/data-room-bootstrap`.

## Inputs
- Counterparty type (investor / customer / vendor / partner / employee / contractor / acquirer).
- Direction of info flow (one-way / mutual).
- Sensitivity tier (general business / trade secret / regulated data).
- Jurisdiction (state law US / UK / EU / multi-region).
- Whether you'll demand vs sign theirs (negotiation leverage).

## Process
1. **Decision tree** — mutual vs one-way per counterparty type.
2. **Define confidential info** — broad with explicit exclusions.
3. **Term** — general + trade-secret split.
4. **Permitted use** — limited to stated purpose; no derivative right.
5. **Residual clause** — push back if other side proposes (founder-hostile).
6. **Remedies** — injunctive relief + attorneys' fees.
7. **Jurisdiction-specific compliance** — NLRB, Speak Out Act, Silenced No More, EU TSD.
8. **Redlines log** — track every counter, version, signed copy.
9. **Counsel review baseline template once; per-deal redlines OK without re-review.**

## Output
Write `docs/inception/nda-template-<project>.md`:

```markdown
# NDA Template + Negotiation Playbook — <project>
**Owner:** founder / counsel
**Date:** <YYYY-MM-DD>
**Baseline counsel review:** <date + firm>
**Versions:** mutual v1.0, one-way (we disclose) v1.0, one-way (they disclose) v1.0

## When NDA is needed
- Investor pitch: usually NO — top-tier VCs refuse to sign. Founders pitch without NDA. Only sign if disclosing material non-public deal info.
- Customer discovery: usually NO for early interviews. YES if showing roadmap / source code / customer list.
- Vendor evaluation: YES — mutual default.
- Partnership talk: YES — mutual default.
- Employee / contractor: covered by PIIA, separate NDA redundant.
- Acquisition diligence: YES — robust mutual, with destruction obligation.

## When NDA is theater
- Pre-pitch general intro
- Conference small-talk
- Conversations no real info disclosed
- "We won't talk to you unless you sign" without specific info ask — walk away

## Direction decision tree

| Counterparty | Direction | Notes |
|--------------|-----------|-------|
| Top-tier VC | None | They refuse; founders pitch without |
| Angel / non-institutional | One-way (we disclose) only if material info | Many also refuse |
| Customer (early discovery) | None | Use confidentiality clause in MSA later |
| Customer (roadmap / source review) | Mutual | They share procurement info, you share roadmap |
| Vendor (you're evaluating) | Mutual | Each shares architecture / pricing / customer list |
| Partner (co-marketing / integration) | Mutual | |
| Acquirer (early talks) | Mutual | + destruction obligation |
| Acquirer (full diligence) | Mutual + standstill | Standstill stops them from going hostile |
| Employee | None (PIIA covers) | |
| Contractor | None (PIIA covers) | |
| Advisor | None (PIIA covers) | |
| Subprocessor (handles customer data) | Covered by DPA | |

## Template structure

### Recitals
- Brief context: "Parties anticipate exchanging confidential information in connection with [Purpose: e.g., 'evaluating a potential commercial relationship']"
- Purpose narrowly defined — drives "permitted use"

### Definition of Confidential Information
**Broadly written:**
> "Confidential Information means any non-public information disclosed by one Party (Discloser) to the other (Recipient), whether oral, written, electronic, or in any other form, that is identified as confidential at the time of disclosure or that a reasonable person would understand to be confidential given its nature and the circumstances of disclosure."

**Exclusions (must include):**
- Information publicly available through no breach of this Agreement
- Information already known to Recipient prior to disclosure (with written evidence)
- Information independently developed by Recipient without use of Confidential Information
- Information lawfully received from a third party without confidentiality obligation
- Information required to be disclosed by law / court order (with notice to Discloser + opportunity to seek protective order)

**Optional marking requirement:** weak protection; default to "reasonable person" test. Marking-required clauses fail in practice — info gets disclosed orally and never marked.

### Permitted Use
- Limited to the stated Purpose only
- No reverse engineering / no derivative works / no re-distribution
- Disclosure within Recipient limited to employees / contractors with need-to-know + bound by equivalent obligations

### Term
| Type | Term |
|------|------|
| General confidential info | 3-5 years from disclosure (3 standard, 5 if sensitive) |
| Trade secrets | Indefinite — "for so long as the information qualifies as a trade secret under applicable law" |
| Term of confidentiality vs term of agreement | Often differ — agreement may end but confidentiality survives |

### Return / Destruction
- Upon written request or termination, Recipient returns or destroys Confidential Information
- Recipient certifies destruction in writing if requested
- Carve-out: backup copies + legal hold (acceptable, but still subject to obligations)

### No License
- "Nothing in this Agreement grants Recipient any license, ownership, or other right in the Confidential Information except the limited right to use for the Purpose."
- Critical — without this, "use" can morph into license claim

### Residuals Clause (PUSH BACK)
**Other side's proposal often looks like:**
> "Recipient may use any Residuals — information retained in unaided memory of Recipient's employees — for any purpose without restriction."

**Why founder-hostile:** anyone who saw your pitch can claim to have memorized it → free to use.

**Counter:**
- Strike entirely (preferred), OR
- Narrow: "Residuals" = general skills + experience, NOT specific Confidential Information
- Cap: limited to employees who didn't have material access

### Injunctive Relief
- Acknowledge that breach causes irreparable harm not adequately compensable by damages
- Discloser entitled to seek injunctive relief without posting bond
- In addition to other remedies (not in lieu of)

### Attorneys' Fees
- Prevailing party in enforcement action recovers reasonable attorneys' fees
- Two-edged — but absence favors deeper-pocketed party

### Governing Law + Venue
- Default to your home jurisdiction
- Trade secret claims: federal Defend Trade Secrets Act (DTSA) 2016 allows federal court access regardless of state
- Specify exclusive venue + waive jury trial (jury waiver may be unenforceable in some states — counsel check)

### Non-solicitation (optional, often pushed)
- 12-month no-solicit of named employees from disclosing party
- Excludes general job postings + unsolicited applications
- Often dropped in mutual NDAs at counterparty request — acceptable

### Standstill (acquisition-only)
- Recipient (potential acquirer) agrees not to:
  - Acquire equity in Discloser
  - Make tender offer / proxy contest
  - Solicit Board changes
- Term: 12-24 months
- Critical in M&A diligence — without it, hostile bidder can use info

### No Hire
- Distinct from non-solicit — bars hiring even if employee comes unsolicited
- Aggressive — usually struck

### Compelled Disclosure
- If Recipient legally compelled to disclose: prompt written notice to Discloser, cooperation in seeking protective order, disclose only required minimum

### Whistleblower Carve-out (Speak Out Act + Silenced No More Act compliance)
**MANDATORY IN US:**
> "Nothing in this Agreement prohibits Recipient from:
> - Reporting possible violations of federal, state, or local law to government agencies (SEC, EEOC, DOL, NLRB, etc.)
> - Receiving whistleblower awards
> - Disclosing information about workplace sexual harassment or sexual assault (Speak Out Act 2022)
> - Disclosing information about unlawful workplace conduct under state law (e.g., California Silenced No More Act SB 331, NJ, WA, IL similar)
> - Defend Trade Secrets Act immunity: disclosure to attorney or court under seal for retaliation claim"

**Without this:** NDA risks unenforceability + statutory penalties.

### NLRB Compliance (2023 McLaren Macomb)
- NDAs with employees / former employees can NOT broadly prohibit discussion of working conditions, wages, terms of employment
- Confidentiality must be narrowly tailored to legitimate business info
- Severance NDAs with broad non-disparagement = unlawful per NLRB

### EU Trade Secret Directive (2016/943)
- EU NDA must define "trade secret" per Directive: not generally known + commercial value from secrecy + subject to reasonable steps to keep secret
- Whistleblower exception broader than US

## Counterparty-type templates

### Investor NDA (rare — only if material non-public info)
- One-way (you disclose)
- Term 2 years (investors push short)
- No standstill
- No non-solicit (investors refuse)
- Define Purpose narrowly: "evaluating potential investment"

### Customer NDA (roadmap / source review)
- Mutual
- Term 3 years general + indefinite trade secret
- Carve-out: customer may share with their employees/contractors with need-to-know
- Limit: no use to develop competing product

### Vendor NDA (evaluating their product)
- Mutual
- Term 3 years
- Include their pricing + your architecture as Confidential
- No use to develop competing offering on either side

### Partner NDA (integration / co-market)
- Mutual
- Term 5 years (longer because partnerships have longer tails)
- + roadmap-sharing carve-outs

### Acquisition NDA
- Mutual + robust
- Standstill 12-18 months
- Non-solicit + no-hire 12 months
- Destruction obligation with certification
- Term 5 years general + indefinite trade secret
- Counsel-reviewed every time

### Bilateral subprocessor info (covered by DPA, not standalone NDA)

## Redlines log
Track every counter to your baseline so you don't re-fight the same battles.

| Date | Counterparty | Clause | Their position | Our position | Resolution | Signed copy |
|------|--------------|--------|----------------|--------------|------------|-------------|
| 2026-Q1 | Acme Corp | Residuals | They want broad | Strike | Struck | docs/contracts/2026-Q1-acme-nda.pdf |
| ... | | | | | | |

**Patterns to extract:** if 3+ counterparties push the same redline, update baseline to reflect.

## Common counterparty redlines (and your default response)

| Their ask | Your default response |
|-----------|----------------------|
| Add residuals clause | Strike or narrow to "general skills/experience" |
| Shorten term to 1 year | Push to 3, accept 2 with trade-secret indefinite |
| Mutual marking requirement | Accept only if "reasonable person" backup |
| Drop injunctive relief | NO — irreparable harm language critical |
| Drop attorneys' fees | Accept (mutual benefit limited) |
| Add their governing law | Negotiate — accept neutral venue if needed |
| Cap damages | Accept caps EXCEPT for IP infringement / confidentiality breach |
| Add standstill (they're acquirer) | YES if M&A talks, NO otherwise |
| Remove whistleblower carve-out | NO — legally required, non-negotiable |
| Add non-disparagement | Accept narrow business-related only, NLRB compliance |
| Indefinite term | Accept for trade secrets only |
| No-hire (not just no-solicit) | Strike — too broad |
| Jury trial waiver | Accept if counsel approves jurisdiction |

## Process: from request to signed
1. **Vendor sends NDA** → counsel-reviewed baseline check
2. **First-pass redline** against your standard markup
3. **Negotiation log** opened (date, redlines, who)
4. **Signed copy** stored in contract repo
5. **Calendar reminder** for term expiration
6. **Tracker** of who has signed what, for what purpose

## Storage + retention
- Signed copies in `docs/contracts/ndas/` (or DocuSign vault)
- Index spreadsheet: counterparty / date / term / purpose / current status
- Retention: keep signed copy + supporting emails for 7 years post-expiration

## Red flags to refuse
- ❌ NDA with no purpose stated → too broad
- ❌ Term 10+ years on general info → unenforceable in many jurisdictions
- ❌ "All information from Discloser is Confidential by default" → courts narrow
- ❌ No whistleblower carve-out → non-compliant
- ❌ Demands you waive trade-secret-related federal rights → DTSA immunity
- ❌ No carve-out for independently developed info
- ❌ Liquidated damages without genuine pre-estimate → unenforceable + signals litigious counterparty
- ❌ Counterparty refuses any redlines → walk

## Special situations

### When counterparty refuses to sign yours
- Use theirs if they're enterprise customer with standard procurement template
- Insist on yours if you're disclosing material trade secret
- Walk if neither side budges + info is asymmetric in your favor

### When you can't get counsel review for every deal
- Counsel reviews baseline once
- Train founder + ops to spot the 7-10 common redlines
- Escalate to counsel only when: new clause type, term > 5 years, regulated data, $10M+ deal value

### Click-through NDAs (data rooms, demo gates)
- Often unenforceable on terms but enforceable on confidentiality
- Read terms before clicking — some claim license rights you don't intend

### Verbal NDAs
- Recognized in most US states but hard to prove
- Always paper before disclosure if disclosure is material

### Post-disclosure NDA
- Asking counterparty to sign NDA AFTER you disclosed = weak position
- Use the "I'm about to disclose" framing — get signature first

## Anti-patterns
- ❌ Demanding NDA before every conversation (signals amateur)
- ❌ Using a template found online without counsel review of baseline
- ❌ Failing to track signed NDAs (no record at trial)
- ❌ Broad confidentiality with no carve-outs (unenforceable)
- ❌ Missing whistleblower language (statutory violation)
- ❌ One-size-fits-all template for all counterparty types
- ❌ Not destroying / returning info at end of relationship
- ❌ Filing NDAs in inbox / Slack — no central repo
- ❌ Forgetting term expiration → using "expired" NDA as cover

## Pre-launch checklist
- [ ] Counsel-reviewed baseline mutual NDA
- [ ] Counsel-reviewed baseline one-way NDA (we disclose)
- [ ] Whistleblower + Speak Out Act + Silenced No More carve-out
- [ ] DTSA immunity language
- [ ] Trade-secret indefinite + general 3-yr term split
- [ ] Residuals clause stripped or narrowed
- [ ] Redlines log started
- [ ] Storage location + retention rule defined
- [ ] First-disclosure rule: paper before info

## Anti-patterns flagged
- ❌ Missing whistleblower carve-out
- ❌ No expiry tracking
- ❌ Residuals clause accepted blindly
- ❌ No record of signed copies
- ❌ Pitching VCs with NDA demand
- ❌ Click-through NDA never read

## Next
- IP assignment → `/ip-assignment-agreement`
- MSA → `/msa-template`
- DPA → `/dpa-template`
- Privacy + ToS → `/privacy-policy-pre`, `/terms-of-service-pre`
- Data room → `/data-room-bootstrap`
```

## Verification
- Mutual / one-way / acquisition templates.
- Whistleblower + Speak Out Act + Silenced No More + DTSA immunity present.
- Trade-secret indefinite + general 3-5yr term split.
- Residuals clause guidance.
- Injunctive relief language.
- Redlines log structure.
- Storage + retention rule.
- Counsel-review baseline + per-deal redline workflow.
