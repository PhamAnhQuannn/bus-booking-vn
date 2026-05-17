---
name: procurement-rfp-response
description: Enterprise RFP/RFI/RFQ response playbook — SOW structure, security questionnaire deflection, bid/no-bid gate, response-time SLAs, win-rate math. Outputs response packet plan to `docs/sales/rfp-<rfp-id>.md`. Reads `/project-classify` to skip XS/S. Use when user says "RFP", "RFI", "RFQ", "bid response", "enterprise procurement", "vendor onboarding packet", "SOW draft", "/procurement-rfp-response", or when a 50+ page buyer template lands and a deadline is attached.
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 3h
  XL: 6h
---

# /procurement-rfp-response — Enterprise RFP Response Playbook

Why you'd care: a single enterprise RFP can be 200+ questions across 6 sections with a 10-business-day turnaround. Without a playbook you burn 80 hours per response, write fresh prose for questions you already answered six times, and miss the bid/no-bid gate that would have told you the deal was unwinnable from question 12 ("must have FedRAMP Moderate ATO").

## Why you'd care

RFPs are won or lost in the first 48 hours of triage — a wrong bid/no-bid call burns weeks of pre-sales effort on deals that were never winnable. A playbook turns the chaos into a repeatable decision.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP (you do not have the muscle yet; founder-led sales beats RFP).
2. Confirm a real RFP exists (PDF/Word/portal link), not a "send me a deck" email — those are different motion.
3. Note response deadline + submission portal (Ariba, Coupa, Jaggaer, Workday Strategic Sourcing, RFPIO/Responsive on buyer side, or email).
4. Locate the buyer's procurement contact + the technical evaluator (these are different people; both matter).
5. Confirm internal owner (AE or founder) and ProServ/SE bench availability for technical sections.

## Inputs
- The RFP document(s): cover letter, technical questionnaire, security questionnaire, pricing template, SOW template.
- Deal size estimate, decision date, incumbent (if any).
- Your existing canned-answer library (security responses, company background, references).
- `/vendor-security-questionnaire` output if security section is large.
- `/enterprise-buying-cycle-map` output for stakeholder context.

## Process

1. **Bid / No-bid gate (1-hour cap)** — kill bad RFPs fast. Score these eight checks; ≥3 reds = no-bid:
   - **Wired-deal signal**: incumbent named, vendor pre-named in language ("must have Salesforce-native"), reference architecture matches one vendor exactly.
   - **Disqualifying must-haves**: FedRAMP Mod/High, SOC 2 Type II ≥1 yr, ISO 27001, HITRUST, IL4/IL5 — if you don't have it and they say "must," no-bid.
   - **Pricing handcuffs**: must accept buyer's MSA verbatim, must commit to 99.99% SLA with credits ≥30% MRR, must accept unlimited liability.
   - **Implementation timeline impossible**: "go-live in 30 days" on enterprise SSO + 5 integrations is a no.
   - **Reference requirement mismatch**: 3 customers >$10B revenue when your largest is $200M.
   - **Q&A window closed**: if buyer Q&A deadline already passed, you cannot clarify ambiguity — risk-up.
   - **Pricing template forbids tiering**: must quote single all-in number, kills value-based pricing.
   - **Win-rate base**: prior bid losses to this buyer or this industry vertical — log them, model expected value before committing.

   Bid → proceed. No-bid → send a 3-paragraph letter declining gracefully, file the RFP in `docs/sales/rfp-archive/` for future ICP signal.

2. **Decompose the response packet** — every enterprise RFP packet has 6 standard sections. Map theirs to yours:
   - **Section A — Company background**: legal entity, year founded, HQ, employee count, funding, audited financials, D&B/Dun number. ~20 questions. Boilerplate library handles 100%.
   - **Section B — Technical capability / functional requirements**: feature matrix, often 200-800 rows of "Y/N/Partial/Roadmap + comment." Score-weighted. This is where you win or lose technically.
   - **Section C — Security & compliance**: SOC 2, ISO, GDPR, pen-test summary, sub-processor list. Deflect to `/vendor-security-questionnaire`.
   - **Section D — Implementation / professional services**: project plan, milestones, training, change management. ProServ team writes; SE reviews.
   - **Section E — Pricing**: their template, your math. Often per-user-per-month, per-transaction, tiered, with year-1/2/3/4/5 projections and discount schedule.
   - **Section F — Contractual / SLA / MSA**: redlines on their paper or attach yours. Legal owns.

3. **Assign owners + due dates with a 60/30/10 burn schedule** — RFP responses are 60% pulled from the library, 30% adapted from prior responses, 10% genuinely new. Owners:

   | Section | Owner | Cycle time | Library hit-rate target |
   |---|---|---|---|
   | A — Background | Sales Ops | 2h | 100% |
   | B — Technical | SE + Product | 16-32h | 60% (the 40% gap is the work) |
   | C — Security | Security/Trust | 8-16h | 80% if SIG-Lite, 50% if custom |
   | D — Implementation | ProServ lead | 8h | 40% |
   | E — Pricing | AE + Finance | 4h + approval | 0% — always custom |
   | F — Contracts | Legal | 4-8h | 70% (clause library) |

   Internal due dates land 3 business days before buyer deadline. Day -3 = packet assembly + executive review. Day -2 = final QA. Day -1 = submit (never submit on deadline day — portal failures, time-zone errors).

4. **Technical section (B) discipline** — for each question:
   - Answer **Y / N / Partial / Roadmap**. Never blank. Never "see attached."
   - 3-sentence max comment per Y. 2-sentence max per Partial naming the gap and the workaround. Never embellish a N — N with no comment beats N with a paragraph of excuses.
   - For Partial-with-Roadmap, cite a specific quarter (e.g., "Q3 2026") but never commit a feature that isn't in the prioritized roadmap. PMs review every Roadmap line.
   - Win-themes: top 3 differentiators threaded through 15-20 answers (not all 600). The buyer reads the cover letter, exec summary, and ~50 questions deeply; the rest gets skimmed.

5. **SOW structure (Section D)** — typical SOW has 11 sections, in order:
   1. Project overview + business objectives (paraphrase buyer's own RFP language)
   2. Scope of services — in-scope and explicit out-of-scope (the out-of-scope list prevents scope creep)
   3. Deliverables list with definition-of-done per deliverable
   4. Project timeline + milestones (Gantt or table; phase-gates)
   5. Roles & responsibilities (RACI: vendor PM, buyer PM, exec sponsor, technical leads on each side)
   6. Acceptance criteria + UAT process (who signs off, time-to-cure for defects)
   7. Change-order process (anything outside scope routes through CO; pricing impact)
   8. Assumptions + dependencies (e.g., "buyer provides production AD access by week 2")
   9. Fees + payment schedule (milestone-based, not time-and-materials, unless they insist)
   10. Term + termination (for cause, for convenience, notice period)
   11. Signatures + exhibits (project plan, rate card, environments diagram)

6. **Pricing section (E)** — three traps:
   - **Apples-to-apples trap**: buyer's template forces you into their unit (per-seat) when you charge per-transaction. Always answer in their unit AND attach a "vendor's preferred unit" worksheet showing your math.
   - **Year-over-year inflator**: most templates cap annual price increase at CPI or 3-5%. Negotiate this in MSA, not the RFP response — the RFP just signals the cap.
   - **Total Cost of Ownership (TCO) bait**: buyer requires 5-year TCO including implementation, training, support, change orders. Be honest; lowballing the implementation cost guarantees a renegotiation fight at month 6.

7. **SLA penalty patterns (Section F)** — what enterprise SLAs typically demand and what to counter with:

   | SLA dimension | Typical buyer ask | Reasonable counter |
   |---|---|---|
   | Uptime | 99.99% with 30% credit if missed | 99.9% with 10% credit, tiered (10%/25%/50% at progressively worse miss) |
   | Severity-1 response | 15 min 24/7 | 30 min 24/7, with explicit Sev-1 definition (production-down, no workaround) |
   | Sev-1 resolution | 4 hours | "commercially reasonable efforts" with status updates every 60 min |
   | Data export on termination | 30 days, all formats | 30 days, defined export format (JSON/CSV), with one-time professional services fee permitted |
   | Maintenance window | No more than 4h/month, off-hours buyer's timezone | Same, with right to schedule emergency maintenance with 4h notice |
   | Liability cap | Unlimited for data breach | 2× annual fees for data breach, 1× for everything else, super-cap of $5M |

   Mirror their SLA structure but renumber so the cure-period clock starts at vendor-acknowledged ticket, not buyer-perceived event.

8. **Trust-center deflection** — instead of answering Section C inline, link to your trust center (Vanta, Drata, SafeBase, or homegrown) and provide:
   - SOC 2 Type II report (under NDA via portal)
   - ISO 27001 cert
   - Pen-test executive summary (full report under NDA)
   - DPIA template
   - Sub-processor list with country of processing
   - SIG-Lite or CAIQ-Lite pre-completed (see `/vendor-security-questionnaire`)

   This deflects 80% of security questions to "see attached" and is acceptable to ~70% of enterprise buyers. The other 30% will demand inline answers; budget 16h for those.

9. **Executive review gate (Day -3)** — three pairs of eyes minimum: VP Sales (or founder), Head of Product/Engineering, Head of Legal. Specifically reviewing:
   - Any Sev-1 commitment outside current SLO
   - Any Roadmap commitment with a date
   - Any pricing departure from rate card
   - Any contract redline accepting unlimited liability or buyer's MSA verbatim
   - Reference customers named (call them first — never name a reference who hasn't agreed)

10. **Submission + post-submit motion** — submit through buyer's portal (Ariba/Coupa/Jaggaer most common; check upload limits, file-name conventions, and PDF-vs-Word requirements). After submit:
    - Day +1: confirm receipt
    - Day +3 to +7: buyer Q&A round, often via portal; treat as second-chance to clarify
    - Day +14 to +30: shortlist notification; if shortlisted, schedule technical demo + pricing negotiation
    - Day +30 to +60: vendor-of-choice selection + MSA/DPA negotiation
    - Day +60 to +120: contract signature
    - **Total RFP-to-close: 90-180 days**, with healthcare/government on the long end (180-365).

11. **Loss debrief (always do this, win or lose)** — within 5 business days of decision:
    - Request buyer debrief call (30 min). Win or lose, you learn.
    - If won: capture which 3 win-themes resonated, which references were called, what almost killed the deal.
    - If lost: capture who won, on what dimension (price/fit/incumbency/timing), which questions were dealbreakers. Update bid/no-bid gate (step 1) heuristics accordingly.
    - File debrief notes in `docs/sales/rfp-archive/<rfp-id>-debrief.md`.

12. **Canned-answer library hygiene** — after every response, harvest 5-15 reusable Q&A pairs into the library. Tag by section (A/B/C/D/E/F), product surface, and last-verified date. Library quality compounds; year-3 RFPs cost 30% of year-1 RFP hours.

## Output

Write `docs/sales/rfp-<rfp-id>.md`:

```markdown
# RFP Response — <Buyer> / <RFP-ID>
**Date received:** <YYYY-MM-DD> | **Buyer deadline:** <YYYY-MM-DD> | **Internal deadline:** <buyer-3bd>
**Deal size:** <$X ARR> | **Decision date:** <YYYY-MM-DD>
**Status:** <bid / no-bid / submitted / shortlisted / won / lost>

## Bid/no-bid decision
- Verdict: <BID / NO-BID>
- Red flags (≥3 = no-bid): <list>
- Win probability estimate: <%>
- Expected value: <deal size × win prob − response cost>

## Stakeholders
| Buyer side | Name | Role | Linked? |
|---|---|---|---|
| Econ buyer | | | |
| Champion | | | |
| Procurement contact | | | |
| Technical evaluator | | | |
| Security reviewer | | | |
| Legal | | | |

| Vendor side | Name | Section owner |
|---|---|---|
| Sales | | A, E |
| SE | | B |
| Security | | C |
| ProServ | | D |
| Legal | | F |

## Section breakdown + due dates
| Section | Owner | Internal due | Hours budget | Library hit-rate |
|---|---|---|---|---|
| A — Background | | | 2h | 100% |
| B — Technical (n Qs) | | | 24h | 60% |
| C — Security | | | 12h | 80% (SIG-Lite) |
| D — Implementation SOW | | | 8h | 40% |
| E — Pricing | | | 4h | 0% |
| F — Contracts | | | 6h | 70% |

## Win themes (top 3, threaded through B)
1.
2.
3.

## SOW key terms drafted
- In-scope: <bullets>
- Out-of-scope (explicit): <bullets>
- Milestones: <list with dates>
- Acceptance criteria: <criteria + UAT process>
- Payment schedule: <milestone-based / monthly / etc.>

## SLA position (vs buyer template)
| Dimension | Buyer ask | Our position | Negotiation room |
|---|---|---|---|
| Uptime | | | |
| Sev-1 response | | | |
| Liability cap | | | |
| Data export | | | |

## Pricing position
- Quote unit: <buyer's> + <our preferred>
- Year-1: $
- Year-5 TCO: $
- Discount schedule + caps:

## Executive review (Day -3)
- [ ] VP Sales sign-off
- [ ] Head of Product/Eng sign-off
- [ ] Head of Legal sign-off

## Submission
- Portal: <Ariba/Coupa/Jaggaer/email>
- Submitted at: <YYYY-MM-DD HH:MM TZ>
- Confirmation receipt: <portal ref>

## Post-submit timeline
- Q&A round: <date>
- Shortlist: <date>
- Award decision: <date>
- Target close: <date>

## Loss/win debrief
- Date: | Buyer attendee: | Vendor attendee:
- Reason cited:
- Library updates queued:
```

## Verification
- Bid/no-bid gate run before any response work (logged in the doc).
- Every Section-B question answered Y/N/Partial/Roadmap — zero blanks.
- No Roadmap commitment without a PM-approved quarter.
- SLA + liability positions reviewed by Legal before submit.
- Submission ≥1 business day before buyer deadline.
- Debrief filed within 5 business days of award decision, win or lose.
