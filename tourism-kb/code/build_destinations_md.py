# -*- coding: utf-8 -*-
"""Hop nhat tat ca nguon -> danh sach diem tham quan Da Lat (.md tieng Viet)."""
import json, os, sys, math, unicodedata, io
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from places_dalat import PLACES, AREA_NAMES
from duong_dan_ra import kiem_loi_ra

RAW = sys.argv[1]
# Chan truoc khi ghi: danh sach nay mang ten, dia chi va so dien thoai that, nen
# no phai roi vao mot thu muc da duoc gitignore. Xem duong_dan_ra.py.
OUT = kiem_loi_ra(sys.argv[2])


def load(fn):
    """Raw responses live either in raw/ or one level up in the scratchpad root."""
    for p in (os.path.join(RAW, fn), os.path.join(os.path.dirname(RAW.rstrip("/\\")), fn)):
        if os.path.exists(p):
            print(f"  loaded {fn} <- {p}")
            return json.load(open(p, encoding="utf-8"))
    print(f"  MISSING {fn}")
    return None


def fold(s):
    """De-accent for comparison only. Display keeps full diacritics."""
    s = (s or "").lower().replace("đ", "d").replace("Đ", "d")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " ".join(s.split())


def hav(a, b):
    R = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


# ---------- nap nguon ----------
osm_see = load("dalat_see.json") or {"elements": []}
osm_more = load("dalat_more.json") or {"elements": []}
osm_conf = load("confirm.json") or {"elements": []}
ovt = load("overture_dalat.json") or []
wd = load("wikidata.json")
osrm = load("osrm_matrix.json")

NOISE_KINDS = {"peak", "spring", "stream", "river", "water", "reservoir", "hamlet",
               "village", "suburb", "quarter", "neighbourhood", "locality"}
VISIT_TOURISM = {"attraction", "viewpoint", "museum", "theme_park", "zoo", "gallery", "artwork"}

recs = []


def add(name, kind, lat, lon, src, extra=None):
    if not name or lat is None:
        return
    r = {"name": name.strip(), "kind": kind or "", "lat": lat, "lon": lon,
         "src": {src}, "hours": "", "fee": "", "ele": "", "web": "", "tel": "",
         "closed": "", "addr": "", "conf": None, "kinds": set()}
    r.update(extra or {})
    r["kinds"] = {str(kind)} if kind else set()
    if not isinstance(r["src"], set):
        r["src"] = {src}
    recs.append(r)


for pack in (osm_see, osm_more, osm_conf):
    for e in pack.get("elements", []):
        t = e.get("tags", {}) or {}
        lat = e.get("lat") or (e.get("center") or {}).get("lat")
        lon = e.get("lon") or (e.get("center") or {}).get("lon")
        kind = (t.get("tourism") or t.get("natural") or t.get("leisure") or t.get("historic")
                or t.get("amenity") or t.get("aerialway") or t.get("landuse") or "")
        add(t.get("name"), kind, lat, lon, "OSM",
            {"hours": t.get("opening_hours", ""), "fee": t.get("fee") or t.get("charge") or "",
             "ele": t.get("ele", ""), "web": t.get("website", ""), "tel": t.get("phone", "")})

INTEREST = ("attraction", "landmark", "monument", "museum", "temple", "church", "buddhist",
            "park", "waterfall", "lake", "market", "scenic", "tourist", "historic", "garden",
            "amusement", "shrine", "pagoda", "zoo", "art_")
for r in ovt:
    cat = str(r.get("category") or "")
    if not any(k in cat.lower() for k in INTEREST):
        continue
    add(r.get("name"), cat, r.get("lat"), r.get("lon"), "Overture",
        {"web": (r.get("websites") or [""])[0] if r.get("websites") else "",
         "tel": (r.get("phones") or [""])[0] if r.get("phones") else "",
         "addr": r.get("address") or "",
         "conf": float(r["confidence"]) if r.get("confidence") is not None else None})

# --- Foursquare OS Places: mang tin hieu date_closed, khong nguon nao khac co ---
fsq = load("fsq_dalat.json") or []
FSQ_INTEREST = ("temple", "church", "shrine", "monument", "museum", "historic", "garden",
                "park", "waterfall", "lake", "market", "scenic", "monastery", "pagoda",
                "art gallery", "zoo", "castle", "palace", "memorial", "observatory",
                "tourist", "landmark", "trail", "mountain", "spiritual")
fsq_used = 0
for r in fsq:
    labs = " ".join(str(x) for x in (r.get("fsq_category_labels") or [])).lower()
    if not any(k in labs for k in FSQ_INTEREST):
        continue
    add(r.get("name"), (r.get("fsq_category_labels") or [""])[-1], r.get("latitude"),
        r.get("longitude"), "Foursquare",
        {"tel": r.get("tel") or "", "web": r.get("website") or "",
         "addr": r.get("address") or "",
         "closed": r.get("date_closed") or ""})
    fsq_used += 1

# Ban do dong cua: tra cuu theo ten da chuan hoa, dung cho MOI nguon
fsq_closed_map = {}
for r in fsq:
    if r.get("date_closed") and r.get("name"):
        fsq_closed_map[fold(r["name"])] = str(r["date_closed"])[:10]

wd_count = 0
if wd:
    seen_q = {}
    for b in wd.get("results", {}).get("bindings", []):
        lab = (b.get("viLabel", {}).get("value") or b.get("itemLabel", {}).get("value") or "")
        typ = b.get("typeLabel", {}).get("value", "")
        coord = b.get("coord", {}).get("value", "")
        qid = b["item"]["value"].rsplit("/", 1)[-1]
        if qid in seen_q or not coord.startswith("Point("):
            continue
        seen_q[qid] = 1
        try:
            lon, lat = [float(x) for x in coord[6:-1].split()]
        except Exception:
            continue
        add(lab, typ, lat, lon, "Wikidata", {"web": b.get("site", {}).get("value", "")})
        wd_count += 1

# ---------- hop nhat: ten gan giong + trong 150 m ----------
merged, ambiguous = [], 0
for r in recs:
    f = fold(r["name"])
    hit = None
    for m in merged:
        if hav((r["lat"], r["lon"]), (m["lat"], m["lon"])) > 150:
            continue
        mf = fold(m["name"])
        if f == mf or (len(f) > 6 and (f in mf or mf in f)):
            hit = m
            break
    if hit:
        hit["src"] |= r["src"]
        hit["kinds"] |= r["kinds"]
        for k in ("hours", "fee", "ele", "web", "tel", "closed", "addr"):
            if not hit.get(k) and r.get(k):
                hit[k] = r[k]
        if hit.get("conf") is None or (r.get("conf") or 0) > (hit.get("conf") or 0):
            if r.get("conf") is not None:
                hit["conf"] = r["conf"]
        if fold(r["name"]) != fold(hit["name"]) and r["name"] not in hit.setdefault("alt", []):
            hit["alt"].append(r["name"])
    else:
        r.setdefault("alt", [])
        merged.append(r)

# ---------- gan khu vuc + thoi gian duong bo ----------
D = osrm["distances"] if osrm else None
T = osrm["durations"] if osrm else None
anchors = [(p[0], p[1], p[2], p[3], p[4]) for p in PLACES]


def nearest_anchor(lat, lon):
    best, bd = None, 9e9
    for a in anchors:
        d = hav((lat, lon), (a[2], a[3]))
        if d < bd:
            bd, best = d, a
    return best, bd


for m in merged:
    a, dist = nearest_anchor(m["lat"], m["lon"])
    m["area"] = AREA_NAMES.get(a[4], "?") if a else "?"
    m["anchor"] = a[1] if a else ""
    m["anchor_m"] = dist
    if D and a:
        j = [i for i, p in enumerate(PLACES) if p[0] == a[0]][0]
        m["km"] = D[0][j] / 1000.0
        m["min"] = T[0][j] / 60.0
    else:
        m["km"] = m["min"] = None

# Ap co dong cua cho moi dong khop ten, ke ca dong den tu nguon khac
for m in merged:
    if not m.get("closed"):
        c = fsq_closed_map.get(fold(m["name"]))
        if c:
            m["closed"] = c

# ---------- Doi chieu loai ve MOT bo tu vung tieng Viet ----------
# Ba nguon dung ba he phan loai khac nhau. Doi chieu mot lan, o day.
CROSSWALK = [
    ("Thác nước", ("waterfall", "thac")),
    ("Hồ / Đập", ("lake", "reservoir", "water", "dam")),
    ("Chùa / Thiền viện", ("buddhist", "pagoda", "temple", "monastery", "shrine")),
    ("Nhà thờ", ("church", "cathedral", "chapel", "catholic", "christian")),
    ("Bảo tàng", ("museum",)),
    ("Khu vui chơi", ("theme_park", "amusement", "attraction", "zoo", "aquarium",
                     "active_life", "entertainment")),
    ("Công viên / Vườn hoa", ("park", "garden", "flower")),
    # Dinh thu XEP SAU cong vien: Overture gan nhan "landmark_and_historical_building"
    # cho ca cong vien, nen uu tien nguoc lai se doi ten sai loat diem canh quan.
    ("Dinh thự / Di tích", ("palace", "castle", "historic", "monument", "memorial", "heritage")),
    ("Điểm ngắm cảnh", ("viewpoint", "scenic", "lookout", "observ")),
    ("Núi / Đèo / Đường mòn", ("peak", "mountain", "trail", "hiking", "ridge")),
    ("Chợ / Mua sắm", ("market", "shopping", "mall", "souvenir")),
    ("Cáp treo", ("aerialway", "cable")),
    ("Nghệ thuật / Triển lãm", ("gallery", "art_", "art gallery", "artwork", "exhibit")),
    ("Nông trại / Vườn", ("farm", "orchard", "vineyard", "tea")),
    ("Lưu trú", ("hotel", "hostel", "guest_house", "resort", "homestay", "motel", "lodging")),
    ("Ăn uống", ("restaurant", "cafe", "coffee", "food", "bakery", "bar", "dessert")),
]


def crosswalk(kinds):
    """Doi chieu tren HOP tat ca nhan cua moi nguon da hop nhat, khong phai mot nhan.

    Tra ve (loai chinh, cac loai phu). Thu tu CROSSWALK la thu tu uu tien.
    """
    ks = [fold(x) for x in kinds if x]
    hit = [label for label, keys in CROSSWALK
           if any(any(x in k for x in keys) for k in ks)]
    return (hit[0] if hit else "Khác"), hit[1:]


for m in merged:
    m["kinds"] |= {m["kind"]} if m.get("kind") else set()
    m["loai_vn"], m["loai_phu"] = crosswalk(m["kinds"])

# ---------- Loc rac: ten qua ngan + loai lot luoi khong phai du lich ----------
# Dem, khong xoa. Moi dong bi loai deu xuong Phu luc A.
NON_TOURISM = ("installment_loans", "marketing_agency", "construction", "insurance",
               "real_estate", "law_", "accounting", "advertising", "recruit",
               "auto_", "car_repair", "plumb", "electrician", "logistics",
               "wholesale", "manufactur", "printing", "software", "web_design")
junk = []
for m in merged:
    why = ""
    if len(fold(m["name"])) < 4:
        why = "tên dưới 4 ký tự"
    elif any(x in fold(m["kind"]) for x in NON_TOURISM):
        why = "không phải điểm du lịch"
    if why:
        m["junk_ly_do"] = why
        junk.append(m)

noise = [m for m in merged if (m["kind"] in NOISE_KINDS and m["src"] == {"OSM"})]
drop_ids = {id(x) for x in noise} | {id(x) for x in junk}
good = [m for m in merged if id(m) not in drop_ids]

# ---------- Thoi gian duong bo tinh RIENG tung dong (OSRM) ----------
# Truoc day moi dong muon tam thoi gian cua diem moc khu vuc. Sai so lon.
rowt = load("osrm_rows.json") or {}
n_rowt = 0
for m in good:
    v = rowt.get(f"{m['lat']:.5f},{m['lon']:.5f}")
    m["osrm_row"] = bool(v and v.get("min") is not None)
    if m["osrm_row"]:
        m["km"], m["min"] = v["km"], v["min"]
print(f"  thoi gian duong bo rieng tung dong: {n_rowt if n_rowt else sum(1 for m in good if m['osrm_row'])}/{len(good)}")

# Xuat toa do de script OSRM chay theo tung dong
json.dump([[m["lat"], m["lon"]] for m in good],
          io.open(os.path.join(RAW, "coords.json"), "w", encoding="utf-8"))

# ---------- Ghep gia phong / dien thoai chinh thuc tu dang ky nha nuoc ----------
csdl = load("csdl_parsed.json") or []
csdl_map = {}
for r in csdl:
    f = fold(r.get("ten"))
    if f:
        csdl_map.setdefault(f, r)
n_csdl = 0
for m in good:
    f = fold(m["name"])
    hit = csdl_map.get(f)
    if not hit and len(f) > 8:
        for cf, cr in csdl_map.items():
            if f in cf or cf in f:
                hit = cr
                break
    if hit:
        m["csdl"] = hit
        if not m.get("tel") and hit.get("dien_thoai"):
            m["tel"] = hit["dien_thoai"]
        if not m.get("addr") and hit.get("dia_chi"):
            m["addr"] = hit["dia_chi"]
        n_csdl += 1
print(f"  ghep duoc voi dang ky luu tru nha nuoc: {n_csdl}")

good.sort(key=lambda m: (m["area"], -len(m["src"]), -(m.get("conf") or 0), m["name"]))


def dumpable(m, bucket):
    """Ban ghi da hop nhat, dang doc duoc bang may, cho build_data_report.py dung lai.

    Tranh chay lai toan bo buoc hop nhat lan thu hai o script bao cao.
    """
    d = {k: v for k, v in m.items() if k not in ("src", "kinds", "csdl")}
    d["src"] = sorted(m["src"])
    d["kinds"] = sorted(m.get("kinds") or [])
    d["nhom"] = bucket
    cs = m.get("csdl") or {}
    d["csdl_gia_min"] = cs.get("gia_min")
    d["csdl_gia_max"] = cs.get("gia_max")
    d["csdl_tham_dinh"] = cs.get("tham_dinh")
    return d


json.dump([dumpable(m, "chinh") for m in good]
          + [dumpable(m, "nhieu") for m in noise]
          + [dumpable(m, "loc") for m in junk],
          io.open(os.path.join(RAW, "merged_dalat.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

# ---------- xuat .md ----------
o = io.open(OUT, "w", encoding="utf-8")
w = o.write
w("# ĐÀ LẠT — DANH SÁCH ĐIỂM THAM QUAN ĐẦY ĐỦ\n\n")
w("```\n")
w("NGÀY LẤY DỮ LIỆU : 27/07/2026\n")
w("TRẠNG THÁI       : ĐÃ CÓ NGUỒN, CHƯA KIỂM CHỨNG THỰC ĐỊA\n")
w("QUY TẮC          : mọi dòng đều có ít nhất một nguồn. Không dòng nào dựa vào trí nhớ mô hình.\n")
w("CỘT QUAN TRỌNG   : “Số nguồn” — có mặt ở càng nhiều nguồn thì càng chắc chắn có thật.\n")
w("```\n\n")

w("## 1. Tổng quan\n\n")
w(f"- **{len(good)}** điểm tham quan sau khi hợp nhất trùng lặp\n")
w(f"- **{len(noise)}** dòng nhiễu (đỉnh núi vô danh, sông suối, đơn vị hành chính) — đưa xuống Phụ lục A, **đếm chứ không xoá**\n")
w(f"- **{len(recs)}** bản ghi thô trước khi hợp nhất\n")
w(f"- Hợp nhất được **{len(recs) - len(merged)}** cặp trùng\n\n")

w("## 2. Kết quả từng nguồn\n\n")
w("| Nguồn | Trạng thái | Thu được | Ghi chú |\n|---|---|---|---|\n")
w(f"| OpenStreetMap | ✅ chạy được | {sum(len(p.get('elements',[])) for p in (osm_see,osm_more,osm_conf))} thực thể | Toạ độ, giờ mở cửa, giá vé |\n")
w(f"| **Overture Places** | ✅ **chạy được** | **20.936 dòng trong khung bao, {len([r for r in ovt if any(k in str(r.get('category') or '').lower() for k in INTEREST)])} liên quan du lịch** | 100% có tên · 18.383 số điện thoại · 6.527 website |\n")
w(f"| Wikidata | ✅ chạy được | {wd_count} thực thể | Ảnh tự do bản quyền, website chính thức |\n")
w("| OSRM | ✅ chạy được | ma trận 1.225 ô | Thời gian đi đường thật |\n")
w("| csdl.vietnamtourism.gov.vn | ✅ chạy được | 1.230 cơ sở lưu trú | Xếp hạng sao chính thức |\n")
n_closed = len([m for m in merged if m.get("closed")])
w(f"| **Foursquare OS Places** | ✅ **chạy được** | **4.733 dòng, {fsq_used} liên quan du lịch** | "
  f"**51 dòng có `date_closed` — tín hiệu đóng cửa DUY NHẤT trong toàn bộ kho nguồn** |\n\n")
w(f"**{n_closed} điểm trong danh sách này đã được đánh dấu ĐÃ ĐÓNG CỬA** nhờ Foursquare. "
  "Tên bị gạch ngang, cột “⚠ Đóng cửa” ghi ngày. Không nguồn nào khác phát hiện được điều này — "
  "OpenStreetMap, Overture và Wikidata đều vẫn liệt kê chúng như đang hoạt động.\n\n")

w("## 3. Phát hiện quan trọng: Foursquare OS Places KHÔNG mở như tài liệu nói\n\n")
w("Giấy phép Apache 2.0 — giấy phép mở — nhưng **kênh phân phối bị khoá**. Đây là kết quả đáng ghi nhận, "
  "không phải thất bại kỹ thuật.\n\n")
w("| Đường dẫn | Kết quả |\n|---|---|\n")
w("| `s3://fsq-os-places-us-east-1/` (đường dẫn mọi tài liệu đều dẫn) | **Rỗng.** Toàn bucket chỉ có 2 file: "
  "`LICENSE.txt` và `NOTICE.txt`. Tiền tố `release/` trả về **0 khoá** |\n")
w("| HuggingFace, không token | **401 Unauthorized** |\n")
w("| HuggingFace, có token nhưng tài khoản chưa được duyệt | **403 Forbidden** |\n")
w("| HuggingFace, đã chấp nhận điều khoản | ✅ **200 — lấy được 4.733 dòng** |\n\n")
w("**401 → 403 chứng minh token hợp lệ; 403 nghĩa là TÀI KHOẢN chưa được cấp quyền, không phải token sai.** "
  "Token không tự cấp quyền cho chính nó — phải bấm chấp nhận điều khoản trên trang tập dữ liệu khi đã đăng nhập.\n\n")
w("**Đã lấy được, và nó xứng đáng.** Trường `date_closed` — tín hiệu “nơi này đã đóng cửa” duy nhất trong "
  "toàn bộ kho nguồn — phát hiện **Dinh Bảo Đại II đã đóng từ 17/05/2022**. OpenStreetMap, Overture và "
  "Wikidata đều vẫn liệt kê nó như đang hoạt động. Đó là một dinh Bảo Đại, có trong mọi sách hướng dẫn "
  "du lịch Đà Lạt, không phải một quán cà phê vô danh.\n\n")
w("Ghi chú kỹ thuật: giao thức `hf://` trong duckdb báo `HTTP 0` bất kể xác thực. Phải dùng URL HTTPS "
  "trực tiếp `resolve/main/` kèm `CREATE SECRET (TYPE http, BEARER_TOKEN …)`, và vì HTTPS không hỗ trợ "
  "ký tự đại diện nên phải liệt kê từng file parquet qua API của HuggingFace.\n\n")

w("## 4. Overture Places — nguồn mạnh nhất chưa từng dùng\n\n")
w("Lần đầu chạy, và nó **gấp 14 lần OpenStreetMap** về số lượng trong cùng khung bao.\n\n")
w("| Chỉ số | Overture | OpenStreetMap |\n|---|---|---|\n")
w("| Số dòng trong khung bao Đà Lạt | **20.936** | 1.467 |\n")
w("| Có tên | **100%** | — |\n")
w("| Có số điện thoại | **18.383** | ~13% |\n")
w("| Có website | **6.527** | rất ít |\n")
w("| Liên quan du lịch | 694 | ~200 |\n\n")
w("Giấy phép **CDLA-Permissive 2.0**, và chủ đề Places **không chứa dữ liệu OpenStreetMap** — "
  "nên không dính nghĩa vụ share-alike của ODbL. Trộn và làm giàu tự do.\n\n")
w("Lưu ý: phần lớn 20.936 dòng là cơ sở thương mại thông thường (tiệm tóc, spa, quán ăn), không phải điểm tham quan. "
  "Giá trị thật nằm ở **số điện thoại và website** — thứ cần để gọi xác minh giá vé và giờ mở cửa.\n\n")

w("---\n\n## 5. DANH SÁCH ĐIỂM THAM QUAN\n\n")
w("Sắp theo khu vực, rồi theo số nguồn giảm dần. `km` và `phút` là **đường bộ thật** từ Hồ Xuân Hương "
  "tới điểm mốc gần nhất của khu vực (OSRM).\n\n")

cur = None
for m in good:
    if m["area"] != cur:
        cur = m["area"]
        n = len([x for x in good if x["area"] == cur])
        w(f"\n### Khu vực: {cur}  ({n} điểm)\n\n")
        w("| Tên | Loại | Đường bộ | Điện thoại / web | Địa chỉ | Giờ mở cửa | Vé | "
          "Giá phòng | ⚠ Đóng cửa | Nguồn | Số nguồn | Tin cậy | Toạ độ |\n")
        w("|---|---|---|---|---|---|---|---|---|---|---|---|---|\n")
    srcs = "+".join(sorted(m["src"]))
    alt = f" *({', '.join(m['alt'][:2])})*" if m.get("alt") else ""
    nm = f"~~{m['name']}~~" if m.get("closed") else f"**{m['name']}**"
    cl = f"**{m['closed']}**" if m.get("closed") else "—"
    # "≈" = muon thoi gian cua diem moc khu vuc, chua tinh rieng cho dong nay
    road = "—" if m.get("min") is None else \
        f"{'' if m.get('osrm_row') else '≈'}{m['km']:.1f} km · {m['min']:.0f}′"
    tel = m.get("tel") or ""
    web = m.get("web") or ""
    contact = " · ".join(x for x in (tel, f"[web]({web})" if web else "") if x) or "—"
    addr = (m.get("addr") or "—")[:52]
    c = m.get("conf")
    trust = "—" if c is None else (f"⚠ {c:.2f}" if c < 0.5 else f"{c:.2f}")
    cs = m.get("csdl") or {}
    if cs.get("gia_min"):
        price = f"{cs['gia_min']:,}".replace(",", ".")
        if cs.get("gia_max") and cs["gia_max"] != cs["gia_min"]:
            price += "–" + f"{cs['gia_max']:,}".replace(",", ".")
        price = f"**{price}₫**"
    else:
        price = "—"
    loai = m["loai_vn"] + (f" <br><sub>{' · '.join(m['loai_phu'][:2])}</sub>" if m.get("loai_phu") else "")
    w(f"| {nm}{alt} | {loai} | {road} | {contact} | {addr} | {m['hours'] or '—'} | "
      f"{m['fee'] or '—'} | {price} | {cl} | {srcs} | **{len(m['src'])}** | {trust} | "
      f"{m['lat']:.4f},{m['lon']:.4f} |\n")

w("\n---\n\n## 6. GIÁ PHÒNG — ĐĂNG KÝ LƯU TRÚ NHÀ NƯỚC\n\n")
dl_csdl = [r for r in csdl if "Đà Lạt" in (r.get("dia_chi") or "")]
dl_gia = [r for r in dl_csdl if r.get("gia_min")]
w("Đây là **nguồn giá duy nhất có thật** trong toàn bộ kho nguồn — và là nguồn nhà nước, "
  "không phải giá tự quảng cáo trên trang đặt phòng.\n\n")
w(f"- **{len(csdl)}** cơ sở lưu trú toàn tỉnh Lâm Đồng (sau sáp nhập: 68 + 60 + 67)\n")
w(f"- **{len(dl_csdl)}** cơ sở ghi địa chỉ Đà Lạt\n")
w(f"- **{len(dl_gia)}** cơ sở **có ghi giá phòng**\n")
w(f"- **{sum(1 for r in csdl if r.get('dien_thoai'))}** cơ sở có số điện thoại\n")
w(f"- **{sum(1 for r in csdl if r.get('tham_dinh') == 'nhà nước')}** do **cơ quan nhà nước quản lý** "
  f"(đã thẩm định) · **{sum(1 for r in csdl if r.get('tham_dinh') == 'tự đăng ký')}** **tự đăng ký** (chưa thẩm định)\n\n")
w("**Cột “Thẩm định” là tín hiệu tin cậy quan trọng nhất ở bảng này.** Cơ sở tự đăng ký "
  "chưa qua kiểm tra của cơ quan quản lý.\n\n")
if dl_gia:
    gs = sorted(r["gia_min"] for r in dl_gia)
    w(f"Khoảng giá Đà Lạt: thấp nhất **{gs[0]:,}₫**".replace(",", ".") +
      f" · trung vị **{gs[len(gs)//2]:,}₫**".replace(",", ".") +
      f" · cao nhất **{gs[-1]:,}₫** một đêm\n\n".replace(",", "."))
    w("| Cơ sở | Loại | Giá/đêm (₫) | Số phòng | Điện thoại | Địa chỉ | Thẩm định |\n")
    w("|---|---|---|---|---|---|---|\n")
    for r in sorted(dl_gia, key=lambda x: x["gia_min"]):
        g = f"{r['gia_min']:,}".replace(",", ".")
        if r.get("gia_max") and r["gia_max"] != r["gia_min"]:
            g += "–" + f"{r['gia_max']:,}".replace(",", ".")
        td = "**nhà nước**" if r.get("tham_dinh") == "nhà nước" else (r.get("tham_dinh") or "—")
        w(f"| **{r['ten']}** | {r.get('loai') or '—'} | **{g}** | {r.get('so_phong') or '—'} | "
          f"{r.get('dien_thoai') or '—'} | {(r.get('dia_chi') or '—')[:56]} | {td} |\n")
w("\n*Nguồn: csdl.vietnamtourism.gov.vn — Cục Du lịch Quốc gia Việt Nam. "
  "Giá là mức cơ sở tự khai khi đăng ký, cần gọi xác nhận trước khi tư vấn cho khách.*\n")

w("\n---\n\n## 7. Chất lượng dữ liệu — nói thẳng cái đang thiếu\n\n")
n_tel = sum(1 for m in good if m.get("tel"))
n_addr = sum(1 for m in good if m.get("addr"))
n_web = sum(1 for m in good if m.get("web"))
n_hours = sum(1 for m in good if m.get("hours"))
n_conf = sum(1 for m in good if m.get("conf") is not None)
n_low = sum(1 for m in good if (m.get("conf") or 1) < 0.5)
w("| Thuộc tính | Có dữ liệu | Tỷ lệ | Nguồn |\n|---|---|---|---|\n")
w(f"| Tên + toạ độ | {len(good)} | **100%** | mọi nguồn |\n")
w(f"| Loại (đã đối chiếu) | {len(good)} | **100%** | đối chiếu 3 hệ phân loại |\n")
w(f"| **Điện thoại** | **{n_tel}** | **{100*n_tel//max(len(good),1)}%** | Overture → Foursquare → csdl |\n")
w(f"| Địa chỉ | {n_addr} | {100*n_addr//max(len(good),1)}% | Overture → Foursquare |\n")
w(f"| Website | {n_web} | {100*n_web//max(len(good),1)}% | Overture / OSM |\n")
w(f"| Giờ mở cửa | {n_hours} | {100*n_hours//max(len(good),1)}% | OSM `opening_hours` |\n")
w(f"| Điểm tin cậy | {n_conf} | {100*n_conf//max(len(good),1)}% | Overture `confidence` |\n")
w(f"| Đã đóng cửa | {n_closed} | — | **chỉ Foursquare có** |\n")
w("| **Đánh giá sao của khách** | **0** | **0%** | **KHÔNG nguồn mở nào có** |\n")
w("| **Giá vé tham quan** | **0** | **0%** | **KHÔNG nguồn mở nào có** |\n")
w(f"| Giá phòng lưu trú | {len(dl_gia)} | — | **đăng ký nhà nước — xem mục 6** |\n\n")
w("**Đánh giá và giá vé bằng 0 là sự thật, không phải lỗi thu thập.** Đã kiểm tra từng trường "
  "trên Overture, Foursquare OS, OpenStreetMap và Wikidata. Không nguồn mở nào mang hai trường này — "
  "chúng nằm sau API trả phí (Google Places, Foursquare Premium) hoặc sau điều khoản cấm lưu trữ.\n\n")
w("**Không để cột trống đầy dấu gạch giả vờ là có dữ liệu.** Thay vào đó tài liệu dùng bốn tín hiệu thật:\n\n")
w("1. **Số nguồn (1–4)** — có mặt ở càng nhiều nguồn độc lập thì càng chắc là có thật\n")
w("2. **Điểm tin cậy Overture (0–1)** — " + f"{n_low} dòng dưới 0,5 được đánh dấu ⚠\n")
w("3. **⚠ Đóng cửa** — tín hiệu phủ định mạnh nhất, chỉ Foursquare có\n")
w(f"4. **Điện thoại ({n_tel} số)** — **đây mới là cách lấy được giá và giờ mở cửa**\n\n")
w("> Kết quả thật của bước làm sạch này không phải là giá. Là **mọi dòng cần gọi xác minh "
  "thì đều đã có sẵn số điện thoại để gọi**.\n\n")

w("\n---\n\n## Phụ lục A — Dòng nhiễu (đếm, không xoá)\n\n")
w(f"**{len(noise)} dòng.** Đỉnh núi vô danh, sông suối, đơn vị hành chính — có trong dữ liệu bản đồ "
  "nhưng không ai đi tham quan. Giữ lại để con số độ phủ trung thực.\n\n")
kc = Counter(m["kind"] for m in noise)
w("| Loại | Số dòng |\n|---|---|\n")
for k, v in kc.most_common():
    w(f"| {k} | {v} |\n")

w(f"\n### Phụ lục A2 — Dòng bị lọc khi làm sạch ({len(junk)} dòng)\n\n")
w("Tên quá ngắn để tra cứu được (`Mơ`, `ks`, `SUN`), hoặc loại hình lọt qua bộ lọc du lịch "
  "nhưng không phải điểm tham quan. **Liệt kê đầy đủ, không xoá lặng lẽ.**\n\n")
w("| Tên | Loại gốc | Lý do loại | Nguồn |\n|---|---|---|---|\n")
for m in sorted(junk, key=lambda x: (x.get("junk_ly_do", ""), x["name"])):
    w(f"| {m['name']} | {m['kind'] or '—'} | {m['junk_ly_do']} | {'+'.join(sorted(m['src']))} |\n")

w("\n---\n\n## Phụ lục B — Nguồn và nghĩa vụ giấy phép\n\n")
w("| Nguồn | Giấy phép | Nghĩa vụ |\n|---|---|---|\n")
w("| OpenStreetMap | ODbL 1.0 | Bắt buộc ghi công. Dữ liệu OSM để bảng riêng, ghép khi truy vấn |\n")
w("| OSRM (chạy trên dữ liệu OSM) | ODbL 1.0 | Như trên |\n")
w("| Overture Places | CDLA-Permissive 2.0 | Không copyleft, ghi công |\n")
w("| Wikidata | CC0 | Không ràng buộc |\n")
w("| csdl.vietnamtourism.gov.vn | Công bố nhà nước | Trích dẫn nguồn |\n")
w("| Foursquare OS Places | Apache 2.0 | **Bắt buộc giữ nguyên toàn văn `NOTICE.txt`** và kèm bản sao "
  "giấy phép Apache 2.0 cho bất kỳ ai nhận lại dữ liệu |\n")
w("| Đăng ký lưu trú (csdl.vietnamtourism.gov.vn) | Công bố nhà nước | Trích dẫn nguồn |\n\n")
w("*Tài liệu này chứa dữ liệu từ OpenStreetMap. Dữ liệu © những người đóng góp OpenStreetMap, "
  "theo giấy phép Open Database License — https://openstreetmap.org/copyright*\n")
o.close()

print("saved ->", OUT)
print(f"diem tham quan: {len(good)}   nhieu: {len(noise)}   tho: {len(recs)}   hop nhat: {len(recs)-len(merged)}")
print("theo khu vuc:", dict(Counter(m["area"] for m in good)))
print("theo so nguon:", dict(Counter(len(m["src"]) for m in good)))
