# do_coverage.py — báo cáo ĐỘ PHỦ 4 field (giờ mở · giá vé · tiện ích · trò trả phí) trên toàn bộ tỉnh.
# READ-ONLY: chỉ đọc raw/<slug>/scrape/{guide_data.json,enrichment.json}, in bảng before/after.
# Chạy: PYTHONIOENCODING=utf-8 python tourism-kb/code/do_coverage.py
# = "deliverable tiến độ" của campaign: đếm THẬT, không phải % suy đoán. So 2 lần (trước/sau batch) = delta.

import json, os, sys, collections

ROOT = os.path.join(os.path.dirname(__file__), "..", "raw")
CURATED = {"da-lat", "nha-trang", "da-nang"}  # id đóng băng DL-/NT-/DN-xx → KHÔNG batch (CLAUDE.md)

# nhóm field enrichment → cột báo cáo
GROUPS = {
    "gio_mo": {"gio_mo_cua", "gio_mo_cua_wikipedia"},
    "gia_ve": {"gia_ve", "gia_ve_tham_khao", "gia_ve_wikipedia"},
    "tien_ich": {"nha_ve_sinh", "bai_do_xe", "cho_ngoi", "nuoc_uong",
                 "quay_thong_tin", "so_cuu", "qua_luu_niem", "loi_xe_lan", "wifi"},
    "tra_phi": {"trai_nghiem_tra_phi"},
    "dia_chi": {"dia_chi_day_du", "dia_chi_osm"},
    "dien_thoai": {"dien_thoai_osm", "dien_thoai_facility"},
    "website": {"website_chinh_thuc", "website_osm", "website_facility"},
}


def _load(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def count_slug(slug):
    scrape = os.path.join(ROOT, slug, "scrape")
    gd = _load(os.path.join(scrape, "guide_data.json"))
    picked = (gd or {}).get("picked", []) if isinstance(gd, dict) else []
    n_dest = len(picked)
    rows = _load(os.path.join(scrape, "enrichment.json")) or []
    if not isinstance(rows, list):
        rows = rows.get("rows", []) if isinstance(rows, dict) else []
    # đếm SỐ ĐIỂM (distinct id) có ≥1 field trong mỗi nhóm — không đếm số dòng
    ids = {g: set() for g in GROUPS}
    for r in rows:
        if not isinstance(r, dict):
            continue
        f, i = r.get("field"), r.get("id")
        if i is None:
            continue
        for g, fields in GROUPS.items():
            if f in fields:
                ids[g].add(i)
    return n_dest, {g: len(ids[g]) for g in GROUPS}


def main():
    slugs = sorted(
        d for d in os.listdir(ROOT)
        if os.path.isdir(os.path.join(ROOT, d, "scrape")) and d not in CURATED and not d.startswith("_")
    )
    tot_dest = 0
    tot = collections.Counter()
    cols = list(GROUPS)
    W = {c: max(9, len(c) + 1) for c in cols}
    hdr = f'{"slug":22} {"dest":>5} ' + " ".join(f'{c:>{W[c]}}' for c in cols)
    print(hdr)
    print("-" * len(hdr))
    for s in slugs:
        n, g = count_slug(s)
        tot_dest += n
        for k, v in g.items():
            tot[k] += v

        def pct(v):
            return f"{v}({0 if not n else round(100*v/n)}%)"
        print(f'{s:22} {n:5} ' + " ".join(f'{pct(g[c]):>{W[c]}}' for c in cols))
    print("-" * len(hdr))

    def tpct(v):
        return f"{v}({0 if not tot_dest else round(100*v/tot_dest,1)}%)"
    print(f'{"TỔNG " + str(len(slugs)) + " tỉnh":22} {tot_dest:5} '
          + " ".join(f'{tpct(tot[c]):>{W[c]}}' for c in cols))


if __name__ == "__main__":
    main()
