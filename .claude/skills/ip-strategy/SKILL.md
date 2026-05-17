---
name: ip-strategy
description: IP strategy — patents / trademarks / trade secrets / open source / defensive publication. Outputs to `docs/inception/ip-strategy-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "IP strategy", "patent", "trademark", "/ip-strategy", or before disclosure / launch.
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 2h
  XL: 4h
---

# /ip-strategy — IP Strategy

## Why you'd care

Founders disclose at conferences, ship without provisional filings, and publish patentable ideas in blog posts — then realize a year later the moat is gone. The strategy doc forces the file-now vs trade-secret vs open-source decision before disclosure.

Invoke as `/ip-strategy`. Most software ≠ patentable. Trademark + trade-secret + brand = real IP.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S → SKIP (lean approach: trademark + trade-secret only)
2. Read `docs/inception/category-<project>.md` + `competitive-moat-<project>.md` if exist.

## Inputs
- Core inventions / novel methods.
- Brand assets (name, logo, mark).
- Confidential know-how (algorithms, data, processes).
- Open-source dependencies + license obligations.

## Process
1. **Per-asset classification**:
   - **Patent** — novel + non-obvious + useful + within patentable subject matter (US: not abstract idea alone). Cost $10k–$50k each, 3–5 yr to grant.
   - **Trademark** — brand name, logo, slogan. $250–$2000 per class. File ITU early.
   - **Trade secret** — protect via NDA + access control + employment IP-assignment.
   - **Copyright** — automatic on creation; register $65 for litigation rights.
   - **Open source publish** — defensive (prior art) or community-build strategy.
   - **Defensive publication** — publish to block competitor patent.
2. **Patent decision tree**:
   - Software-only (no novel hardware/algo)? → trade secret usually better
   - Algo with measurable improvement? → maybe patent (high cost/value)
   - Process/method patent → narrow + check prior art
   - Avoid: vague feature patents, "patent troll" magnets
3. **Trademark priorities**:
   - Brand name in primary class (e.g. Class 9 software, Class 42 SaaS)
   - File ITU (Intent-To-Use) early
   - Multi-class if multi-product
   - Geo: US first, then EU (EUIPO), key markets
4. **Trade secret hygiene**:
   - NDAs with all employees + contractors
   - IP assignment in employment agreement
   - Access controls (need-to-know)
   - Document marking ("Confidential")
   - Exit interviews + return-of-materials
5. **Open source compliance**:
   - SBOM (software bill of materials)
   - License compatibility check (GPL contamination risk)
   - Attribution per license (BSD, MIT, Apache)
   - Avoid AGPL in proprietary closed-source product
6. **Defensive publishing** — for non-patent inventions, publish blog/paper to block others patenting it.

## Output
Write `docs/inception/ip-strategy-<project>.md`:

```markdown
# IP Strategy — <project>
**Date:** <YYYY-MM-DD>

## Asset inventory
| Asset | Type | Strategy | Owner | Priority |
|---|---|---|---|---|
| Brand name "<X>" | Trademark | file ITU US Class 9, 42 | founder | P0 |
| Logo | Trademark + copyright | TM after pivot-stable | founder | P1 |
| Algorithm <Y> | Trade secret | NDA + access control | tech | P0 |
| Method <Z> (patentable?) | Patent provisional? | file PPA $200 to lock date | tech | P2 |
| Codebase | Copyright | automatic | company | P0 |
| Customer data | Trade secret + privacy | encrypted + NDA | ops | P0 |

## Trademark plan
| Mark | Class | Geo | Type | Filing date | Cost |
|---|---|---|---|---|---|
| <brand name> | 9 (software) | US | ITU | Q1 | $350 |
| <brand name> | 42 (SaaS) | US | ITU | Q1 | $350 |
| <brand name> | 9, 42 | EUIPO | direct | Q3 | $1100 |
| <logo> | 9, 42 | US | direct after stable | Q4 | $700 |

## Patent strategy
- Decision: <patent / no patent / provisional only>
- Reason: <e.g. software algo too abstract / would advertise method>
- If provisional: $200 + own filing, locks 12-mo priority date
- If full: $15k+ per patent — only worth if material competitive moat

## Trade secret protocol
- ✓ Employment IP assignment in offer letter
- ✓ Mutual NDA template for all contractors
- ✓ Access control: principle of least privilege
- ✓ Exit checklist: return materials + remind ongoing duty
- ✓ Document marking "Confidential — <Co>"
- ✓ Codebase access: no public repo of trade-secret code

## Open source compliance
- SBOM tool: Syft / dependency-track / Snyk
- License audit: avoid AGPL in proprietary; flag GPL
- Attribution: maintain THIRD-PARTY-NOTICES.md
- Contribution policy (if accept external PRs): CLA via cla-assistant

## Defensive publishing
- For each non-patent invention: blog post + arXiv (if research-y)
- Establishes prior art; blocks competitor patent

## IP risk audit
| Risk | Mitigation |
|---|---|
| Competitor TM exists | clearance search before file (USPTO TESS, EUIPO TMview) |
| GPL contamination | license scan in CI |
| Employee leaves with IP | strong agreement + exit IP-return |
| Patent troll claim | E&O insurance covers |

## Verdict
**IP-PROTECTED / GAPS (list) / EXPOSED**

## 12-mo IP plan
- Q1: TM file US, NDA template rollout
- Q2: provisional patent (if any), TM EU
- Q3: open source SBOM + license audit live
- Q4: full patent if PPA matured
```

## Verification
- Each asset has type + strategy + priority.
- TM clearance done (USPTO TESS check).
- Patent decision justified (not "patent everything" anti-pattern).
- Trade secret hygiene checklist.
- Open source compliance plan.
