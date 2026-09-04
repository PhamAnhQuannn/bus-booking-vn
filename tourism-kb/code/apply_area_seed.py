# -*- coding: utf-8 -*-
"""Stage 1 (apply) — chèn seed icon (đã resolve) vào export/<slug>/diem-den.json.

Pipeline STAGE (chạy SAU split_city, như apply_importance_order) — idempotent, KHÔNG phải patch tay:
bỏ qua icon đã có (place_id / fold-name). region_id kế thừa record gần nhất. ext.destination tối thiểu.

Nguồn seed: AREA_SEED trong dia_diem_config (bền, committed) NẾU có; else raw/_shared/area_seed_resolved.json.
Chạy TỪ tourism-kb/:  python code/apply_area_seed.py <slug> [<slug> ...]
"""
import io
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
EXPORT = os.path.join(HERE, "..", "export")
RESOLVED = os.path.join(HERE, "..", "raw", "_shared", "area_seed_resolved.json")

try:
    from dia_diem_config import AREA_SEED  # committed source (ưu tiên)
except Exception:
    AREA_SEED = None

# Lối vào đặc trưng (cáp treo/tàu ra đảo) = trải nghiệm khách săn → engine force-include (ngày đỉnh/đảo).
# fold-name → nhãn card. Editorial-fact (đúng thực tế), curated.
SIG_ACCESS = {
    "fansipan": "Đi cáp treo lên đỉnh Fansipan — nóc nhà Đông Dương",
    "phan xi păng": "Đi cáp treo lên đỉnh Fansipan — nóc nhà Đông Dương",
    "núi hàm rồng": "Leo núi ngắm toàn cảnh thị trấn Sa Pa",
}


import unicodedata


def fold(s):
    return re.sub(r"\s+", " ", (s or "").lower()).strip()


def foldnd(s):
    """fold + BỎ DẤU (kitô≡kito, đ→d) — cho so tên trùng biến thể dấu."""
    s = unicodedata.normalize("NFD", fold(s))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.replace("đ", "d").replace("Đ", "d")


def slugify(s):
    s = fold(s)
    s = re.sub(r"[àáạảãâầấậẩẫăằắặẳẵ]", "a", s)
    s = re.sub(r"[èéẹẻẽêềếệểễ]", "e", s)
    s = re.sub(r"[ìíịỉĩ]", "i", s)
    s = re.sub(r"[òóọỏõôồốộổỗơờớợởỡ]", "o", s)
    s = re.sub(r"[ùúụủũưừứựửữ]", "u", s)
    s = re.sub(r"[ỳýỵỷỹ]", "y", s).replace("đ", "d")
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s)).strip("-")


def hav(a, b):
    R = 6371.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    return 2 * R * math.asin(math.sqrt(math.sin(dp / 2) ** 2
                             + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2))


def seeds_for(slug):
    if AREA_SEED and slug in AREA_SEED:
        return AREA_SEED[slug]
    if os.path.exists(RESOLVED):
        return [r for r in json.load(io.open(RESOLVED, encoding="utf-8")) if r["slug"] == slug]
    return []


def prefix(recs):
    for r in recs:
        m = re.match(r"^([A-Z]{2,3})-\d+$", r.get("id", "") or "")
        if m:
            return m.group(1)
    return "SD"


_WARD_RE = re.compile(r"(phường|xã|thị trấn)\s+\S", re.I)


def _ward(rec):
    full = ((rec.get("address") or {}).get("full_address")) or ""
    for seg in full.split(","):
        s = seg.strip()
        if _WARD_RE.match(s):
            return s
    return None


def nearest_meta(recs, lat, lon):
    """(region_id, ward, province) của record gần nhất — seed kế thừa để join đúng cụm hành chính."""
    best, bd = None, 1e9
    for r in recs:
        c = r.get("coordinates") or {}
        if c.get("latitude") is None:
            continue
        d = hav((lat, lon), (c["latitude"], c["longitude"]))
        if d < bd:
            bd, best = d, r
    if not best:
        return None, None, None
    a = best.get("address") or {}
    return best.get("region_id"), _ward(best), a.get("province")


def build_record(seed, rid, region, ward, province):
    name = seed["ten"]
    mo_ta = seed.get("mo_ta")
    pid = seed.get("place_id")
    # full_address CÓ token ward (adminKey khớp → join đúng cụm hành chính của record lân cận)
    if ward:
        full = "%s, %s" % (ward, ("tỉnh " + province) if province else "Việt Nam")
    else:
        full = seed.get("address")
    return {
        "id": rid,
        "identity": {"place_id": pid, "fold_key": slugify(name)},
        "slug": slugify(name),
        "name": name,
        "alternate_names": seed.get("alt") or [],
        "category": {"primary": seed.get("loai") or "Điểm tham quan", "secondary": []},
        "region_id": region,
        "address": {"full_address": full, "province": province, "country": "Việt Nam",
                    "_google_address": seed.get("address")},
        "coordinates": {"latitude": seed["lat"], "longitude": seed["lon"],
                        "precision_m": None, "accuracy_note": "seed-resolved"},
        "contact": {"phone": None, "website": None, "facebook": None, "email": None},
        "description": {"value": mo_ta, "is_verbatim_quote": bool(mo_ta),
                        "derived": "area-seed", "source_id": "seed-area", "retrieved_at": None},
        "external_ids": {"google_place_id": pid, "tripadvisor_location_id": None,
                         "wikidata_qid": seed.get("qid")},
        "data_quality": {"verified_fields": [], "conflicts": {}, "warnings": ["seed-icon"],
                         "last_verified_at": None, "verification_method": ["area-seed-" + seed.get("src", "?")]},
        "source_ids": ["seed-area"],
        "ext": {"destination": {
            "trai_nghiem": None, "hoat_dong": [], "vibes": [],
            "opening_hours": None, "ticketing": [], "mo_ta": mo_ta,
            "mo_ta_nguon_url": ("https://www.wikidata.org/wiki/" + seed["qid"]) if seed.get("qid") else None,
            "intro": {"fact": mo_ta, "editorial": None, "tier": "seed"} if mo_ta else None,
            "loi_vao_dac_trung": SIG_ACCESS.get(fold(name)),
            "media": ({"image": seed["image"]} if seed.get("image") else {}),
        }},
    }


def apply(slug):
    p = os.path.join(EXPORT, slug, "diem-den.json")
    if not os.path.exists(p):
        print("  [%s] khong co export" % slug); return
    recs = json.load(io.open(p, encoding="utf-8"))
    # drop seed-area cũ (re-runnable: cho phép đổi address/region rồi apply lại)
    recs = [r for r in recs if (r.get("source_ids") or []) != ["seed-area"]]
    seeds = seeds_for(slug)
    have_pid = {(r.get("identity") or {}).get("place_id") for r in recs if (r.get("identity") or {}).get("place_id")}
    have_name = {fold(r.get("name", "")) for r in recs}

    def near_dup(s):
        """Đã có record cùng địa danh (khác tên/biến thể dấu): trong 350m + tên chồng 2 chiều (bỏ dấu) → trùng."""
        sf = foldnd(s["ten"])
        for r in recs:
            c = r.get("coordinates") or {}
            if c.get("latitude") is None:
                continue
            if hav((s["lat"], s["lon"]), (c["latitude"], c["longitude"])) > 0.35:
                continue
            rf = foldnd(r.get("name", ""))
            if (len(sf) >= 5 and sf in rf) or (len(rf) >= 5 and rf in sf):
                return r.get("name")
        return None

    pfx = prefix(recs)
    nxt = 1 + max([int(m.group(1)) for r in recs
                   for m in [re.match(r"^[A-Z]{2,3}-(\d+)$", r.get("id", "") or "")] if m] or [len(recs)])
    added = []
    for s in seeds:
        if s.get("place_id") and s["place_id"] in have_pid:
            continue
        if fold(s["ten"]) in have_name:
            continue
        dupname = near_dup(s)
        if dupname:
            print("  skip  %-22s (đã có gần đó: %s)" % (s["ten"], dupname))
            continue
        region, ward, province = nearest_meta(recs, s["lat"], s["lon"])
        rid = "%s-S%02d" % (pfx, nxt); nxt += 1
        recs.append(build_record(s, rid, region, ward, province))
        added.append(s["ten"])
    tmp = p + ".tmp"
    json.dump(recs, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    os.replace(tmp, p)
    print("  [%s] +%d seed (%s) -> %d records" % (slug, len(added), ", ".join(added) or "—", len(recs)))


def main():
    for s in sys.argv[1:]:
        apply(s)


if __name__ == "__main__":
    main()
