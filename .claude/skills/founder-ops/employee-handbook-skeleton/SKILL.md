---
name: employee-handbook-skeleton
description: Founder / head of people / general counsel responsibility — pre-launch employee handbook skeleton — jurisdiction cover sheet, at-will / equivalent, EEO + harassment, comp + PTO + parental + sick + bereavement, working hours + remote, IP + confidentiality + COI, mental health, termination + severance + arbitration, acknowledgment, change-log, jurisdiction carve-outs (CA/NY/WA/TX/UK/DE/FR/SG). Outputs to `docs/inception/employee-handbook-skeleton-<project>.md`. Use when user says "employee handbook", "handbook", "policies doc", "people doc", "head of people handbook", "HR policies", "general counsel handbook review", "/employee-handbook-skeleton", or before first hire.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /employee-handbook-skeleton — Handbook = Contract + Culture + Compliance. One Doc, Read Before Sign, Updated Quarterly.

Handbook ≠ HR busywork. Handbook = the single source of truth for "how we work, what we promise you, what's required of you, what happens if X". Required reading before signing offer. Acknowledged at hire. Updated quarterly. Jurisdiction-aware or you have a lawsuit waiting.

## Why you'd care

A handbook copied from a US template and used in California is a wage-and-hour lawsuit waiting to happen. A skeleton with jurisdiction carve-outs is the document that survives multi-state and multi-country hiring.

## Pre-flight
Run before hire #1 OR before founder + co-founder sign anything resembling employment. Pairs with `/first-hire-plan`, `/contractor-vs-employee-decision`, `/equity-comp-philosophy`, `/vacation-policy-pre`, `/on-call-philosophy-pre`, `/mental-health-plan`, `/code-of-conduct`, `/values-charter`, `/async-comms-charter`, `/founders-agreement`, `/ip-assignment-agreement`, `/nda-template`, `/burnout-early-warning`.

## Inputs
- Primary jurisdiction(s) of incorporation + employment (US-DE / US-CA / UK / DE / FR / SG / remote-global).
- Team composition (W-2 / 1099 / EOR / B2B contractor split).
- Existing policy fragments (vacation, code of conduct, async charter, values, on-call).
- Industry-specific overlays (fintech / healthtech / EdTech / defense / scraper).
- Insurance + benefits already procured.
- Legal counsel engaged (yes/no/which jurisdiction).

## Process
1. **Pick jurisdiction template** — US-multistate / UK / EU / SG / remote-global. Default = US-DE with state carve-outs.
2. **Confirm at-will statement** (US) or equivalent fixed-term/notice clause (EU/UK/SG).
3. **Stitch in existing policies** — vacation / on-call / mental-health / async / values / code-of-conduct linked, not duplicated.
4. **Draft EEO + anti-harassment + reporting** — non-negotiable, every jurisdiction.
5. **IP + confidentiality + COI + social media** — protects co + employee.
6. **Termination + severance + arbitration + reference policy** — write before need.
7. **Jurisdiction carve-outs** — CA/NY/WA/MA/IL/CO + UK/DE/FR/IE/NL/SG state-by-state addenda.
8. **Acknowledgment page** — signed at offer + at every material update.
9. **Change-log** — every edit dated + version-bumped.
10. **Legal review** — employment lawyer signs off jurisdiction(s) before hire #1.

## Output
Write `docs/inception/employee-handbook-skeleton-<project>.md`:

```markdown
# Employee Handbook — <project>
**Owner:** founder / Head of People
**Date:** <YYYY-MM-DD>
**Version:** 1.0
**Effective:** <YYYY-MM-DD>
**Primary jurisdiction(s):** <US-DE + US-CA / UK / DE / remote-global etc>
**Legal review by:** <firm/counsel name + date> | **NOT REVIEWED — DO NOT DISTRIBUTE**

---

## 0. Cover sheet + scope
This handbook applies to all W-2 employees of <co legal name> in <jurisdiction>. Contractors / EOR-employed staff governed by their respective agreements; selected policies (code of conduct, IP for work product, confidentiality, security) extend to all workers.

This handbook is **not** an employment contract and (in at-will jurisdictions) does **not** alter the at-will nature of employment. Policies may be updated; material changes acknowledged separately.

**Reading order:** (1) cover + at-will → (2) values + code of conduct → (3) comp + benefits + PTO → (4) workplace rules + IP + confidentiality → (5) termination + arbitration → (6) acknowledgment page.

---

## 1. Welcome + company
- Mission: <link to `/vision-positioning-statement`>
- Values: <link to `/values-charter`>
- How we work: <link to `/async-comms-charter` + `/documentation-culture-charter`>
- Code of conduct: <link to `/code-of-conduct`>

---

## 2. Employment basics

### 2.1 At-will employment (US jurisdictions)
Employment is at-will. Either party may terminate at any time, with or without cause or notice, subject to applicable law. No statement in this handbook creates a contract of employment or a guarantee of continued employment. Only a written agreement signed by the founder/CEO can modify at-will status.

**Non-US carve-outs:**
- **UK:** statutory notice (1 week after 1 month, then 1 week per year up to 12 weeks); unfair dismissal protection after 2 yr service.
- **DE:** Kündigungsschutzgesetz applies > 6 mo + 10 employees; statutory notice 4 weeks to 15th/end of month, scaling with tenure.
- **FR:** CDI default; cause required for termination; 1-3 mo notice scaling with role.
- **IE:** Unfair Dismissals Act after 12 mo service; statutory notice 1 wk - 8 wk.
- **SG:** notice per contract (typically 1 mo); no unfair-dismissal regime equivalent to UK.

### 2.2 Probation period
- **US:** introductory period of 90 days. Does not alter at-will status.
- **UK/EU:** probation 3-6 months per local norm; shortened notice applies during probation.

### 2.3 Classification
- W-2 / employee vs 1099 / contractor: governed by `/contractor-vs-employee-decision`.
- Exempt vs non-exempt (US FLSA): exempt = salaried + qualifies under executive/admin/professional/computer test. Non-exempt = hourly + overtime per FLSA + state law.

### 2.4 Equal employment opportunity (EEO)
<co> is an equal opportunity employer. We do not discriminate on the basis of race, color, religion, national origin, sex (including pregnancy, sexual orientation, gender identity, gender expression), age (40+), disability, genetic information, veteran status, marital status, or any other protected status under federal, state, or local law.

This applies to every employment decision: hiring, promotion, compensation, benefits, training, discipline, termination.

### 2.5 Anti-harassment + anti-retaliation
Zero tolerance for:
- Sexual harassment (quid pro quo + hostile environment)
- Harassment based on any protected class
- Bullying / intimidation / threats
- Retaliation against anyone who reports or participates in an investigation

**Reporting channels (multiple — pick any):**
1. Direct manager
2. Founder / CEO
3. People lead (when hired)
4. Anonymous channel: <Lighthouse / EthicsPoint / dedicated email / Slack-DM-to-board>
5. Outside counsel (for founder-involved complaints): <firm + email>

**Investigation:** acknowledged within 24 hr, investigated within 30 days, outcome communicated to reporter. No retaliation, ever. Confidential to extent possible.

**Mandatory training:** anti-harassment training within first 30 days; annual refresher. CA/NY/IL/CT statutory training schedules followed per jurisdiction.

### 2.6 Accommodations
- Reasonable accommodation for disability (ADA + state equivalents): contact People lead, interactive process within 5 business days.
- Religious accommodation: same process.
- Pregnancy / lactation: PWFA + PUMP Act compliant; private space + break time provided.

---

## 3. Compensation + benefits

### 3.1 Compensation philosophy
Summary of `/equity-comp-philosophy` + first-hire comp framework (cash + equity + bonus posture).
- Pay bands: <link to internal doc or "available on request from People lead">
- Review cycle: annual + on promotion
- Refresh grants: per `/equity-comp-philosophy`
- Geographic differential: <yes/no, methodology>

### 3.2 Pay schedule
- Frequency: <biweekly / semi-monthly / monthly per jurisdiction norm>
- Direct deposit: required
- Pay stubs: accessible via <Gusto / Rippling / Deel / Justworks>
- Final paycheck: per state law (CA = same day on involuntary; NY = next regular cycle, etc.)

### 3.3 Benefits index
Linked details in benefits-summary doc; high-level here:
- **Health insurance** (US): medical / dental / vision; <co> pays X% employee, Y% dependents.
- **Health insurance** (non-US): per local statutory + supplemental.
- **Retirement** (US): 401(k) with <match policy> | **non-US:** statutory pension + supplemental.
- **Life + AD&D + LTD/STD:** company-paid baseline.
- **HSA / FSA:** offered where applicable.
- **Mental health benefit:** EAP + telehealth + stipend per `/mental-health-plan`.
- **Parental leave:** per `/vacation-policy-pre` parental section.
- **Stipends:**
  - Home office: $X one-time + $Y/yr refresh
  - Wellness / gym: $Z/mo
  - Learning / books / conferences: $W/yr
  - Coworking: $V/mo if no office in region
- **Equipment:** company-provided laptop + accessories; return at exit.
- **Phone / internet:** $X/mo stipend if remote.
- **Commuter benefit** (US): pre-tax transit + parking where applicable.

### 3.4 Equity
See `/equity-comp-philosophy`. Highlights:
- Grant on offer; board approval within 30 days; 409A FMV strike (options).
- Standard vesting: 4 yr / 1 yr cliff.
- Early exercise + 83(b) discussion at grant (US).
- Post-termination exercise window: <90 days / extended X yr per philosophy>.
- Annual value statement issued by People lead.

---

## 4. Time off

### 4.1 Annual leave / PTO
Per `/vacation-policy-pre`. Highlights:
- 25 days/yr; **minimum take 15 days**.
- Up to 5 days carryover; expires Q1.
- Request via <HR tool> with 2 wk notice for > 3 days.
- Manager flags any report tracking < 10 days by Q3.

### 4.2 Public holidays
- <Country>-default holidays observed (list).
- 3 flex holidays — employee picks (religious / cultural / personal).
- Holiday on weekend → next working day off.

### 4.3 Sick leave
- 10 days/yr; no doctor's note for first 3 consecutive.
- Mental health = sick days (same policy, no stigma).
- Beyond 10 → short-term disability conversation.

### 4.4 Parental leave
- Birth parent: 16 weeks paid (or jurisdiction floor if higher).
- Non-birth / adoptive parent: 12 weeks paid.
- Phased return: 50% schedule for 2 weeks.
- Pumping accommodation per law.

### 4.5 Bereavement
- 5 days paid for immediate family; 2 days extended/close friend; manager discretion to extend.

### 4.6 Jury / civic duty
- Paid in full; voting half-day if no early voting.

### 4.7 Personal / compassionate leave
- 5 days/yr; unpaid extension with notice.

### 4.8 Sabbatical
- 1 month paid after 4 yr tenure; 1 additional month every 4 yr thereafter.
- Min 4 wk notice; max 2 people on sabbatical at once.

### 4.9 Leaves of absence (extended)
- FMLA (US, > 50 employees within 75 mi): 12 wk unpaid job-protected.
- State paid family leave: CA PFL / NY PFL / WA PFL / NJ FLI etc. per jurisdiction.
- Disability leave: per ADA + state DI; interactive process.
- Military leave: USERRA compliant.
- Non-US: statutory + co-supplemental.

---

## 5. Working hours + remote / hybrid

### 5.1 Hours + expectations
- Async-first per `/async-comms-charter`.
- Core overlap hours: <e.g. 10am-2pm primary timezone, or none>.
- No expectation of email / Slack response outside 9-6 local.
- Weekends: no expectation.
- Time-zone fairness: meetings rotate inconvenient hours.

### 5.2 Overtime (non-exempt employees, US)
- Time-and-a-half over 40 hr/wk (federal) or 8 hr/day (CA, AK, NV).
- Approval required in advance.
- Logged via <time-tracking tool>.

### 5.3 Remote / hybrid policy
- Fully remote / hybrid / in-office: <pick>
- Equipment + stipend: see §3.3.
- Tax + work-location: notify People lead before relocating > 30 days or across state/country lines (PE + payroll-tax risk per `/contractor-vs-employee-decision`).
- Approved jurisdictions: <list — outside list requires People + Legal approval>.

### 5.4 Travel
- Business travel reimbursed per expense policy §6.
- Travel time per FLSA / local law for non-exempt.

---

## 6. Expense reimbursement
- Submit via <Expensify / Ramp / Brex> within 30 days of expense.
- Receipts required > $25.
- Approved categories: travel (coach default; business class > 6 hr flights with approval), client meals, conferences, professional development per stipend, equipment.
- Reimbursed in next pay cycle.
- Misuse = clawback + discipline.

---

## 7. Professional development
- Annual learning stipend $X (books / courses / conferences).
- 1 conference per year covered.
- Internal: weekly demo / monthly tech talk / quarterly strategy off-site.
- Manager 1:1: weekly; career conversation quarterly.

---

## 8. Performance + leveling

### 8.1 Performance review cadence
- 30/60/90 for new hires (per `/first-hire-plan`).
- Annual review + mid-year check-in.
- Continuous feedback expected — no "saved up" feedback at review.
- No stack ranking / forced curves.

### 8.2 Leveling framework
- Roles + levels: <link to leveling rubric — eng IC1-IC6, M1-M3 etc.>
- Promotion: nomination + packet + manager + skip-level + cross-functional review.
- Comp adjusts on promotion per `/equity-comp-philosophy` promotion grant grid.

### 8.3 Performance improvement plans (PIP)
- PIP = written, time-bound (typically 30-60 days), specific deliverables.
- Weekly check-ins during PIP.
- Outcome: meets expectations / extended / exit with severance.
- PIP ≠ surprise — preceded by documented feedback.

---

## 9. IP + confidentiality + conflict of interest

### 9.1 IP assignment
All work product created in the course of employment, on company time, with company resources, or related to company business = property of <co>. See `/ip-assignment-agreement` signed at hire.

**Carve-outs:** prior IP listed at hire (Schedule A); personal projects unrelated to co business + done on personal time + no co resources.

### 9.2 Confidentiality
Trade secrets, customer data, financial info, source code, roadmap, comp info (own salary OK to discuss; others' = not), and any "Confidential" / "Proprietary" marked info = confidential.

**Survives termination.** Indefinite for trade secrets; 2-3 yr for general confidential info (per jurisdiction enforceability).

**Defend Trade Secrets Act notice (US):** whistleblower immunity for disclosures to attorney/govt for reporting suspected violations of law.

### 9.3 Conflict of interest
Disclose to People lead any:
- Outside employment / consulting / advisor role
- Equity in competitor / customer / vendor
- Family member at competitor / customer / vendor
- Board seat at any company
- Significant personal relationship within reporting chain

Decision: pre-approval or recusal. Non-disclosure = grounds for discipline.

### 9.4 Non-compete + non-solicit
- **Non-compete:** **DEFAULT OFF.** FTC final rule (April 2024) bans most non-competes for US workers; CA / ND / OK / MN prohibit; many EU jurisdictions require paid garden leave. Do not include unless senior exec + legal counsel signs off + paid garden leave.
- **Non-solicit (employees + customers):** 12 mo post-termination. Narrow to actual reports / accounts. CA: void. Tailor per jurisdiction.

### 9.5 Social media + public statements
- Personal social media: your own. Don't speak for <co> without authorization.
- Press inquiries: forward to founder / PR lead.
- Public criticism of co: protected concerted activity under NLRA (US) for terms / conditions of employment; criticism of strategy / individuals = handle internally first.
- Confidential info never posted.
- Customer mentions: only with customer consent.

---

## 10. Workplace conduct + safety

### 10.1 Code of conduct
See `/code-of-conduct`. Summary:
- Respect, professionalism, no harassment, no discrimination.
- Inclusive language.
- No retaliation for reporting.

### 10.2 Drug + alcohol
- No drugs / alcohol impairing work.
- Co events with alcohol: optional attendance, non-alcoholic options always.
- Medical / prescription: confidential accommodation conversation.

### 10.3 Weapons
- No weapons in office / co events.
- State carve-outs per law (some states protect concealed-carry in parking lots).

### 10.4 Workplace violence
- Zero tolerance.
- Threats reported immediately.
- Restraining order assistance for affected employees.

### 10.5 Safety + OSHA (US)
- Report injuries within 24 hr.
- Workers' comp claim filed by People lead.
- Remote workplace safety = employee's responsibility for ergonomic setup; stipend funds furniture per §3.3.

---

## 11. Security + data

### 11.1 Acceptable use
- Co devices for co work; reasonable personal use OK.
- No co data on personal devices without MDM enrollment.
- Strong passwords + password manager (<1Password / Bitwarden>).
- 2FA required everywhere (security key preferred for admin).
- Phishing reported, not clicked.

### 11.2 Incident reporting
- Suspected breach / lost device / phishing click → security lead within 1 hr.
- See `/incident-runbook` for response.

### 11.3 Data handling
- PII / customer data per `/pii-inventory-pre` + `/data-flow-diagram-pre`.
- No PII in screenshots / Slack / personal email.
- Customer data: production access logged + reviewed.

### 11.4 Device return
At exit / on demand:
- All co-issued devices returned within 5 business days.
- Co data wiped from personal devices (verified).
- Accounts deprovisioned same day as exit.

---

## 12. On-call (engineering)
See `/on-call-philosophy-pre`. Highlights:
- Rotation model + comp model.
- Burnout floors enforced.
- New eng shadows 1 full rotation before primary.

---

## 13. Mental health + wellbeing
See `/mental-health-plan`. Highlights:
- EAP access + confidentiality.
- Mental health = sick days.
- Manager training on burnout signals.
- Anonymous burnout pulse per `/burnout-early-warning`.

---

## 14. Termination

### 14.1 Voluntary resignation
- 2 weeks notice requested (US); per local statutory notice elsewhere.
- Exit interview optional.
- Final pay per §3.2 + state law.
- Equity: post-termination exercise window per `/equity-comp-philosophy`.

### 14.2 Involuntary termination — cause
**Cause includes:**
- Gross misconduct (violence, theft, harassment substantiated)
- Material breach of IP / confidentiality
- Conviction of felony / fraud
- Repeated material policy violation after written warning
- Failure to perform after PIP

Cause termination: no severance (subject to statutory minimums); equity per plan rules; final pay per law.

### 14.3 Involuntary termination — without cause (layoff / fit)
- Severance: 2-4 weeks base + 1 wk per year tenure (typical pre-Series-A starting point; tune).
- Benefits continuation: COBRA (US) / statutory (EU/UK); co subsidy <X mo>.
- Equity: standard plan rules; consider extended exercise per philosophy.
- Outplacement: optional <budget>.
- Reference policy: neutral confirmation (dates + title) by default; positive only with written consent.
- Release agreement required for severance (US: ADEA 21-day consideration + 7-day revocation if 40+).

### 14.4 Reductions in force (RIF / layoff)
- Selection criteria documented (role / performance / business need).
- WARN Act compliance (US 100+ employees, 60-day notice for mass layoffs).
- EU collective consultation requirements where applicable.
- Severance pool consistent across cohort.
- Outplacement + extended benefits.

### 14.5 Death of employee
- Final pay to estate per state law.
- Equity: vested → estate per plan; unvested per plan (typically forfeit, but check).
- Benefits continuation for dependents per plan.

---

## 15. Dispute resolution

### 15.1 Internal resolution first
Concerns raised to manager → People lead → founder.

### 15.2 Arbitration
- **DEFAULT OPTIONAL** — mandatory arbitration of employment disputes is contentious.
- If included: pre-dispute arbitration agreement signed at hire; carve-out for sexual harassment / assault claims (Ending Forced Arbitration of Sexual Assault and Sexual Harassment Act 2022, US).
- CA: AB 51 limits (currently enjoined; check status).
- Class / collective action waivers: enforceable per Epic Systems (US); narrower in EU/UK.
- Forum + rules: AAA Employment Rules + co pays AAA fees.

### 15.3 Class action
If arbitration included: class action waiver. PAGA carve-out (CA) per Viking River + Adolph.

### 15.4 Governing law + venue
- Governing law: <state of incorporation>.
- Venue: <county/court>.
- Choice-of-law overridden by employee's home jurisdiction for mandatory protections.

---

## 16. Jurisdiction carve-outs

### 16.1 California (US-CA)
- Non-compete: void.
- Non-solicit of employees: void (Edwards v. Arthur Andersen; AMN Healthcare).
- Paid sick leave: 5 days / 40 hr (HSWHFA expansion 2024).
- Pay equity: pay-scale on job postings (SB 1162).
- Final pay: same day for involuntary; 72 hr for voluntary.
- Reimbursement: business expenses required (Labor Code 2802) — including phone / internet if required for work.
- Anti-harassment training: 2 hr supervisors / 1 hr non-supervisors every 2 yr (employers 5+).
- Lactation: dedicated space + break time (AB 1976 + AB 1976 amendments).
- CCPA / CPRA: employee data subject rights.
- Bereavement: 5 days protected (AB 1949).
- Reproductive loss: 5 days protected (SB 848).
- PWFA + Pregnancy Disability Leave: up to 4 mo.
- CFRA: 12 wk job-protected per 12 mo.

### 16.2 New York (US-NY)
- Paid sick: 40-56 hr/yr per employer size.
- NY PFL: 12 wk paid family leave.
- Pay transparency: salary range on postings (NYC + state).
- Sexual harassment: annual training + policy distribution.
- Frequency-of-pay: weekly for manual workers (Labor Law 191).
- WARN: NY-WARN 90 days + 50 employees.

### 16.3 Washington (US-WA)
- Paid sick: 1 hr per 40 worked.
- WA PFML: 12-18 wk paid.
- Non-compete: salary threshold + 18 mo cap + advance disclosure.
- Pay transparency: range + benefits on postings.

### 16.4 Massachusetts (US-MA)
- Paid sick: 40 hr/yr (10+ employees).
- MA PFML: up to 26 wk.
- Non-compete: garden leave 50% salary + 12 mo cap + signed 10 days before start.
- Equal Pay Act + pay history ban.

### 16.5 Illinois (US-IL)
- Paid Leave for All Workers Act: 40 hr/yr any reason.
- Anti-harassment training annual.
- Non-compete: salary threshold + advance notice (Freedom to Work Act).
- BIPA: biometric consent.

### 16.6 Colorado (US-CO)
- Paid sick + Healthy Families and Workplaces Act.
- FAMLI: paid family leave 12 wk.
- Pay transparency: range + benefits + promotion notice (Equal Pay for Equal Work).
- Non-compete: salary threshold.

### 16.7 Texas (US-TX)
- At-will; minimal state employment law overlay.
- No state PFL / paid sick mandate.
- Non-compete enforceable with reasonable scope.

### 16.8 UK
- Statutory notice; unfair dismissal after 2 yr.
- Statutory sick pay (SSP) + statutory maternity / paternity / shared parental.
- 28 days statutory holiday (incl. bank holidays).
- Working Time Regulations: 48 hr/wk opt-out.
- GDPR + UK GDPR data rights.
- Right to request flexible working (day-one right post-2024).
- Whistleblowing (PIDA) protections.

### 16.9 Germany (DE)
- Kündigungsschutzgesetz protections.
- Works council (Betriebsrat) consultation if applicable.
- 20 days statutory holiday (most contracts 25-30).
- Sick pay 6 wk full pay + insurance.
- Parental leave (Elternzeit) up to 3 yr.
- Mutterschutz: maternity protection.
- AGG (anti-discrimination) compliance.
- Datenschutz (DSGVO/GDPR) + BDSG.

### 16.10 France (FR)
- CDI default; cause required for termination.
- 25 days CP + RTT for 35-hr-week overage.
- Mutuelle (health insurance) employer co-contribution mandatory.
- CSE (works council) at 11+ employees.
- Right to disconnect (Loi Travail 2017).
- Parental leave (congé parental) up to 3 yr.

### 16.11 Ireland (IE)
- Unfair Dismissals Act after 12 mo.
- 20 days annual leave + 10 public holidays.
- Statutory sick pay (phased in to 10 days by 2026).
- Maternity 26 wk + 16 wk unpaid.
- GDPR + Data Protection Acts.

### 16.12 Netherlands (NL)
- Strong employee protection; cause + UWV/court approval to terminate.
- 20 days minimum (most contracts 25+).
- Sick pay 70%+ for 2 yr.
- Wet DBA 2026 contractor enforcement.
- Works council at 50+ employees.

### 16.13 Singapore (SG)
- Employment Act baseline + Tripartite Guidelines.
- 7-14 days annual leave depending on tenure.
- 14 days sick + 60 hospitalization.
- Maternity 16 wk + paternity 4 wk (2024 reform).
- CPF contributions per resident status.
- PDPA (data protection).
- Notice per contract.

---

## 17. Policies index (linked, not duplicated)
- Values: `/values-charter`
- Code of conduct: `/code-of-conduct`
- Async comms: `/async-comms-charter`
- Documentation culture: `/documentation-culture-charter`
- Vacation: `/vacation-policy-pre`
- On-call: `/on-call-philosophy-pre`
- Mental health: `/mental-health-plan`
- Burnout: `/burnout-early-warning`
- Equity comp: `/equity-comp-philosophy`
- IP assignment: `/ip-assignment-agreement`
- NDA: `/nda-template`
- Founders agreement: `/founders-agreement`
- Vesting schedule: `/vesting-schedule`
- Cap table: `/cap-table-design`
- 409A: `/409a-precheck`
- Insurance: `/insurance-policy-pick` + `/d-and-o-insurance-pick` + `/e-and-o-insurance-pick` + `/cyber-insurance-pick`
- Privacy: `/privacy-policy-pre`
- ToS: `/terms-of-service-pre`
- Security incident: `/incident-runbook`

---

## 18. Acknowledgment

I acknowledge that I have received and read the <co> Employee Handbook (Version <X.Y>, dated <YYYY-MM-DD>). I understand that:

- This handbook is not a contract of employment.
- (US:) My employment is at-will and may be terminated by either party at any time, with or without cause or notice, subject to applicable law.
- I am responsible for understanding and following the policies in this handbook.
- Policies may be modified; material changes will be communicated and re-acknowledged.
- Questions go to my manager or the People lead.

**Signature:** _______________________
**Printed name:** _______________________
**Date:** _______________________

(Separate acknowledgments: arbitration agreement, IP assignment, NDA, anti-harassment training completion.)

---

## 19. Change-log

| Version | Date | Author | Changes | Acknowledgment required |
|---------|------|--------|---------|------------------------|
| 1.0 | <YYYY-MM-DD> | <founder> | Initial publication | Yes (all employees) |
| | | | | |

---

## 20. Anti-patterns (handbook hall of shame)
- ❌ Handbook copied from template with no jurisdiction review
- ❌ At-will language missing in US handbook
- ❌ EEO / anti-harassment policy absent or weak
- ❌ Reporting channels = "talk to your manager" (one channel only)
- ❌ Non-compete clause in US-CA / ND / OK / MN
- ❌ Mandatory arbitration without sexual harassment carve-out (post-2022)
- ❌ "Unlimited PTO" with no minimum-take floor
- ❌ Parental leave promised but unfunded
- ❌ IP assignment missing prior-IP carve-out (Schedule A)
- ❌ Termination + severance posture undefined ("we'll figure it out")
- ❌ State carve-outs missing (CA / NY / WA at minimum)
- ❌ No change-log → no record of what was in force when
- ❌ No acknowledgment page → no proof of receipt
- ❌ Not legal-reviewed → handbook becomes evidence against you
- ❌ Updated never → stale handbook = liability

---

## Pre-launch checklist
- [ ] Primary jurisdiction template picked
- [ ] At-will / equivalent statement correct for jurisdiction
- [ ] EEO + anti-harassment + reporting channels (multiple)
- [ ] Comp philosophy + benefits + PTO + parental + sick + bereavement + sabbatical
- [ ] Working hours + remote/hybrid + travel
- [ ] Expense + dev + perf review + leveling
- [ ] IP + confidentiality + COI + non-solicit (no non-compete unless valid)
- [ ] Social media + drug/alcohol + weapons + safety
- [ ] Security + acceptable use + incident reporting
- [ ] On-call + mental health linked
- [ ] Termination + severance + RIF + arbitration + reference policy
- [ ] Jurisdiction carve-outs (CA/NY/WA/MA + UK/DE/FR per team geography)
- [ ] Policies index (linked, not duplicated)
- [ ] Acknowledgment page
- [ ] Change-log table
- [ ] Legal review by employment counsel — sign-off recorded
- [ ] Distribute before hire #1; acknowledgment signed at offer

## Anti-patterns flagged
- ❌ No legal review
- ❌ Wrong jurisdiction template
- ❌ Missing EEO / anti-harassment
- ❌ Reporting channel = one
- ❌ Non-compete in CA / FTC-banned states
- ❌ No acknowledgment
- ❌ No change-log
- ❌ Stale handbook

## Annual review
- Re-review jurisdiction law changes (CA + NY + WA pass new bills constantly)
- Update FTC / state / EU rulings (non-compete, arbitration, pay transparency)
- Refresh comp + benefits sections
- Update parental leave funding as co matures
- Re-distribute + re-acknowledge on material changes
- Audit incident reports + handbook gaps revealed

## Next
- First hire → `/first-hire-plan`
- Worker classification → `/contractor-vs-employee-decision`
- Equity grants → `/equity-comp-philosophy`
- Vacation + leave → `/vacation-policy-pre`
- On-call → `/on-call-philosophy-pre`
- Mental health → `/mental-health-plan` + `/burnout-early-warning`
- Code of conduct + values → `/code-of-conduct` + `/values-charter`
- Async + docs → `/async-comms-charter` + `/documentation-culture-charter`
- IP + NDA + founders → `/ip-assignment-agreement` + `/nda-template` + `/founders-agreement`
```

## Verification
- Jurisdiction template picked + at-will/equivalent correct.
- EEO + anti-harassment + multiple reporting channels.
- Comp + benefits + PTO + parental + sick + bereavement + sabbatical.
- Working hours + remote + expense + dev + perf review.
- IP + confidentiality + COI + non-solicit (no banned non-compete).
- Social media + drug/alcohol + weapons + safety + security.
- Termination + severance + RIF + arbitration carve-outs.
- Jurisdiction carve-outs for team geography.
- Policies index linked.
- Acknowledgment + change-log.
- Legal review recorded.
