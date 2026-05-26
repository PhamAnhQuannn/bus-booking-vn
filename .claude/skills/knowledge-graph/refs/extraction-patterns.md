# Extraction Patterns (Pass 1)

READ WHEN: running Pass 1 of `/knowledge-graph`. These are the ripgrep patterns that turn source text into raw nodes/edges. Deterministic only — no interpretation here (that's Pass 2).

**Limitation, stated up front:** regex sees static syntax. It MISSES dynamic `import()`, computed re-exports (`export * from`), string-keyed dispatch, reflection, and call sites through variables. The 1:1 honesty rule applies to **what these patterns actually matched** — never invent an edge to fill a gap; count the gap in the doc's Notes instead.

All greps run over the resolved target set (CHANGED + new files), excluding `node_modules/`, `.next/`, `dist/`, `build/`, `*.d.ts`, `*.test.*`, `*.spec.*`.

---

## TypeScript / JavaScript (primary — Next.js)

**Imports** (→ `imports` edge, 1:1):
```
^\s*import\s+(?:type\s+)?.+\s+from\s+['"]([^'"]+)['"]
^\s*import\s+['"]([^'"]+)['"]            # side-effect import
(?:const|let)\s+.+=\s*require\(['"]([^'"]+)['"]\)
```
Keep only project-internal specifiers: starts with `.`, `..`, `@/`, or a configured path alias (read `tsconfig.json` `compilerOptions.paths`). Resolve to a file path → that's the `imports` target `file:` node. Drop bare package names.

**Exports** (→ `exports` edge):
```
^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class)\s+(\w+)
^\s*export\s*\{([^}]+)\}
^\s*export\s+(?:type|interface)\s+(\w+)
```

**Functions** (→ `function:` node + `contains` edge), top-level only:
```
^\s*export\s+(?:async\s+)?function\s+(\w+)
^\s*(?:async\s+)?function\s+(\w+)
^\s*export\s+const\s+(\w+)\s*=\s*(?:async\s*)?\(
^\s*const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>
```
Emit a node only if exported OR the body is ≥10 lines.

**Classes** (→ `class:` node + `contains`; `inherits` if `extends`):
```
^\s*export\s+(?:default\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?
^\s*(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?
```

**Next.js route handlers** (→ `endpoint:` node + `routes` edge). Only in files matching `app/**/route.{ts,js}`:
```
^\s*export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b
^\s*export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=
```
Endpoint name = `<METHOD> /<route derived from path>` (strip `app/`, drop `/route.ts`, keep `[param]` segments).

**Server actions** (→ `endpoint:` node, layer `API`): files/functions with a top `'use server'` directive.

**Calls** (→ `calls` edge, inferred, weight ≤0.9): grep `\b(<name>)\s*\(` for each known `function:` node name within the in-scope files. Only emit when the callee name maps to exactly one node id (skip ambiguous/common names like `map`, `get`).

**Prisma data access** (→ `depends_on` edge to a `table:` node):
```
prisma\.(\w+)\.(findUnique|findFirst|findMany|create|createMany|update|updateMany|upsert|delete|deleteMany|count|aggregate)
```
The capture-1 model (camelCase) maps to its `table:<Model>` node (PascalCase).

---

## Prisma schema (`prisma/schema.prisma`)

**Models** (→ `table:` node):
```
^\s*model\s+(\w+)\s*\{
```
**Relations / FKs** (→ `depends_on` edge between tables): within a model block, lines referencing another model type:
```
^\s*\w+\s+(\w+)(\[\])?\s*(@relation|\?)?
```
where capture-1 matches another model name.

The schema file itself = `schema:prisma/schema.prisma`, with `defines_schema` edges to each `table:` it declares.

---

## Tests (→ `tested_by` edge)

In `*.test.{ts,tsx}` / `*.spec.{ts,tsx}` / `__tests__/**` (these ARE read for test-mapping even though excluded from node creation): grep their imports for in-scope symbols; link `function:`/`endpoint:` node → `file:<test file>` via `tested_by`.

---

## Config / neighbors (→ `config:` node)

1-hop neighbor files that are config (`*.config.{js,ts,mjs}`, `next.config.*`, `tailwind.config.*`, `.env*` names only — never values) become `config:` nodes with a `configures` or `imports` edge. Do not Read `.env` contents.

---

## Other languages (quick map)

If `/stack-profile` shows a non-JS stack, swap patterns:
- **Python:** `^\s*(?:from\s+(\S+)\s+)?import\s+(.+)` (imports); `^\s*def\s+(\w+)`; `^\s*class\s+(\w+)(?:\(([^)]*)\))?`.
- **Go:** import blocks `^\s*"([^"]+)"` inside `import (`; `^func\s+(?:\([^)]*\)\s*)?(\w+)`; `^type\s+(\w+)\s+struct`.
- **Java/Kotlin:** `^\s*import\s+([\w.]+);?`; `(?:public|private|protected)?\s*(?:static\s+)?\w[\w<>]*\s+(\w+)\s*\(`; `class\s+(\w+)`.

Same node/edge schema applies; only the regexes change.
