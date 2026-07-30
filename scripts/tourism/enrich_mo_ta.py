# -*- coding: utf-8 -*-
"""Lay MO TA tu Wikipedia tieng Viet cho 36 diem den. TRICH NGUYEN VAN.

═══════════════════════════════════════════════════════════════════════════════
KHOANG TRONG LA MOT DIEM, KHONG PHAI MUOI BAY.

`enrichment.json` da co `mo_ta_wikipedia` cho 19/36, va con lai bi coi la "khong
co bai". Kiem tung ten thi 16 trong 17 diem do CO bai Wikipedia tieng Viet —
chi la duoi TEN KHAC:
    Đỉnh Langbiang    -> Núi Langbiang
    Crazy House       -> Biệt thự Hằng Nga
    Nhà thờ Con Gà    -> Nhà thờ chính toà Đà Lạt
    Thác Voi          -> Thác Voi (Nam Ban)
Chi `Đồi chè Cầu Đất` la khong co that. Nen tran thuc te la 35/36.
Bai hoc: "khong tim thay bai" thuong la "tim bang ten sai", va hai dieu do phai
duoc phan biet — giong luat da ghi trong so ve "khong kiem duoc" khac "kiem ra
ket qua am".

TRICH NGUYEN VAN, KHONG DIEN DAT LAI. Van ban Wikipedia la CC BY-SA 4.0:
  - Ghi cong: dan nguon + lien ket la du.
  - Chia se tuong tu: chi kich hoat khi tao "Adapted Material", tuc khi SUA/dien
    dat lai. Trich nguyen van trong mot tai lieu lon hon la mot "collection" va
    khong keo ca tai lieu vao giay phep.
  => Nen: trich nguyen van hoac khong trich. Viet lai bang loi minh la cach
     duy nhat lam phat sinh nghia vu chia se tuong tu cho chinh doan do.

KHONG DUNG `mo_ta_osm`. No co 2/36 va mot trong hai la du lieu SAI:
"Room: 19; Price: 48-198 USD/night" gan cho Chùa Linh Phước — mot ngoi chua.

Chay:  python scripts/tourism/enrich_mo_ta.py <thu-muc-raw>
"""
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

RAW = sys.argv[1] if len(sys.argv) > 1 else ".tourism-data/raw"
API = "https://vi.wikipedia.org/w/api.php"
UA = "BusBookingKB/0.1 (tourism knowledge base; contact via repo)"

# Ten bai THUC TE, tra bang tay vi ten trong du lieu khong khop ten bai.
# Moi dong la mot ten da kiem, khong phai mot phong doan.
TEN_BAI = {
    "Đỉnh Langbiang": "Núi Langbiang",
    "Crazy House": "Biệt thự Hằng Nga",
    "Nhà thờ Con Gà": "Nhà thờ chính tòa Đà Lạt",
    "Thác Voi": "Thác Voi (Nam Ban)",
    "Ga Đà Lạt": "Ga Đà Lạt",
    "XQ Sử Quán": "XQ Sử quán",
    "Vườn hoa thành phố Đà Lạt": "Vườn hoa thành phố Đà Lạt",
    "Thiền Viện Trúc Lâm": "Thiền viện Trúc Lâm (Đà Lạt)",
    "Chùa Linh Phước - Đà Lạt": "Chùa Linh Phước",
    "Khu du lịch Đồi Mộng Mơ": "Đồi Mộng Mơ",
    "Thung lũng Tình yêu": "Thung lũng Tình Yêu",
    "Bảo Tàng Lâm Đồng": "Bảo tàng Lâm Đồng",
    "Làng Cù Lần": "Làng Cù Lần",
    "Lake of Sighs (Ho Than Tho)": "Hồ Than Thở",
    "Hồ Xuân Hương - TP Đà Lạt": "Hồ Xuân Hương (Đà Lạt)",
    "Chợ Đà Lạt": "Chợ Đà Lạt",
    "Chùa Tàu (Thiên Vương Cổ Sát)": "Thiên Vương Cổ Sát",
    "Dinh Bao Dai III": "Dinh III",
    "Quảng trường Lâm Viên": "Quảng trường Lâm Viên",
    "Khu Di Tích Dinh Bảo Đại": "Dinh I",
}
# Khong co bai — ghi ra de khong ai di tim lai.
KHONG_CO = {"Đồi chè Cầu Đất"}

MAX_CHU = 420          # do dai doan trich toi da


def goi(params, lan=4):
    """Wikipedia tra 429 khi goi lien tuc. Lui dan roi thu lai — mot loi tam thoi
    bi ghi thanh 'khong co bai' se thanh mot khoang trong VINH VIEN trong tai
    lieu, vi lan chay sau se bo qua diem do."""
    u = API + "?" + urllib.parse.urlencode(dict(params, format="json"))
    req = urllib.request.Request(u, headers={"User-Agent": UA})
    for i in range(lan):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception:
            if i == lan - 1:
                raise
            time.sleep(2 * (i + 1))


def doan_dau(tieu_de):
    """Doan mo dau cua bai, nguyen van. None neu khong co bai."""
    d = goi({"action": "query", "prop": "extracts", "exintro": 1,
             "explaintext": 1, "redirects": 1, "titles": tieu_de})
    pages = d.get("query", {}).get("pages", {})
    for pid, p in pages.items():
        if pid == "-1" or "missing" in p:
            return None, None
        txt = (p.get("extract") or "").strip()
        if not txt:
            return None, p.get("title")
        # Cat theo CAU, khong cat giua cau — mot cau bi cat doi doc nhu du lieu
        # loi, va no cung khong con la trich nguyen van dung nghia.
        cau = re.split(r"(?<=[.!?])\s+", txt.replace("\n", " "))
        ra = ""
        for c in cau:
            if ra and len(ra) + len(c) + 1 > MAX_CHU:
                break
            ra = (ra + " " + c).strip()
        return ra or None, p.get("title")
    return None, None


G = json.load(io.open(os.path.join(RAW, "guide_data.json"), encoding="utf-8"))
picked = G["picked"]
p_enr = os.path.join(RAW, "enrichment.json")
enr = json.load(io.open(p_enr, encoding="utf-8")) if os.path.exists(p_enr) else []
da_co = {e["id"] for e in enr if e["field"] == "mo_ta_wikipedia"}
ngay = time.strftime("%d/%m/%Y")

print(f"{len(picked)} điểm · đã có mô tả {len(da_co)} · thiếu {len(picked)-len(da_co)}\n")

them, khong, loi = [], [], []
for r in picked:
    if r["id"] in da_co:
        continue
    if r["name"] in KHONG_CO:
        khong.append((r["id"], r["name"], "không có bài Wikipedia"))
        continue
    tieu_de = TEN_BAI.get(r["name"], r["name"])
    try:
        txt, that = doan_dau(tieu_de)
    except Exception as e:
        loi.append((r["id"], r["name"], f"{type(e).__name__}"))
        continue
    if not txt:
        khong.append((r["id"], r["name"], f"tra '{tieu_de}' → không có"))
        continue
    them.append({
        "id": r["id"], "field": "mo_ta_wikipedia", "value": txt,
        "source": "Wikipedia tiếng Việt",
        "url": "https://vi.wikipedia.org/wiki/" + urllib.parse.quote(
            (that or tieu_de).replace(" ", "_")),
        "date": ngay, "method": "wikipedia api · trích nguyên văn",
        "note": "trích nguyên văn, CC BY-SA 4.0",
    })
    print(f"  {r['id']}  {r['name'][:30]:32s} {len(txt):4d} chữ  ← {that}")
    time.sleep(0.3)

if them:
    # Ghi qua file tam roi os.replace: enrichment.json la file 512 dong dung qua
    # 11 luot lam giau va mot phan khong tai tao duoc, nen mot lan ghi do dang
    # la mat du lieu that.
    tmp = p_enr + ".tmp"
    with io.open(tmp, "w", encoding="utf-8") as f:
        json.dump(enr + them, f, ensure_ascii=False, indent=1)
    os.replace(tmp, p_enr)

print(f"\nthêm {len(them)} mô tả  ·  tổng {len(da_co)+len(them)}/{len(picked)}")
if khong:
    print(f"\n{len(khong)} điểm không có mô tả — để trống, KHÔNG tự viết:")
    for i, t, ly in khong:
        print(f"   {i}  {t[:34]:36s} {ly}")
if loi:
    print(f"\n{len(loi)} lỗi gọi API: {loi}")
