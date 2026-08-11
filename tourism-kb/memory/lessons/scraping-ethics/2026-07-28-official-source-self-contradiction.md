---
name: 2026-07-28-official-source-self-contradiction
description: "A state museum published two different opening times on two of its own pages — 'official source' licenses recording a value, not stopping checking; read at least two pages of the same site."
metadata:
  type: reference
  domain: scraping-ethics
  date: 2026-07-28
  source: tourism-kb
  refs: []
---

# an OFFICIAL source contradicted itself on two of its own pages — the two-source rule is not only for unofficial sources

Pass 3 recorded `Giờ mở cửa: 07:30 – 17:30` for Bảo tàng Lâm Đồng as `[VERIFIED: baotanglamdong.com.vn]`, read off the museum's own homepage. That is as authoritative a source as exists for a state museum. Opening the same site's `/tickets` page with a real browser one pass later: **"Hằng ngày từ 8:00 đến 17:00"** — the same organisation publishing two different opening times on two of its own pages. I had already stamped the first one verified and shipped it into both documents. Fix: the field now carries **both** values plus the instruction to phone before quoting, and the earlier row was overwritten rather than left standing. **Rule: "official source" licenses you to record a value, not to stop checking. Read at least two pages of the same site before treating any operational detail (hours, price, closure day) as settled — a homepage banner and a booking page are maintained by different people at different times, and the booking page is usually the fresher one. Greppable smell: a single-page fetch producing a `[VERIFIED]` operational value, with no second URL from the same host in the provenance.** Direct sibling of the same-day entry about three commercial sites disagreeing 3× on price — I had scoped that lesson to *unofficial* sources, and this shows the scoping was wrong.

Related: [[2026-07-28-single-scraped-price-not-fact]]
