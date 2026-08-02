# -*- coding: utf-8 -*-
"""Kiem `duong_dan_ra.py` bang duong dan bia — khong ghi file, khong goi mang.

Chay:  PYTHONIOENCODING=utf-8 python scripts/tourism/test_duong_dan_ra.py

PHAI CHAY TU GOC REPO. `duoc_phep` giai duong dan tuong doi theo cwd, dung y
nhu `open()` se lam, nen chay tu thu muc khac thi moi duong dan tuong doi tro
thanh mot dich khac. Lan chay dau tien cua chinh phep kiem nay bao SAI ca bay
truong hop "duoc phep" chi vi no duoc goi tu `scripts/tourism/` — code dung, phep
kiem sai. Do la ly do co dong `_bat_buoc_goc()` ben duoi: mot phep kiem im lang
chay sai cho se bao lai ket qua cua mot cau hoi khac.
"""
import os
import sys

_GOC = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(_GOC, "scripts", "tourism"))
import duong_dan_ra as D  # noqa: E402


def _bat_buoc_goc():
    if os.path.normpath(os.getcwd()) != os.path.normpath(_GOC):
        sys.stderr.write(
            "PHAI chay tu goc repo ({}), dang o {}\n".format(_GOC, os.getcwd()))
        raise SystemExit(2)


_bat_buoc_goc()

# (duong dan, co duoc phep khong, vi sao)
TRUONG_HOP = [
    # ── Duoc phep ─────────────────────────────────────────────────────────
    (".tourism-data/raw/x.json", True, "kho du lieu tho"),
    (".tourism-data/build/Huong-Dan-Da-Lat.docx", True, "ban gop, ngoai docs/"),
    (".tourism-data", True, "chinh thu muc goc du lieu"),
    ("documentation/tourism/destinations/da-lat/huong-dan-diem-den.md", True,
     "dau ra mac dinh cua build_huong_dan.py"),
    ("docs/Diem-Den-Da-Lat.docx", True, "mot trong ba ban phat hanh"),
    ("docs/Nha-Hang-Da-Lat.docx", True, "mot trong ba ban phat hanh"),
    ("docs/Khach-San-Da-Lat.docx", True, "mot trong ba ban phat hanh"),
    ("docs/Huong-Dan-Da-Lat.md", True, "ban .md tuong ung, da ignore theo ten"),

    # ── Bi tu choi: dung tam duong dan do duoc 2026-08-01 la commit duoc ──
    ("docs/tourism-guide.md", False, "docs/ nhung sai tien to"),
    ("docs/qa/dalat-data.md", False, "docs/qa la 168 bao cao that"),
    ("docs/design/dalat.md", False, "docs/design la tai lieu that"),
    ("scripts/tourism/out.md", False, "lop lot cua diem_den_chot.json"),
    ("documentation/dalat.md", False, "documentation/ nhung ngoai tourism/"),
    ("documentation/tourism-v2/x.md", False, "gan giong nhung khong phai"),
    ("issues/dalat-quan.md", False, "ngoai vung hoan toan"),
    ("bao-cao.md", False, "goc repo"),

    # ── Bi tu choi: di vong ───────────────────────────────────────────────
    (".tourism-data/../docs/sneak.md", False, ".. di ra khoi vung cho phep"),
    ("documentation/tourism/../../issues/x.md", False, ".. hai cap"),
    ("../outside-repo.md", False, "ngoai repo"),
    (os.path.join(_GOC, "docs", "Diem-Den-Da-Lat.docx"), True,
     "duong dan tuyet doi trong vung van duoc"),
    (os.path.join(_GOC, "issues", "x.md"), False,
     "duong dan tuyet doi ngoai vung van bi chan"),
]

loi = []
for duong_dan, mong, vi_sao in TRUONG_HOP:
    dat = D.duoc_phep(duong_dan)
    if dat != mong:
        loi.append("{}: duoc {}, mong {}  ({})".format(duong_dan, dat, mong, vi_sao))
    print("  {} {:<58} {}".format("OK " if dat == mong else "SAI",
                                  duong_dan if len(duong_dan) < 58 else "..." + duong_dan[-55:],
                                  dat))

# `kiem_loi_ra` phai THOAT chu khong chi tra ve False — kiem rieng, vi mot guard
# tra ve False roi de chuong trinh chay tiep thi khong chan duoc gi.
print()
try:
    D.kiem_loi_ra("issues/x.md")
    loi.append("kiem_loi_ra() KHONG thoat khi duong dan sai")
    print("  SAI kiem_loi_ra() khong thoat")
except SystemExit as e:
    if e.code == 1:
        print("  OK  kiem_loi_ra() thoat 1 khi duong dan sai")
    else:
        loi.append("kiem_loi_ra() thoat {} thay vi 1".format(e.code))

# ...va phai TRA VE duong dan khi hop le, de goi long nhau duoc:
#     OUT = kiem_loi_ra(sys.argv[2])
try:
    tra_ve = D.kiem_loi_ra("docs/Diem-Den-Da-Lat.docx")
    if tra_ve == "docs/Diem-Den-Da-Lat.docx":
        print("  OK  kiem_loi_ra() tra ve duong dan khi hop le")
    else:
        loi.append("kiem_loi_ra() tra ve {!r}".format(tra_ve))
except SystemExit:
    loi.append("kiem_loi_ra() thoat tren mot duong dan HOP LE")
    print("  SAI kiem_loi_ra() thoat tren duong dan hop le")

# ── Moi noi duoc PHEP ghi phai la noi da duoc gitignore ────────────────────
# Day la gia dinh trung tam cua ca thay doi nay: "cho phep" phai keo theo "da
# ignore". Hom nay dung, nhung dung nho HAI danh sach tinh co khop nhau —
# `THU_MUC_CHO_PHEP` trong duong_dan_ra.py va cac luat trong `.gitignore`. Them
# mot goc vao mot ben ma quen ben kia thi guard se vui ve cho ghi tai lieu day so
# dien thoai vao mot duong dan DUOC THEO DOI, dung cai no sinh ra de chan.
#
# Thong diep loi cua module da bao "sua ca hai cung luc", nhung do la mot chu
# thich chu khong phai mot phep kiem — va so chu thich het dung trong du an nay
# du de khong tin vao chu thich nua. Bien no thanh phep kiem.
import subprocess  # noqa: E402

print()
_can_ignore = list(D.THU_MUC_CHO_PHEP) + [
    "docs/" + t + "Da-Lat.docx" for t in D.TIEN_TO_DOCS
]
for _p in _can_ignore:
    _rc = subprocess.run(["git", "check-ignore", "-q", _p],
                         cwd=_GOC, stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL).returncode
    if _rc == 0:
        print("  OK  da gitignore: {}".format(_p))
    else:
        loi.append("{} duoc phep ghi nhung KHONG bi gitignore "
                   "(git check-ignore tra ve {})".format(_p, _rc))
        print("  SAI KHONG bi gitignore: {}".format(_p))

print()
if loi:
    print("{} PHEP KIEM SAI:".format(len(loi)))
    for x in loi:
        print("   " + x)
    sys.exit(1)
print("tat ca phep kiem dat.")
