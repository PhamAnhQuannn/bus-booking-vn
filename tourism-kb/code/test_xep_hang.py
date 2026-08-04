# -*- coding: utf-8 -*-
"""Kiem `xep_hang.py` bang so BIA — khong goi mang, khong ton quota, chay offline.

Chay:  PYTHONIOENCODING=utf-8 python tourism-kb/code/test_xep_hang.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xep_hang as X

loi = []


def kiem(ten, dat, ky_vong):
    if dat != ky_vong:
        loi.append(f"{ten}: được {dat!r}, mong {ky_vong!r}")
    print(f"  {'OK ' if dat == ky_vong else 'SAI'} {ten:52} {dat!r}")


# ── San bang chung ─────────────────────────────────────────────────────────
kiem("29 luot -> khong xep hang", X.xep(5.0, 29)["hang"], None)
kiem("29 luot -> dat_san False", X.xep(5.0, 29)["dat_san"], False)
kiem("30 luot -> qua san", X.xep(5.0, 30)["dat_san"], True)
kiem("0 luot -> khong no", X.xep(None, 0)["W"], 0.0)

# ── Bay da do that: R cao thi Wilson gan nhu khong phat n be ───────────────
# `Liquid Lab` 5,0★/167 CAO HON `Nậm Nướng` 4,9★/11.364. Day khong phai bug,
# day la tinh chat cua Wilson o p=1 — ghi lai de khong ai "sua" no thanh sai.
_ll = X.wilson95(5.0, 167)
_nn = X.wilson95(4.9, 11364)
kiem("5,0★/167 luot VUOT 4,9★/11.364 luot (co y)", _ll > _nn, True)

# ── Hai diem neo nguoi dung chi ra ─────────────────────────────────────────
kiem("Nam Nuong 4,9★/11.364 -> A", X.xep(4.9, 11364)["hang"], "A")
# W = 3,651, duoi ca nguong C (4,00). Ky vong ban dau cua toi la "C" — chep tu
# bo nguong CU (4,5/4,0/3,5) truoc khi chot 4,7/4,4/4,0. Test sai, code dung.
kiem("Lau Bo Phan Rang 3,9★/221 -> duoi chuan", X.xep(3.9, 221)["hang"], X.DUOI_CHUAN)

# PHAN BIET hai trang thai am: duoi chuan (co ket luan) vs chua du danh gia.
kiem("duoi chuan KHAC chua du danh gia",
     (X.xep(3.9, 221)["hang"], X.xep(3.9, 5)["hang"]), (X.DUOI_CHUAN, None))

# ── Nguong khong phu thuoc quan moc ────────────────────────────────────────
# Kiem THAM SO, khong phai bien cuc bo: `co_varnames` gom ca bien vong lap, va
# ban dau toi kiem nham no nen phep kiem bao sai trong khi code dung.
_tham_so = X.xep.__code__.co_varnames[:X.xep.__code__.co_argcount]
kiem("xep() chi nhan (R, n)", _tham_so, ("R", "n"))
kiem("goi lai cho cung ket qua", X.xep(4.6, 2352)["hang"], X.xep(4.6, 2352)["hang"])

# ── Khoang tin cay phai HEP dan khi n tang ─────────────────────────────────
_r30 = X.khoang_tin_cay(4.6, 30)
_r2k = X.khoang_tin_cay(4.6, 2352)
kiem("CI n=30 rong hon CI n=2.352",
     (_r30[1] - _r30[0]) > (_r2k[1] - _r2k[0]), True)
print(f"      n=30    CI = [{_r30[0]:.2f} ; {_r30[1]:.2f}]  rong {_r30[1]-_r30[0]:.2f} sao")
print(f"      n=2.352 CI = [{_r2k[0]:.2f} ; {_r2k[1]:.2f}]  rong {_r2k[1]-_r2k[0]:.2f} sao")

# ── Wilson phai <= diem tho, va tang theo n ────────────────────────────────
kiem("Wilson <= diem tho", all(X.wilson95(4.5, n) <= 4.5 for n in (30, 300, 3000)), True)
kiem("Wilson tang theo n (cung R)",
     X.wilson95(4.5, 30) < X.wilson95(4.5, 300) < X.wilson95(4.5, 3000), True)

# ── Phan vi ────────────────────────────────────────────────────────────────
_bo = [X.xep(5.0, 100), X.xep(4.0, 100), X.xep(3.0, 100), X.xep(5.0, 5)]
X.phan_vi(_bo)
kiem("phan vi cao nhat = 100", max(r["phan_vi"] for r in _bo if r["phan_vi"] is not None), 100)
kiem("duoi san -> phan_vi None", _bo[3]["phan_vi"], None)

# ── Mo ta nguong sinh tu chinh hang, khong chep tay ────────────────────────
_m = X.mo_ta_nguong()
kiem("mo_ta_nguong neu du 3 hang", all(h in _m for _, h in X.NGUONG), True)
kiem("mo_ta_nguong neu san", str(X.SAN_TOI_THIEU) in _m, True)

print()
if loi:
    print(f"{len(loi)} PHEP KIEM SAI:")
    for x in loi:
        print("   " + x)
    sys.exit(1)
print("tat ca phep kiem dat.")
