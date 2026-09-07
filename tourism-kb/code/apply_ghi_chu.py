# -*- coding: utf-8 -*-
"""Stage (apply) — set ext.destination.loi_vao_dac_trung IN-PLACE trên export/<slug>/diem-den.json
từ GHI_CHU_DIEM_DEN (dia_diem_config). Dùng khi thêm nhãn "lối vào đặc trưng" mà KHÔNG muốn full
re-export (build_diem_den re-gán id + revert tên Google pass16 — xem lesson reexport-reverts-pass16-names).

Additive + idempotent: chỉ SET cho record khớp tên EXACT trong GHI_CHU (khớp như export_planner canonical —
KHÔNG fold, để một khớp fold-only không bị âm thầm drop khi full re-export), KHÔNG xoá nhãn khác (giữ
sig-access seed do apply_area_seed đặt). Atomic (os.replace).
Chạy TỪ tourism-kb/:  python code/apply_ghi_chu.py <slug> [<slug> ...]   (không slug → mọi slug trong export)
"""
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
EXPORT = os.path.join(HERE, "..", "export")

from dia_diem_config import GHI_CHU_DIEM_DEN as GHI_CHU


def apply(slug):
    """Trả về set các GHI_CHU key khớp ≥1 record trong slug này (để main() báo key khớp 0 record)."""
    matched = set()
    p = os.path.join(EXPORT, slug, "diem-den.json")
    if not os.path.exists(p):
        return matched
    recs = json.load(io.open(p, encoding="utf-8"))
    hits = []
    for r in recs:
        nm = r.get("name", "")
        label = GHI_CHU.get(nm)  # exact-only, khớp export_planner canonical
        if not label:
            continue
        matched.add(nm)
        ext = r.get("ext")
        if not isinstance(ext, dict):
            ext = r["ext"] = {}
        dest = ext.get("destination")
        if not isinstance(dest, dict):
            dest = ext["destination"] = {}
        if dest.get("loi_vao_dac_trung") != label:
            dest["loi_vao_dac_trung"] = label
            hits.append(nm)
    if hits:
        tmp = p + ".tmp"
        json.dump(recs, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        os.replace(tmp, p)
    print("  [%s] +%d nhãn (%s)" % (slug, len(hits), ", ".join(hits) or "—"))
    return matched


def main():
    slugs = sys.argv[1:]
    if not slugs:
        slugs = sorted(d for d in os.listdir(EXPORT)
                       if os.path.exists(os.path.join(EXPORT, d, "diem-den.json")))
    matched = set()
    for s in slugs:
        matched |= apply(s)
    unmatched = [k for k in GHI_CHU if k not in matched]
    if unmatched:
        print("  ⚠ %d GHI_CHU key khớp 0 record (mistyped/renamed?): %s"
              % (len(unmatched), ", ".join(unmatched)))


if __name__ == "__main__":
    main()
