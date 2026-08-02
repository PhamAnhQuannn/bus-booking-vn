# -*- coding: utf-8 -*-
"""R1 — lop LUU TRU. Khong cham mang.

Vi sao la lop RIENG chu khong nam trong kho da hop nhat: kho do co 1.422 dong
nhung chi 1 dong "Lưu trú" va 3 dong "Ăn uống". Khong phai thieu du lieu —
`build_huong_dan.py` co `EXCLUDE_CAT = {"Lưu trú", "Ăn uống"}` va ca vong hop
nhat duoc dung cho diem tham quan. An va ngu chua tung di qua duong ong.

Ba nguon, moi nguon giu mot thu khong nguon nao khac co:

  csdl_parsed.json  420 co so o Da Lat — GIA THAT (213) + HANG THAM DINH
                    (401 "nhà nước" / 19 "tự đăng ký") + so phong (218).
                    Day la nhom DUY NHAT trong ca du an co gia kem dau tham
                    dinh cua co quan quan ly. Khong con phai xin gia o blog.
  overture          3.913 dong luu tru — do phu + dien thoai + Facebook.
  fsq_dalat.json    860 dong luu tru — DATE_CLOSED. La nguon DUY NHAT co tin
                    hieu nay: `operating_status` cua Overture NULL tren toan bo
                    20.936 dong Da Lat.

BAY KHOP TEN O NHOM NAY: gan nhu moi ten deu mo dau bang tu chi LOAI
("Khách sạn Lilac", "Nhà nghỉ Anh Sang"). Bo tu do di roi moi so — neu khong
thi moi khach san deu giong moi khach san. Va so khop phai GIU NGUYEN DAU +
doi bien tu, dung bai hoc `sữa chua`/`sửa chữa`.

Chay:  python tourism-kb/code/sweep_luu_tru.py <thu-muc-raw>
"""
import json, os, sys, io, re, math, unicodedata
from collections import Counter

RAW = sys.argv[1]
OUT = os.path.join(RAW, "luu_tru.json")


def fold(s):
    s = (s or "").lower().replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    return " ".join("".join(c for c in s if unicodedata.category(c) != "Mn").split())


# Tu chi LOAI co so — co mat trong hau het moi ten, nen khong phan biet duoc gi.
# Bo tu dai den ngan, neu khong "khách sạn nghỉ dưỡng" chi bi cat mat "khách sạn".
LOAI_TU = ["khach san nghi duong", "khach san biet thu", "nha nghi du lich",
           "biet thu du lich", "can ho du lich", "khu nghi duong", "khach san",
           "nha nghi", "homestay", "hostel", "motel", "resort", "hotel",
           "guesthouse", "guest house", "villa", "biet thu", "nha khach"]
# Duoi dia danh — "Khách sạn Casanova Đà Lạt" va "Casanova" la mot.
DUOI = ["da lat", "dalat", "lam dong", "viet nam"]


def ten_rieng(s):
    """Bo tu chi loai va duoi dia danh, con lai la phan phan biet duoc."""
    t = fold(s)
    for k in LOAI_TU:
        t = re.sub(r"(?<![a-z0-9])" + re.escape(k) + r"(?![a-z0-9])", " ", t)
    for k in DUOI:
        t = re.sub(r"(?<![a-z0-9])" + re.escape(k) + r"(?![a-z0-9])", " ", t)
    return " ".join(t.split())


def duong(dia_chi):
    """'127 Yersin, Lâm Viên - Đà Lạt, ...' -> ('127', 'yersin')."""
    p = (dia_chi or "").split(",")[0].strip()
    m = re.match(r"^(\d+[a-zA-Z]?(?:/\d+)?)\s+(.+)$", p)
    return (m.group(1), fold(m.group(2))) if m else (None, fold(p))


csdl = json.load(io.open(os.path.join(RAW, "csdl_parsed.json"), encoding="utf-8"))
ovt = json.load(io.open(os.path.join(RAW, "overture_dalat.json"), encoding="utf-8"))
fsq = json.load(io.open(os.path.join(RAW, "fsq_dalat.json"), encoding="utf-8"))

dl = [r for r in csdl
      if "lạt" in str(r.get("thanh_pho") or "").lower()
      or "lạt" in str(r.get("dia_chi") or "").lower()]

OVT_LODGE = {"hotel", "resort", "hostel", "motel", "bed_and_breakfast",
             "guest_house", "holiday_rental_home"}
o_lodge = [r for r in ovt if str(r.get("category") or "") in OVT_LODGE]
f_lodge = [r for r in fsq if "Lodging" in str(r.get("fsq_category_labels") or "")]

print(f"đăng ký nhà nước (Đà Lạt) {len(dl)} · Overture lưu trú {len(o_lodge)} · "
      f"Foursquare lưu trú {len(f_lodge)}\n")

# Chi so theo TEN RIENG. Ten rieng qua ngan (<4 ky tu) thi bo — "An", "Mai" khop
# vao hang chuc co so khac nhau.
def chi_so(rows, key):
    ix = {}
    for r in rows:
        t = ten_rieng(r.get(key) or "")
        if len(t) >= 4:
            ix.setdefault(t, []).append(r)
    return ix


ix_o, ix_f = chi_so(o_lodge, "name"), chi_so(f_lodge, "name")

out, n_o, n_f, n_closed = [], 0, 0, 0
for r in dl:
    t = ten_rieng(r.get("ten") or "")
    sn, st = duong(r.get("dia_chi"))
    row = {
        "ten": r.get("ten"), "loai": r.get("loai") or None,
        "tham_dinh": r.get("tham_dinh"),
        "gia_min": r.get("gia_min"), "gia_max": r.get("gia_max"),
        "so_phong": r.get("so_phong"),
        "dien_thoai": r.get("dien_thoai"), "email": r.get("email"),
        "dia_chi": r.get("dia_chi"), "so_nha": sn, "duong": st,
        "lat": None, "lon": None, "facebook": None, "tin_cay": None,
        "da_dong_cua": None, "nguon_khop": [],
    }
    if len(t) >= 4:
        for m in ix_o.get(t, [])[:1]:
            n_o += 1
            row["lat"], row["lon"] = m["lat"], m["lon"]
            row["tin_cay"] = m.get("confidence")
            row["facebook"] = (m.get("socials") or [None])[0]
            row["dien_thoai"] = row["dien_thoai"] or (m.get("phones") or [None])[0]
            row["nguon_khop"].append("Overture")
        for m in ix_f.get(t, [])[:1]:
            n_f += 1
            row["nguon_khop"].append("Foursquare")
            if m.get("date_closed"):
                row["da_dong_cua"] = m["date_closed"]
                n_closed += 1
    out.append(row)

# Co so Foursquare bao DA DONG nhung khong co trong dang ky nha nuoc — van phai
# neu ra, vi day chinh la nhung noi huong dan cu va mo hinh ngon ngu con gioi thieu.
ten_dl = {ten_rieng(r.get("ten") or "") for r in dl}
dong_ngoai = [{"ten": m["name"], "dia_chi": m.get("address"),
               "da_dong_cua": m["date_closed"]}
              for m in f_lodge
              if m.get("date_closed") and ten_rieng(m["name"]) not in ten_dl]

json.dump({"co_so": out, "dong_cua_ngoai_dang_ky": dong_ngoai},
          io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

g = [r for r in out if r["gia_min"]]
tt = Counter(r["tham_dinh"] for r in out)
print(f"{len(out)} cơ sở lưu trú")
print(f"  thẩm định : " + " · ".join(f"{k} {v}" for k, v in tt.most_common()))
# `gia_max` co the RONG: nguon ghi thieu phan nghin ("250.000 - 350") va
# parse_csdl.py bo gia tran thay vi doan lai. Nen phai loc None truoc khi max().
_hi = [r["gia_max"] for r in g if r["gia_max"]]
print(f"  có giá    : {len(g)}   ({min(r['gia_min'] for r in g):,}–"
      f"{max(_hi):,}₫)".replace(",", "."))
print(f"  số phòng  : {sum(1 for r in out if r['so_phong'])}")
print(f"  điện thoại: {sum(1 for r in out if r['dien_thoai'])}")
print(f"  khớp Overture {n_o} · Foursquare {n_f} · có toạ độ {sum(1 for r in out if r['lat'])}")
print(f"  ĐÃ ĐÓNG CỬA (trong đăng ký): {n_closed}")
for r in out:
    if r["da_dong_cua"]:
        print(f"     {r['ten'][:40]:42s}{r['da_dong_cua']}")
print(f"  ĐÃ ĐÓNG CỬA (ngoài đăng ký): {len(dong_ngoai)}")
for r in dong_ngoai:
    print(f"     {str(r['ten'])[:40]:42s}{r['da_dong_cua']}")

print(f"\n{'Loại':24s}{'Số':>5s}{'Có giá':>8s}  Ví dụ")
for loai, n in Counter(r["loai"] or "(không ghi)" for r in out).most_common(8):
    cg = sum(1 for r in out if (r["loai"] or "(không ghi)") == loai and r["gia_min"])
    vd = next((r["ten"] for r in out if (r["loai"] or "(không ghi)") == loai), "")
    print(f"{loai[:22]:24s}{n:5d}{cg:8d}  {vd[:34]}")
print(f"\nsaved -> {OUT}")
