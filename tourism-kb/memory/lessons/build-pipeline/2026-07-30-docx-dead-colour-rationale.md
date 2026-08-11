---
name: 2026-07-30-docx-dead-colour-rationale
description: "The .docx builder's stated reason to exist (red UNVERIFIED colour) had been unreachable dead code for days while its docstring still claimed it; a live rationale beside dead code reads as working."
metadata:
  type: reference
  domain: build-pipeline
  date: 2026-07-30
  source: tourism-kb
  refs: []
---

# the .docx's stated reason for existing had been dead code for days, and the comment saying otherwise was still there

`build_huong_dan_docx.py`'s docstring justified the whole file: *"Word làm được một việc Markdown không làm được: TÔ MÀU. Cả giá trị của tài liệu này nằm ở chỗ `[CHƯA XÁC MINH]` không thể bỏ qua được — màu đỏ làm được điều đó, chữ in đậm thì không."* That mechanism could not run. `field_table()` drops every row whose value starts with `UNV` **before** rendering, and `value_run()` — which holds the red branch — is called *only* from inside `field_table()`, so the branch is unreachable and its tag-detection loop iterates an empty tuple (`for mark in ():`). Phase K's decision to omit unverified rows rather than flag them had superseded the colour, and the docstring was never revised, so the file spent days being a colourless mirror of the `.md` while documenting itself as the opposite. Fixed by rewriting the docstring to state what the file is actually for and by moving the gap signal up one level: each group now prints one grey `— N/M trường đã xác minh —` line (348 of them), which shows the depth of what is missing without reinstating 1,336 red rows. **Rule: a comment explaining why a file or branch exists is not evidence that it still runs. When a policy changes ("flag it" → "drop it"), grep for the code the old policy justified and check whether it is still reachable — dead code with a live rationale beside it reads as working. Greppable smell: a function whose only caller filters out precisely the inputs that function branches on.**
