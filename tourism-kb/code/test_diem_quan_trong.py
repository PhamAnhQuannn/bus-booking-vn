# -*- coding: utf-8 -*-
"""Kiem `diem_quan_trong.py` bang record BIA — offline, khong mang, khong quota.

Chay:  PYTHONIOENCODING=utf-8 python tourism-kb/code/test_diem_quan_trong.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import diem_quan_trong as D

loi = []


def kiem(ten, dat, ky_vong):
    if dat != ky_vong:
        loi.append("%s: duoc %r, mong %r" % (ten, dat, ky_vong))
    print("  %s %-54s %r" % ("OK " if dat == ky_vong else "SAI", ten, dat))


def rec(cat="Khác", tickets=None, nha_nuoc=None, tra_phi=None, pid=None, name="x"):
    return {
        "name": name,
        "category": {"primary": cat},
        "identity": {"place_id": pid},
        "ext": {"destination": {
            "ticketing": tickets or [],
            "nha_nuoc_tham_dinh": nha_nuoc,
            "trai_nghiem_tra_phi": tra_phi,
        }},
    }


# ── paid_marquee: gia that vs "mien phi" (bug 02/09 — ve tra phi kem dong mien-phi-tre-nho) ──
_VE_VIN = [{"value": "1.050.000đ người lớn / 800.000đ trẻ 100–139cm / <100cm miễn phí"}]
kiem("ve co gia + 'mien phi' tre nho -> tra phi", D._paid_marquee(rec(tickets=_VE_VIN)), True)
kiem("chi 'Miễn phí (theo loại hình)' -> KHONG tra phi",
     D._paid_marquee(rec(tickets=[{"value": "Miễn phí (theo loại hình)"}])), False)
kiem("ticketing rong -> KHONG tra phi", D._paid_marquee(rec()), False)
kiem("trai_nghiem_tra_phi that -> tra phi", D._paid_marquee(rec(tra_phi="chèo sup 200k")), True)
kiem("ve '50.000 VNĐ' -> tra phi", D._paid_marquee(rec(tickets=[{"value": "50.000 VNĐ/vé"}])), True)

# ── tier ────────────────────────────────────────────────────────────────────
kiem("tier Bao tang = 1.0", D._tier(rec(cat="Bảo tàng")), 1.0)
kiem("tier Khac = 0.1", D._tier(rec(cat="Khác")), 0.1)
kiem("tier category la -> TIER_DEFAULT", D._tier(rec(cat="Xyz khong co")), D.TIER_DEFAULT)

# ── popularity: san 30 luot; Wilson chuan hoa [0,1] ──────────────────────────
kiem("n<30 -> popularity 0", D._popularity(rec(pid="P"), {"P": {"R": 5.0, "n": 10}})[0], 0.0)
kiem("thieu place_id -> popularity 0", D._popularity(rec(pid=None), {})[0], 0.0)
_pn = D._popularity(rec(pid="P"), {"P": {"R": 4.5, "n": 30700}})[0]
kiem("n>=30, R=4.5 -> popularity trong (0,1]", 0.0 < _pn <= 1.0, True)

# ── I1: tang day (Khac) maxed < tang dinh tran trui (chong chon di san) ──────
_day_max = D.score(rec(cat="Khác", nha_nuoc=True, tickets=_VE_VIN, pid="P"),
                   {"P": {"R": 5.0, "n": 100000}})[0]
_dinh_tran = D.score(rec(cat="Bảo tàng"))[0]
kiem("I1: Khac-maxed (%.3f) < Bao-tang-tran (%.3f)" % (_day_max, _dinh_tran),
     _day_max < _dinh_tran, True)

# ── sap_xep: giam importance; hoa giu thu tu cu; KHONG mutate/them field ─────
_a = rec(cat="Bảo tàng", name="cao")           # 0.60
_b = rec(cat="Khác", name="thap")              # 0.06
_c = rec(cat="Bảo tàng", name="cao2")          # 0.60, hoa voi _a
_out = D.sap_xep([_b, _a, _c])
kiem("sap_xep: cao len truoc thap", [r["name"] for r in _out][0] != "thap", True)
kiem("sap_xep: hoa giu thu tu cu (_a truoc _c)",
     [r["name"] for r in _out if r["name"] in ("cao", "cao2")], ["cao", "cao2"])
kiem("sap_xep KHONG them field vao record", set(_a.keys()),
     {"name", "category", "identity", "ext"})

print("\n%s  (%d loi)" % ("TAT CA OK" if not loi else "CO LOI:", len(loi)))
for e in loi:
    print("  -", e)
sys.exit(1 if loi else 0)
