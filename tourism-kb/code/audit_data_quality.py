# -*- coding: utf-8 -*-
"""Eval harness — đo chất lượng data điểm đến per-tp (trước/sau enrich).

In bảng: n · place_id% · hours% · price% · mota% · adv% · junk · dup.
Chạy TỪ tourism-kb/:  python code/audit_data_quality.py [slug ...]   (mặc định = 10 tp hot)
"""
import io
import json
import os
import re
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
EXPORT = os.path.join(HERE, "..", "export")

HOT10 = ["ha-noi", "hue", "ninh-binh", "phu-quoc", "da-lat",
         "da-nang", "ha-long", "vung-tau", "nha-trang", "sa-pa"]

# junk-name: leading english/commercial/number tokens lọt mục tham quan
JUNK = re.compile(
    r"^(coffee|place to rent|[0-9]+ |quán |nhà hàng |nhà nghỉ |homestay|hostel|"
    r"villa |căn hộ|khách sạn |shop |cửa hàng|the |a |an )", re.I)


def fold(s):
    return re.sub(r"\s+", " ", (s or "").lower()).strip()


def audit(slug):
    p = os.path.join(EXPORT, slug, "diem-den.json")
    if not os.path.exists(p):
        return None
    d = json.load(io.open(p, encoding="utf-8"))
    n = len(d)
    dd = [(r.get("ext") or {}).get("destination") or {} for r in d]

    def pct(k):
        return round(100 * k / n) if n else 0

    pid = sum(1 for r in d if (r.get("identity") or {}).get("place_id")
              or (r.get("external_ids") or {}).get("google_place_id"))
    hour = sum(1 for x in dd if x.get("opening_hours"))
    price = sum(1 for x in dd if x.get("ticketing") or x.get("gia_ve")
                or x.get("gia_ve_tham_khao"))
    mota = sum(1 for x in dd if (x.get("mo_ta") or "").strip())
    adv = sum(1 for x in dd if ((x.get("intro") or {}).get("editorial"))
              or x.get("phu_hop_voi"))
    names = [r.get("name", "") for r in d]
    junk = sum(1 for nm in names if JUNK.match(nm.strip()))
    dup = sum(v - 1 for v in Counter(fold(nm) for nm in names).values() if v > 1)
    return dict(slug=slug, n=n, pid=pct(pid), hour=pct(hour), price=pct(price),
                mota=pct(mota), adv=pct(adv), junk=junk, dup=dup)


def main():
    slugs = sys.argv[1:] or HOT10
    print("%-11s %4s %5s %5s %5s %5s %5s %4s %4s"
          % ("city", "n", "pid%", "hour%", "price%", "mota%", "adv%", "junk", "dup"))
    for s in slugs:
        r = audit(s)
        if not r:
            print("%-11s  (missing)" % s)
            continue
        print("%-11s %4d %5d %5d %5d %5d %5d %4d %4d"
              % (r["slug"], r["n"], r["pid"], r["hour"], r["price"],
                 r["mota"], r["adv"], r["junk"], r["dup"]))


if __name__ == "__main__":
    main()
