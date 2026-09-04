# -*- coding: utf-8 -*-
"""Áp CÔNG THỨC importance (diem_quan_trong) → sắp xếp lại record trong export/<slug>/diem-den.json
IN-PLACE (order-only, = output export_planner khi rebuild). Popularity từ raw/<slug>/noi-bo/pop_diem_den.json.

CHỈ đổi THỨ TỰ — KHÔNG thêm/sửa field (doctrine order-ship-not-number). Atomic ghi.
Chạy:  python tourism-kb/code/apply_importance_order.py <slug> [<slug> ...]
"""
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import diem_quan_trong as dqt

EXPORT = os.path.join(HERE, "..", "export")
RAW = os.path.join(HERE, "..", "raw")


def apply(slug):
    p = os.path.join(EXPORT, slug, "diem-den.json")
    if not os.path.exists(p):
        print("  [%s] khong co export" % slug); return
    recs = json.load(io.open(p, encoding="utf-8"))
    pop = dqt.load_pop(os.path.join(RAW, slug))
    before = [r.get("name") for r in recs]
    out = dqt.sap_xep(recs, pop)
    after = [r.get("name") for r in out]
    tmp = p + ".tmp"
    json.dump(out, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    os.replace(tmp, p)
    moved = sum(1 for a, b in zip(before, after) if a != b)
    print("  [%s] %d điểm · pop=%d · đổi vị trí %d · top: %s"
          % (slug, len(out), len(pop), moved, " / ".join(after[:3])))


def main():
    slugs = sys.argv[1:]
    if not slugs:
        print("cách dùng: python apply_importance_order.py <slug> [<slug> ...]"); sys.exit(1)
    for s in slugs:
        apply(s)


if __name__ == "__main__":
    main()
