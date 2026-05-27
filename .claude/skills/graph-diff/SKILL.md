---
name: graph-diff
description: Deterministic blast-radius + staleness check against the persisted knowledge graph. Reads `git diff --name-only` + .understand/graph.json, walks incoming edges to list what depends on each changed file, flags graph nodes whose fingerprint no longer matches (stale), and names unmapped files. Warn-only — never rebuilds the graph, never edits source. Use before a commit, after an edit, when the user asks "what depends on this", "what breaks if I change X", "blast radius", "/graph-diff", or when `/commit-split` is about to run.
output_size:
  XS: skip
  S: 30m
  M: 30m
  L: 1h
  XL: 1h
---

# /graph-diff — Blast-radius & Staleness Check

Invoke as `/graph-diff`. Reads what you changed (`git diff`) against the persisted knowledge graph and answers two questions before you commit: **what depends on the files I touched**, and **which parts of the graph are now stale**. Pure read — never rebuilds the graph, never edits source. The query half of the `/knowledge-graph` pair (which is the build half).

---

## Why you'd care

"I changed `momo.ts` — what breaks?" is a question you either answer by an edge lookup, or by re-opening eight files and hoping you remember them all. The graph already knows who calls and imports the thing you touched; this skill reads that out in a second and names the dependent you'd otherwise discover in production. It's the cheap, deterministic check that runs every time — the expensive LLM rebuild (`/knowledge-graph`) runs only when you choose.

**Cost note:** this skill does **no** source-file Reads and **no** LLM enrichment — it's JSON traversal of `edges[]`. That's deliberate: it can run on every commit without re-triggering a context blowup.

---

## Pre-flight

1. Anchor to repo root (`git rev-parse --show-toplevel`); fall back to invocation cwd if not git.
2. **Changed set:** `git diff --name-only` + `git diff --name-only --cached` → union of working + staged changes. Add `git diff --name-only --diff-filter=D` to know which files were **deleted**. If git is absent, ask the user for the changed-file list or stop with a one-line note.
3. **Load graph:** `Read .understand/graph.json`. **If absent → STOP** with one line: `no graph yet — run /knowledge-graph <subsystem> first`. Nothing to diff against.
4. **Current fingerprints:** `git hash-object <file>` for each changed (non-deleted) file (mtime+size fallback when not git). Hold for Pass 3.

Read `.claude/skills/knowledge-graph/refs/node-edge-schema.md` if you need the exact node/edge id shapes — only needed when edge-type semantics are unclear.

---

## Pass 1 — Resolve changed nodes

For each changed file path, find its `file:<path>` node, then collect the nodes it `contains` (the `function:`/`class:`/`endpoint:`/`table:`/`schema:` nodes whose `path` equals the changed file). Together these are the **changed nodes**.

- Changed file with **no** matching node → add to **UNMAPPED** (graph never covered it).
- **Deleted** file → its nodes are **orphaning**: anything still pointing at them is a now-broken dependency. Flag separately in Blast radius.

---

## Pass 2 — Blast radius (reverse edge walk)

For each changed node, scan `edges[]` for every edge whose **`target`** is that node id — those sources are its dependents. Relevant incoming types:

| Edge into changed node | Means | So a change may… |
|---|---|---|
| `imports` | a file imports this file | break the importer's build |
| `calls` | a function/endpoint calls this | break the caller's behavior |
| `depends_on` | code reads/writes this table | break on schema/shape change |
| `inherits` | a subclass extends this class | break the subclass |
| `tested_by` | a test covers this | tests need updating/rerunning |

- Report **1-hop** dependents always.
- Optionally report **2-hop** (dependents of dependents), clearly labelled `(2-hop)`, capped at ~15 — never expand unbounded.
- De-dup; group dependents under each changed node. This is pure `edges[]` traversal — do not Read source.

---

## Pass 3 — Staleness

For each changed (non-deleted) file, compare its current `git hash-object` to the stored `fingerprint` on its node. **Mismatch → STALE**: the graph's summary/tags/edges for that node predate this edit, so the blast radius above may itself be slightly out of date (an edge added in this edit isn't in the graph yet).

- Group STALE nodes by subsystem (shared top dir) and name the exact re-map command: `/knowledge-graph <subsystem>`.
- **Do not run it.** Warn only.
- UNMAPPED files (Pass 1) are reported as "consider mapping" — also a `/knowledge-graph` suggestion, not an action.

---

## Output Format

```
GRAPH DIFF
──────────
Date: <YYYY-MM-DD>
Changed: <n> files (<s> staged, <w> working, <d> deleted)
Graph: .understand/graph.json (<N> nodes, <M> edges)

─── Blast radius ───

lib/payment/momo.ts  (function:…#verifySignature)
  ← endpoint  POST /api/webhooks/momo        [calls]
  ← file      lib/payment/index.ts            [imports]
  ← test      __tests__/momo.test.ts          [tested_by]
  ← (2-hop)   endpoint POST /api/bookings     [calls → index.ts]

prisma/schema.prisma  (table:Booking)
  ← endpoint  POST /api/bookings              [depends_on]
  ← function  lib/booking/createHold.ts#hold  [depends_on]

⚠ DELETED  lib/legacy/vnpay.ts — 1 node still referenced:
  ← file      lib/payment/index.ts            [imports]  ← broken import

─── Stale (graph predates these edits) ───

payment   → run  /knowledge-graph payment        (momo.ts fingerprint changed)
booking   → run  /knowledge-graph booking schema  (schema.prisma changed)

─── Unmapped (not in graph) ───

lib/payment/zalopay.ts — never mapped; consider /knowledge-graph payment

VERDICT: 5 dependents to review · 1 broken-by-delete · 2 stale regions · 1 unmapped

--- OR ---

VERDICT: CLEAN — no graph dependents on changed files, graph fresh, all files mapped.
```

---

## Auto-chain

- Chains **from** `/verify` and **before** `/commit-split` — see the blast radius before you stage, not after.
- A flagged dependent with **no** `tested_by` edge → suggest `/coverage-map` then `/tdd` for that dependent before committing the change.
- A `⚠ broken-by-delete` finding → the deletion left a dangling import; suggest `/atomic-file-edit` to fix all call sites in one pass.

## Integration

- **Warn-only contract:** never writes `.understand/graph.json`, never edits source, never invokes `/knowledge-graph`. Reads and reports only. Re-mapping is always the user's explicit call.
- **Output cap:** if total dependents exceed ~60, print every 1-hop dependent in full and collapse 2-hop to counts. Never truncate 1-hop.
- **Git-hook note:** this is a markdown skill, not a bundled script (per the library's no-bundled-scripts norm), so it cannot fire autonomously inside a real git pre-commit hook. For automatic firing, either let `/autopilot` / `/commit-split` chain to it, or add a small deterministic JSON-traversal script in the product repo that does the same reverse-edge lookup — out of scope here.
- **Skill complete** when the three blocks (Blast radius, Stale, Unmapped) and the VERDICT are emitted.
