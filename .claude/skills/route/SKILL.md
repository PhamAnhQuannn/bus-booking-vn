---
name: route
description: Skill dispatcher for the project. Reads the user's intent and current git state, then recommends which installed skills to invoke and in what order. Use when the user is unsure which skill applies, when multiple changes are staged, or when they describe a goal in plain language and need a routing decision.
---

# /route — Skill Routing Intelligence

Invoke as `/route <description of what you want to do>`. Reads the current project state and matches your description to the right sequence of skills to invoke.

The description is: $ARGUMENTS

---

## Why you'd care

When you have 300 installed skills, picking the right one is itself a skill. The dispatcher reads your intent and your git state and tells you which to invoke — faster than you'd guess yourself, and right more often.

## Pre-flight

1. Run `git status` — count modified files and identify affected domains (schema/migrations, API entrypoints, routes/pages, components, infra config, etc.). Worked example for Next.js + Prisma: `prisma/schema.prisma`, `app/api/**`, `app/(routes)/**`, `components/**`, `prisma/migrations/**`. Run `/stack-profile` if the layout is unknown.
2. Read `CLAUDE.md` (if present) — confirm current project context and Mistake Log
3. List `.claude/skills/*/SKILL.md` (Glob) — confirm which skills are actually installed locally before recommending one

---

## Installed Skills

At invocation, list `.claude/skills/*/SKILL.md` (Glob) and treat each present skill as routable. Skills not on disk are not routable, even if mentioned in the matching logic below — silently drop them from the suggestion.

---

## Matching Logic

Match the user's description + current git state against trigger conditions:

| User says / git state shows                                                             | Route to                                                              |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| "commit", "stage", "group my changes", or >10 modified files across 3+ domains          | `/commit-split` first                                                 |
| "schema", "migration", or schema file modified (e.g. `prisma/schema.prisma`, `alembic/versions/*`, `db/migrate/*`) | run your stack's migrate command → `/verify`               |
| "payment", "webhook", or webhook handler dir modified (e.g. `app/api/webhooks/**`)      | implement carefully → `/verify` (payment-webhook-audit if installed)  |
| "security", "auth", "pii", "launch", "production"                                       | `/lead` at T3 (Security Reviewer subteam)                             |
| "test", "tdd", "write tests", "integration test"                                        | `/tdd <feature>`                                                      |
| "what's untested", "coverage", "what needs tests"                                       | `/coverage-map` → `/tdd`                                              |
| "debt", "TODO", "cleanup", "refactor"                                                   | `/debt-scan`                                                          |
| "naming", "structure", "consistency", "duplicated logic"                                | `/consistency-audit`                                                  |
| "improve architecture", "deepen modules", "subsystem feels off"                         | `/improve-codebase-architecture`                                      |
| "feature", "build", "implement", or new endpoint/page in a detected domain dir          | `/lead <task>` (or `/plan <task>` for heavier research)               |
| "new product", "PRD", "requirements doc"                                                | `/write-a-prd` → `/prd-to-issues`                                     |
| "stress test my plan", "grill me"                                                       | `/grill-me`                                                           |
| "quick fix", "small change", "just change X" (after the fix)                            | `/verify`                                                             |
| native-module ABI mismatch (e.g. "broke after npm install", "NODE_MODULE_VERSION")      | `/better-sqlite3-rebuild` (Node + better-sqlite3 example)             |
| "removing/renaming a symbol used in many files"                                         | `/atomic-file-edit` first                                             |
| "browser test", "smoke", "playwright"                                                   | `/smoke-test`                                                         |

---

## Multi-Skill Sequencing

If multiple triggers match, output them in dependency order. Skills that produce output consumed by the next skill must run first.

Example: "I want to add a new resource type and have users see it in the list view" (schema-touching multi-layer feature):
1. Run the stack's migrate command (e.g. `prisma migrate dev`, `alembic upgrade head`, `rails db:migrate`) — schema change first
2. `/lead "add <resource> support to backend + frontend"` (T2 — multi-layer)
3. `/tdd` (during implementation, per endpoint/component)
4. `/verify` (post-fix, before commit)
5. `/smoke-test` (browser path)
6. `/commit-split` (if many files staged)

Example: "I'm about to commit but want to be safe":
1. `/verify` (type check + tests for changed scope)
2. `/smoke-test` (golden path)
3. `/commit-split` (if >10 files)

---

## Output Format

```
ROUTE DECISION
──────────────
Your description: "<description>"
Git state: N modified files across M domains

Matched triggers:
  → schema modified: prisma migrate dev
  → multi-layer feature: /lead
  → tests not yet written: /tdd

Suggested invocation order:
  1. prisma migrate dev
     Why: schema files modified — migration must be generated and applied first
  2. /lead "<task>"
     Why: spans backend + frontend — needs Target Outcome and team assignment
  3. /tdd "<endpoint or component>"
     Why: build behavior with tests alongside implementation
  4. /verify
     Why: after fix, run targeted checks for changed scope
  5. /smoke-test
     Why: browser path verification before merge
  6. /commit-split
     Why: many files changed — group into ordered commits

Type any of the above to continue.
```

---

## When No Match Found

If the description doesn't match any known trigger:

```
ROUTE DECISION
──────────────
No specific skill matched your description.
For most implementation tasks, start with: /lead "<your task>"
For new features, start with: /grill-me "<feature idea>"
For unsure scope, start with: /plan "<problem>"
```
