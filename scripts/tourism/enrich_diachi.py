# -*- coding: utf-8 -*-
"""Pass 9 — dung dia chi day du kieu Viet Nam cho ca 36 diem.

Dinh dang muc tieu:
    số 3 - 5 - 7 đường Mai Anh Đào, Phường Lâm Viên - Đà Lạt, thành phố Đà Lạt, tỉnh Lâm Đồng

Hai luu y da kiem chung ngay 28/07/2026:

1. TEN PHUONG DA DOI. Nghi quyet 202/2025/QH15 gop cac phuong so cua Da Lat
   thanh phuong co ten. Nominatim tra ve "Phường Lâm Viên - Đà Lạt" chu khong
   phai "Phường 8". Dang ky luu tru nha nuoc cung dung ten moi. Dung ten MOI.

2. NOMINATIM TRA VE CON DUONG GAN NHAT, KHONG PHAI DIA CHI BUU CHINH. Voi
   Thung lung Tinh yeu no tra ve "Flower Steps" — mot loi di trong khuon vien.
   Vi vay ten duong uu tien OSM addr:street, roi Overture, Nominatim la cuoi.

Khong bia so nha. Thieu thi bo, khong doan.
"""
import json, os, sys, io, re, time, urllib.request

RAW = sys.argv[1]
ENRICH = os.path.join(RAW, "enrichment.json")
CACHE = os.path.join(RAW, "nominatim.json")
D = "28/07/2026"
UA = {"User-Agent": "BusBooking-KB/0.1 (tourism research; phamanhquan4068@gmail.com)"}

picked = json.load(io.open(os.path.join(RAW, "guide_data.json"), encoding="utf-8"))["picked"]
rows = json.load(io.open(ENRICH, encoding="utf-8"))
E = {}
for r in rows:
    E.setdefault(r["id"], {})[r["field"]] = r["value"]

cache = json.load(io.open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
n_new = 0
for p in picked:
    if p["id"] in cache:
        continue
    u = ("https://nominatim.openstreetmap.org/reverse?format=jsonv2"
         f"&lat={p['lat']:.6f}&lon={p['lon']:.6f}&addressdetails=1&accept-language=vi")
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r:
            cache[p["id"]] = json.load(r)
        n_new += 1
    except Exception as e:
        print(f"  {p['id']}: LOI {type(e).__name__}")
        cache[p["id"]] = {}
    time.sleep(1.2)          # chinh sach Nominatim: toi da 1 yeu cau/giay
if n_new:
    json.dump(cache, io.open(CACHE, "w", encoding="utf-8"), ensure_ascii=False)
print(f"nominatim: {n_new} moi, {len(cache)} trong bo nho dem")

STREET_WORD = re.compile(r"(đường|phố|hẻm|quốc lộ|đèo)", re.IGNORECASE)


def plausible_street(s):
    """Loai bo rac kieu 'Dalat, Binh Chuan' hay 'Đà Lạt Telpher'.

    Chi nhan neu co tu chi duong, hoac bat dau bang so nha.
    """
    s = (s or "").strip()
    if not s or len(s) < 4:
        return None
    if "," in s:                      # "Dalat, Binh Chuan" / "22 Đường Nguyễn Trãi, ..."
        return None
    if STREET_WORD.search(s) or re.match(r"^\d+[A-Za-z]?\b", s):
        return s
    return None


def split_number(s):
    """'157 Đường Hoàng Diệu' -> ('157', 'Đường Hoàng Diệu')"""
    m = re.match(r"^([\d]+(?:\s*[-/]\s*\d+)*[A-Za-z]?)\s+(.*)$", (s or "").strip())
    return (m.group(1), m.group(2)) if m else (None, (s or "").strip())


def tidy_street(s):
    """Bo chu 'Đường' o dau VA o giua — Overture hay tra ve '54A/4 Đường Hùng Vương'."""
    s = (s or "").strip()
    s = re.sub(r"\b(Đường|đường)\s+", "", s)
    return s.strip(" ,/")


added = 0
seen = {(r["id"], r["field"]) for r in rows}
stat = {"co_so_nha": 0, "co_duong": 0, "co_phuong": 0}
for p in picked:
    a = (cache.get(p["id"]) or {}).get("address", {}) or {}
    enr = E.get(p["id"], {})

    # --- so nha + duong ---
    house = street = None
    osm_addr = enr.get("dia_chi_osm")
    if osm_addr:
        house, street = split_number(osm_addr)
    if not street:
        cand = plausible_street(p.get("addr"))
        if cand:
            h2, s2 = split_number(cand)
            house = house or h2
            street = s2
    street = tidy_street(street)
    # Ten duong tu OSM doi khi chi la mot tu vo nghia ("Dinh"). Nominatim dang tin hon.
    if (not street or len(street) < 5) and a.get("road"):
        street = tidy_street(a["road"])
        if not osm_addr:
            house = None

    # --- phuong / xa: ten SAU sap nhap 2025 ---
    ward = a.get("county") or a.get("suburb") or a.get("quarter") or a.get("city_district")
    if ward and not ward.lower().startswith(("phường", "xã", "thị trấn")):
        ward = "Phường " + ward

    # --- thanh pho: KHONG mac dinh la Da Lat ---
    # Thac Voi o Lam Ha, Chua Quan The Am o Duc Trong — ghi "thành phố Đà Lạt"
    # cho nhung noi nay la sai, va sai theo kieu khien khach di nham 30 km.
    in_dalat = bool(a.get("city") or a.get("town")) and "lạt" in str(
        a.get("city") or a.get("town")).lower()
    if ward and "đà lạt" in ward.lower():
        in_dalat = True

    parts = []
    if house and street:
        parts.append(f"số {house} đường {street}")
        stat["co_so_nha"] += 1
        stat["co_duong"] += 1
    elif street:
        parts.append(f"đường {street}")
        stat["co_duong"] += 1
    if ward:
        parts.append(ward)
        stat["co_phuong"] += 1
    if in_dalat:
        parts.append("thành phố Đà Lạt")
    else:
        stat["ngoai_da_lat"] = stat.get("ngoai_da_lat", 0) + 1
    parts.append("tỉnh Lâm Đồng")
    full = ", ".join(parts)

    src = "OpenStreetMap" + (" + Overture" if p.get("addr") else "")
    if (p["id"], "dia_chi_day_du") not in seen:
        rows.append({"id": p["id"], "field": "dia_chi_day_du", "value": full,
                     "source": src + " + Nominatim",
                     "url": f"https://nominatim.openstreetmap.org/reverse?lat={p['lat']:.6f}&lon={p['lon']:.6f}",
                     "date": D, "method": "pass9-diachi",
                     "note": "tên phường theo Nghị quyết 202/2025/QH15 (sau sáp nhập)",
                     "match_m": None})
        seen.add((p["id"], "dia_chi_day_du"))
        added += 1
    print(f"  {p['id']}  {full}")

json.dump(rows, io.open(ENRICH, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"\nenrichment.json +{added} -> {len(rows)} dong")
print(f"co so nha: {stat['co_so_nha']}/36   co ten duong: {stat['co_duong']}/36   "
      f"co phuong: {stat['co_phuong']}/36")
