---
name: 2026-07-29-query-relative-filter-backdoor
description: "A distinctiveness filter written relative to the query has a back door through the loosest query in an any-of set — use a query-independent dish-token reference set instead."
metadata:
  type: reference
  domain: data-integrity
  date: 2026-07-29
  source: tourism-kb
  refs: []
---

# a filter written RELATIVE TO THE QUERY had a back door that a query-independent one does not

Matching vlog text against 19k known business names needs a distinctiveness rule, because businesses literally named after the dish (`Bánh tráng nướng`, `Sua Dau Nanh`, `Lau Ga La E`) match every vlog about that dish. My first rule was *"the business name must contain a token absent from the query that found it"*. Validated offline against the 72 collected rows: it still passed `Bánh tráng nướng` at 52 mentions and `Sua Dau Nanh` at 33. Reason: a dish-named business also matches the **general** queries (`ăn vặt Đà Lạt`), and relative to *those* it does have a distinctive token — so `any(rule(name, q) for q in queries)` opens a back door through the loosest query in the set. The correct rule is **query-independent**: build the dish-token set from the dish labels themselves and require a token outside it. `Bánh tráng nướng` → all dish tokens → reject; `Bánh Căn Lệ` → `le` outside → keep; `Bánh Tráng nướng Dì Đinh` → `di`, `dinh` outside → keep. **Rule: when a predicate is evaluated against several contexts and any-of passes, the loosest context defines the filter. Prefer a rule whose reference set is fixed and derived from the data, not from whichever request happened to produce the row. Greppable smell: `any(pred(x, ctx) for ctx in contexts)` used as an admission test.** Two collateral notes: the same pass's `MIN_TEN = 10` name-length floor silently excluded `Kem Phụng` (9 chars) — the very shop I had written into the plan as the verification case — along with 284 other food businesses named in 8–9 characters; and a validation harness must be run against the *previous* run's output before spending more quota, which is what caught both of these for free.
