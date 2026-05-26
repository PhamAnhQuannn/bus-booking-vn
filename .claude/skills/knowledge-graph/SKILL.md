---
name: knowledge-graph
description: Build an incremental, queryable knowledge graph of a codebase subsystem — nodes (files/functions/classes/endpoints/tables) + edges (imports/calls/contains/routes/…) extracted via Grep/Glob, summarized by the LLM, persisted to .understand/graph.json and rendered as Mermaid. Advisory only — never modifies source. Use when the user says "map this", "knowledge graph", "how does <subsystem> fit together", "what calls X", "diagram this flow", or "/knowledge-graph".
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 1h
  XL: 2h
---

# /knowledge-graph — Subsystem Knowledge Graph Builder

## Why you'd care

An unfamiliar subsystem is a guessing game played one Read at a time: you open a route handler, chase its imports, forget where you started, re-open the same file an hour later. A persisted graph turns "what touches the payment webhook?" into a lookup instead of a re-read — and survives across sessions, so the map you build today is still there next week. The graph is the cheap, durable substitute for re-deriving structure from raw source on every question.

Invoke as `/knowledge-graph <subsystem>` (a directory, feature, flow, or file). Maps **one subsystem per run** and merges it into a growing repo-wide graph — build the whole picture incrementally, never in one context-blowing pass. Advisory only — never modifies source.

**Stack assumption:** patterns below target Next.js + Prisma (`app/`, `components/`, `lib/`, `prisma/`). For other stacks, run `/stack-profile` first and re-map the globs (`src/` for Vite, `pages/` for old Next.js, `apps/<name>/` for monorepos, package modules for Python).

---

## Scope

One subsystem per run. The target set =
- the files the user named (dir glob, feature dir, or explicit file list), **plus**
- their **1-hop neighbors** — files they directly import (resolved from the import patterns, project-internal only; node_modules excluded).

Do **not** expand past 1 hop. Neighbors enter the graph as nodes but are not themselves re-expanded this run; a later `/knowledge-graph <neighbor>` deepens them.

Excluded everywhere: `node_modules/`, `dist/`, `build/`, `.next/`, `*.d.ts`, `public/`, `.claude/`, `docs/`, `*.test.*`, `*.spec.*`.

---

## Pre-flight

1. Anchor to repo root (`git rev-parse --show-toplevel`); fall back to the invocation cwd if not a git repo.
2. **Resolve scope.** Turn the user's argument into a concrete file list via Glob. Add 1-hop import neighbors (see Scope). If the argument is ambiguous (no matching files), ask once for a dir or file — do not guess.
3. **Load prior graph.** `Read .understand/graph.json` if it exists; parse `nodes[]`/`edges[]` into memory. If absent, start with an empty graph (`{ version: 1, nodes: [], edges: [] }`).
4. **Fingerprint targets.** For each target file run `git hash-object <file>` (mtime+size fallback when not a git repo). If a stored node for that `path` carries the same `fingerprint`, mark the file **UNCHANGED** → reuse its node/edges verbatim, skip Pass 2 for it. Only **CHANGED**/new files go through full analysis.

---

## Pass 1 — Structural extraction (deterministic)

Grep/Glob only — no interpretation. Apply the patterns in `refs/extraction-patterns.md` across the (CHANGED + new) target files to emit raw candidates:

- **Nodes:** one `file:` node per target; `function:`/`class:` nodes per definition; `endpoint:` per route handler; `table:`/`schema:` per Prisma model.
- **Edges:** `imports` (per import statement), `exports`, `contains` (file→its functions/classes), `calls` (call sites resolving to a known node), `routes` (endpoint→handler), `defines_schema`/`depends_on` for data.

**Honesty rule (from Understand-Anything's file-analyzer):** `imports` edges are enumerated **1:1** from the grep import matches — the count of `imports` edges MUST equal the number of internal import statements grep found. No invented edges; no edge whose source or target isn't a node you created. What regex can't see (dynamic `import()`, re-exports), you don't claim.

Read `refs/node-edge-schema.md` for the full node/edge type catalogue and id-prefix rules when you need them.

---

## Pass 2 — Semantic enrichment (LLM)

For CHANGED/new files only, `Read` the source and enrich each node:
- `summary` — one line, what it does.
- `tags` — 3–5 lowercase tags (`payment`, `webhook`, `auth`, `prisma`, …).
- `complexity` — `simple` | `moderate` | `complex`.
- `layer` — `API` | `Service` | `Data` | `UI` | `Util` (assign by role, not folder alone).

Confirm Pass 1 edges and set `weight` 0.5–1.0 (1.0 = certain import/contains; lower for inferred calls). Reused (UNCHANGED) nodes keep their existing enrichment — do not re-Read them.

---

## Pass 3 — Merge + incremental

Merge the subgraph into the loaded global graph:
- **Upsert by node `id`.** New id → add. Existing id, file CHANGED → replace node + refresh `fingerprint`. UNCHANGED → leave as-is.
- **Edges:** drop every edge whose endpoint node no longer exists (deleted files), then add this run's edges; de-dup on `(source,target,type)`.
- Update top-level `generatedAt`.

---

## Pass 4 — Review (referential integrity)

Before writing, validate (Understand-Anything's graph-reviewer job):
- No edge points at a missing node id (no dangling targets).
- No duplicate node ids.
- No self-edges (`source === target`).
- Report orphan nodes (no edges) as a note — not an error.

If any check fails, fix the offending edge/node, don't emit a broken graph.

---

## Output Format

Write **two** artifacts to the target repo.

**1. `.understand/graph.json`** — the machine graph (committable):

```json
{
  "version": 1,
  "generatedAt": "<ISO-8601>",
  "nodes": [
    {
      "id": "endpoint:app/api/webhooks/momo/route.ts#POST",
      "type": "endpoint",
      "name": "POST /api/webhooks/momo",
      "path": "app/api/webhooks/momo/route.ts",
      "summary": "Verifies MoMo HMAC, marks booking paid.",
      "tags": ["payment", "webhook", "momo"],
      "complexity": "complex",
      "layer": "API",
      "fingerprint": "<git-blob-sha>"
    }
  ],
  "edges": [
    { "source": "endpoint:...#POST", "target": "function:lib/payment/momo.ts#verifySignature", "type": "calls", "direction": "forward", "weight": 0.9 }
  ]
}
```

**2. `docs/maps/knowledge-graph-<subsystem>.md`** — the human view:

```
# Knowledge Graph — <subsystem>
Generated: <YYYY-MM-DD> · Nodes: <n> · Edges: <m> · Run scope: <files mapped> (<k> reused unchanged)

## Diagram

​```mermaid
graph TD
  EP["POST /api/webhooks/momo"]:::api --> VS["verifySignature()"]:::util
  VS --> BK["booking (table)"]:::data
  classDef api fill:#dae8fc; classDef service fill:#d5e8d4; classDef data fill:#ffe6cc; classDef ui fill:#fff2cc; classDef util fill:#f8cecc;
​```

## Nodes by layer

### API
| Node | Summary | Complexity |
|---|---|---|
| `POST /api/webhooks/momo` | Verifies MoMo HMAC, marks booking paid. | complex |

### Service / Data / UI / Util
…

## Entry points
- `POST /api/webhooks/momo` — external (MoMo callback)

## Notes
- Orphans: none. Regex-invisible edges skipped: <count or none>.
```

---

## Auto-chain

- Chains **from** `/improve-codebase-architecture` (map before you restructure).
- A mapped subsystem with `complex` nodes and no tests → suggest `/coverage-map` then `/tdd`.

## Integration

- **Output cap:** if a subsystem exceeds ~60 nodes, render only the in-scope nodes in the Mermaid diagram (collapse 1-hop neighbors into a single `…N neighbors` node) and keep the full set in `graph.json`. Never emit an unreadable diagram.
- Feeds `/architect-review` and `/consistency-audit` (layer + edge data) and gives `/project-status` a navigation substrate.
- The persisted `graph.json` is the substrate a future `/graph-query` or `/graph-diff` companion skill would read — out of scope here.
- **Skill complete** when (1) all four passes ran, (2) `graph.json` validated and written, (3) the Mermaid doc was emitted.
