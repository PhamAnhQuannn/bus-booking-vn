---
name: ip-assignment-agreement
description: Founder / general counsel / head of people responsibility — IP assignment agreement — pre-existing IP carve-out + ongoing assignment + work-for-hire + moral rights waiver + cooperation. Outputs to `docs/inception/ip-assignment-agreement-<project>.md`. Use when user says "IP assignment", "PIIA", "CIIAA", "invention assignment", "work for hire", "general counsel PIIA", "head of people onboarding IP", "/ip-assignment-agreement", or before first founder/employee/contractor onboarding.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /ip-assignment-agreement — Without This, You Don't Own Your Own Product. Investors Won't Fund. Acquirers Won't Buy.

The IP assignment is the document that converts every founder's, employee's, and contractor's brain-output into company property. Skip it and you discover at diligence that the CTO's pre-incorporation code is personally owned, that a contractor's design is licensed not assigned, that an ex-employer claims your codebase. Sign before anyone writes a line of code.

## Why you'd care

Without a signed PIIA, the company doesn't actually own its own code — a fact every diligence exercise discovers, expensively. Get the agreement in place before the first commit, not the day before the term sheet.

## Pre-flight
Run within 30 days of co-founder commitment. Every contractor + employee + advisor signs BEFORE first deliverable. Pairs with `/founders-agreement`, `/vesting-schedule`, `/nda-template`, `/contractor-vs-employee-decision`, `/prior-art-disclosure`.

## Inputs
- Jurisdiction (assignability of future IP varies — CA requires §2870 carve-out, EU/UK has different moral rights regimes).
- Person type (founder / employee / contractor / advisor).
- Pre-existing IP each person brings.
- Current employer obligations (does day-job employer have a claim?).
- Open source policy (permitted / prohibited / requires approval).
- Patent strategy (will company file? — see `/ip-strategy`).

## Process
1. **Pre-existing IP disclosure** — each person lists prior inventions in Schedule A (carved out OR assigned).
2. **Present assignment** — all IP created during tenure or using company resources auto-assigned.
3. **Work-for-hire designation** — copyrightable works deemed work-for-hire (US copyright term).
4. **Moral rights waiver** — where waivable; pure work-for-hire isn't enough in many jurisdictions.
5. **Cooperation clause** — sign future docs to perfect assignment (patent applications, etc.).
6. **Power of attorney** — irrevocable, for executing assignment docs if person unreachable.
7. **Statutory carve-outs** — CA §2870, IL, KS, MN, NC, UT, WA, DE — personal-time + non-company-resource + non-business-related inventions excluded.
8. **Open source clause** — declared usage + approval flow.
9. **Prior employer non-conflict** — warrant no breach of prior IP-assignment.
10. **Non-disclosure overlap** — confidentiality typically combined (PIIA = Proprietary Info + Inventions Assignment Agreement).

## Output
Write `docs/inception/ip-assignment-agreement-<project>.md`:

```markdown
# IP Assignment Agreement (PIIA) — <project>
**Date:** <YYYY-MM-DD>
**Owner:** counsel / founder
**Applies to:** all founders + employees + contractors + advisors
**Jurisdiction:** <state / country>

## Why this exists before any code is written
- Without assignment: the writer owns their work. Period.
- Founder pre-incorp code: personally owned unless assigned to co
- Contractor: default copyright stays with contractor under US law (not "work for hire" by default for non-employees)
- Acquirer diligence will demand chain of title proof — gap = killed deal OR clawback
- Investor diligence: missing PIIA = no funding
- Patent application: requires assignment from each inventor by name
- Open source: GPL/AGPL drift = poisoned codebase
- Day-job employer: may have prior claim on side-project IP

## Triggering events
| Event | PIIA required from |
|-------|---------------------|
| Co-founder formation | All founders, signed before any joint work |
| Employee hire | Every employee, day 1 (with offer letter) |
| Contractor engagement | Every contractor, before first deliverable |
| Advisor engagement | Every advisor, with advisor agreement |
| Acquisition: target person | Every transferring employee + key contractor |
| Open source PR by employee | Per OSS policy — disclosed and approved |

## Document structure

### 1. Definitions
- **"Inventions":** discoveries, developments, concepts, ideas, improvements, processes, formulas, techniques, know-how, software, designs, data, products, mask works, trademarks, copyrightable works.
- **"Company Inventions":** Inventions made during tenure that (a) relate to company business or actual/anticipated R&D, OR (b) result from work performed for company, OR (c) are made using company resources.
- **"Prior Inventions":** Inventions made before joining (listed in Schedule A).

### 2. Pre-existing IP (Schedule A — required)

Each signer lists, by description sufficient to identify:
- Each Prior Invention claimed
- Date of creation
- Whether assigned to company OR carved out
- Whether licensed to company (e.g., "previously open-sourced under MIT")

**Default:** if Schedule A is left blank, signer warrants no Prior Inventions exist.

**Risk of incomplete Schedule A:** signer may lose claim to legitimately personal IP, OR company may inherit unwanted obligations on disclosed-but-not-assigned IP.

**Recommended practice:** detailed Schedule A reviewed by counsel; ambiguous items resolved before signing.

### 3. Present assignment of Company Inventions
Signer assigns to company "all right, title, and interest worldwide in and to any and all Company Inventions and intellectual property rights therein, including patents, copyrights, trademarks, trade secrets, mask works."

**Key language:** "hereby assigns" (present-tense conveyance), NOT "agrees to assign" (future obligation — weaker, problems in Stanford v Roche 2011).

### 4. Work-for-hire designation (US)
"All copyrightable works created by Signer within the scope of employment or service relationship are deemed 'works made for hire' under 17 U.S.C. § 101."

**Backup:** if not work-for-hire by operation of law, then assigned per Section 3.

### 5. Moral rights waiver
"To the extent permitted by law, Signer waives any moral rights in Company Inventions (right of attribution, right of integrity, droit moral)."

**Note:** Some jurisdictions (France, Germany) make moral rights non-waivable. Counsel should review for international signers.

### 6. Cooperation + further assurances
"Signer will execute all documents and take all actions reasonably requested by Company to perfect, evidence, or enforce the rights assigned, including signing patent applications, copyright registrations, trademark assignments, and chain-of-title declarations, both during and after tenure."

### 7. Power of attorney (irrevocable)
"If Company is unable to obtain Signer's signature on any document required to perfect Company's rights (after reasonable attempts), Signer irrevocably appoints Company as Signer's attorney-in-fact to execute such documents."

**Critical:** "irrevocably" + "coupled with an interest" language — survives termination.

### 8. Statutory carve-outs (required in many US states)

**California Labor Code §2870 (mandatory disclosure):**
"This Agreement does not require assignment of any invention that Signer developed entirely on Signer's own time without using Company equipment, supplies, facilities, or trade secret information, except for those inventions that either (1) relate at the time of conception or reduction to practice to Company business or actual/anticipated R&D, or (2) result from work performed by Signer for Company."

**Similar required in:** Delaware, Illinois, Kansas, Minnesota, North Carolina, Utah, Washington — verify per state.

**Failure to include §2870 notice in CA = entire assignment can be voided.**

### 9. Open source policy
- Signer will not incorporate open-source code into Company product without prior written approval
- Approved OSS subject to license review (see `/licensing-audit`)
- GPL/AGPL only with explicit approval (rarely granted for proprietary product)
- Signer's personal OSS contributions: permitted; no use of Company confidential info; no company-developed code

### 10. Prior employer non-conflict
"Signer warrants: (a) entering this Agreement does not breach any prior employer's IP assignment, confidentiality, or non-compete obligations; (b) Signer has disclosed any prior employer agreements; (c) Signer will not use or disclose any prior employer's confidential info or trade secrets in Company work."

**Founder action:** request written release from current employer if employer has broad IP-assignment clause + side-project work overlaps company business.

### 11. Confidentiality (often combined as PIIA)
- Signer agrees to maintain Company confidential information in confidence
- Indefinite obligation for trade secrets
- 3-5 year obligation for general confidential info post-termination
- Carve-outs: publicly available, independently developed, lawfully disclosed (subpoena with notice)
- Return + destroy all Company materials on termination

### 12. Non-solicit (often combined)
- 12-month post-termination
- No solicitation of employees + customers + investors
- Generally enforceable

### 13. Remedies
- Injunctive relief: irreparable harm doctrine (no monetary damages adequate)
- Specific performance: signer can be compelled to sign assignment docs
- Liquidated damages: rare; jurisdiction-dependent
- Attorneys' fees: to prevailing party

### 14. Survival
- Sections survive termination: pre-existing IP / present assignment / work-for-hire / moral rights waiver / cooperation / POA / confidentiality / non-solicit / remedies / governing law

## Schedule A: Pre-existing IP disclosure (per signer)

| # | Title / description | Date created | Status |
|---|---------------------|--------------|--------|
| 1 | <e.g., "Personal blog at example.com, MIT-licensed code only"> | <date> | Carved out |
| 2 | <e.g., "Sketch for <project>, drafted while founder pre-incorp"> | <date> | Assigned to Company |
| 3 | <e.g., "Side project unrelated to Company business"> | <date> | Carved out |

**If no Prior Inventions:** Signer initials "None claimed."

## Schedule B: Open source pre-approved list
Track open-source dependencies approved for use:
| Library | License | Use case | Approved by | Date |
|---------|---------|----------|-------------|------|
| <name> | <MIT / Apache 2.0 / etc.> | <use> | <person> | <date> |

## Person-type variations

### Founder PIIA
- Signed concurrent with `/founders-agreement` + `/vesting-schedule`
- Pre-existing IP carve-outs heavily scrutinized (potential dispute later)
- Strongest cooperation + POA terms
- Spouse signature in community property states (see `/founders-agreement`)

### Employee PIIA
- Signed as part of offer letter / day-1 paperwork
- Standard terms; less negotiation
- §2870 carve-out included where required
- Combined with offer letter + employee handbook acknowledgment

### Contractor PIIA
- **Distinct from employee:** US copyright defaults to creator, NOT hirer
- Explicit assignment essential (work-for-hire alone may not apply)
- "All deliverables and work product" assigned
- Distinct from MSA — IP terms either in MSA or separate PIIA
- See `/contractor-vs-employee-decision` for classification

### Advisor PIIA
- Lighter scope: limited to work done in advisory capacity
- Confidentiality emphasis
- Carve-outs for other advisory roles / portfolio companies

### Acquihire / acquisition
- Diligence step: confirm every transferring person has signed PIIA
- New PIIA with acquirer if employment continues
- Acquirer may require representations + warranties on chain of title

## Signing logistics
- DocuSign / similar e-sign with KBA
- Spouse signature where required (community property)
- Original PDF in data room (see `/data-room-bootstrap`)
- Retention: indefinite (chain of title evidence)
- Counterparts permitted

## Cap-table tool integration
- Track PIIA signing status per person in HR tool / cap-table tool
- Block grant issuance OR onboarding completion until PIIA signed
- Re-execute if material change (role change with new IP responsibilities)

## Special situations

### Founder used current employer's resources
- Likely contaminated. Resolve before formation:
  - Written release from employer
  - Document clean-room rewrite
  - Counsel-led analysis of overlap
- Worst case: employer holds claim on company IP

### Open-source contribution by employee on company time
- Per OSS policy: requires approval
- No company confidential info disclosed
- Contribution stays in OSS repo; no carved-out claim by employee

### Patent invented by employee
- Cooperation clause + POA enable filing without employee dispute
- Employee credited as inventor; company is assignee
- Bonus or stipend for patent filings common (not required)

### Employee leaves with side-project from before joining
- Schedule A carve-out + §2870 protection = side-project remains personal
- If side-project relates to company business → potential dispute
- Resolve at hire with explicit Schedule A entry

### Contractor's pre-existing tools / libraries used in deliverable
- Contractor licenses (not assigns) pre-existing tools to company
- Specify license scope: perpetual, royalty-free, sublicensable
- Distinct line in MSA / SOW

## Anti-patterns
- ❌ Founder signs nothing — investor diligence kills funding
- ❌ Contractor without PIIA — copyright stays with contractor
- ❌ "Agrees to assign" instead of "hereby assigns" (Stanford v Roche)
- ❌ Schedule A blank without "None claimed" — ambiguity later
- ❌ CA without §2870 notice — entire agreement void
- ❌ No POA — assignment fails if signer becomes uncooperative
- ❌ Open-source policy verbal — GPL drift contaminates codebase
- ❌ Day-job employer's IP-assignment unaddressed — prior claim risk
- ❌ Acquihire without per-person PIIA verification — diligence break
- ❌ Moral rights silent — issue in EU
- ❌ PIIA signed after first deliverable — gap in chain of title

## Pre-launch checklist
- [ ] Counsel-reviewed PIIA template
- [ ] §2870 (or state equivalent) notice included
- [ ] "Hereby assigns" present-tense language
- [ ] Work-for-hire designation
- [ ] Moral rights waiver (where applicable)
- [ ] Cooperation + POA clauses
- [ ] Open-source policy
- [ ] Prior employer non-conflict warranty
- [ ] Confidentiality + non-solicit incorporated (PIIA combined)
- [ ] Schedule A reviewed per signer
- [ ] Spouse signature in community property states
- [ ] Storage: data room + per-person HR file

## Anti-patterns flagged
- ❌ Sign nothing
- ❌ "Agrees to assign" weak language
- ❌ Missing §2870
- ❌ No POA
- ❌ OSS uncontrolled
- ❌ Prior employer unresolved

## Annual review
- New jurisdictions added? Add carve-outs.
- New person-types? Update templates.
- Open-source pre-approved list refresh
- Counsel re-review on material change

## Next
- Founders agreement → `/founders-agreement`
- Vesting → `/vesting-schedule`
- Contractor vs employee classification → `/contractor-vs-employee-decision`
- NDA template → `/nda-template`
- Prior art disclosure (founder-specific) → `/prior-art-disclosure`
- Licensing audit (OSS) → `/licensing-audit`
- IP strategy (patents / trademarks) → `/ip-strategy`
```

## Verification
- "Hereby assigns" present-tense language.
- §2870 (or state equivalent) notice included where required.
- Work-for-hire designation.
- Moral rights waiver.
- Cooperation + irrevocable POA.
- Schedule A per signer (Prior Inventions disclosed or "None claimed").
- Open source policy declared.
- Prior employer non-conflict warranty.
- Spouse signature in community property states.
- Counsel reviewed.
- Storage in data room + HR file.
