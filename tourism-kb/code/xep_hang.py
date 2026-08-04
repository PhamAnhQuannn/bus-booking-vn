# -*- coding: utf-8 -*-
"""Xep hang co so theo danh gia — THUAN TOAN, khong I/O, khong goi mang.

Tach khoi `xep_hang_song.py` co chu dich: phan TINH DIEM phai test duoc bang so
bia voi 0 quota va 0 mang. Moi bug o day tim duoc offline; moi bug o kia ton
mot lan goi API de tai hien.

═══════════════════════════════════════════════════════════════════════════════
NGUONG LA TUYET DOI, KHONG NEO VAO MOT QUAN MOC. Day la ban sua cua mot thiet
ke sai, va phep do la cua chinh du an nay:

    giu nguyen 172 quan, chi doi quan moc  ->  hang A di tu 12 len 27

Vi sao: `n0` cua quan moc la GIA TRI CUC DAI cua mot phan phoi lech nang (trung
vi 60, max 11.364 — chenh 189 lan). Cuc dai la thong ke bat on nhat co the
chon; cho no dieu khien ca san lan thang diem nghia la ca bang xep hang lac lu
theo mot quan sat duy nhat. O 63 tinh, "hang A" se co nghia khac nhau o moi
tinh ma khong ai biet.

Quan moc van co vai tro — no DINH CO nguong MOT LAN, roi nguong dong bang thanh
hang so dung chung toan quoc. Khac nhau o cho: nguong khong duoc tinh lai theo
tung tinh.

CANH BAO ve mot bay da do duoc: o R cao, phuong sai nhi thuc p(1-p) rat nho nen
Wilson GAN NHU KHONG phat n be. `Liquid Lab` 5,0★/167 luot cho W=4,910, cao hon
ca quan 4,9★/11.364 luot (W=4,888). Do la ly do SAN BANG CHUNG ton tai va khong
duoc bo — Wilson mot minh khong du chan ca nay.
═══════════════════════════════════════════════════════════════════════════════

RATING VA SO LUOT LA GOOGLE MAPS CONTENT. Module nay nhan chung nhu tham so
thuong va khong biet chung tu dau ra; no khong mo mot handle ghi nao. Noi nao
goi module nay cung KHONG duoc ghi (R, n) hay `hang` xuong dia — xem docstring
cua `xep_hang_song.py`.
"""
import math

# ── Nguong, dinh co MOT LAN roi dong bang ──────────────────────────────────
# Dinh co tren 102 quan Da Lat qua san, va tren hai diem neo nguoi dung chi ra:
#   `Nậm Nướng Đà Lạt`            4,9★ / 11.364 luot -> W = 4,888  (chuan "top dau")
#   `Lẩu Bò Phan Rang Quang Trung` 3,9★ /    221 luot -> W = 3,651  (chuan "kha")
# Chon 4,7 / 4,4 / 4,0 vi no cho A = 9/102 = 9% — mot "top dau" co nghia. Hai
# muc long hon da thu: 4,5 cho A = 31% (khong con la top), 4,6 cho 19%.
NGUONG = ((4.70, "A"), (4.40, "B"), (4.00, "C"))

# Nhan cho co so QUA san nhung duoi moi nguong. KHONG dung `None` cho ca nay:
# `None` da mang nghia "chua du danh gia de ket luan", va gop hai thu do lam
# mot chinh la loi 28/07 — "phep kiem khong chay duoc" phai bao khac "phep kiem
# cho ket qua am". Mot quan 3,9★ voi 221 luot la mot ket luan, khong phai mot
# khoang trong.
DUOI_CHUAN = "—"

# San bang chung: HANG SO TOAN QUOC, khong nhan theo quan moc.
# 30 la nguong CLT quen thuoc, va no la san toi thieu chu khong phai dau hieu
# dang tin: do tai n=30, R=4,6 thi khoang tin cay 95% rong [3,98 ; 4,86] — gan
# mot sao. "Qua san" nghia la "khong con vo nghia", khong phai "da chac chan".
# Vi vay `xep()` tra ve ca do rong khoang tin cay de noi goi hien thi duoc.
SAN_TOI_THIEU = 30

Z95 = 1.959963985


def _wilson(p, n, z=Z95, tren=False):
    """Can duoi (hoac tren) khoang tin cay Wilson cho ty le p voi n quan sat."""
    if n <= 0:
        return 0.0
    mau = 1 + z * z / n
    tam = p + z * z / (2 * n)
    rong = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return min(1.0, max(0.0, (tam + rong if tren else tam - rong) / mau))


def wilson95(R, n):
    """Can duoi Wilson 95%, tra ve tren THANG SAO 1-5.

    Anh xa 1..5 -> ty le 0..1 bang p=(R-1)/4 truoc khi tinh, roi anh xa nguoc.
    Lam vay de nguong doc duoc bang cung don vi voi diem Google ("A tu 4,7 sao
    tro len"), thay vi mot con so 0..1 khong ai doi chieu duoc voi cai ho thay
    tren ban do.
    """
    if not R or n <= 0:
        return 0.0
    return 1 + 4 * _wilson((R - 1) / 4.0, n)


def khoang_tin_cay(R, n):
    """(can duoi, can tren) tren thang sao — de HIEN THI do bat dinh, khong de loc.

    Ton tai vi mot nguong nhi phan qua/khong-qua giau mat dieu quan trong: o
    n=30 khoang nay rong gan mot sao, o n=2.352 no rong 0,06 sao. Hai quan cung
    "4,6★" nhung khac han ve do chac chan, va nguoi doc co quyen thay dieu do.
    """
    if not R or n <= 0:
        return (0.0, 0.0)
    p = (R - 1) / 4.0
    return (1 + 4 * _wilson(p, n), 1 + 4 * _wilson(p, n, tren=True))


def xep(R, n):
    """Tra ve dict: {R, n, W, hang, dat_san, ci}.

    `hang`  "A"/"B"/"C"     — qua san va dat nguong
            DUOI_CHUAN "—"  — qua san nhung duoi moi nguong (mot KET LUAN)
            None            — chua du danh gia de ket luan (mot KHOANG TRONG)

    KHONG nhan quan moc lam tham so — do la diem chinh cua ban sua nay.
    """
    dat_san = n is not None and n >= SAN_TOI_THIEU
    W = wilson95(R, n or 0)
    hang = None
    if dat_san:
        hang = DUOI_CHUAN
        for _moc, _ten in NGUONG:
            if W >= _moc:
                hang = _ten
                break
    return {"R": R, "n": n, "W": W, "hang": hang, "dat_san": dat_san,
            "ci": khoang_tin_cay(R, n or 0)}


def phan_vi(rows, khoa="W"):
    """Gan `phan_vi` (0-100) trong CHINH tap nay — nhan phu, khong phai hang.

    Vi sao la nhan phu chu khong phai hang chinh: phan vi khong on dinh theo
    thoi gian — mot quan moc xuat sac gia nhap lam dich chuyen phan vi cua MOI
    quan khac du diem va so luot cua chung khong doi. Nguoi doc se hoi "sao toi
    tut hang ma diem khong doi", va do la mot cau hoi khong tra loi duoc.
    Nguong tuyet doi khong co benh do; phan vi chi tra loi cau khac:
    "so voi cac quan CUNG DIA BAN thi dung dau bao nhieu".
    """
    hop_le = [r for r in rows if r.get("dat_san")]
    thu_tu = sorted(hop_le, key=lambda r: r[khoa])
    for i, r in enumerate(thu_tu):
        r["phan_vi"] = round(100.0 * i / max(len(thu_tu) - 1, 1))
    for r in rows:
        if not r.get("dat_san"):
            r["phan_vi"] = None
    return rows


def mo_ta_nguong():
    """Mot dong giai thich, dung chung cho moi bo dung — de nguong khong bi
    chep lai thanh hai ban roi lech nhau."""
    b = " · ".join(f"{ten} ≥ {moc:.1f}".replace(".", ",") for moc, ten in NGUONG)
    return (f"Hạng theo cận dưới Wilson 95% trên thang sao: {b}. "
            f"Cơ sở dưới {SAN_TOI_THIEU} lượt đánh giá KHÔNG được xếp hạng.")
