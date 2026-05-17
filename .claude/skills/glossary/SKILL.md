---
name: glossary
description: Per-project glossary so jargon, acronyms, and domain terms collapse to one canonical definition. Outputs to `docs/glossary.md`. Also defines the "why-you'd-care" header convention every skill SKILL.md should adopt for readability. Use when user says "glossary", "what does X mean", "define our terms", "acronyms", "/glossary", or when a PM/junior dev reports skill names are opaque.
output_size:
  XS: 30m
  S: 30m
  M: 1h
  L: 1h
  XL: 2h
---

# /glossary — One Source of Truth for Jargon

## Why you'd care

Without a canonical glossary, every new hire spends weeks decoding jargon and every doc redefines the same term three different ways. One file kills the ambiguity tax for everyone after.

Invoke as `/glossary`. Two outputs:
1. `docs/glossary.md` — project-specific term sheet.
2. The "why-you'd-care" header convention all SKILL.md files should adopt so a non-expert can decide in 10s whether to read further.

## Pre-flight
1. Read `docs/classify/<project>.md` if exists.
2. Walk codebase + docs for acronyms (regex `\b[A-Z]{2,6}\b`), domain nouns, and product-specific jargon.

## Inputs
- Codebase (for grep-able acronyms)
- Existing docs (READMEs, design docs)
- Skill names in scope (for the "why-you'd-care" pass)
- Audience (engineers / PMs / new hires / customer-facing)

## Process

### Part A — Project glossary

1. **Acronym sweep** — grep all-caps 2-6 letter runs. Dedupe. For each, write expansion + 1-line definition.
2. **Domain noun sweep** — terms that mean different things in different industries (e.g., "tenant" = SaaS account vs. building lessee vs. K8s namespace).
3. **Internal-only terms** — code names, project nicknames, in-flight features.
4. **Disambiguate** — when one term has two meanings in the codebase, both go in with `(context: X)` tag.
5. **Cross-link** — every glossary entry that names another glossary term links to it.
6. **Owner per entry** — who to ping when definition is contested.

### Part B — "Why-you'd-care" SKILL.md header convention

Problem: skill names like `north-star-instrumentation`, `dora-metrics`, `traction-stage-gate` are opaque to non-experts. Bootcamp-grad readers in PM-eval rated naming axis 2/5.

Fix: every SKILL.md starts with a one-line header in plain English:

```markdown
---
name: north-star-instrumentation
description: ...
output_size: ...
---

# /north-star-instrumentation — Wire the One Metric

> **Why you'd care:** Pick the single number your whole company watches every day, and wire it so every dashboard shows the same value. Without this, leadership and engineering argue over which chart is right.

## Pre-flight
...
```

Rules:
- One sentence describing WHAT problem this skill solves in plain English (no jargon from the skill name itself).
- A second sentence describing what BREAKS if you skip it.
- No marketing fluff. Concrete failure mode.
- Goes between the H1 title and the first H2 section.

### Part C — Skill name aliasing

For irreducibly technical names (`dora-metrics`, `pci-dss-scope`), add a `aliases:` line to frontmatter so plain-English invocations route to them:

```yaml
aliases:
  - engineering-health-metrics
  - deploy-frequency
  - shipping-velocity
```

## Output

Write `docs/glossary.md`:

```markdown
# Glossary — <project>
**Date:** <YYYY-MM-DD> | **Owner:** <person>

## How to use
- One canonical definition per term.
- Contested? Open PR against this file, owner reviews.
- Search by term or acronym.

## Terms

### A
- **ACV** (Annual Contract Value) — total $ value of a customer contract for one year. Distinct from MRR×12 when contract has ramp. Owner: @sales-ops
- **API gateway** — single entry point routing to internal services. We use Kong. Owner: @platform
- ...

### D
- **DPA** (Data Processing Agreement) — GDPR-required contract between controller and processor. We sign customer-facing DPAs; we sign vendor-facing DPAs upstream. Owner: @legal
- **DORA metrics** — see [[dora-metrics]] skill. Four engineering health numbers. Owner: @eng-leadership
- ...

### N
- **NSM** (North Star Metric) — see [[north-star-instrumentation]] skill. The one number the company orients around. Distinct from KPIs (plural, team-level). Owner: @product
- ...

## Disambiguation
- **Tenant**:
  - (context: SaaS) — paying customer org with isolated data
  - (context: K8s) — namespace
- **Pipeline**:
  - (context: data) — ETL job
  - (context: CI) — build/test/deploy steps

## Owners
| Domain | Owner |
|---|---|
| Sales/CS | @sales-ops |
| Eng | @eng-leadership |
| Legal | @legal |
| Product | @product |
```

Also: open PRs against existing skills adding the "Why you'd care" line where missing. Backlog the rest into per-pack housekeeping passes.

## Verification
- Every acronym in the codebase has an expansion in glossary.
- Every contested term has a single owner.
- Cross-references to skill names use `[[skill-name]]` form.
- Top 20 most-invoked skills have a "Why you'd care" line.
- Bootcamp-grad reader can scan SKILL.md H1 + "Why you'd care" line and decide in 10s whether skill applies.
