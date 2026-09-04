# -*- coding: utf-8 -*-
"""Merge place_id đã resolve (raw/<slug>/scrape/place_id_diem_den.json) vào export
identity.place_id (CHỖ NULL — không override cái đã có). Match theo fold(ten).
Chạy:  python tourism-kb/code/apply_placeid.py <slug> [<slug> ...]
"""
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from yt_chung import fold

EXPORT = os.path.join(HERE, "..", "export")
RAW = os.path.join(HERE, "..", "raw")


def run(slug):
    exp = os.path.join(EXPORT, slug, "diem-den.json")
    pf = os.path.join(RAW, slug, "scrape", "place_id_diem_den.json")
    if not (os.path.exists(exp) and os.path.exists(pf)):
        print("[%s] thieu file" % slug); return
    recs = json.load(io.open(exp, encoding="utf-8"))
    pid_map = {}
    for r in json.load(io.open(pf, encoding="utf-8")).get("co_so", []):
        pid_map[fold(r["ten"])] = r["place_id"]
    filled = 0
    for r in recs:
        ident = r.setdefault("identity", {})
        if ident.get("place_id"):
            continue
        pid = pid_map.get(fold(r.get("name") or ""))
        if pid:
            ident["place_id"] = pid
            r.setdefault("external_ids", {})["google_place_id"] = pid
            filled += 1
    tmp = exp + ".tmp"
    json.dump(recs, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    os.replace(tmp, exp)
    have = sum(1 for r in recs if (r.get("identity") or {}).get("place_id"))
    print("[%s] +%d place_id (giờ %d/%d có)" % (slug, filled, have, len(recs)))


for s in sys.argv[1:]:
    run(s)
