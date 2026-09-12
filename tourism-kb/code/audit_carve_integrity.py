# -*- coding: utf-8 -*-
"""Carve-integrity audit (operationalize lesson 2026-09-02-splitcity-wrong-parent): mỗi carve unit
(split_city UNITS + areas.json areas[]) — province chủ đạo trong address có KHỚP tp đích không, và
signatureSpots có resolve không. Bắt bug "nạp nhầm tỉnh" (Vũng Tàu 21 điểm Đồng Nai) mà radius/centroid
check MÙ. Network-free.

Chạy TỪ tourism-kb/:  python code/audit_carve_integrity.py [slug ...]   (mặc định: mọi carve)
"""
import io
import json
import math
import os
import re
import sys
import unicodedata
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
EXPORT = os.path.join(HERE, "..", "export")
AREAS = os.path.join(HERE, "..", "..", "trip-planner", "lib", "planner", "areas.json")

# carve slug → tên tỉnh KỲ VỌNG trong address (post-2025). Từ split_city UNITS + areas[].
EXPECT_PROV = {
    "sa-pa": "Lào Cai", "vung-tau": "Hồ Chí Minh", "phu-quoc": "An Giang", "ha-long": "Quảng Ninh",
    "chau-doc": "An Giang", "mong-cai": "Quảng Ninh", "van-don": "Quảng Ninh", "quy-nhon": "Gia Lai",
    "tuy-hoa": "Đắk Lắk", "dong-hoi": "Quảng Trị", "dong-ha": "Quảng Trị", "ca-mau-tp": "Cà Mau",
    "mui-ca-mau": "Cà Mau", "tay-ninh-tp": "Tây Ninh", "dien-bien-phu": "Điện Biên",
    "dong-van": "Tuyên Quang", "vinh": "Nghệ An", "cao-bang-tp": "Cao Bằng",
    "thanh-hoa-tp": "Thanh Hóa", "lang-son-tp": "Lạng Sơn", "ha-giang": "Tuyên Quang",
    "ba-be": "Thái Nguyên", "ben-tre": "Vĩnh Long", "tra-vinh": "Vĩnh Long",
    "con-dao": "Hồ Chí Minh",
}

# parent slug → vùng (tâm, bán kính km, nhãn) PHẢI RỖNG sau subtractive carve. Bắt regression "child leak
# ngược về parent": ho-chi-minh KHÔNG được còn điểm Vũng Tàu / Côn Đảo (đã tách ra slug riêng, split_city
# SUBTRACT_FROM_PARENT). Đồng bộ tâm/bán kính với split_city UNITS.
LEAK_ZONES = {
    "ho-chi-minh": [((10.35, 107.08), 22.0, "Vũng Tàu"), ((8.683, 106.607), 22.0, "Côn Đảo")],
}


def hav(a, b):
    R = 6371.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    return 2 * R * math.asin(math.sqrt(math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2))


def leak_check(slug):
    zones = LEAK_ZONES.get(slug)
    if not zones:
        return True
    p = os.path.join(EXPORT, slug, "diem-den.json")
    if not os.path.exists(p):
        print("  [%-14s] MISSING export (leak-check)" % slug); return False
    d = json.load(io.open(p, encoding="utf-8"))
    ok = True
    for center, rad, label in zones:
        leaked = [r for r in d if _near(r, center, rad)]
        if leaked:
            ok = False
            print("  [%-14s] LEAK %d điểm trong %gkm quanh %s (phải 0) — vd: %s"
                  % (slug, len(leaked), rad, label, (leaked[0].get("name") or "?")))
    if ok:
        print("  [%-14s] leak-check OK (0 điểm %s)" % (slug, "/".join(z[2] for z in zones)))
    return ok


def _near(r, center, rad):
    c = r.get("coordinates") or {}
    la, lo = c.get("latitude"), c.get("longitude")
    return la is not None and lo is not None and hav(center, (la, lo)) <= rad


def fold(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s.replace("đ", "d")).strip()


def prov_of(r):
    a = r.get("address") or {}
    if a.get("province"):
        return a["province"]
    full = a.get("full_address") or ""
    m = re.findall(r"(?:tỉnh|thành phố)\s+([^,]+)", full)
    return m[-1].strip() if m else "?"


def sigmap():
    raw = json.load(io.open(AREAS, encoding="utf-8"))
    m = {k: v.get("signatureSpots", []) for k, v in raw.get("provinces", {}).items()}
    for a in raw.get("areas", []):
        if a.get("slug") and a.get("signatureSpots"):
            m[a["slug"]] = a["signatureSpots"]
    return m


def audit(slug, sig):
    p = os.path.join(EXPORT, slug, "diem-den.json")
    if not os.path.exists(p):
        print("  [%-14s] MISSING export" % slug); return False
    d = json.load(io.open(p, encoding="utf-8"))
    provs = Counter(prov_of(r) for r in d)
    modal, mcount = (provs.most_common(1)[0] if provs else ("?", 0))
    exp = EXPECT_PROV.get(slug)
    prov_ok = (not exp) or (fold(exp) in fold(modal))
    names = [fold(r.get("name", "")) for r in d]
    sigs = sig.get(slug, [])
    absent = [s for s in sigs if not any(fold(s) in n or n in fold(s) for n in names if len(n) >= 5)]
    flag = "" if prov_ok else "  <<< PROV MISMATCH (kỳ vọng %s)" % exp
    print("  [%-14s] n=%3d · modal=%s (%d/%d)%s · icon absent=%d/%d %s"
          % (slug, len(d), modal, mcount, len(d), flag, len(absent), len(sigs),
             ("(" + ", ".join(absent) + ")") if absent else ""))
    return prov_ok


def main():
    sig = sigmap()
    slugs = sys.argv[1:] or list(EXPECT_PROV.keys())
    bad = 0
    for s in slugs:
        if not audit(s, sig):
            bad += 1
    # Leak-check chạy trên PARENT (LEAK_ZONES keyed theo parent, vd ho-chi-minh — KHÔNG theo child
    # vung-tau/con-dao). Không arg -> kiểm mọi zone. Có arg -> chỉ các parent được yêu cầu. Nếu chỉ
    # định toàn child (vd `audit vung-tau con-dao`) thì KHÔNG parent nào khớp -> leak-check KHÔNG áp
    # dụng: phải báo N/A rõ ràng, TUYỆT ĐỐI không in "0 LEAK" (lesson could-not-test: "không kiểm
    # được" ≠ "kiểm và sạch" — chạy lại với slug parent, vd ho-chi-minh, để thực sự kiểm).
    leak_slugs = list(LEAK_ZONES) if len(sys.argv) <= 1 else [s for s in slugs if s in LEAK_ZONES]
    leaks = 0
    for s in leak_slugs:
        if not leak_check(s):
            leaks += 1
    leak_report = ("%d LEAK" % leaks) if leak_slugs else "LEAK N/A (không slug parent LEAK_ZONES nào được yêu cầu)"
    print("\n%d carve · %d PROV MISMATCH · %s" % (len(slugs), bad, leak_report))
    sys.exit(1 if (bad or leaks) else 0)


if __name__ == "__main__":
    main()
