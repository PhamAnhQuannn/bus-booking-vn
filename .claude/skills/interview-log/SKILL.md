---
name: interview-log
description: Append-only log of customer interviews — date, person, signal/anti-signal, quotes, intro chain. Outputs to `docs/inception/interview-log-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "log interview", "interview notes", "/interview-log", or after each `/customer-interview-script` session.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /interview-log — Append-Only Interview Record

## Why you'd care

Customer interviews fade from memory within a week and the strongest quotes are lost to no-one's-notebook by month two. The append-only log preserves the signal so patterns across 30 conversations become legible.

Invoke as `/interview-log`. One file, all interviews. Saturation tracker.

## Pre-flight
1. Read `docs/classify/<project>.md` — XS → SKIP.
2. Append to existing `docs/inception/interview-log-<project>.md` (don't overwrite).

## Inputs
- Date, person name/handle, role, segment.
- 3–5 verbatim quotes.
- Signals (paid before? searched? built workaround?).
- Anti-signals (shrugged? "interesting"? polite no).
- Next intro names.

## Process
1. **Append entry** — never edit past entries.
2. **Tag** signal/anti-signal/neutral.
3. **Saturation check** — at N=5 same segment same answers, declare saturation.
4. **Roll-up summary** updated at top after each entry.

## Output (append to)
`docs/inception/interview-log-<project>.md`:

```markdown
# Interview Log — <project>

## Roll-up
**Total:** N | **Signals:** X | **Anti-signals:** Y | **Saturation:** <yes/no per segment>
**Top quote:** "<quote>"
**Top anti-pattern:** <pattern>

---

## #N — <YYYY-MM-DD> — <name>, <role>, <segment>
**Length:** N min | **Tag:** SIGNAL / ANTI / NEUTRAL

**Quotes:**
- "<verbatim>"
- "<verbatim>"
- "<verbatim>"

**Past behavior:**
- ...

**Workaround + cost:**
- ...

**Buying signal:**
- Paid before? <Y/N — what>
- Searched? <Y/N — terms>
- Built? <Y/N — how long>

**Anti-signal:**
- ...

**Next intros:** <name1>, <name2>

---

## #N-1 — ...
```

## Verification
- Append-only (no past edits).
- ≥3 verbatim quotes per entry (not paraphrase).
- Tag every entry SIGNAL/ANTI/NEUTRAL (no "mixed" cop-out).
- Roll-up updated.
