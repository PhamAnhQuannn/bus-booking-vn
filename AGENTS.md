<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Documentation — read this BEFORE working on product scope

`documentation/` is the product spec library, organized in 7 series:

| Prefix | Folder | Coverage |
|--------|--------|----------|
| ADR | `architecture-decisions/` | Stack, auth, payments, deployment decisions |
| DS | `design-specifications/` | Data model, APIs, payment flows, compliance |
| FD | `frontend-design/` | UI/UX specs for customer, operator, admin |
| FI | `feature-implementation/` | Per-feature synthesis (links ADR→DS→FD→code) |
| SI | `scaffolding-infra/` | Toolchain, CI/CD, testing, deployment |
| GL | `go-live/` | Production readiness gates |
| HD | `hardening/` | Security, perf, compliance pre-release audits |

Plus `business/` (market research, personas, domain model, regulatory).

- On any scope/feature/verify task: find the matching spec by prefix ID (e.g., FI-003, DS-006). Each is a directory with `README.md`.
- Do NOT scan the whole repo. Full-repo scans happen ONLY when the user explicitly asks.
- Specs cross-reference each other by prefix ID. Read only what the task touches.

## Mistake Log

Full post-mortems are no longer inlined here. The 71 app lessons (this file's Issue-001→092b
entries + CLAUDE.md's Working-Track log) now live one-file-per-lesson under
`~/.claude/projects/D--Bus-Booking/memory/lessons/app/<domain>/`, indexed by
`memory/lessons/app/_index.md` and distilled into `CLAUDE.md` → `## Project Rules`. Retrieve
on demand by domain/date/keyword. New lesson → add a file there + its `_index.md` line.
