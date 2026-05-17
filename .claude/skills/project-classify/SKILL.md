---
name: project-classify
description: Classify a product idea as XS / S / M / L / XL by scoring it on 5 axes (users, revenue, regulation, concurrency, lifetime). Outputs class + rationale + score breakdown to `docs/classify/<project>.md`. Other Inception/Design skills read this to skip-when wrong class. Use as first step on any new product, when user says "classify project", "what class is this", "size this thing", "/project-classify", or before invoking class-gated skills.
---

# /project-classify — Project Class Gate

Invoke as `/project-classify`. Reads a product brief / PRD / one-line idea and returns a single class label (XS, S, M, L, XL) with rationale. All scale-adaptive skills in this library read the class to decide whether they apply.

---

## Why you'd care

Skills, budget, regulation, and risk all scale with project class — applying enterprise rigor to a weekend project burns time, and applying weekend rigor to an enterprise project ships breaches. Classifying first is what makes every downstream skill sized right.

## Inputs

Accept any of:
- One-line idea ("a CLI todo for my own use")
- Project brief (paragraph)
- Existing PRD at `issues/prd.md`
- Conversation context (if user has been describing the idea)

If input ambiguous, ask 3 short questions covering the weakest-signal axes (usually revenue + regulation + concurrency).

---

## 5-axis rubric

Score each axis 0–4. Sum → class.

| Axis           | 0 (XS)            | 1 (S)             | 2 (M)                | 3 (L)                       | 4 (XL)                          |
|----------------|-------------------|-------------------|----------------------|-----------------------------|---------------------------------|
| **Users**      | 1 (self)          | 10s (friends)     | 1k (indie launch)    | 10k–100k (commercial)       | 1M+ or critical-infra           |
| **Revenue**    | none              | donation / tip    | indie SaaS $20–100/mo| commercial $100–10k/mo      | enterprise contract / regulated |
| **Regulation** | none              | GDPR cookies      | GDPR + payment (PCI) | GDPR + payment + sector     | bank / health / gov (SOC2/HIPAA/PCI-DSS) |
| **Concurrency**| single-user CLI   | single-user web   | many users, async    | realtime (websocket, 1k+ concurrent) | global realtime (100k+ concurrent) |
| **Lifetime**   | throwaway (weeks) | months            | 1–3 years            | 3–10 years                  | decade+ / legally retained      |

---

## Score → class

| Sum   | Class |
|-------|-------|
| 0–3   | **XS** |
| 4–7   | **S**  |
| 8–12  | **M**  |
| 13–17 | **L**  |
| 18–20 | **XL** |

Tie-breaker: if any single axis = 4, bump up one class (regulation or concurrency at max → never XS/S).

---

## Output template

Write to `docs/classify/<project-slug>.md`:

```markdown
# Classification — <project name>

**Class: <XS | S | M | L | XL>**
**Score: <sum> / 20**
**Date: <YYYY-MM-DD>**

## Axis scores

| Axis        | Score | Rationale                                      |
|-------------|------:|------------------------------------------------|
| Users       |     X | <one line>                                     |
| Revenue     |     X | <one line>                                     |
| Regulation  |     X | <one line>                                     |
| Concurrency |     X | <one line>                                     |
| Lifetime    |     X | <one line>                                     |

## Implications

- Skills that auto-skip at this class: <list>
- Skills that activate at this class: <list>
- Next recommended skill: <one>

## Re-classify when

- Pivot to paid tier
- Add multi-user / realtime
- Enter regulated market
- Cross 1k users
```

**Do NOT add a `stage:` field to this front-matter.**
`/project-status` Stage Detection reads filesystem signals only (PRD
file, issues/, dependency manifest, code, tests, branch state). A
classify-front-matter `stage:` is silently ignored — pinning it here
will mislead future readers and is a maintenance trap. If you want to
force a stage for a test scenario, seed the filesystem signals
(`/write-a-prd`, `/prd-to-issues`, etc.) instead.

---

## Examples

| Product                             | U | R | Reg | C | L | Sum | Class |
|-------------------------------------|--:|--:|----:|--:|--:|----:|-------|
| Personal CLI todo                   | 0 | 0 |   0 | 0 | 0 |   0 | XS    |
| Hobby blog with comments            | 1 | 0 |   1 | 1 | 1 |   4 | S     |
| Indie SaaS reservation widget       | 2 | 2 |   2 | 2 | 2 |  10 | M     |
| Multiplayer chess platform          | 3 | 3 |   2 | 4 | 3 |  15 | L     |
| Bank mobile app                     | 4 | 4 |   4 | 3 | 4 |  19 | XL    |

---

## When to re-run

Re-classify on pivot, scope change, or every 6 months. Class can drift up (rare to drift down).
