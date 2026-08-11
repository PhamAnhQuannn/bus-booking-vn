---
name: 2026-07-30-parity-presence-vs-count
description: "A parity check asking 'present in both and above a minimum' cannot police a count — a warning rendered 3x vs 2x passed; compare counts, not presence."
metadata:
  type: reference
  domain: build-pipeline
  date: 2026-07-30
  source: tourism-kb
  refs: []
---

# my own parity guard read "3 and 2, both ≥ 1" and called it a match — a presence check cannot police a count

`kiem_parity.py`'s block check asks two questions of each content marker: is it present in both outputs, and is it above a minimum. It never asks whether the two counts are **equal**. So when the address-conflict warning I had just added rendered **3 times in `.md` and 2 in `.docx`**, parity printed `KHỚP`. Cause: `field_table()` drops every row whose value *starts with* `[CHƯA XÁC MINH]` (`build_huong_dan_docx.py:280`), and XQ Sử Quán's address is exactly that after its map record was quarantined — so appending the warning **after** the value deleted the warning along with the row. The `.md`, which has no such filter, kept it. One document warned the reader that a house number is disputed; the other stated nothing, and the guard written specifically to catch divergence between them approved it. Same defect hid the `fee` annotation. Fixed by putting warnings **before** the value so the row survives the filter, and by adding a section to the guard where listed markers must match **exactly**, not merely both exist. **Rule: for anything whose absence changes what the reader believes — a warning, a conflict flag, a caveat — parity must compare COUNTS, not presence. `a > 0 and b > 0` is satisfied by every off-by-N, and off-by-N on a warning is precisely one output asserting as fact what the other flags as disputed. Greppable smell: a cross-output check whose per-item test is `if a == 0 or b == 0` or `a < minimum`, with no `a != b`.** Second-order lesson, and the reason this is logged rather than quietly fixed: I had **already written** in this file, two entries down, that the guard "cannot see an error upstream of the split". That was true and I acted on it — then trusted the same guard for a class it was equally blind to *downstream* of the split. Per the `import-x/no-cycle` rule, the new check was proven before being trusted: reverted to the broken renderer it reports `LỆCH 2 điểm` naming both markers and exits 1; restored, it exits 0. Also fixed in the same pass: `fee=yes` (an OSM boolean meaning *a charge exists*) was printed in the `Giá vé` slot as though it were the amount, and `fee=10000` was printed with no currency unit — both bypassing the `enrichment.json`/`ev()` path, i.e. the identical precedence defect fixed for `hours` earlier the same day, still live one field over. **When you fix a "raw merge-layer value outranks the sourced value" bug, grep every other field that reads from the same merge layer in the same breath — the defect is per-field, and fixing the one that was reported leaves the siblings armed.**

Related: [[2026-07-30-proximity-join-wrong-identity]]
