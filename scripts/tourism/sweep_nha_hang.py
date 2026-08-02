# -*- coding: utf-8 -*-
"""R2 — lop AN UONG. Khong cham mang.

Bat doi xung voi lop luu tru, va no quyet dinh tai lieu nay in gi:

  Luu tru  co GIA THAT tu dang ky nha nuoc + hang tham dinh.
  An uong  KHONG co gia, KHONG co danh gia, tu bat ky nguon hop le nao.
           Google Places chi cho luu `place_id`; TripAdvisor chi cho luu
           Location ID. Khong scraper nao doi duoc dieu do — rao can la quyen
           LUU TRU, khong phai kha nang doc.

Nen gia tri cua lop nay nam o ba thu khac: CON MO KHONG · BAN MON GI · GOI SO NAO.

TIN HIEU QUAN TRONG NHAT: DA DONG CUA.
Thac khong dong cua; quan an thi co. 8/10 vu dong tu 2024 la hang an, trong do
`Long Hoa Restaurant` la quan moi huong dan va moi mo hinh ngon ngu con gioi
thieu. Bon quan ca phe dong rieng trong thang 7 va 10/2025.
Foursquare la nguon DUY NHAT co truong nay — `operating_status` cua Overture
NULL tren toan bo 20.936 dong Da Lat.

Gioi thieu mot quan da dong la loi te nhat tai lieu nay co the mac: khach di
toi noi roi moi biet.

BAY DA GAP KHI DO: loc hang muc bang CHUOI CON keo vao 109 hieu cat toc, vi
"bar" nam trong "barber". Cung ho voi "sup"/"súp", "tour"/"tourist". Nen o day
dung TAP LIET KE RO, khong dung chuoi con.

Chay:  python scripts/tourism/sweep_nha_hang.py <thu-muc-raw>
"""
import json, os, sys, io, re, math, unicodedata
from collections import Counter

RAW = sys.argv[1]
OUT = os.path.join(RAW, "nha_hang.json")

# Noi de NGOI AN/UONG. Liet ke ro tung hang muc.
AN_UONG = {
    "restaurant", "cafe", "coffee_shop", "diner", "vietnamese_restaurant", "bakery",
    "eat_and_drink", "barbecue_restaurant", "bubble_tea", "fast_food_restaurant",
    "bar", "tea_room", "seafood_restaurant", "asian_restaurant", "chinese_restaurant",
    "ice_cream_shop", "smoothie_juice_bar", "chicken_restaurant", "pub",
    "breakfast_and_brunch_restaurant", "korean_restaurant", "theme_restaurant",
    "vegetarian_restaurant", "cocktail_bar", "pizza_restaurant", "food",
    "noodles_restaurant", "japanese_restaurant", "thai_restaurant", "indian_restaurant",
    "delicatessen", "desserts", "bar_and_grill_restaurant", "beer_garden", "wine_bar",
    "buffet_restaurant", "italian_restaurant", "beer_bar", "steakhouse",
    "soup_restaurant", "sushi_restaurant", "food_truck", "french_restaurant",
    "gastropub", "burger_restaurant", "brewery", "american_restaurant",
    "malaysian_restaurant", "bistro", "health_food_restaurant", "southern_restaurant",
    "sports_bar", "greek_restaurant", "molecular_gastronomy_restaurant",
    "european_restaurant", "afghan_restaurant", "taco_restaurant",
    "hong_kong_style_cafe", "taiwanese_restaurant", "australian_restaurant",
    "polish_restaurant", "mediterranean_restaurant", "sake_bar", "food_stand",
}
# Nhung hang muc chuoi con SE keo vao ma khong phai noi de an. Giu lai de bat
# ky ai doc sau nay biet chung da bi loai CO Y, khong phai bi bo sot.
DA_LOAI = {"barber", "public_and_government_association", "public_service_and_government",
           "notary_public", "public_plaza", "public_school", "bartending_school",
           "bartender", "water_treatment_equipment_and_services", "theatre",
           "sports_and_recreation_venue", "professional_sports_team",
           "school_sports_team", "amateur_sports_team", "food_banks",
           "restaurant_wholesale", "restaurant_equipment_and_supply",
           "b2b_food_products", "food_consultant", "food_delivery_service",
           "food_beverage_service_distribution", "bed_and_breakfast",
           "health_food_store", "internet_cafe", "food_tours",
           "atv_recreation_park", "kids_recreation_and_party", "winery"}


def fold(s):
    s = (s or "").lower().replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    return " ".join("".join(c for c in s if unicodedata.category(c) != "Mn").split())


def hav(la1, lo1, la2, lo2):
    R = 6371000.0
    p1, p2 = math.radians(la1), math.radians(la2)
    dp, dl = p2 - p1, math.radians(lo2 - lo1)
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


ovt = json.load(io.open(os.path.join(RAW, "overture_dalat.json"), encoding="utf-8"))
fsq = json.load(io.open(os.path.join(RAW, "fsq_dalat.json"), encoding="utf-8"))
mon = json.load(io.open(os.path.join(RAW, "mon_an_dalat.json"), encoding="utf-8"))

food = [r for r in ovt if str(r.get("category") or "") in AN_UONG and (r.get("name") or "").strip()]
f_food = [r for r in fsq if "Dining and Drinking" in str(r.get("fsq_category_labels") or "")]
print(f"Overture ăn uống {len(food)} · Foursquare ăn uống {len(f_food)} "
      f"(đã đóng {sum(1 for r in f_food if r.get('date_closed'))})\n")

# ── Ghep de lay tin hieu DONG CUA ───────────────────────────────────────────
# Ca hai nguon deu co toa do, nen ghep bang TEN + KHOANG CACH, khong ghep bang
# ten khong — "Cafe Sang" co the la muoi quan khac nhau trong thanh pho.
MAX_M = 200
luoi = {}
for r in f_food:
    if r.get("latitude") is None:
        continue
    luoi.setdefault((round(r["latitude"], 2), round(r["longitude"], 2)), []).append(r)

dong_cua = {}
for r in food:
    t = fold(r["name"])
    if len(t) < 4:
        continue
    k = (round(r["lat"], 2), round(r["lon"], 2))
    for dla in (-0.01, 0, 0.01):
        for dlo in (-0.01, 0, 0.01):
            for m in luoi.get((round(k[0] + dla, 2), round(k[1] + dlo, 2)), []):
                if not m.get("date_closed"):
                    continue
                tm = fold(m["name"])
                if len(tm) < 4 or not (t == tm or t in tm or tm in t):
                    continue
                if hav(r["lat"], r["lon"], m["latitude"], m["longitude"]) <= MAX_M:
                    dong_cua[(r["name"], round(r["lat"], 5))] = m["date_closed"]

# Mon cua tung quan — tu mon_an_dalat.json, khoa theo (ten, toa do lam tron).
mon_cua = {}
for ten_mon, quan in mon.items():
    for q in quan:
        mon_cua.setdefault((q["ten"], round(q["lat"], 5)), []).append(ten_mon)

out = []
for r in food:
    key = (r["name"], round(r["lat"], 5))
    out.append({
        "ten": r["name"].strip(), "hang_muc": r.get("category"),
        "lat": r["lat"], "lon": r["lon"],
        "dia_chi": r.get("address"), "dien_thoai": (r.get("phones") or [None])[0],
        "facebook": (r.get("socials") or [None])[0],
        "website": (r.get("websites") or [None])[0],
        "tin_cay": r.get("confidence"),
        "mon": sorted(set(mon_cua.get(key, []))),
        "da_dong_cua": dong_cua.get(key),
    })

# Quan Foursquare bao DA DONG ma khong ghep duoc vao Overture — van phai neu,
# vi day chinh la nhung ten huong dan cu con gioi thieu.
ten_ovt = {fold(r["name"]) for r in food}
dong_ngoai = [{"ten": m["name"], "dia_chi": m.get("address"),
               "da_dong_cua": m["date_closed"],
               "loai": str(m.get("fsq_category_labels") or "")[:60]}
              for m in f_food
              if m.get("date_closed") and fold(m["name"]) not in ten_ovt]
dong_ngoai.sort(key=lambda x: x["da_dong_cua"], reverse=True)

json.dump({"quan": out, "dong_cua_ngoai_danh_sach": dong_ngoai},
          io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

mo = [r for r in out if not r["da_dong_cua"]]
print(f"{len(out)} quán ăn uống  ·  còn mở {len(mo)}  ·  ĐÃ ĐÓNG {len(out)-len(mo)}")
print(f"  điện thoại {sum(1 for r in mo if r['dien_thoai'])} · "
      f"Facebook {sum(1 for r in mo if r['facebook'])} · "
      f"địa chỉ {sum(1 for r in mo if r['dia_chi'])} · "
      f"tin cậy ≥0,7 {sum(1 for r in mo if (r['tin_cay'] or 0) >= 0.7)}")
print(f"  khớp được món: {sum(1 for r in mo if r['mon'])}")
print(f"\n  đã loại {len(DA_LOAI)} hạng mục KHÔNG phải nơi ăn uống mà lọc chuỗi con "
      f"sẽ kéo vào (barber 109, public_and_government_association 37, …)")

print(f"\nĐÃ ĐÓNG CỬA — {len(out)-len(mo)} trong danh sách:")
for r in sorted([r for r in out if r["da_dong_cua"]],
                key=lambda x: x["da_dong_cua"], reverse=True):
    print(f"  {r['da_dong_cua']}  {r['ten'][:40]:42s}{r['hang_muc']}")
print(f"\nĐÃ ĐÓNG CỬA — {len(dong_ngoai)} chỉ Foursquare biết (không có trong Overture):")
for r in dong_ngoai[:12]:
    print(f"  {r['da_dong_cua']}  {str(r['ten'])[:40]:42s}{r['loai'][:34]}")

print(f"\n{'Hạng mục':30s}{'Còn mở':>8s}  Ví dụ")
for k, n in Counter(r["hang_muc"] for r in mo).most_common(8):
    vd = next(r["ten"] for r in mo if r["hang_muc"] == k)
    print(f"{k:30s}{n:8d}  {vd[:34]}")
print(f"\nsaved -> {OUT}")
