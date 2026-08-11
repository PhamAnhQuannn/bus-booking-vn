---
name: 2026-07-28-single-scraped-price-not-fact
description: "Three 'current 2026' price sources disagreed by up to 3x — a single web-scraped price is not a fact; fetch at least two, and if they disagree the disagreement IS the finding."
metadata:
  type: reference
  domain: scraping-ethics
  date: 2026-07-28
  source: tourism-kb
  refs: []
---

# three "current 2026" price sources disagreed by up to 3× for the same attraction — a single web-scraped price is not a fact

Filling `Giá vé` for the Đà Lạt guide, I pulled prices from commercial travel sites. For **Thác Datanla**: 50.000₫ from one page, 80.000₫ from another. For **Lang Biang**: 50.000₫ vs 155.000₫. For **Thung lũng Tình yêu**: 155.000₫ vs 240.000₫ vs 250.000₫. Every source presented its figure as the current 2026 price with no as-of date. Had I taken the first result and written it in as `[VERIFIED]`, the document would have carried a number that is wrong by up to 3× while looking sourced. Fix: prices from commercial pages go into a separate `gia_ve_tham_khao` field carrying **all** conflicting values with their sources, and `Giá vé` itself stays `[UNVERIFIED]` until phone-confirmed. **Rule: when a value is only available from unofficial aggregators, fetch at least two before recording anything — if they disagree, the disagreement IS the finding and must be shown rather than resolved by picking one. Never let a single blog figure occupy a field the reader will treat as authoritative.** Greppable smell: any pipeline writing a price or an opening time from a single non-official web source into a field with a verified-style provenance tag. Corollary confirmed the same day: of 8 "official" venue domains stored in the data, **3 did not resolve at all** (`kdlprenn.com.vn`, `khudulichthacbaodai.vn`, `vuonhoacamtucau.com`) and 8 more pointed at unrelated businesses (a pagoda's website field held a shoe shop) — a stored URL must be fetched and confirmed before it is treated as that entity's site.
