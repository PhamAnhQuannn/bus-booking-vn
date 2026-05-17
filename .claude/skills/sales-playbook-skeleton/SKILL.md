---
name: sales-playbook-skeleton
description: Build a first-draft sales playbook — ICP cheat sheet, discovery questions, demo flow, objection handling, close steps. Outputs to `docs/inception/sales-playbook-<project>.md`. Use when user says "sales playbook", "discovery questions", "demo script", "objection handling", "/sales-playbook-skeleton", or before first sales hire.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /sales-playbook-skeleton — Repeatable Beats Heroic

Founder-led sales doesn't scale until the playbook is written. Write it after 10 closed deals, before the first AE.

## Why you'd care

Without a written discovery script and demo flow, your first sales hire pitches by intuition and you can't tell whether the close rate reflects the product or the rep. The playbook is what makes sales repeatable.

## Pre-flight
Run after `/gtm-motion-pick` (sales-led path), `/icp-and-buyer-personas`. Pairs with `/discovery-call-script`, `/demo-script`.

## Inputs
- 10+ closed-won deals to mine for patterns.
- 5+ closed-lost deals for objection patterns.
- Current pricing + packaging.
- Buyer personas (economic buyer, champion, user, blocker).

## Process
1. **ICP cheat sheet** — who buys, who doesn't, fast disqualify rules.
2. **Stages of the deal** — define 5-6 stages with clear entry/exit criteria. Standard: Suspect → Discovery → Demo → Pilot → Proposal → Closed.
3. **Discovery questions** — 10-15 questions across pain / current state / budget / decision process / timeline (BANT or MEDDIC light).
4. **Demo script** — opening hook, 3 use cases tailored to ICP, ROI math, close question.
5. **Objection handling** — top 8 objections from closed-lost interviews. Each: framing + counter + proof point.
6. **Pricing conversation** — when to bring up, anchor strategy, discount ladder.
7. **Close steps** — what triggers "proposal," what triggers "contract sent," what's in MSA vs SOW.
8. **CRM hygiene** — required fields per stage; no advance without.
9. **Handoff to CS** — what gets passed at deal close (use cases, success criteria, key contacts).

## Output
Write `docs/inception/sales-playbook-<project>.md`:

```markdown
# Sales Playbook v1 — <project>
**Date:** <YYYY-MM-DD>
**Author:** Founder A
**Based on:** 12 closed-won + 7 closed-lost interviews

## ICP cheat sheet
**Buyer:** VP Ops at 50-500 person SaaS company
**Trigger events:** Series A close, new VP Ops hire, switching from Notion+Slack mess
**Disqualify if:**
- < 50 employees (no pain yet)
- Already runs Asana + heavy custom workflows (switching cost too high)
- Single-team buyer (we need cross-functional)
- Budget < $24k ARR

## Deal stages
| Stage | Entry criteria | Exit criteria | Avg days |
|-------|----------------|---------------|----------|
| 1. Suspect | Inbound / qualified outbound | Disco scheduled | 5 |
| 2. Discovery | Disco call done | Pain + budget + timeline confirmed | 7 |
| 3. Demo | Tailored demo done | Stakeholder buy-in confirmed | 10 |
| 4. Pilot | Pilot agreement signed | Pilot success criteria met | 21 |
| 5. Proposal | Proposal sent | Verbal yes from economic buyer | 7 |
| 6. Closed | Contract signed | Handoff to CS | — |

## Discovery questions
**Pain:**
- Walk me through how your ops team coordinates today
- Where does this process break down most often?
- What did you try before? Why didn't it stick?

**Impact:**
- How much time does this cost the team per week?
- What's the cost of not solving this in 90 days?

**Decision process:**
- Who else needs to weigh in on a tool like this?
- What's worked in past tool purchases here?

**Budget + timeline:**
- Do you have a budget for this initiative?
- When would you want this live?

## Demo flow (30 min)
| Minute | Section | Tactic |
|--------|---------|--------|
| 0-3 | Recap discovery pain in customer's own words | Show we listened |
| 3-7 | Use case 1: <ICP-specific> | Tailor to their workflow |
| 7-12 | Use case 2: <ICP-specific> | Show automation depth |
| 12-18 | Use case 3: <ICP-specific> | Show cross-functional |
| 18-22 | ROI math live (hours saved × hourly rate × team size) | Tie to dollars |
| 22-27 | Q&A | Listen for buying signals |
| 27-30 | Close: "Would you like to pilot with 2 teams?" | Direct ask |

## Top 8 objections + responses
| Objection | Counter | Proof point |
|-----------|---------|-------------|
| "Too expensive" | "Compared to losing X hours/week, it pays back in 6 weeks" | ROI calculator + case study |
| "We use Notion" | "Notion is a doc tool; we're a workflow engine" | Side-by-side demo |
| "We need integrations with X" | "Built / on roadmap / via Zapier" | Integration catalog |
| "Need to think about it" | "What specifically needs to be true to move forward?" | Get to real blocker |
| "Wait for next budget cycle" | "We can start pilot now, contract in Jan" | Pilot agreement |
| "Champion can't get exec buy-in" | "Let me brief your VP directly" | Exec-level deck |
| "Implementation will take forever" | "Avg 14-day onboarding, we run it for you" | Reference customer |
| "Security review" | "SOC 2 Type II, full data room ready" | Security one-pager |

## Pricing conversation
- Don't lead with price — lead with ROI
- Bring up price only after demo + ROI math
- Anchor with Pro tier ($24k/yr), let them ask for Starter ($6k) if needed
- Discount ladder per `/discount-policy`
- Never give multi-year discount without prepay

## Close steps
1. Verbal yes from economic buyer (recorded in CRM)
2. Proposal sent (SOW + MSA template)
3. Procurement / legal kickoff
4. Contract sent (DocuSign)
5. Countersignature received
6. Handoff to CS within 24h

## CRM hygiene (required fields per stage)
- Suspect: source, ICP-fit checklist
- Discovery: pain, budget, timeline, decision-maker name
- Demo: stakeholders looped in, ROI estimate
- Pilot: pilot success criteria
- Proposal: pricing, contract terms
- Closed: handoff doc to CS

## Handoff to CS
- Pain solved
- Pilot success criteria
- Key contacts + roles
- ROI promise made (so CS doesn't undershoot)
- Renewal date + budget cycle

## Pitfalls flagged
- [ ] ICP includes hard disqualify rules
- [ ] Stages with clear entry/exit (not vague "in progress")
- [ ] Discovery covers pain + budget + timeline + decision process
- [ ] Demo is ICP-tailored, not feature-tour
- [ ] Top objections come from actual closed-lost interviews
- [ ] Pricing not led with
- [ ] Handoff to CS is real (not "FYI Slack message")

## Next
- Discovery deeper → `/discovery-call-script`
- Demo deeper → `/demo-script`
- First AE hire → `/first-ae-hire-plan`
- Pricing → `/pricing-strategy`
```

## Verification
- ICP cheat sheet with disqualifies.
- 5-6 stages with entry/exit criteria.
- 10-15 discovery questions.
- Demo flow timed in minutes.
- Top 8 objections with counter + proof point.
- Close steps + CRM hygiene + CS handoff.
