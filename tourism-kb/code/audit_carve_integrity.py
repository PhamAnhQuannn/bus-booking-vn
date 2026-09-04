# -*- coding: utf-8 -*-
"""Carve-integrity audit (operationalize lesson 2026-09-02-splitcity-wrong-parent): mỗi carve unit
(split_city UNITS + areas.json areas[]) — province chủ đạo trong address có KHỚP tp đích không, và
signatureSpots có resolve không. Bắt bug "nạp nhầm tỉnh" (Vũng Tàu 21 điểm Đồng Nai) mà radius/centroid
check MÙ. Network-free.

Chạy TỪ tourism-kb/:  python code/audit_carve_integrity.py [slug ...]   (mặc định: mọi carve)
"""
import io
import json
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
}


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
    print("\n%d carve · %d PROV MISMATCH" % (len(slugs), bad))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
