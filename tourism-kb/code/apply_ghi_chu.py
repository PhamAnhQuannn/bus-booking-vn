# -*- coding: utf-8 -*-
"""Stage (apply) — set ext.destination.loi_vao_dac_trung IN-PLACE trên export/<slug>/diem-den.json
từ GHI_CHU_DIEM_DEN (dia_diem_config). Dùng khi thêm nhãn "lối vào đặc trưng" mà KHÔNG muốn full
re-export (build_diem_den re-gán id + revert tên Google pass16 — xem lesson reexport-reverts-pass16-names).

Additive + idempotent: chỉ SET cho record khớp tên trong GHI_CHU (khớp exact hoặc fold), KHÔNG xoá nhãn
khác (giữ sig-access seed do apply_area_seed đặt). Atomic (os.replace).
Chạy TỪ tourism-kb/:  python code/apply_ghi_chu.py <slug> [<slug> ...]   (không slug → mọi slug trong export)
"""
import io
import json
import os
import re
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
EXPORT = os.path.join(HERE, "..", "export")

from dia_diem_config import GHI_CHU_DIEM_DEN as GHI_CHU


def fold(s):
    s = unicodedata.normalize("NFD", (s or "").strip().lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s.replace("đ", "d"))


_FOLDED = {fold(k): v for k, v in GHI_CHU.items()}


def apply(slug):
    p = os.path.join(EXPORT, slug, "diem-den.json")
    if not os.path.exists(p):
        return
    recs = json.load(io.open(p, encoding="utf-8"))
    hits = []
    for r in recs:
        nm = r.get("name", "")
        label = GHI_CHU.get(nm) or _FOLDED.get(fold(nm))
        if not label:
            continue
        ext = r.setdefault("ext", {}).setdefault("destination", {})
        if ext.get("loi_vao_dac_trung") != label:
            ext["loi_vao_dac_trung"] = label
            hits.append(nm)
    if hits:
        tmp = p + ".tmp"
        json.dump(recs, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        os.replace(tmp, p)
    print("  [%s] +%d nhãn (%s)" % (slug, len(hits), ", ".join(hits) or "—"))


def main():
    slugs = sys.argv[1:]
    if not slugs:
        slugs = sorted(d for d in os.listdir(EXPORT)
                       if os.path.exists(os.path.join(EXPORT, d, "diem-den.json")))
    for s in slugs:
        apply(s)


if __name__ == "__main__":
    main()
