# -*- coding: utf-8 -*-
"""parse_diem_den_web.py — GHI giờ mở + giá vé (đã LLM-extract từ evidence + NGƯỜI duyệt) vào enrichment.

Tách TẢI khỏi PHÂN TÍCH: crawl_diem_den_web.mts fetch + lưu bằng chứng (pages/dd-web-*.txt);
LLM đọc bằng chứng (subagent) → xuất file duyệt <raw>/dd_web_llm.json; script này CHỈ ghi cái đã duyệt.

dd_web_llm.json = list [{id, gio_mo_cua(str|null), gia_ve(list[str]), source(domain), url}] — chỉ điểm CÓ
giá trị SẠCH (LLM phân biệt giờ-mở vs giờ-diễn/suất; giữ MỌI giá vé xung đột → gia_ve_tham_khao). Người đã soát.

Chạy:  PYTHONIOENCODING=utf-8 python tourism-kb/code/parse_diem_den_web.py raw/<slug>/scrape [--dry-run]
"""
import io, json, os, sys

RAW = sys.argv[1]
DRY = "--dry-run" in sys.argv[2:]
ENRICH = os.path.join(RAW, "enrichment.json")
LLM = os.path.join(RAW, "dd_web_llm.json")
DATE = "21/08/2026"


def main():
    if not os.path.exists(LLM):
        print(f"[skip] chua co {LLM} (chay LLM-extract + duyet truoc)")
        return
    items = json.load(io.open(LLM, encoding="utf-8"))
    rows = json.load(io.open(ENRICH, encoding="utf-8")) if os.path.exists(ENRICH) else []
    seen = {(r["id"], r["field"]) for r in rows}
    add_gio = add_gia = 0
    plan = []

    for it in items:
        pid = it.get("id")
        src = it.get("source") or "web chính thức"
        url = it.get("url") or ""
        gio = (it.get("gio_mo_cua") or "").strip()
        gia = [g.strip() for g in (it.get("gia_ve") or []) if g and g.strip()]
        if pid and gio and (pid, "gio_mo_cua") not in seen:
            plan.append((pid, "gio_mo_cua", gio, src, url))
        # giá vé: giữ mọi giá trị xung đột trong 1 dòng gia_ve_tham_khao (doctrine: khong chon 1)
        if pid and gia and (pid, "gia_ve_tham_khao") not in seen:
            plan.append((pid, "gia_ve_tham_khao", " · ".join(dict.fromkeys(gia)), src, url))

    for pid, field, value, src, url in plan:
        print(f"  {pid:8} {field:18} {value[:60]}  ({src})")
    if DRY:
        print(f"  [dry-run] {len(plan)} dong — KHONG ghi.")
        return

    for pid, field, value, src, url in plan:
        rows.append({"id": pid, "field": field, "value": value, "source": src,
                     "url": url, "date": DATE, "method": "web-official-llm"})
        seen.add((pid, field))
        if field == "gio_mo_cua":
            add_gio += 1
        else:
            add_gia += 1
    tmp = ENRICH + ".tmp"
    json.dump(rows, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    os.replace(tmp, ENRICH)
    print(f"  enrichment.json += gio_mo_cua {add_gio} · gia_ve_tham_khao {add_gia}")


if __name__ == "__main__":
    main()
