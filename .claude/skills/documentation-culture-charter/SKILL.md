---
name: documentation-culture-charter
description: Documentation culture charter — write-it-down default, RFC/ADR/runbook tiers, ownership, decay protection, "if it's not written, it didn't happen". Outputs to `docs/inception/documentation-culture-charter-<project>.md`. Use when user says "documentation", "docs culture", "writing culture", "RFC culture", "knowledge sharing", "/documentation-culture-charter", or before team past 5.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /documentation-culture-charter — Tribal Knowledge Is The Bus Factor. Write It Down.

## Why you'd care

By hire #8 the team is asking the founder the same five questions three times a week — and the founder believes the answer is "everyone should just remember the Slack thread from October," which means the next new hire has to wait for the founder to be free again. A charter that codifies the write-it-down default at hire #2 is the lowest-cost intervention with the highest compounding return; retrofitting it at hire #20 means a "doc sprint" that costs a quarter of velocity and still misses half the institutional knowledge.

Docs ≠ overhead. Docs = leverage. The thing you write once is read 50 times. The thing you say in a meeting is heard once and forgotten in a week. Culture is set by founder behavior, not by a wiki tool.

## Pre-flight
Run before team past 5 OR when "I told you last week, remember?" becomes a recurring phrase. Pairs with `/async-comms-charter`, `/knowledge-base-bootstrap`, `/adr-writer`.

## Inputs
- Existing docs (where do they live? Are they read?).
- Founder writing comfort (sets tone).
- Tooling (Notion / Confluence / Coda / GitHub wiki).
- Recurring questions (any question asked 3+ times = doc gap).

## Process
1. **Declare default** — write it down, then talk about it.
2. **Define doc tiers** — RFC / ADR / runbook / spec / FAQ.
3. **Assign owners** — every doc has one named human.
4. **Set decay protection** — review cadence, last-touched date, archive criteria.
5. **Embed in workflow** — PR template requires doc updates, design review requires written RFC.
6. **Model from the top** — founder writes RFCs, not just emails.
7. **Onboarding teaches it day 1.**

## Output
Write `docs/inception/documentation-culture-charter-<project>.md`:

```markdown
# Documentation Culture Charter — <project>
**Default:** write-it-down, then talk
**Owner:** <founder / Head of Eng / Chief of Staff>
**Version:** 1.0
**Date:** <YYYY-MM-DD>

## Why we write things down
- The thing you write is read 50 times. The thing you say is forgotten in a week.
- Async + remote-first only works with durable knowledge.
- "Tribal knowledge" = bus factor of 1 = company-ending fragility.
- Writing forces clarity — half of bad ideas die when you try to write them down.
- New hires onboard in days not months.
- Founder bandwidth = limited. Docs are how founder scales.

## The default
**Write first, talk second.** Specifically:
- Decision needs to happen → write the recommendation, then meet
- Question asked 3+ times → answer becomes a doc
- New feature → spec doc before any code
- Architectural choice → ADR before merge
- Process / runbook → written before second person needs to do it

If it's not written, it didn't happen. If it's written but unfindable, it didn't happen.

## Doc tiers
| Tier | Length | Lifespan | Owner | When |
|------|--------|----------|-------|------|
| **RFC (Request for Comments)** | 2-10 pg | Permanent (archived after decision) | Author | Major proposal — new feature, architecture, process change |
| **ADR (Architecture Decision Record)** | 1-2 pg | Permanent | Author | Architecturally significant decision (framework, DB, auth, deploy target) |
| **Spec / PRD** | 2-8 pg | Active during build, archived after | PM / engineer | Per feature |
| **Runbook** | 1-3 pg | Living | Service owner | Per critical service / incident type |
| **FAQ** | 1 pg per topic | Living | Topic owner | When a question repeats 3+ times |
| **Onboarding doc** | 2-5 pg | Living | People / founder | Per role |
| **Decision log entry** | 1-3 paragraphs | Permanent | Decider | After any non-trivial decision |
| **Post-mortem** | 2-4 pg | Permanent | Incident commander | After any P1 incident |

## RFC process (the killer feature)
1. Author drafts RFC in Notion / Google Docs (commentable)
2. Shares with stakeholders + open #rfc channel
3. 48-72 hr async comment period
4. Author addresses comments, marks resolved
5. Decision meeting only if disagreement remains (often unnecessary)
6. Decision written into RFC + status changed to Accepted/Rejected
7. Archived under `docs/rfcs/`

**RFC template:**
```
# RFC: <title>
**Author:** <name>
**Status:** Draft / In Review / Accepted / Rejected / Superseded
**Date:** <YYYY-MM-DD>

## Problem
<what's broken or unmet need>

## Proposal
<what we're proposing to do>

## Alternatives considered
1. <alt + why rejected>
2. <alt + why rejected>

## Trade-offs
- Pros: <list>
- Cons: <list>

## Open questions
- <Q + who decides>

## Decision
<filled in at end>
```

## ADR template (lightweight)
```
# ADR <NNNN>: <title>
**Date:** <YYYY-MM-DD>
**Status:** Proposed / Accepted / Superseded by ADR-<N>

## Context
<the forces at play>

## Decision
<what we decided>

## Consequences
<what becomes easier, what becomes harder>
```

Filed under `docs/adr/NNNN-<slug>.md`. Numbered sequentially. Never deleted — superseded.

## Ownership
Every doc has:
- 1 named owner (not "the team")
- A "last reviewed" date
- A review cadence (3 mo / 6 mo / 12 mo / never)

No owner = no doc. Orphaned docs archived after 90 days unowned.

## Decay protection
Docs rot. Old docs are worse than no docs (they mislead).

**Per-doc checklist:**
- Last reviewed date visible at top
- Owner notified on cadence
- "Still accurate?" review takes <5 min for current docs
- Stale > 12 months without review → auto-flag → archive or update

**Quarterly:** owner walks their docs list, archives stale, updates current.

## Embed in workflow
**PR template includes:**
```
- [ ] Updated relevant docs (runbook, ADR, spec)
- [ ] Or: docs N/A because <reason>
```

**Design review requires:**
- Written RFC linked
- 48-hr async review window before sync meeting

**Incident response requires:**
- Post-mortem within 7 days
- Runbook updated within incident week

**Onboarding includes:**
- Day 1: read team values, doc index, last 10 decision-log entries
- Week 1: write 1 onboarding-friction doc ("things confusing as a newcomer")
- Week 4: contribute to 1 existing doc

## The "if it took >15 min to answer in DM" rule
Any question that took you >15 min to answer in a DM = make it a doc. Reply with the doc link going forward. Compound returns over 6 months.

## Doc storage
| Type | Where |
|------|-------|
| RFCs | `docs/rfcs/` in repo OR Notion `/rfcs/` |
| ADRs | `docs/adr/NNNN-<slug>.md` in repo |
| Runbooks | `docs/ops/runbooks/<service>.md` |
| Specs | `docs/design/<feature>.md` |
| FAQs | Notion `/faqs/` |
| Decision log | Notion DB OR `#decisions` channel |
| Post-mortems | `docs/ops/post-mortems/` |
| Onboarding | Notion `/onboarding/` |

**Source of truth rule:** one place per topic. If it exists in 2 places, kill one.

## Tooling pick
| Tool | Best for |
|------|----------|
| GitHub repo `/docs` | Specs, ADRs, runbooks (lives with code) |
| Notion | RFCs, FAQs, onboarding, people docs |
| Linear | Tickets (not long-form docs) |
| Google Docs | Drafts before publishing (commentable) |
| Confluence | Avoid unless mandated |

**Anti-pattern:** docs spread across 5 tools, nobody knows where to look.

## Search + discoverability
- Top-level INDEX doc per area (`docs/README.md`, Notion `/index/`)
- Naming convention: lowercase-kebab, dated when relevant
- Tags / categories enforced
- Slack `/doc <topic>` shortcut (if tooling allows)
- New hire test: can they find X in <2 min? If no → fix discoverability

## Modeling from the top (the only thing that matters)
- Founder writes RFCs, not just emails
- Founder updates the runbook when they fix something at 2 am
- Founder doesn't answer DMs with stuff that should be docs
- Founder publishes weekly written update (not Loom-only)

Doc culture dies the moment leadership exempts itself.

## What's a "doc" (and isn't)
**Is:**
- Searchable, versioned, evergreen content
- Written for someone-else-future (not present-you)
- Linked from somewhere discoverable

**Isn't:**
- Slack message
- DM thread
- Meeting recording (raw)
- Email
- Voice note
- 1:1 conversation

Move from non-doc → doc when content has reuse value.

## Doc style
- Lead with the answer (newspaper style)
- Use H2/H3, not walls of text
- Examples > abstractions
- Date the doc (top + sections that change)
- Link related docs (don't duplicate)
- Cut filler ("In this document we will explore...")
- Active voice
- Short sentences

## Anti-patterns
- ❌ "We don't have time to document" (you don't have time NOT to)
- ❌ Founder exempt from writing
- ❌ Docs in 5 tools, none authoritative
- ❌ No owner per doc
- ❌ Never reviewed, full of stale info
- ❌ Wiki where everything lives + nothing is findable
- ❌ Long preamble before the actual content
- ❌ Documenting after launch only ("we'll write it later" = never)

## Annual review
- Survey team: "what's the doc you wish existed?"
- Audit: top 20 most-viewed docs, are they current?
- Archive: orphan docs > 90 days
- Update: tooling if 1+ failing
- Celebrate: best 3 docs of the year

## Pitfalls flagged
- [ ] Default declared (write first)
- [ ] Doc tiers named
- [ ] RFC + ADR templates
- [ ] Per-doc owner + review cadence
- [ ] Embedded in PR / design / onboarding
- [ ] Storage source of truth
- [ ] Founder models the behavior
- [ ] Annual review scheduled

## Anti-patterns flagged
- ❌ Charter without founder modeling
- ❌ Docs nobody reads
- ❌ Multiple tools, no source of truth
- ❌ Decay tolerance > 12 months
- ❌ Onboarding doesn't reference docs
- ❌ PR merges without doc updates
- ❌ "Tribal knowledge" tolerated

## Next
- Knowledge base → `/knowledge-base-bootstrap`
- ADR writer → `/adr-writer`
- Async charter → `/async-comms-charter`
```

## Verification
- Default stated.
- Doc tiers with templates.
- Owner + review cadence.
- Workflow embed (PR, design, onboarding).
- Storage + source-of-truth.
- Modeling from top called out.
- Annual review scheduled.
