---
name: 2026-07-28-regex-line-delete-orphans
description: "A line-oriented regex cannot see a multi-line Python construct's extent — deleting call sites orphaned continuation lines three times; use Edit with the full construct and parse before writing."
metadata:
  type: reference
  domain: build-pipeline
  date: 2026-07-28
  source: tourism-kb
  refs: []
---

# regex line-deletion on Python source orphaned continuation lines — THREE separate breakages in one session

Stripping fields from two generator scripts, I used `re.sub(r'^\s*w\(f"Toạ độ GPS.*\n', '', s, flags=re.M)` and similar to delete call sites. Every one of those calls spanned multiple lines, so the regex removed the first line and left the continuation dangling: `+ ("   [ĐÃ XÁC MINH…]" if r.get("addr") else "") + "\n")` with no statement above it → `IndentationError`. A second pattern mangled an f-string into `f"{ind}.lower()} — {INDOOR_NOTE[ind]}]"` → `SyntaxError`. This is the **third** instance of the same family in one day, after the `<<'PY'` heredoc rewriting `\n` into real newlines and the bulk string-replace missing `"[VERIFIED"` because the literal in the branch test lacked the colon I matched on. **Rule: never delete or rewrite a multi-line Python construct with a line-oriented regex. A call, an f-string, a dict literal and a list element can all span lines, and a line regex cannot see the construct's extent. Use the Edit tool with the FULL construct as `old_string`, or a script of exact whole-construct string pairs that asserts each pair matched — an unmatched pair must print, never pass silently.** Greppable smell: `re.sub` or `re.compile` with `flags=re.M` and `^`/`$` anchors applied to a file that is source code rather than data. Corollary that cost the most time: after each such edit I ran `ast.parse`, which caught the break — but only after the write. Parse the result BEFORE writing it back, so a failed patch leaves the file untouched instead of requiring repair.

Related: [[2026-07-27-heredoc-escape-rewrite]]
