# -*- coding: utf-8 -*-
"""Audit OFFLINE thu tu importance tren 35 tp LIVE (doc export san co, KHONG rebuild,
KHONG goi API). Cong 1 cua plan: sweep hop ly · Thap Ba+Vinpearl top o Nha Trang ·
khong tp nao sup ve mot category · diem thieu place_id KHONG chim het day.

Popularity lay tu raw/<slug>/noi-bo/pop_diem_den.json neu co; Phase 1 offline -> rong -> 0.
Chay:  python tourism-kb/code/audit_importance_order.py  [slug ...]
"""
import io
import json
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")  # tranh crash cp1252 khi in tieng Viet

import diem_quan_trong as dqt

HERE = os.path.dirname(os.path.abspath(__file__))
EXPORT = os.path.join(HERE, "..", "export")

# 35 slug LIVE — nguon: trip-planner/lib/planner/cities.ts (CITY_SLUGS). Cap nhat neu cities.ts doi.
LIVE_SLUGS = [
    "da-lat", "nha-trang", "da-nang", "ha-noi", "ho-chi-minh", "hue", "hai-phong",
    "ninh-binh", "can-tho", "bac-ninh", "phu-tho", "thai-nguyen", "tuyen-quang",
    "lao-cai", "dong-thap", "vinh-long", "phu-quoc", "quy-nhon", "ha-long", "vung-tau",
    "dong-hoi", "tuy-hoa", "chau-doc", "dong-ha", "mong-cai", "van-don", "mui-ca-mau",
    "tay-ninh-tp", "sa-pa", "ba-be", "dien-bien-phu", "dong-van", "vinh", "cao-bang-tp",
    "thanh-hoa-tp",
]


def _load(slug):
    p = os.path.join(EXPORT, slug, "diem-den.json")
    if not os.path.exists(p):
        return None
    return json.load(io.open(p, encoding="utf-8"))


def _pop(slug):
    # noi-bo sibling cua scrape: raw/<slug>/noi-bo. Offline -> rong.
    return dqt.load_pop(os.path.join(HERE, "..", "raw", slug))


def _pct(rank, n):
    return 0.0 if n <= 1 else 100.0 * rank / (n - 1)


def audit(slug):
    recs = _load(slug)
    if not recs:
        print("  [%s] KHONG co export" % slug)
        return None
    pop = _pop(slug)
    ordered = dqt.sap_xep(recs, pop)
    n = len(ordered)

    unknown = set()
    no_pid_ranks = []
    for i, r in enumerate(ordered):
        cat = (r.get("category") or {}).get("primary")
        if cat not in dqt.IMPORTANCE_TIER:
            unknown.add(cat)
        if not dqt._place_id(r):
            no_pid_ranks.append(i)

    topk = ordered[: min(8, n)]
    top_cats = Counter((r.get("category") or {}).get("primary") for r in topk)
    collapsed = len(top_cats) == 1 and n >= 5

    no_pid_pct = None
    if no_pid_ranks:
        mid = sorted(_pct(r, n) for r in no_pid_ranks)
        no_pid_pct = mid[len(mid) // 2]

    print("\n=== %s  (N=%d) ===" % (slug, n))
    for i, r in enumerate(topk):
        s, nn = dqt.score(r, pop)
        cat = (r.get("category") or {}).get("primary") or "?"
        flags = []
        if dqt._nha_nuoc(r):
            flags.append("NN")
        if dqt._paid_marquee(r):
            flags.append("$")
        if not dqt._place_id(r):
            flags.append("no-pid")
        print("  %2d. %-34s  %.3f  [%s]  %s"
              % (i + 1, (r.get("name") or "?")[:34], s, cat[:22], " ".join(flags)))
    print("  top-8 categories: %d loai  %s%s"
          % (len(top_cats), dict(top_cats), "  <-- SUP 1 LOAI!" if collapsed else ""))
    if no_pid_ranks:
        print("  no-place_id: %d/%d diem, median percentile = %.0f%% (100%%=day)"
              % (len(no_pid_ranks), n, no_pid_pct))
    if unknown:
        print("  category NGOAI bang IMPORTANCE_TIER: %s" % sorted(unknown))
    return {"slug": slug, "n": n, "collapsed": collapsed, "unknown": unknown,
            "no_pid_pct": no_pid_pct, "no_pid_count": len(no_pid_ranks)}


def check_nha_trang(pop):
    recs = _load("nha-trang")
    if not recs:
        return
    ordered = dqt.sap_xep(recs, dqt.load_pop(os.path.join(HERE, "..", "raw", "nha-trang")))
    pos = {}
    for i, r in enumerate(ordered):
        nm = r.get("name") or ""
        if "Tháp Bà" in nm or "VinWonders" in nm:
            pos[nm] = i + 1
    print("\n>>> NHA TRANG anchor: %s (N=%d)  [ky vong ca hai o top]"
          % (pos, len(ordered)))


def main():
    slugs = sys.argv[1:] or LIVE_SLUGS
    results = []
    for s in slugs:
        r = audit(s)
        if r:
            results.append(r)

    print("\n" + "=" * 60)
    print("TONG KET %d tp:" % len(results))
    collapsed = [r["slug"] for r in results if r["collapsed"]]
    print("  Sup ve 1 loai (top-8): %s" % (collapsed or "khong co (tot)"))
    unknown = set().union(*[r["unknown"] for r in results]) if results else set()
    print("  Category ngoai bang: %s" % (sorted(unknown) or "khong (tot)"))
    pcts = [r["no_pid_pct"] for r in results if r["no_pid_pct"] is not None]
    if pcts:
        print("  no-place_id median-percentile trung binh: %.0f%% "
              "(cao ~ chim day; ky vong < 70%%)" % (sum(pcts) / len(pcts)))
    check_nha_trang(None)


if __name__ == "__main__":
    main()
