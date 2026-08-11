---
name: 2026-07-27-heredoc-escape-rewrite
description: "Patching source with escape sequences through a heredoc rewrote them into real newlines and produced a SyntaxError; never patch escape-bearing content via a heredoc-fed inline script."
metadata:
  type: reference
  domain: build-pipeline
  date: 2026-07-27
  source: tourism-kb
  refs: []
---

# patching source with escape sequences through a `<<'PY'` heredoc silently rewrote `\n` into real newlines

Patched `build_destinations_md.py` by piping a Python patch script through `python - <<'PY'`. The replacement text contained `w("...\n\n")`; what landed in the file was a literal line break inside the string literal, producing `SyntaxError: unterminated string literal` — and `assert old in s` had already failed once for the same reason, which I misread as a whitespace mismatch and worked around instead of diagnosing. Repairing it took a second script that rejoined lines and re-inserted the escapes, and the collapse was lossy (`\n\n` and `\n` both became "one blank line"), so paragraph breaks had to be restored by hand. **Rule: never patch a file whose content contains backslash escape sequences by way of a heredoc-fed inline script — the escape passes through two layers of interpretation before it reaches disk. Use the Edit tool, or write the patch script to a real file first and run it by path.** Greppable smell: `python - <<` in the same command as a string containing `\n`, `\t`, or `\\`.
