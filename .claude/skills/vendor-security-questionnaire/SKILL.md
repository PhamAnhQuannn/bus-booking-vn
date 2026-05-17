---
name: vendor-security-questionnaire
description: Vendor security questionnaire response playbook — CAIQ, SIG-Lite, SIG-Core, HECVAT, custom — with canned-answer library structure and trust-center deflection strategy. Outputs response packet + library plan to `docs/security/vsq-<buyer>.md`. Reads `/project-classify` to skip XS/S. Use when user says "security questionnaire", "CAIQ", "SIG", "HECVAT", "third-party risk", "TPRM", "vendor assessment", "trust center", "/vendor-security-questionnaire", or when a buyer sends a 200-question Excel asking about your security posture.
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 3h
  XL: 6h
---

# /vendor-security-questionnaire — Vendor Security Questionnaire Response

Why you'd care: enterprise buyers and TPRM (third-party risk management) teams send 6-12 of these per year per vendor. Without a canned-answer library each one costs 8-40 hours and pulls your CISO/security lead off real work. A well-curated library deflects 70-80% of questions, with a public trust center handling another 10-15%.

## Why you'd care

Enterprise buyers send 200-question security spreadsheets expecting answers in five business days. A canned-answer library plus a trust center deflects 80% of the work to a URL.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP (no security program to describe; do `/threat-model-pre` first).
2. Identify which questionnaire standard. The five you'll meet 95% of the time:
   - **CAIQ** (Consensus Assessment Initiative Questionnaire) — Cloud Security Alliance, current v4.0.2, 261 questions across 17 CCM domains. CAIQ-Lite is the trimmed 73-question version.
   - **SIG-Lite** — Shared Assessments, ~330 questions, broad coverage.
   - **SIG-Core** — Shared Assessments, 1,200-1,800 questions, deep dive (financial services + critical infrastructure favor this).
   - **HECVAT** — Higher Education Community Vendor Assessment Toolkit. HECVAT-Lite (90Q), HECVAT-Full (265Q), HECVAT-On-Premise (140Q). EDUCAUSE-published; required by most universities.
   - **Custom** — buyer's own Excel, 50-500 questions, often a frankenstein of CAIQ + their internal policies.
3. Confirm response deadline + delivery format (Excel, PDF, RFPIO/Responsive/Loopio/Whistic portal, OneTrust portal, ProcessUnity portal).

## Inputs
- The questionnaire file or portal link.
- Buyer's signed NDA (don't share SOC 2/pen-test without one).
- Your existing canned-answer library state.
- Trust-center URL if you have one (SafeBase, Vanta Trust Center, Drata Trust, Conveyor, Whistic Profile, or homegrown).
- Current control evidence: SOC 2 Type II, ISO 27001, PCI ROC/AOC, HIPAA risk assessment, pen-test report, BCP/DR plan, sub-processor list.

## Process

1. **Categorize the questionnaire** — first 15 min, scan and count:
   - Total questions
   - Standard (CAIQ / SIG-Lite / SIG-Core / HECVAT / custom)
   - Coverage areas (governance, IAM, data protection, infra security, app sec, BCP/DR, incident response, vendor mgmt, compliance, privacy)
   - Required evidence attachments (SOC 2, pen-test, ISO, DPIA, sub-processor list)
   - Free-text vs Y/N vs evidence-link questions (% breakdown drives effort estimate)

   Effort heuristic: CAIQ-Lite 73Q ≈ 6h fresh, 1h with mature library. SIG-Core 1,800Q ≈ 80h fresh, 12h with mature library. Custom 300Q ≈ 16h fresh, 4h with mature library.

2. **Run trust-center deflection sweep first** — before answering any question, check the trust center. If it's already documented publicly or under-NDA-on-portal, the answer is a link, not prose. Expected deflection ratio by maturity:

   | Trust center maturity | Deflection ratio | What's on it |
   |---|---|---|
   | None / "see attached" | 0% | nothing |
   | Static page (about/security) | 20-30% | SOC 2 logo, ISO logo, contact email |
   | Trust portal (SafeBase/Vanta Trust/Conveyor) | 60-75% | SOC 2 report behind click-through NDA, sub-processor list, pen-test summary, FAQs, SIG-Lite pre-filled |
   | Trust portal + AI answer engine (Conveyor/Whistic Resp) | 80-90% | above + auto-respond to questionnaires |

   **Target: ≥70% deflection within 12 months of first enterprise deal.**

3. **Map questions to canned-answer library** — your library should have these top-level categories matching CAIQ CCM v4 domains:
   - A&A — Audit & Assurance
   - AIS — Application & Interface Security
   - BCR — Business Continuity & Operational Resilience
   - CCC — Change Control & Configuration Mgmt
   - CEK — Cryptography, Encryption & Key Management
   - DCS — Datacenter Security
   - DSP — Data Security & Privacy Lifecycle Mgmt
   - GRC — Governance, Risk & Compliance
   - HRS — Human Resources Security
   - IAM — Identity & Access Management
   - IPY — Interoperability & Portability
   - IVS — Infrastructure & Virtualization Security
   - LOG — Logging & Monitoring
   - SEF — Security Incident Mgmt, E-Discovery, Forensics
   - STA — Supply Chain Mgmt, Transparency & Accountability
   - TVM — Threat & Vulnerability Mgmt
   - UEM — Universal Endpoint Management

   Each library entry has 5 fields: question stem, canonical answer (3-sentence max), Y/N/NA flag, evidence link, last-verified date. Re-verify quarterly.

4. **Answer discipline — the 5-line rule** — for any free-text question:
   - Line 1: direct Y/N/Partial (or "Yes — with caveat" — never "Yes, but…")
   - Line 2-3: what control implements it (process + tool)
   - Line 4: evidence reference (SOC 2 CC6.1, ISO A.9.2.3, internal policy doc)
   - Line 5: review/audit cadence

   Example for "Does the vendor encrypt data at rest?": "Yes. All customer data at rest is encrypted with AES-256 via AWS KMS-managed CMKs with annual rotation; encryption is enforced by S3 default encryption + RDS storage encryption + EBS volume encryption. Evidence: SOC 2 Type II CC6.1, AWS KMS key policy in /security/kms-policies. Reviewed quarterly by security engineering."

5. **Standard pre-fills** — pre-complete and host on trust center:
   - **CAIQ-Lite v4 (73Q)** — minimum viable. Every B2B SaaS over $1M ARR should have this.
   - **SIG-Lite (~330Q)** — recommended once you're targeting enterprise ($50K+ ACV).
   - **HECVAT-Lite (90Q)** — required if you sell to universities.

   Skip SIG-Core / HECVAT-Full pre-fills until a deal specifically requires them; refresh on demand. Pre-fill cost: CAIQ-Lite ~4h, SIG-Lite ~16h, HECVAT-Lite ~6h.

6. **NDA-gated evidence pack** — under buyer-signed NDA, you can share:
   - SOC 2 Type II report (most recent + most recent observation period; reports older than 12 months get rejected)
   - ISO 27001 cert + Statement of Applicability (SoA)
   - Pen-test executive summary (full report only with strong NDA + sometimes additional confidentiality undertaking)
   - DPIA / TIA (transfer impact assessment for EU customers post-Schrems II)
   - BCP/DR plan summary
   - Sub-processor list with country of processing + DPAs in place
   - Security policies index (don't share policies themselves unless required — policy text rarely persuades; outcomes do)
   - Insurance certs (cyber liability ≥$5M, E&O, general liability) — Acord 25 form

   Stage these in a clean "evidence pack" folder so any team member can assemble in <10 min.

7. **Custom-questionnaire triage** — when the buyer sends a frankenstein:
   - Step 1: search-replace map their question to nearest CAIQ/SIG question, paste your canned answer. Expect 60-70% direct match.
   - Step 2: 20-30% need light tailoring (their wording differs but intent matches).
   - Step 3: 10-15% are genuinely new — these go through full 5-line discipline AND get backfilled into the library after submission.
   - Step 4: 1-3% are unanswerable as worded (ambiguous, contradictory, or asking for something you don't do) — request clarification via portal/email; don't guess. "Question 47 appears to assume on-prem deployment; can you confirm whether SaaS-only response is acceptable?"

8. **Compensating-control framing for "No" answers** — never bare-N. If you don't have a control the buyer asked about, write: "No — we do not [exact control]. We mitigate the underlying risk via [compensating control], which achieves [equivalent outcome]. Evidence: [audit doc]. We have/have not committed this on roadmap [date or N/A]."

   Examples:
   - "Do you do annual third-party pen-tests?" — "Yes — annual Crowdstrike/Bishop Fox/NCC pen-test, report available under NDA."
   - "Do you do quarterly third-party pen-tests?" — "No — we do annual third-party pen-tests plus continuous internal red-team exercises plus monthly automated DAST scans. The annual cadence aligns with SOC 2 Type II and is reviewed against threat profile annually."

9. **Sub-processor + supply chain transparency** — buyers increasingly require:
   - Sub-processor list with name, processing purpose, location, data category, DPA-in-place flag
   - Notification commitment for new sub-processors (typically 30-day advance notice in DPA)
   - Data residency confirmation (EU-only, US-only, or specific regions)
   - For US federal: FedRAMP status of underlying cloud (AWS GovCloud, Azure Government)
   - For healthcare: BAA in place with each PHI-touching sub-processor

   Maintain this list in a single source of truth (e.g., `/security/sub-processors.md`) and link from trust center.

10. **Privacy + cross-border addenda** — for any EU buyer, expect questions on:
    - GDPR Art. 28 processor obligations
    - Schrems II / TIA for US data transfers
    - SCCs (Standard Contractual Clauses) — 2021 SCCs are current, Module 2 (controller-processor) most common
    - Subject rights process (DSAR turnaround time, typically 30 days)
    - DPO contact (required if you process EU data at scale)
    - Breach notification SLA to controller (72h aligns with GDPR Art. 33)

11. **Response QA pass before submit** — 30-minute review:
    - Every question has an answer (no blanks)
    - No "we will…" future-tense unless flagged as Roadmap with date
    - No buyer-specific language accidentally lifted from prior responses ("As discussed with Acme Corp…")
    - No confidential customer references named
    - Evidence links point somewhere real (test each link)
    - Version + date on the cover

12. **Post-submission backfill** — within 3 business days of submission:
    - Add any new Q&A to the library, tagged with source questionnaire and buyer industry.
    - If a question revealed a real gap (e.g., "you don't have MFA on admin consoles?") — open a security ticket, don't just document it.
    - Update trust-center FAQ if a question recurs across 3+ buyers.
    - Re-verify quarterly: each library entry's `last_verified` date should be ≤90 days for SOC 2-adjacent claims.

## Output

Write `docs/security/vsq-<buyer>.md`:

```markdown
# Vendor Security Questionnaire — <Buyer>
**Date received:** <YYYY-MM-DD> | **Deadline:** <YYYY-MM-DD>
**Standard:** <CAIQ-Lite / CAIQ-v4 / SIG-Lite / SIG-Core / HECVAT-Lite / HECVAT-Full / Custom>
**Total questions:** <n>
**Owner:** <security lead>
**Delivery:** <Excel / OneTrust portal / Whistic / RFPIO / Conveyor / SafeBase>

## Triage
| Bucket | Count | % | Source |
|---|---:|---:|---|
| Direct library hit | | | canned answer |
| Library + tailor | | | adapted |
| Trust-center deflect | | | link out |
| Fresh (new) | | | first-time |
| Unanswerable / clarify | | | flagged to buyer |

## Coverage area breakdown
| CCM domain | Q count | Owner | Status |
|---|---:|---|---|
| A&A | | | |
| AIS | | | |
| BCR | | | |
| CCC | | | |
| CEK | | | |
| DCS | | | |
| DSP | | | |
| GRC | | | |
| HRS | | | |
| IAM | | | |
| IVS | | | |
| LOG | | | |
| SEF | | | |
| STA | | | |
| TVM | | | |

## Evidence pack attached (under NDA)
- [ ] SOC 2 Type II (period: __)
- [ ] ISO 27001 cert + SoA
- [ ] Pen-test executive summary (date: __)
- [ ] DPIA / TIA
- [ ] BCP/DR plan summary
- [ ] Sub-processor list (last updated: __)
- [ ] Cyber liability insurance Acord 25 ($_M limit)

## "No" answers + compensating controls
| Q# | Question | Compensating control | Roadmap? |
|---|---|---|---|
| | | | |

## Roadmap commitments made
| Q# | Commitment | Date | PM-approved? |
|---|---|---|---|
| | | | Y/N |

## Clarifications requested from buyer
| Q# | Ambiguity | Question asked |
|---|---|---|

## QA checklist before submit
- [ ] Zero blanks
- [ ] No buyer-name leaks from prior responses
- [ ] Every evidence link tested
- [ ] No unauthorized Roadmap commits
- [ ] Cover version + date set
- [ ] NDA on file before sending SOC 2/pen-test

## Submission record
- Submitted: <YYYY-MM-DD HH:MM TZ>
- Method: <portal / email>
- Confirmation: <ref>

## Post-submit backfill
- New library entries added: <count>
- Trust-center FAQ updates queued: <list>
- Security tickets opened: <ticket IDs>
- Re-verify dates set for: <list>
```

## Verification
- Trust-center deflection ratio measured for this questionnaire (≥50% target for SIG-Lite/CAIQ-Lite).
- Every "No" answer has a compensating control sentence, not bare-N.
- No buyer-name leaks from prior responses (search-replace pass).
- Sub-processor list reflects current state, not last quarter's.
- Library backfill scheduled within 3 business days of submission.
- Quarterly re-verification cadence on calendar for SOC-2-adjacent claims.
