---
name: prd-to-issues
description: Break a PRD into independently-workable issues and write each as a local markdown file in issues/. Use when the user wants to turn a PRD into a list of concrete tasks.
---

# PRD to Issues

Break a PRD into independently-grabbable issues using vertical slices (tracer bullets), written as local markdown files.

## Why you'd care

A PRD that lives only as one document gets implemented as one giant PR nobody can review. Slicing it into independently-workable issues is what makes the work parallelizable and the progress visible.

## Process

### 1. Locate the PRD

Ask the user for the PRD file path (e.g. `issues/prd.md`).

If the PRD is not already in your context window, read it from the file.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code.

### 3. Draft vertical slices

Break the PRD into **tracer bullet** issues. Each issue is a thin vertical slice that cuts through ALL integration layers end-to-end, NOT a horizontal slice of one layer.

Slices may be 'HITL' or 'AFK'. HITL slices require human interaction, such as an architectural decision or a design review. AFK slices can be implemented and merged without human interaction. Prefer AFK over HITL where possible.

<vertical-slice-rules>
- Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests)
- A completed slice is demoable or verifiable on its own
- Prefer many thin slices over few thick ones
</vertical-slice-rules>

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each slice, show:

- **Title**: short descriptive name
- **Type**: HITL / AFK
- **Blocked by**: which other slices (if any) must complete first
- **User stories covered**: which user stories from the PRD this addresses

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any slices be merged or split further?
- Are the correct slices marked as HITL and AFK?

Iterate until the user approves the breakdown.

### 5. Create the issue files

For each approved slice, write a markdown file in `issues/` using the naming pattern `issues/NNN-short-title.md` (e.g. `issues/001-add-user-auth.md`).

Number issues starting from the next available number (check what files already exist in `issues/`).

Create files in dependency order (blockers first) so you can reference real filenames in the "Blocked by" field.

Do NOT use `gh issue create` or any GitHub CLI commands. Do NOT reference GitHub issue numbers. Use local filenames for all cross-references.

<issue-template>
## Parent PRD

`issues/prd.md` (or whichever PRD file was used)

## What to build

A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer implementation. Reference specific sections of the parent PRD rather than duplicating content.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

- Blocked by `issues/NNN-title.md` (if any)

Or "None - can start immediately" if no blockers.

## User stories addressed

Reference by number from the parent PRD:

- User story 3
- User story 7

</issue-template>

Do NOT close or modify the parent PRD file.

### Code-graph dep-inference

After extracting issues from the PRD, scan the import-graph of files each issue touches. If issue B's files import from issue A's files, infer "B depends-on A".

Emit the inferred graph in each issue's frontmatter:

```yaml
---
depends-on: [issue-001, issue-003]
---
```

Use this as a first pass; surface it to the user during step 4 so they can override edges that import-graph cannot see (runtime coupling, shared state, etc.).

### Cross-slice coupling detection

Once the dep-graph is built, run two checks:

- **Cycles**: if A depends-on B and B depends-on A (directly or transitively), flag both issues. Cycles mean the slices are not vertical — re-slice before writing files.
- **High fan-in**: any issue with >3 incoming deps gets flagged `high-coupling, consider extracting interface first`. Suggest pulling the shared surface into its own slice that the dependents target.

Report flags to the user before creating files. Do not silently write a broken graph.

### Optional GitHub-API sync

Behind a `--github` flag. Only runs after local `issues/*.md` are written and approved.

For each slice file, run `gh issue create` with:

- **title**: derived from filename (`001-add-user-auth.md` -> `Add user auth`)
- **body**: file content
- **labels**: from frontmatter

Make it idempotent: before each create, run `gh issue list --search "<title>" --state all` and skip if a match exists.

Write the local-file -> GitHub-issue-number mapping to `issues/.github-map.json`:

```json
{ "001-add-user-auth.md": 42, "002-login-flow.md": 43 }
```

Re-running with `--github` reuses the map; only unmapped files hit the API.
