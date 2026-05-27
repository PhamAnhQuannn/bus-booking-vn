# Node & Edge Schema

READ WHEN: Pass 1 or Pass 2 of `/knowledge-graph` needs the type catalogue, id-prefix rules, or the exact `graph.json` shape. Not needed for a plain re-render of an existing graph.

Trimmed from Understand-Anything's 11-node / ~18-edge catalogue down to the set that matters for a Next.js + Prisma app. Add a type only when a real node needs it.

---

## Node types

Every node id is `<type>:<path>[#<symbol>]`. The prefix IS the type. Ids are globally unique.

| Type | id shape | Created for | Example id |
|---|---|---|---|
| `file` | `file:<path>` | every in-scope source file | `file:lib/payment/momo.ts` |
| `function` | `function:<path>#<name>` | top-level function/const-arrow, if exported OR ≥10 lines | `function:lib/payment/momo.ts#verifySignature` |
| `class` | `class:<path>#<name>` | class with ≥2 methods or ≥20 lines | `class:lib/booking/Hold.ts#SeatHold` |
| `endpoint` | `endpoint:<path>#<METHOD>` | Next.js route handler export (GET/POST/…) | `endpoint:app/api/webhooks/momo/route.ts#POST` |
| `table` | `table:<model>` | Prisma `model` block | `table:Booking` |
| `schema` | `schema:<path>` | a schema/validation file (zod, prisma schema file itself) | `schema:prisma/schema.prisma` |
| `config` | `config:<path>` | config files pulled in as 1-hop neighbors | `config:next.config.js` |

Node object:
```json
{
  "id": "function:lib/payment/momo.ts#verifySignature",
  "type": "function",
  "name": "verifySignature",
  "path": "lib/payment/momo.ts",
  "summary": "<one line, Pass 2>",
  "tags": ["payment","hmac","momo"],
  "complexity": "simple|moderate|complex",
  "layer": "API|Service|Data|UI|Util",
  "fingerprint": "<git blob sha of path, or mtime:size fallback>"
}
```
`summary`/`tags`/`complexity`/`layer` are filled in Pass 2; in Pass 1 they may be empty.

---

## Edge types

| Type | Meaning | Source → Target | Default weight |
|---|---|---|---|
| `imports` | file imports another internal module | `file:` → `file:` | 1.0 |
| `exports` | symbol exported by a file | `file:` → `function:`/`class:` | 1.0 |
| `contains` | file contains a definition | `file:` → `function:`/`class:`/`endpoint:` | 1.0 |
| `calls` | call site resolves to a known node | `function:`/`endpoint:` → `function:` | 0.6–0.9 |
| `inherits` | class extends another | `class:` → `class:` | 1.0 |
| `routes` | route file exposes a handler | `file:` → `endpoint:` | 1.0 |
| `defines_schema` | file defines a data model/schema | `file:`/`schema:` → `table:` | 1.0 |
| `depends_on` | code reads/writes a table | `function:`/`endpoint:` → `table:` | 0.7 |
| `tested_by` | a test targets this node | `function:`/`endpoint:` → `file:` (the test) | 0.8 |

Edge object:
```json
{ "source": "<node id>", "target": "<node id>", "type": "imports", "direction": "forward", "weight": 1.0 }
```
`direction` is always `"forward"` (source→target). `weight`: 1.0 = certain (import/contains/exports parsed directly); lower = inferred (call/dependency resolved heuristically).

---

## Rules (carried from Understand-Anything)

1. **1:1 imports.** `imports` edge count MUST equal the internal import statements grep found in Pass 1. No more, no fewer.
2. **No dangling edges.** Every `source` and `target` must be an id present in `nodes[]`.
3. **No duplicate ids.** Merge by id in Pass 3 instead of adding a second node.
4. **No self-edges.** `source !== target`.
5. **Internal only.** Edges to `node_modules`/external packages are dropped (they're not nodes).
6. **Honest gaps.** Regex can't see dynamic `import()`, re-exports, or reflection. Don't fabricate edges for them — note the gap count in the doc instead.
