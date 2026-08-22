# -*- coding: utf-8 -*-
"""Pass 14 — RE-EMIT tag CHÍNH NODE điểm đến (giờ mở · điện thoại · website) vào enrichment.

`build_diem_den.py` giữ `picked[].tags` = tag của CHÍNH node OSM đã chọn làm điểm đến. Trong đó
`opening_hours`/`phone`/`website` sẵn có (đo: ~3.8%/3.0%/4.4%) nhưng bị bỏ ở bước phân loại, không
vào enrichment. Pass này chỉ COPY chúng ra — 0 request mạng, MIỄN PHÍ.

Doctrine — vì sao KHÔNG cần identity-gate: đây là tag của CHÍNH node điểm (own-node), không phải
proximity-join hàng xóm → nhân dạng nội tại (bài học 2026-07-30 proximity chỉ áp cho node LÂN CẬN).
first-writer-wins: nếu (id, field) đã có nguồn tốt hơn (vd gio_mo_cua từ web chính thức) thì BỎ.

Chạy:  PYTHONIOENCODING=utf-8 python tourism-kb/code/enrich_osm_selftags.py tourism-kb/raw/<slug>/scrape [--dry-run]
"""
import io, json, os, sys

RAW = sys.argv[1]
DRY = "--dry-run" in sys.argv[2:]
ENRICH = os.path.join(RAW, "enrichment.json")
GUIDE = os.path.join(RAW, "guide_data.json")
DATE = "21/08/2026"

# tag OSM (own-node) → field enrichment mà export_planner ĐÃ đọc
TAGMAP = [
    ("gio_mo_cua", ("opening_hours",)),
    ("dien_thoai_osm", ("phone", "contact:phone")),
    ("website_osm", ("website", "contact:website")),
]


def main():
    picked = json.load(io.open(GUIDE, encoding="utf-8")).get("picked", [])
    rows = json.load(io.open(ENRICH, encoding="utf-8")) if os.path.exists(ENRICH) else []
    seen = {(r["id"], r["field"]) for r in rows}
    add = {f: 0 for f, _ in TAGMAP}
    plan = []
    for p in picked:
        if p.get("closed"):
            continue
        tags = p.get("tags") or {}
        oid = tags.get("wikidata") or ""
        for field, keys in TAGMAP:
            if (p["id"], field) in seen:
                continue
            val = next((tags[k].strip() for k in keys if (tags.get(k) or "").strip()), None)
            if not val:
                continue
            plan.append((p["id"], field, val, oid))
            seen.add((p["id"], field))  # tránh trùng trong cùng lượt

    for pid, field, val, _ in plan:
        print(f"  {pid:10} {field:16} {val[:56]}")
    if DRY:
        print(f"  [dry-run] {len(plan)} dong — KHONG ghi.")
        return

    url = "https://www.openstreetmap.org/"
    for pid, field, val, oid in plan:
        u = ("https://www.wikidata.org/wiki/" + oid) if oid else url
        rows.append({"id": pid, "field": field, "value": val,
                     "source": "OpenStreetMap (tag node điểm đến)", "url": u,
                     "date": DATE, "method": "pass14-selftags", "match_m": 0})
        add[field] += 1
    tmp = ENRICH + ".tmp"
    json.dump(rows, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    os.replace(tmp, ENRICH)
    print("  enrichment += " + " · ".join(f"{f} {n}" for f, n in add.items()) + f"  (-> {len(rows)} dong)")


if __name__ == "__main__":
    main()
