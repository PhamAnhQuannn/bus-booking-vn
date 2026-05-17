---
name: knowledge-base-bootstrap
description: Knowledge base bootstrap — wiki structure, taxonomy, search, page templates, ownership, archive rules. Outputs to `docs/inception/knowledge-base-bootstrap-<project>.md`. Use when user says "knowledge base", "KB", "wiki", "internal wiki", "Notion structure", "Confluence structure", "/knowledge-base-bootstrap", or before team past 5.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /knowledge-base-bootstrap — Wiki Without Structure = Search-Engine For Stale Stuff. Bootstrap It Right Once.

## Why you'd care

Without an early KB structure, every team past 5 people drowns in tribal knowledge and the same questions get re-answered in Slack threads forever. Bootstrapping the taxonomy + ownership before the team scales is the cheap moment to do it.

KB ≠ dump folder. KB = curated, owned, searchable, decayed-on-purpose. Get the skeleton right early — retroactive reorganization of 500 pages is a 2-week project nobody volunteers for.

## Pre-flight
Run before team past 5 OR when "where is X documented?" becomes a daily question. Pairs with `/documentation-culture-charter`, `/async-comms-charter`.

## Inputs
- Tooling pick (Notion / Confluence / Coda / GitBook / GitHub wiki / Obsidian).
- Existing docs (where do they live? Bring in or rewrite?).
- Team structure (departments / squads).
- Public vs private — separate KB for customer-facing docs?

## Process
1. **Pick the tool** — one tool, single source of truth.
2. **Lay out the taxonomy** — top-level categories before any pages.
3. **Define page templates** — RFC / runbook / FAQ / onboarding / spec.
4. **Assign ownership** — every section has a named owner.
5. **Set search + naming conventions** — discoverability is the product.
6. **Define archive rules** — what gets killed when.
7. **Seed with the 20 must-have pages** — onboarding day-1 reads.

## Output
Write `docs/inception/knowledge-base-bootstrap-<project>.md`:

```markdown
# Knowledge Base Bootstrap — <project>
**Tool:** <Notion / Confluence / GitBook / Obsidian / GitHub wiki>
**URL:** <kb.<co>.com or workspace URL>
**Owner:** <Chief of Staff / Head of People / founder>
**Date:** <YYYY-MM-DD>

## Top-level taxonomy
Hard rule: max 7 top-level categories. More = forest, fewer = miscellaneous-bucket-from-hell.

| Category | What lives here | Owner |
|----------|----------------|-------|
| 🏢 Company | Vision, values, history, org chart, OKRs | Founder / COO |
| 👋 Onboarding | New-hire week 1 reads, role-specific guides | People / Hiring manager |
| 🛠️ Engineering | RFCs, ADRs, runbooks, architecture, specs | Head of Eng |
| 📈 Go-to-Market | Pricing, positioning, sales playbook, marketing | Head of Sales / CRO |
| 💼 People & Ops | Policies, benefits, expense, travel, IT | People / Ops |
| 📚 Reference | FAQs, glossary, vendor list, tool guides | Per-doc owners |
| 📦 Archive | Old / superseded / retired | KB owner |

Each top-level page = an index, not content. Content lives 1-2 levels deep.

## Per-category page templates

### 🏢 Company pages
- Vision + 5-yr direction
- Operating values (linked to /values-charter)
- Code of conduct (linked to /code-of-conduct)
- Cap table summary (high-level, not sensitive)
- Org chart (current)
- Quarterly OKRs (current + last)
- All-hands deck archive
- History / founding story

### 👋 Onboarding pages
- Week 1 reading list
- Role-specific onboarding (eng / sales / CS / ops)
- Tool stack + how to access
- "How we work" — async comms charter, doc culture
- First-month milestones
- 30/60/90-day expectations

### 🛠️ Engineering pages
- Architecture overview + diagram
- ADR index (`/adr/`)
- RFC index (`/rfcs/`)
- Service catalog (1 page per service)
- Runbook index (`/runbooks/`)
- On-call rotation + escalation
- Tech radar (adopt / trial / assess / hold)
- Coding standards
- PR + review process
- Incident response process

### 📈 GTM pages
- ICP + buyer persona
- Pricing + packaging
- Sales playbook (linked to /sales-playbook-skeleton)
- Competitive battlecards
- Customer reference list
- Press kit
- Brand guidelines

### 💼 People & Ops pages
- Employee handbook
- Comp + leveling
- Benefits + PTO + parental leave
- Expense policy
- Travel + business expense
- IT + provisioning
- Performance review cycle
- Holidays + working hours

### 📚 Reference pages
- Glossary (acronyms, internal jargon)
- Vendor list (who we pay, contract owner)
- Tool guides (per-tool how-to)
- FAQs (organized by topic)
- Brand assets

## Page templates (pinned at top of section)

### RFC template
```
# RFC: <title>
**Author:** | **Status:** Draft / Review / Accepted / Rejected | **Date:**

## Problem
## Proposal
## Alternatives
## Trade-offs
## Open questions
## Decision
```

### Runbook template
```
# Runbook: <service / scenario>
**Owner:** | **Last reviewed:** | **Severity:** P1/P2/P3

## Symptoms
## Diagnosis
## Remediation (step-by-step)
## Escalation
## Related
```

### FAQ template
```
# FAQ: <topic>
**Owner:** | **Last updated:**

## Q1
A1

## Q2
A2
```

### Spec template
```
# Spec: <feature>
**Owner:** | **Status:** | **Target ship:**

## Problem
## Solution
## Scope (in / out)
## Success metrics
## Risks
```

## Naming conventions
- Lowercase-kebab-case file/page names (`/runbook-stripe-webhooks`)
- Dates use `YYYY-MM-DD`
- Acronyms uppercase only when standard (`RFC-042`, `ADR-013`)
- No spaces in URLs (use - or _)
- No version numbers in names (use page history)

## Search + discoverability
- Search bar prominent on landing page
- Tagging: every page tagged with 1-3 tags (`engineering`, `onboarding`, `runbook`)
- Cross-linking: every page links to 2-3 related pages
- TOC for pages > 1000 words
- Top-of-page summary (5 lines) for skim-readers
- Last-updated date visible

**Discoverability test:** new hire finds X in <2 min. If no → fix the index.

## Per-page header (standard)
```
**Owner:** <name>
**Status:** Active / Draft / Stale / Archived
**Last reviewed:** <YYYY-MM-DD>
**Review cadence:** 3 mo / 6 mo / 12 mo / never
**Tags:** <tag1>, <tag2>
```

## Ownership rules
- Every page has 1 named human (not "the team")
- Owner reviews on cadence
- Orphaned pages (no owner) → auto-archive after 90 days
- Owner changes role → KB owner reassigns

## Permissions
| Tier | Who | Access |
|------|-----|--------|
| Public KB | Anyone | View only |
| Internal | All employees + contractors | View + comment |
| Sensitive (Finance, HR) | Specific roles | View |
| Drafts | Author | Edit |

Default: internal-view, edit-by-section-owner.

## Archive rules
- Status = Stale after 12 months no review
- Status = Archived after 18 months no review OR superseded
- Archived pages move to `📦 Archive` (not deleted)
- Search results filter archived by default (toggle to include)
- Superseded pages link forward to replacement

## Seed pages (the 20 must-haves on day 1)
1. Welcome / read-me-first
2. Org chart
3. Values charter
4. Code of conduct
5. Async comms charter
6. Documentation culture charter
7. Onboarding — week 1 checklist
8. Tool stack + access
9. Holiday + PTO policy
10. Expense policy
11. IT provisioning guide
12. Engineering architecture overview
13. Service catalog (stub)
14. Runbook index (stub)
15. ICP + buyer persona
16. Pricing summary
17. Sales playbook (stub)
18. Glossary
19. Vendor list
20. FAQ landing page

Seed before first hire. Even if stubs.

## Migration from existing docs
- Inventory current locations (Slack pins, Google Docs, Confluence, etc.)
- Triage: keep / merge / archive
- Move keep-pages with edit pass (date, owner, cleanup)
- Redirect old links where possible
- Old locations announce "moved to KB" for 30 days then disable

Budget: 2 weeks for an existing team's docs.

## Maintenance cadence
- **Weekly:** KB owner spot-checks 5 random pages for staleness
- **Monthly:** auto-report of pages > 6 months no review → owners notified
- **Quarterly:** owners walk their pages, update / archive
- **Annually:** taxonomy review (cut / merge categories)

## Anti-patterns
- ❌ Multiple wikis (Notion + Confluence + Google Docs) = 0 source of truth
- ❌ Top-level "Misc" / "Other" category
- ❌ No owner per page
- ❌ Pages with no last-reviewed date
- ❌ Search returns 50 results for "expense policy" because 50 versions exist
- ❌ Permissions so locked nobody can find anything
- ❌ Permissions so open sensitive info leaks
- ❌ "Living document" without review cadence = stale document

## Tool comparison
| Tool | Best for | Cost | Pain points |
|------|----------|------|-------------|
| Notion | Most teams seed-Series B | $$ | Search is mid; can get messy |
| Confluence | Enterprise / Atlassian shops | $$$ | Heavy, slow, dated UX |
| GitBook | Public-facing docs + internal | $$ | Less flexible for non-tech content |
| Coda | Heavy ops / data-in-doc | $$ | Learning curve |
| GitHub wiki | Eng-only orgs | Free | Weak for non-eng content |
| Obsidian | Solo / small team / local-first | Free | No real-time multi-user |

Default pick at seed-Series A: Notion. Migrate later only if pain forces it.

## Pitfalls flagged
- [ ] Single tool picked
- [ ] Top-level taxonomy ≤ 7 categories
- [ ] Page templates pinned
- [ ] Owner + review cadence per page
- [ ] Naming convention enforced
- [ ] 20 seed pages exist
- [ ] Permissions tiered
- [ ] Maintenance cadence scheduled

## Anti-patterns flagged
- ❌ Multiple wikis tolerated
- ❌ Free-for-all naming
- ❌ No archive flow
- ❌ Founder doesn't model writing
- ❌ KB launched then abandoned
- ❌ No search-discoverability test

## Next
- Documentation culture → `/documentation-culture-charter`
- Async comms → `/async-comms-charter`
- Onboarding doc → embedded in employee handbook (`/employee-handbook-skeleton`)
```

## Verification
- Single tool picked.
- Top-level taxonomy ≤ 7.
- Page templates defined.
- Per-page owner + review cadence.
- Naming + search conventions.
- 20 seed pages listed.
- Permissions tiered.
- Maintenance cadence scheduled.
