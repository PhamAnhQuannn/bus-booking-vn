# -*- coding: utf-8 -*-
"""Trò trả phí CỤ THỂ (Alpine Coaster / cáp treo / zipline / canyoning...) cho điểm đến.

Geo-join POI on-site từ overture_dalat.json (tên literal ở mọi city dir) vào điểm đến picked.
Doctrine (Rule 3): hoạt động KÈM ĐƠN VỊ CÓ TÊN = dữ kiện. Proximity thuần = CẤM → bắt buộc
corroboration bằng TÊN (toponym điểm đến nằm trong tên POI), + conf≥0.6 + EXCLUDE_NAME.
CATEGORY overture nhiễu (amusement_park mis-tag quảng trường/shop) → TÊN là gate, category bỏ.
Yield nhỏ + trung thực: chỉ vài điểm mega-complex (Datanla, Bà Nà, Vinpearl). Điểm không có trò → null.

Chạy:  PYTHONIOENCODING=utf-8 python tourism-kb/code/enrich_trai_nghiem_tra_phi.py raw/<slug>/scrape [--dry-run]
"""
import io, json, os, sys
from refine_trai_nghiem import fold, toks, hav, EXCLUDE_NAME

RAW = sys.argv[1]
DRY = "--dry-run" in sys.argv[2:]
OVT = os.path.join(RAW, "overture_dalat.json")   # tên literal (bbox chọn theo slug path, không theo tên file)
ENRICH = os.path.join(RAW, "enrichment.json")
GUIDE = os.path.join(RAW, "guide_data.json")
FIELD = "trai_nghiem_tra_phi"
R_M = 400.0        # ≤400m = "on-site" (văn phòng tour cách xa sẽ rớt — đúng)
CONF_MIN = 0.6
PULL_DATE = "21/08/2026"

# Từ khóa trò trả phí. Phrase (đa từ) = substring an toàn; token (đơn) = khớp cả từ (chống "Chicano"/"canon").
RIDE_PHRASES = ["cap treo", "alpine coaster", "zip line", "go kart", "du day"]
RIDE_TOKENS = {"coaster", "zipline", "canyoning", "luge", "toboggan", "buggy", "atv", "truot"}


def is_ride(name):
    fn = fold(name)
    if any(x in fn for x in EXCLUDE_NAME):
        return False
    if any(p in fn for p in RIDE_PHRASES):
        return True
    return bool(RIDE_TOKENS & set(fn.split()))


# geo-generic (VN + EN) — KHÔNG dùng làm bằng chứng đồng nhất (thác/waterfall trùng nhau ≠ cùng nơi).
GEO_STOP = {"thac", "chua", "den", "mieu", "cong", "vien", "bien", "nui", "dao", "cau", "pho",
            "quan", "khu", "vuon", "dinh", "bao", "tang", "lang", "thanh", "dai", "song", "suoi",
            "waterfall", "mountain", "lake", "temple", "church", "park", "beach", "island",
            "bridge", "market", "museum", "garden", "tourist", "attraction", "dalat"}


def dtoks(name):
    # token TÊN RIÊNG phân biệt: bỏ dấu ngoặc, len≥4, không geo-generic
    fn = fold(name).replace("(", " ").replace(")", " ")
    return {w for w in fn.split() if len(w) >= 4 and w not in GEO_STOP}


def main():
    if not os.path.exists(OVT):
        print(f"[skip] khong co {OVT}")
        return
    ov = json.load(io.open(OVT, encoding="utf-8"))
    picked = json.load(io.open(GUIDE, encoding="utf-8"))["picked"]

    # POI ứng viên = tên là trò + conf đủ + có toạ độ
    rides = [r for r in ov if r.get("lat") and r.get("lon")
             and (r.get("confidence") or 0) >= CONF_MIN and is_ride(r.get("name", ""))]
    print(f"[{os.path.basename(os.path.dirname(RAW)) or RAW}] overture={len(ov)}  ride-candidate={len(rides)}")

    # precompute toponym điểm đến
    dests = []
    for p in picked:
        if p.get("lat") is None or p.get("lon") is None:
            continue
        alt = p.get("alt") or []
        if isinstance(alt, str):
            alt = [alt]
        names = [p["name"]] + alt
        dt = set()
        for n in names:
            dt |= dtoks(n)
        dests.append({"id": p["id"], "name": p["name"], "lat": p["lat"], "lon": p["lon"], "dtok": dt})

    # mỗi POI trò → gán vào điểm đến GẦN NHẤT có corroboration tên (≤R_M)
    by_dest = {}   # id -> list[(ten, dist, conf)]
    pairs = []
    for r in rides:
        rn = r["name"]
        rtok = dtoks(rn)
        best = None
        for d in dests:
            # corroboration = POI mang TÊN RIÊNG của điểm đến (giao token phân biệt), KHÔNG proximity thuần
            if not (d["dtok"] & rtok):
                continue
            dist = hav((d["lat"], d["lon"]), (r["lat"], r["lon"]))
            if dist > R_M:
                continue
            if best is None or dist < best[1]:
                best = (d, dist)
        if best:
            d, dist = best
            by_dest.setdefault(d["id"], []).append((rn, dist, r.get("confidence")))
            pairs.append((d["name"], rn, round(dist), round(r.get("confidence") or 0, 2)))

    print(f"  → {len(pairs)} cặp (điểm × trò), {len(by_dest)} điểm có trò trả phí")
    for dn, rn, m, c in sorted(pairs):
        print(f"    {dn[:26]:26} ← {rn[:38]:38} {m:4}m conf={c}")

    if DRY:
        print("  [dry-run] KHONG ghi.")
        return

    # emit: 1 dòng/điểm, value = list {ten, don_vi}; CHỈ khi list non-empty
    rows = json.load(io.open(ENRICH, encoding="utf-8")) if os.path.exists(ENRICH) else []
    seen = {(r["id"], r["field"]) for r in rows}
    added = 0
    for pid, items in by_dest.items():
        if (pid, FIELD) in seen:
            continue
        # dedup tên trùng, giữ gần nhất
        uniq = {}
        for ten, dist, _ in sorted(items, key=lambda x: x[1]):
            uniq.setdefault(fold(ten), ten)
        value = [{"ten": t, "don_vi": t} for t in uniq.values()]
        if not value:
            continue
        rows.append({"id": pid, "field": FIELD, "value": value, "source": "Overture Places",
                     "url": "", "date": PULL_DATE, "method": "geojoin-onsite",
                     "note": f"POI on-site ≤{int(R_M)}m + ten khop toponym"})
        added += 1
    tmp = ENRICH + ".tmp"
    json.dump(rows, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    os.replace(tmp, ENRICH)
    print(f"  enrichment.json += {added} diem (field {FIELD})")


if __name__ == "__main__":
    main()
