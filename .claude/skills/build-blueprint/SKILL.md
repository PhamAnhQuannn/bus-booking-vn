---
name: build-blueprint
description: Target-architecture blueprint GROWN FROM ISSUES — for each issue, derive the files/endpoints/tables it needs, then merge into one target tree + wiring + build checklist + per-file sub-tasks. Issues are the single source of truth; every blueprint node traces to an issue (issue-authority is intrinsic — it can't invent unauthorized work). The inverse of /knowledge-graph (target vs actual); emits .understand/target-graph.json in the same schema. Use at the planned stage after /prd-to-issues, when the user says "blueprint", "what files do we need", "target structure", "project skeleton plan", "/build-blueprint".
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 6h
---

# /build-blueprint — Target-Architecture Blueprint

Invoke as `/build-blueprint`. **Grows the target structure from the issues**: walks each `issues/*.md`, derives the files/endpoints/tables that issue needs, then merges them into one target tree + wiring + build checklist + per-file sub-tasks. The forward counterpart of `/knowledge-graph` (that maps what exists; this declares what should exist). Advisory/author-only — writes the blueprint + `target-graph.json`, never source.

## Why you'd care

Building without a target structure means discovering your architecture by accident — one file at a time, wiring decided ad hoc, the shape only visible in hindsight when it's expensive to change. This blueprint is **derived from the issues, not guessed up front**: it grows only as far as the issues are defined, so it never invents work no issue authorized, and it stays a *view* of the issues rather than a rival plan. Re-run it as issues are added and it grows with them. Because it emits a `target-graph.json` in the same schema as `/knowledge-graph`, `/graph-diff --target` can later show exactly how far the built code drifted from the plan.

**Single source of truth = issues.** Every node carries `satisfies: [issue-id…]`; a node that traces to no issue is a bug, not a plan (issue-authority is intrinsic to how the blueprint is born).

**Stack assumption:** Next.js + Prisma layout (`app/`, `components/`, `lib/`, `prisma/`). For other stacks run `/stack-profile` first and re-map the conventions (`src/` for Vite, `app/routers/` for FastAPI, package modules for Go).

---

## Pre-flight

1. Anchor to repo root (`git rev-parse --show-toplevel`); fall back to cwd if not git.
2. **Read the issues — primary, required input.** Glob + Read every `issues/*.md` (PRD excluded) with their `goal`/`scope`/`acceptance criteria`/`depends-on`. **If no issues exist → STOP** with one line: `no issues — run /prd-to-issues first` (the blueprint is grown from issues; there's nothing to grow from).
3. **Read context/conventions** (optional, note presence): PRD (`issues/*-prd.md`), `docs/inception/architecture-sketch-<project>.md`, `docs/inception/mvp-scope-<project>.md`, the schema, `package.json` (stack → folder conventions; run `/stack-profile` if unknown). These inform *how* nodes are named/wired — they are **not** the source of the tree (issues are).
4. **Brownfield scan:** Glob the existing source tree (`app/**`, `components/**`, `lib/**`, `prisma/**`, or stack equivalents) → used to set each node's `status` (`built` if its path exists, else `planned`).
5. **Load prior blueprint:** `Read .understand/target-graph.json` if it exists → refresh run (merge into it; don't discard manual sub-task edits).

Read `knowledge-graph/refs/node-edge-schema.md` for the node/edge types, id shapes, and JSON shape — `target-graph.json` uses that schema verbatim **plus** a `status` and `satisfies` field per node.

---

## Pass 1 — Per-issue derivation

**Walk each issue one at a time.** For issue *I*, read its `goal`/`scope`/`acceptance criteria` and derive the concrete nodes it requires — naming paths via stack conventions (Next.js + Prisma defaults: API → `app/api/<group>/route.ts`; page → `app/<route>/page.tsx`; shared logic → `lib/<domain>.ts`; UI → `components/<Name>.tsx`; data → `prisma/schema.prisma` models). Each node uses the `knowledge-graph` types/id shapes (`file:`/`function:`/`class:`/`endpoint:`/`table:`/`config:`) and is tagged **`satisfies: [I]`** at birth.

Do **not** invent a global tree from the PRD — only emit nodes an issue actually calls for. The blueprint grows exactly as far as the issues are defined.

---

## Pass 2 — Wiring (per issue)

For each issue's nodes, declare the edges that **must** exist — forward counterpart of `/knowledge-graph` Pass 1, derived from intent not grepped. Same edge schema: `imports`, `calls`, `contains`, `exports`, `routes`, `depends_on`, `defines_schema`, `inherits`. Example: `endpoint:app/api/bookings#POST` `calls` `function:lib/booking.ts#createHold` `depends_on` `table:Booking`. Apply schema integrity rules: no edge to an undeclared node, no self-edges, no duplicate ids.

---

## Pass 3 — Merge + authority

Fold every issue's derivation into one graph by **upserting on node id**:
- A file two issues both need → **one node**, `satisfies` = **union** of the issue ids (never duplicate the node). Same for shared edges.
- Set `status` from disk: `built` if the node's `path` exists, else `planned`.

**Authority invariant (intrinsic):** every node carries ≥1 `satisfies` issue — because every node was born inside an issue's Pass 1. A node with empty `satisfies` is a bug, not a plan; drop it. This is what stops the blueprint inventing work no issue authorized — the single source of truth is the issues.

**Gaps both directions:** an issue that produced **no** nodes → flag (underspecified — route `/grill-me`). An existing file matching **no** issue's nodes → note as orphan/infra (may be scope creep; the `/graph-diff --target` drift check surfaces these against real code).

---

## Pass 4 — Per-file decomposition

For each `planned` (not-yet-built) file, list 3-5 concrete sub-tasks — small enough to feed `/tdd` directly. Templates:
- **Route handler:** parse/validate input → authz check → core logic → error/edge handling → tests.
- **Service/lib function:** signature + types → happy path → failure modes → tests.
- **Prisma model:** fields + types → relations/indexes → migration → seed/factory.
- **Component:** markup + props → states (loading/empty/error) → a11y → tests.

`built` files get no sub-tasks (already done). Embed these inline in the blueprint doc — do **not** emit separate `issues/` files.

---

## Output Format

Write **two** artifacts.

**1. `.understand/target-graph.json`** — machine blueprint, same schema as `knowledge-graph`'s `graph.json` plus `status`/`satisfies`:
```json
{
  "version": 1,
  "kind": "target",
  "generatedAt": "<ISO-8601>",
  "nodes": [
    {
      "id": "endpoint:app/api/bookings/route.ts#POST",
      "type": "endpoint",
      "name": "POST /api/bookings",
      "path": "app/api/bookings/route.ts",
      "summary": "Create a booking + seat hold.",
      "tags": ["booking","write"],
      "complexity": "complex",
      "layer": "API",
      "status": "planned",
      "satisfies": ["issue-014"]
    }
  ],
  "edges": [
    { "source": "endpoint:app/api/bookings/route.ts#POST", "target": "table:Booking", "type": "depends_on", "direction": "forward", "weight": 1.0 }
  ]
}
```

**2. `docs/plan/build-blueprint-<project>.md`** — human blueprint:
```
# Build Blueprint — <project>
Generated: <YYYY-MM-DD> · 12 planned · 4 built · 25% complete

## Target tree
​```
app/
  api/
    bookings/route.ts        [planned]  ← issue-014
    webhooks/momo/route.ts   [built]
  bookings/page.tsx          [planned]  ← issue-015
lib/
  booking.ts                 [planned]  ← issue-014
prisma/
  schema.prisma  (model Booking [planned], model Trip [built])
​```

## Wiring
​```mermaid
graph TD
  EP["POST /api/bookings"]:::api --> SV["createHold()"]:::util --> BK["Booking (table)"]:::data
  classDef api fill:#dae8fc; classDef util fill:#f8cecc; classDef data fill:#ffe6cc;
​```

## Checklist
- [ ] app/api/bookings/route.ts — issue-014
- [ ] lib/booking.ts — issue-014
- [x] app/api/webhooks/momo/route.ts — built

## Per-file sub-tasks
### app/api/bookings/route.ts  (issue-014)
1. Validate body (tripId, seatIds, passenger) with zod
2. Authz: require OTP proof token
3. Call createHold() → reserve seats (idempotent)
4. Handle seat-conflict (409) + expired-hold edge cases
5. Tests: happy path + double-submit race

## Gaps
- issue-017 has no file in the blueprint — scope it.
- lib/legacy.ts exists but maps to no issue — orphan / infra?
```

---

## Auto-chain

- Chains **from** `/mvp-scope`, `/prd-to-issues`, `/architecture-sketch` (run `/architecture-sketch` first if no architecture doc exists).
- Feeds **`/scaffold-feature`** (scaffold the `planned` tree) → **`/tdd`** (work the per-file sub-tasks).
- **Re-run = refresh:** re-running re-globs the tree and re-ticks the checklist (`planned`→`built` as files appear) + recomputes the % header. The living progress view — run it whenever you want a build-vs-plan snapshot.

## Integration

- **Planned-vs-built drift:** `target-graph.json` and `/knowledge-graph`'s `graph.json` share schema. **`/graph-diff --target`** set-diffs them → planned-but-unbuilt, built-but-unplanned (plan stale / scope crept), wired-differently. `/project-status` flags drift when both graphs exist. Re-run `/build-blueprint` after issues change to grow/refresh the plan.
- **Issue-authority is intrinsic:** every node traces to ≥1 issue by construction (Pass 1/3). The blueprint never authorizes work the issues didn't — issues are the source of truth, this is a derived view.
- **Author-only:** writes the blueprint doc + `target-graph.json`; never writes source files (that's `/scaffold-feature`) and never commits.
- **Tracked + executed live by `/project-status`:** it reads `target-graph.json` and derives built-vs-planned **live from disk** (does each node's `path` exist?) — surfaces a `BLUEPRINT <built>/<total> · <pct>%` line and drives `/autopilot` to build the next unbuilt node (`/scaffold-feature` if absent, `/tdd` if present-but-incomplete). The stored `status` is a write-time hint; **disk is the source of truth**, so progress stays fresh without re-running this skill. Re-run only to refresh the doc/tree or add newly-scoped nodes.
- **Output cap:** projects over ~80 planned nodes → render the tree + checklist in full but collapse the Mermaid wiring to one subsystem per diagram; keep the complete graph in `target-graph.json`.
- **Skill complete** when both artifacts are written and the four doc sections (tree, wiring, checklist, per-file sub-tasks) + gaps are present.
