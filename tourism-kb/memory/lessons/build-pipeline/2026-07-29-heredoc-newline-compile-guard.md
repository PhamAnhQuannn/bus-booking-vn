---
name: 2026-07-29-heredoc-newline-compile-guard
description: "Third heredoc newline corruption — this time a pre-write compile() caught it before disk; keep parse-before-write in every patch script even when following the no-heredoc rule."
metadata:
  type: reference
  domain: build-pipeline
  date: 2026-07-29
  source: tourism-kb
  refs: []
---

# patched a file containing `\n` through a heredoc AGAIN — third time; only a pre-write `compile()` saved it

Patching `sweep_youtube_quan.py` via `python - <<'PY'`, the replacement text contained `\\n` inside an f-string. The heredoc collapsed it to a real newline and produced `SyntaxError: unterminated f-string literal`. This is the **third** occurrence of the rule already in this log (2026-07-27 heredoc, 2026-07-28 regex line-deletion). What differed this time is that the patch script called `compile(s, p, 'exec')` **before** `io.open(p, 'w').write(s)`, so the broken text never reached disk and the file stayed valid — confirmed with a follow-up `ast.parse`. The fix afterwards used the Edit tool with the full construct as `old_string`, which is what the rule says to do in the first place. **Reinforcement, not a new rule: parse-before-write converts this class from "corrupt the file and repair it" into "the patch simply fails". Keep that guard in every patch script even when the rule against heredocs is being followed.**

Related: [[2026-07-27-heredoc-escape-rewrite]], [[2026-07-28-regex-line-delete-orphans]]
