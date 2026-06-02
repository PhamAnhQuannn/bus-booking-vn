# routing-filters — shared safety layer for /project-status and /route

READ WHEN: producing any skill recommendation. `/project-status` applies the
Billed-Skill Registry on every call (effectively always-on) and the
blueprint/graph rules when those artifacts exist. `/route` reads this file each
invocation to apply the same filters to its matched candidates. **This is the
single source of truth for both** — neither skill should carry its own copy of
these rules.

---

## Billed-Skill Registry — HARD EXCLUSION

Skills here cost money / are user-triggered. They **MUST NOT** appear in any
recommendation or route slot (RECOMMENDED NEXT STEPS, SITUATION → SKILL,
INTENT-PHRASE → SKILL, FRONTEND BUILD, STAGE-APPROPRIATE NEXT SKILL, ROUTE
DECISION), regardless of stage / class / boost / intent match. Silent-drop —
this is **not** a class-skip filter line and is never surfaced as "dropped as
class=X skip"; it simply never appears.

**Registry:**
- `/ultrareview`

Extend this list here when adding a billed/user-triggered skill. Both
`/project-status` and `/route` inherit the change automatically.

---

## Class-skip filter

Drop any candidate whose frontmatter `output_size[<project class>] = skip`. The
full algorithm (drop pass + Class-Aware Boost) lives in `class-filter.md`; both
skills read it. `/route` applies the **drop pass** to its matched candidates and
renders a one-line `Filtered: <n> dropped (class=<X> skip)` note. The boost pass
is `/project-status`-specific (it reorders state-driven recs) and `/route` may
ignore it.

---

## Blueprint / graph awareness (route-applicable subset)

Apply after a cheap presence check (booleans only — no full parse needed for the
gate). These mirror `/project-status` elevation rules 8 and 9 so a build/refactor
intent routed through `/route` targets the same node `/project-status` would.

- **Blueprint present** (`.understand/target-graph.json` exists) AND a candidate
  would *build a feature* → prefer targeting the next unbuilt node `next_unbuilt[0]`:
  `/scaffold-feature "<node.path>"` if its file is absent, else
  `/tdd "<node.path> + blueprint sub-tasks>"` if the file exists but its AC are
  unmet. Substitutes for a generic `/lead`/`/plan` build pick. **Dormant when the
  file is absent.**
- **Graph present** (`.understand/graph.json` exists) AND the intent is *refactor
  a subsystem* → prepend `/knowledge-graph "<subsystem>"` before
  `/improve-codebase-architecture` (map before refactor). **Dormant when the file
  is absent** — never auto-recommend `/knowledge-graph` on a project with no graph
  yet (the first graph is always a deliberate manual build).
