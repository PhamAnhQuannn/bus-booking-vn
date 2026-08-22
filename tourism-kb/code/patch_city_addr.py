# -*- coding: utf-8 -*-
"""Pass E2 — vá full_address cho 12 city planner-served KHONG co pipeline (raw/).

12 city (phu-quoc/ha-long/vung-tau...) la export CU, khong co raw/ nen Pass E (enrich_diachi) khong
cham -> dia chi ~9%. Nhung MOI diem cua chung mang id cua tinh twin (vd phu-quoc = AG-xx ⊂ an-giang),
va tinh twin DA enrich dia chi cho chinh id do (Pass E). => COPY full_address theo id: 0 request mang,
GIA TRI Y HET tinh twin (cung nguon Nominatim, cung provenance) -> doctrine-clean, khong bia.

first-writer-wins: chi ghi neu full_address con rong. Atomic write. Chay TU REPO ROOT.
Chay:  PYTHONIOENCODING=utf-8 python tourism-kb/code/patch_city_addr.py [--dry-run]
"""
import io, json, os, sys, glob

DRY = "--dry-run" in sys.argv[1:]
EXPORT = "tourism-kb/export"
RAW = "tourism-kb/raw"
CITIES = ["phu-quoc", "ha-long", "vung-tau", "quy-nhon", "chau-doc", "dong-ha",
          "mong-cai", "van-don", "mui-ca-mau", "tuy-hoa", "dong-hoi", "tay-ninh-tp"]


def _load(p):
    return json.load(io.open(p, encoding="utf-8"))


def main():
    # id -> full_address tu 37 tinh SONG (co raw/ twin -> da chay Pass E)
    addr = {}
    for d in glob.glob(os.path.join(EXPORT, "*", "diem-den.json")):
        slug = os.path.basename(os.path.dirname(d))
        if not os.path.exists(os.path.join(RAW, slug, "scrape", "guide_data.json")):
            continue                                  # bo city export cu (khong phai tinh song)
        for r in _load(d):
            fa = (r.get("address") or {}).get("full_address")
            if fa:
                addr[r["id"]] = fa
    print(f"id co dia chi tu tinh song: {len(addr)}")

    for c in CITIES:
        path = os.path.join(EXPORT, c, "diem-den.json")
        if not os.path.exists(path):
            print(f"  [skip] khong co {path}")
            continue
        recs = _load(path)
        filled = miss = 0
        for r in recs:
            a = r.setdefault("address", {})
            if a.get("full_address"):
                continue
            fa = addr.get(r["id"])
            if fa:
                if not DRY:
                    a["full_address"] = fa
                filled += 1
            else:
                miss += 1
        print(f"  {c:14} {len(recs):3} diem -> +{filled} dia chi" + (f", {miss} khong khop id" if miss else ""))
        if not DRY and filled:
            tmp = path + ".tmp"
            json.dump(recs, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            os.replace(tmp, path)
    if DRY:
        print("  [dry-run] KHONG ghi.")


if __name__ == "__main__":
    main()
