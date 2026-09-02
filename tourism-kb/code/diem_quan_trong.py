# -*- coding: utf-8 -*-
"""Cham & sap xep DIEM DEN theo MUC DO QUAN TRONG (worth-visiting).

Cham THUAN TOAN (khong I/O, khong mang); I/O tach ra `load_pop`. Doctrine:
CHI THU TU record trong diem-den.json doi — KHONG them field so nao vao record
(cung ngoai le 2026-08-05 nhu nha_hang/khach_san: order ship, so KHONG ship).

Cong thuc:
    importance = W_CAT  * tier(category.primary)          # san chan rac
               + W_NN   * nha_nuoc_tham_dinh              # booster (thua)
               + W_PAID * paid_marquee                    # diem-dinh tra phi
               + W_POP  * popularity                       # Wilson qua place_id, n>=30
    hoa -> review count n -> giu thu tu cu (khong gian).

`popularity` la can duoi Wilson (xep_hang.wilson95) chuan hoa ve [0,1]; =0 khi thieu
place_id HOAC n<SAN_TOI_THIEU -> cung code path, xen theo backbone (khong chim day).
Wilson tranh volume-bias (count*rating tho se cho quan 20k-review de bep di san).

IMPORTANCE_TIER la RULE trong file — cung lop voi xep_hang.NGUONG / build_diem_den.CAT_TIER,
KHONG phai float bia per-place. Khoi tao = gia tri CAT_TIER (build_diem_den.py:35);
la diem xuat phat, calibrate bang audit_importance_order.py (co the co y lech khoi CAT_TIER
vi CAT_TIER la fame-prior cho osm_score, con day la tier quan-trong — hai muc dich khac).

RATING/SO LUOT la Google Maps content: nhan nhu tham so, KHONG ghi xuong record (xem xep_hang.py).
"""
import io
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xep_hang import SAN_TOI_THIEU, wilson95

# ── Trong so (PLACEHOLDER — calibrate qua audit; xem plan) ──────────────────
W_CAT, W_NN, W_PAID, W_POP = 0.60, 0.10, 0.10, 0.15

# Tier quan-trong theo category.primary. Khoi tao = build_diem_den.CAT_TIER.
# (Khong import build_diem_den: no chay sys.argv[1] o module-level -> khong import-safe.)
IMPORTANCE_TIER = {
    "Thác nước": 1.0, "Hồ / Đập": 1.0, "Chùa / Thiền viện": 1.0, "Nhà thờ": 1.0,
    "Bảo tàng": 1.0, "Dinh thự / Di tích": 1.0, "Công viên / Vườn hoa": 1.0,
    "Bãi biển": 1.0, "Điểm ngắm cảnh": 1.0, "Khu vui chơi": 1.0, "Cáp treo": 1.0,
    "Khu du lịch giải trí (vui chơi trả phí)": 1.0,
    "Hang động": 1.0, "Đảo": 1.0, "Vườn quốc gia / Khu bảo tồn": 1.0, "Điểm tham quan": 0.9,
    "Đền / Miếu": 0.9, "Suối nước nóng": 0.8, "Nông trại / Vườn": 0.8,
    "Chợ / Mua sắm": 0.8, "Núi / Đèo / Đường mòn": 0.6, "Khác": 0.1,
}
TIER_DEFAULT = 0.3  # category ngoai bang -> nhu build_diem_den.osm_score default; audit se bao

# Diem-dinh tra phi = ticketing value co GIA TIEN that. KHONG dung "chua chu mien phi"
# vi ve tra phi hay kem dong "<100cm mien phi" (vd VinWonders 1.050.000d ... mien phi tre nho)
# -> match nham. Tim so tien: chu so + don vi (d/nghin/k/vnd).
_CO_GIA = re.compile(r"\d[\d.,]*\s*(đ|₫|nghìn|ngàn|vn[đd]|\bk\b)", re.I)


def _ext(rec):
    return (rec.get("ext") or {}).get("destination") or {}


def _tier(rec):
    cat = (rec.get("category") or {}).get("primary")
    return IMPORTANCE_TIER.get(cat, TIER_DEFAULT)


def _nha_nuoc(rec):
    return bool(_ext(rec).get("nha_nuoc_tham_dinh"))


def _paid_marquee(rec):
    """Diem co ve/trai nghiem tra phi that (khong phai 'mien phi')."""
    ext = _ext(rec)
    if ext.get("trai_nghiem_tra_phi"):
        return True
    for t in (ext.get("ticketing") or []):
        v = (t or {}).get("value") or ""
        if _CO_GIA.search(v):
            return True
    return False


def _place_id(rec):
    return ((rec.get("identity") or {}).get("place_id")
            or (rec.get("external_ids") or {}).get("google_place_id"))


def _popularity(rec, pop):
    """(pop_norm in [0,1], n). pop: {place_id: {'R':.., 'n':..}}. Thieu/n<san -> (0, n)."""
    pid = _place_id(rec)
    rn = pop.get(pid) if (pid and pop) else None
    if not rn:
        return 0.0, 0
    R = rn.get("R")
    n = rn.get("n") or 0
    if not R or n < SAN_TOI_THIEU:
        return 0.0, n
    return (wilson95(R, n) - 1.0) / 4.0, n


def score(rec, pop=None):
    """(importance, n). THUAN TOAN. pop mac dinh rong -> popularity=0 (Phase 1 offline)."""
    pop = pop or {}
    p, n = _popularity(rec, pop)
    s = (W_CAT * _tier(rec)
         + W_NN * (1.0 if _nha_nuoc(rec) else 0.0)
         + W_PAID * (1.0 if _paid_marquee(rec) else 0.0)
         + W_POP * p)
    return s, n


def sap_xep(records, pop=None):
    """Sap ON DINH giam importance -> hoa theo n -> hoa nua giu thu tu cu (khong gian).
    KHONG mutate record, KHONG them field — chi tra list moi da doi thu tu."""
    pop = pop or {}
    keyed = []
    for i, r in enumerate(records):
        s, n = score(r, pop)
        keyed.append((-s, -n, i, r))
    keyed.sort(key=lambda t: (t[0], t[1], t[2]))
    return [t[3] for t in keyed]


def load_pop(city_dir):
    """{place_id: {'R','n'}} tu raw/<slug>/noi-bo/pop_diem_den.json. Thieu -> {} (Phase 1)."""
    p = os.path.join(city_dir, "noi-bo", "pop_diem_den.json")
    if not os.path.exists(p):
        return {}
    d = json.load(io.open(p, encoding="utf-8"))
    return d.get("pop", d) if isinstance(d, dict) else {}
