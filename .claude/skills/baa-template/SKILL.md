---
name: baa-template
description: Author or review a Business Associate Agreement (BAA) for CE↔BA and BA↔subcontractor relationships. Covers HIPAA 45 CFR 164.504(e) required clauses, optional risk-shifting clauses (indemnity, liability cap, breach reimbursement), breach-notice timelines, subcontractor flow-down. Reads `docs/inception/hipaa-<project>.md`. Writes `docs/legal/baa-<counterparty>-<project>.md`. Trigger phrases "BAA", "business associate agreement", "BAA review", "BAA template", "subcontractor BAA", "AWS BAA", "Stripe BAA", "/baa-template", or before signing any contract that touches PHI.
output_size:
  XS: skip
  S: 2h
  M: 2h
  L: 4h
  XL: 6h
---

# /baa-template — BAA Authoring & Review

## Why you'd care

Touching PHI without a signed BAA in either direction is a per-incident HIPAA violation, and the standard vendor template usually shifts breach liability your way. Reviewing or authoring the BAA properly is how you keep enterprise health customers without accidentally underwriting their next incident.

Invoke as `/baa-template`. Run once per BAA counterparty (each CE customer; each BA subcontractor that touches PHI).

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP (no PHI at that scale).
2. Read `docs/inception/hipaa-<project>.md` — confirms CE-vs-BA role and BAA inventory.
3. Confirm counterparty role: CE (downstream customer), BA-subcontractor (upstream vendor), or CE↔CE (organized health care arrangement — rare).

## Inputs
- Counterparty name + role (CE, BA-subcontractor, OHCA peer).
- Your role with respect to them (BA serving a CE, BA flowing down to subBA, CE buying from BA).
- Whose paper? Yours, theirs, or hybrid.
- Permitted Uses and Disclosures (what they're allowed to do with PHI).
- Subcontractors involved (BA → sub-BA chain triggers flow-down obligations).
- Jurisdiction (state-law overlay: CA CMIA, TX HB 300, WA MHMD, NY SHIELD).
- Term (typical 1–3 yrs, auto-renew) + termination triggers.
- Liability appetite (uncapped, cap at fees, cap at 2× fees, supercap for breach).

## Process
1. **Identify required clauses** — HIPAA 45 CFR 164.504(e)(2) mandates 10 items. Check counterparty draft against this list; any missing item = redline.
2. **Identify optional risk-shifting clauses** — indemnity, liability cap, breach cost reimbursement, cyber-insurance minimums, audit rights. These are negotiated, not mandated.
3. **Breach notification timeline** — HIPAA floor is 60 days from BA discovery to CE notice. Most CEs demand stricter (24–72 hours). Negotiate: tier the timeline (notice of incident ≤24h, confirmation ≤72h, full report ≤30d).
4. **Subcontractor flow-down** — if you (BA) use sub-BAs (AWS, Stripe, Twilio, Datadog), the BAA with CE must allow it, AND you must sign BAAs downstream with equivalent or stricter terms. Omnibus Rule 2013 = sub-BAs are themselves BAs.
5. **State-law overlay** — CMIA stricter on consent; WA MHMD covers non-HIPAA health data; NY SHIELD has its own breach standard. Reference, don't recreate.
6. **Permitted uses** — narrow to performance of services + as Required by Law + de-identification (if you want analytics rights). Block "marketing", "sale of PHI", and broad "improving services" unless explicit.
7. **Termination** — material breach with cure period (30 d); if cure infeasible, immediate termination + return/destruction of PHI within 30–60 d.
8. **Indemnity** — mutual indemnity for the indemnifying party's HIPAA violation. Cap if you can; supercap (e.g., 3× fees or $5M) for willful neglect. Carve out: HHS fines often uninsurable — push back on "indemnify for fines".
9. **Audit rights** — CE often asks. Counter with: SOC 2 Type II / HITRUST report in lieu of on-site audit; on-site limited to 1×/yr, 30-day notice, NDA, business hours.
10. **Cyber insurance minimum** — $5M typical for SMB BA; $10–25M for larger BA. Specify HIPAA rider required.

## Vendor-specific notes
- **AWS BAA**: free, click-through via AWS Artifact. Covers eligible services only — check the HIPAA Eligible Services list each renewal. Customer responsibility for configuration (e.g., turn on encryption).
- **Stripe BAA**: add-on, beta (Stripe for Health). Limited — payment metadata is OK, never PHI in description fields.
- **Twilio BAA**: enables HIPAA-eligible messaging products. Must use approved channels (SMS, Voice, SendGrid email with HIPAA add-on). No PHI in subject lines or sender IDs.
- **Datadog / Sentry / observability**: requires Enterprise tier + BAA addendum. Scrub PHI at the agent layer; never rely on the vendor to redact.
- **Google Workspace / Microsoft 365**: BAA available; specific services covered (Gmail, Drive, Meet for Workspace; Outlook, Teams, OneDrive for M365). Workforce training required: no PHI in Slack/Discord.
- **OpenAI / Anthropic / Azure OpenAI**: Azure OpenAI offers BAA (Microsoft). OpenAI direct API: BAA available on Enterprise/Zero Data Retention tier as of 2024. Anthropic: BAA on Enterprise. Verify case-by-case before sending PHI to any LLM.

## Output
Write `docs/legal/baa-<counterparty>-<project>.md`:

```markdown
# BAA — <counterparty> ↔ <us>
**Project:** <project>
**Date drafted:** <YYYY-MM-DD>
**Counterparty role:** <CE customer | BA subcontractor | sub-BA>
**Our role:** Business Associate
**Paper:** <ours | theirs | hybrid>
**Status:** <draft | redlined | executed>
**Effective date:** <YYYY-MM-DD>
**Term:** 1 yr, auto-renew

## Counterparty profile
- Legal name: <Acme Health Inc.>
- Type: <hospital | clinic | health-plan | clearinghouse | BA serving CE | sub-BA>
- Jurisdiction: <Delaware corp, operates in CA + TX + NY>
- Their CE customers (if sub-BA chain): <list>

## Required clauses — 45 CFR 164.504(e)(2) checklist
| # | Required clause | In counterparty draft? | Comment |
|---|---|:--:|---|
| 1 | Permitted/required uses & disclosures of PHI | ✓ | scope narrow OK |
| 2 | Prohibition on use/disclosure beyond contract | ✓ | |
| 3 | Use appropriate safeguards (Security Rule) | ✓ | reference 164.308–316 |
| 4 | Report unauthorized use/disclosure + breaches | ⚠ | timeline missing — add 24h notice |
| 5 | Flow-down: sub-BAs must agree to same restrictions | ✗ | redline in: §6 |
| 6 | Make PHI available for individual access (164.524) | ✓ | |
| 7 | Make PHI available for amendment (164.526) | ✓ | |
| 8 | Provide accounting of disclosures (164.528) | ✓ | retain 6 yrs |
| 9 | Make practices/records available to HHS | ✓ | |
| 10 | Return/destroy PHI at termination (or extend protections) | ⚠ | 60d destroy → negotiate 30d |

## Optional risk-shifting clauses
| Clause | Position | Our redline |
|---|---|---|
| Indemnity | Mutual for own HIPAA violation | accept mutual; cap at 3× annual fees |
| Liability cap | Uncapped breach (their draft) | counter: cap at 2× fees; supercap $5M for willful neglect |
| Cyber insurance minimum | $10M (their ask) | accept $5M (HIPAA rider required) |
| Audit rights | On-site quarterly (their ask) | counter: SOC 2 Type II in lieu; on-site 1×/yr, 30d notice |
| Reimbursement of breach costs | Forensics + notification (their ask) | accept up to cap; carve out HHS fines |
| Most-favored nation (MFN) | (their ask) | reject — operationally untenable |

## Breach notification — tiered timeline
| Stage | Trigger | Notify CE within |
|---|---|---|
| Initial notice | Reasonable belief unauthorized acquisition/access/use/disclosure | **24 hours** of discovery |
| Confirmation + scope | Investigation confirms breach + affected individuals identified | **72 hours** |
| Full report | Root cause, mitigation, remediation, individual list | **30 days** |
| HHS OCR notification | If >500 affected: contemporaneous with individuals; ≤500: annual | **per Breach Notification Rule** |

(See `docs/ops/breach-notification-<project>.md` for full runbook.)

## Permitted uses & disclosures
Narrow whitelist — no broad "improving services":
- Performance of Services described in MSA §<n>
- As Required by Law
- For management & administration of BA (HIPAA-permitted)
- Data aggregation services as defined in 45 CFR 164.501
- De-identification per 164.514(b) — Safe Harbor or Expert Determination; resulting data is no longer PHI and may be used for product analytics
- Blocked: marketing (164.508(a)(3)), sale of PHI (164.508(a)(4)), any use for ML training without explicit written approval

## Subcontractor flow-down
We use these sub-BAs; all signed equivalent BAAs:
| Sub-BA | Service | BAA on file |
|---|---|:--:|
| AWS | hosting | ✓ AWS BAA via Artifact |
| Stripe | payment | ✓ Stripe for Health add-on |
| Twilio | SMS reminders | ✓ HIPAA-eligible |
| Datadog | observability | ✓ Enterprise + addendum (PHI scrubbed pre-send) |
| Postmark/SendGrid | email | ✓ SendGrid HIPAA add-on |

## Termination
- Either party material breach → 30-day cure → terminate.
- Cure infeasible → immediate termination.
- At termination: return or destroy all PHI within **30 days**; written attestation of destruction.
- If return/destruction infeasible (backups), extend BAA protections indefinitely to that residual PHI.

## Jurisdiction & state overlay
- Governing law: Delaware (counterparty), but services performed in CA + TX + NY → state overlays apply:
  - **CA CMIA**: stricter consent; treble damages for negligent disclosure.
  - **TX HB 300**: broader CE definition; training requirement.
  - **NY SHIELD**: separate breach standard; reasonable safeguards.
  - **WA MHMD (2024)**: covers consumer health data outside HIPAA scope — confirm we're not in scope here.

## Open redlines (round 1)
- [ ] §3.4 — add 24h initial breach notice (CE asks ≤8h; we counter 24h).
- [ ] §6 — sub-BA flow-down language missing; insert standard.
- [ ] §9 — liability cap; CE wants uncapped, we counter 2× fees + $5M supercap.
- [ ] §11 — audit rights; SOC 2 II report in lieu of on-site.
- [ ] §14 — destruction window 30 d (CE asks 15 d).

## Risk if skip / weak BAA
- HHS OCR fines $137 – $68,928 per violation; annual max **$2.07M** (2024 indexed).
- BA without BAA = automatic violation regardless of breach.
- CE customer can terminate MSA for cause.
- Class action exposure under CA CMIA (statutory damages).
- Cyber insurance may deny claim if BAA missing/non-conforming.

## Sign-off
- Legal review: <attorney name> <date>
- Security review: <CISO/security lead> <date>
- Privacy officer: <name> <date>
- Counterparty contact: <name, title, email>
```

## Verification
- All 10 required clauses (45 CFR 164.504(e)(2)) checked off.
- Breach-notice timeline tighter than 60-d HIPAA floor.
- Sub-BA flow-down language present if applicable.
- Indemnity + liability cap + cyber-insurance min explicitly negotiated.
- State-law overlay referenced for each operational jurisdiction.
- Permitted-uses list narrow; marketing + sale of PHI explicitly blocked.
- Termination + return/destroy timeline set.
- Open redlines tracked with party position.
