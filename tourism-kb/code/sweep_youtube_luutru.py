# -*- coding: utf-8 -*-
"""Tim CO SO LUU TRU nao vlog thuc su nhac, bang YouTube Data API.

Song sinh cua `sweep_youtube_quan.py`, cho lop LUU TRU. Toan bo loi dung chung
nam o `yt_chung` — khong chep lai mot ham nao, vi moi ham trong do la mot su co
da tra gia va hai ban se lech neu moi ben giu mot ban.

VI SAO CAN. Lop luu tru hien co gia, co so phong, co so goi — va KHONG co bat
ky tin hieu chat luong nao. Danh gia sao thi 0/420 va bi chan boi giay phep
luu tru. Tin hieu HIEN DIEN ">=2 kenh doc lap nhac toi" la thu duy nhat vua
hop phap (khong luu thong ke, khong luu danh tinh), vua hop le (mot khang dinh
khiem ton nhung that), vua mien phi.

═════════════════════════════════════════════════════════════════════════════
TU DIEN HAI TANG — va vi sao tang A phai la tang CHINH

Y dinh dau: khop vao Overture cho rong, roi noi sang `luu_tru.json` de lay
phan khuc gia. DO THI HONG: ten `luu_tru` khop chinh xac ten Overture luu tru
chi 72/420 (17%), va chi 45 dong trong so do co `gia_min`. Nguong >=2 kenh se
an not phan con lai. `nguon_khop` khong cuu duoc — no ghi TEN NGUON
(["Overture","Foursquare"]) chu khong ghi id, nen khong dung lam khoa noi.

Nen dao lai:
  Tang A  `luu_tru.json` (420 dong, 416 qua bo loc ten) — TU DIEN CHINH. Moi
          dong da san gia, so phong, dien thoai, dia chi, dau tham dinh nha
          nuoc. Khong phai noi gi ca.
  Tang B  Overture hang muc luu tru (4.737 dong, 4.594 qua bo loc) — lay do
          phu va dia chi. Dong CHI khop tang B ghi ro "chua co gia cong bo",
          TUYET DOI khong suy phan khuc tu hang muc hay tu ten.
Trung ten giua hai tang thi tang A thang: gia tham dinh nha nuoc manh hon.

SWEEP KHONG TINH PHAN KHUC. No chi mang `gia_min`/`gia_max` di; viec chia bac
la cua `an_ngu_data.BAC_GIA` luc render. Mot nguong gia nam o hai noi la mot
nguong se lech.
═════════════════════════════════════════════════════════════════════════════

RANH GIOI PDPL (giu nguyen tu Phase N/O va tu ban an uong):
  LUU     ten co so · so kenh nhac · so video nhac · the phong cach · truy van
  KHONG   ten kenh · tieu de · mo ta · ID video · anh
Van ban vlog chi ton tai trong bo nho du lau de doi chieu roi bo.

KHONG xin `part=statistics`. viewCount/likeCount vua vi pham dieu khoan cam
gop cua YouTube (Developer Policies III.E.2.a: chi duoc gop du lieu cua cac
kenh CUNG MOT chu so huu), vua vo hieu ve do luong — `sweep_youtube_mon.py` da
thu ho phuong phap nay va ghi ket qua trong khung: KET QUA: TIN HIEU NAY
KHONG DUNG DUOC.

Chay:  PYTHONIOENCODING=utf-8 python tourism-kb/code/sweep_youtube_luutru.py <thu-muc-raw>
"""
import json, os, sys, io, time
import urllib.parse, urllib.request, urllib.error
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from yt_chung import (S_API, V_API, MAX_KQ, MIN_KENH, MIN_TEN,
                      TRAN_DON_VI, TRAN_LENH_SEARCH, chi_phi,
                      luu_json, fold, tim_cum, co_ten_rieng, doc_khoa,
                      ly_do_403, LY_DO_HAN_MUC,
                      ngay_pacific, doc_nhat_ky, ghi_nhat_ky)

RAW = sys.argv[1]
OUT = os.path.join(RAW, "luutru_vlog.json")
PHIEN_BAN = 1

# Hang muc luu tru trong Overture. `campground`/`cabin` giu lai vi glamping va
# cam trai la mot phan that cua thi truong luu tru Da Lat.
LUU_TRU = {"hotel", "accommodation", "resort", "holiday_rental_home", "hostel",
           "bed_and_breakfast", "motel", "guest_house", "inn", "cottage",
           "cabin", "campground"}

# ── Tu chung cua lop LUU TRU ───────────────────────────────────────────────
# KHONG tai dung `MON_TU` cua lop an uong: tap tu-chung phai suy tu chinh lop
# dang xet. Mot co so ten dung bang cum chung ("Khách Sạn Đà Lạt", "Ở Đà Lạt")
# se khop moi vlog nhac "khach san da lat", nen phai loai truoc khi so sanh.
CHUNG = set("""khach san hotel resort homestay home stay villa nha nghi motel hostel
lodge lodging bungalow farmstay camping glamping cam trai guest house inn
da lat dalat da lat lam dong viet nam vietnam phong room rooms suite
the a an and cua o tai so""".split())


def co_ten_rieng_luu_tru(ten_folded):
    return co_ten_rieng(ten_folded, CHUNG)


# ── The phong cach — cum tu vlog dung de mo ta mot cho o ───────────────────
# Chi la NHAN MO TA, khong phai danh gia. Mot the noi vlog goi cho do la gi,
# khong noi no tot hay khong.
THE = {
    "view đẹp":      ("view đẹp", "view xịn", "view triệu đô", "view đồi", "view thung lũng"),
    "săn mây":       ("săn mây", "san may", "ngắm mây"),
    "trung tâm":     ("trung tâm", "gần chợ", "gan cho", "ngay chợ"),
    "giá rẻ":        ("giá rẻ", "gia re", "bình dân", "sinh viên"),
    "có bể bơi":     ("bể bơi", "be boi", "hồ bơi", "ho boi", "pool"),
    "cho gia đình":  ("gia đình", "gia dinh", "cho bé", "trẻ em"),
    "cổ / lâu năm":  ("cổ điển", "co dien", "lâu đời", "lau doi", "kiến trúc pháp"),
}

TV_LOAI = ["khách sạn Đà Lạt review", "homestay Đà Lạt", "resort Đà Lạt",
           "villa Đà Lạt", "nhà nghỉ Đà Lạt", "hostel Đà Lạt",
           "khách sạn Đà Lạt mới", "homestay Đà Lạt review thật"]
TV_NHU_CAU = ["khách sạn Đà Lạt giá rẻ", "khách sạn Đà Lạt view đẹp",
              "homestay Đà Lạt gần chợ", "khách sạn Đà Lạt trung tâm",
              "resort Đà Lạt có bể bơi", "khách sạn Đà Lạt cho gia đình",
              "homestay Đà Lạt giá rẻ", "khách sạn Đà Lạt gần hồ Xuân Hương",
              "chỗ ở Đà Lạt đáng tiền", "ở đâu khi đến Đà Lạt"]
TV_PHONG_CACH = ["homestay Đà Lạt view đồi", "khách sạn cổ Đà Lạt",
                 "homestay Đà Lạt săn mây", "villa Đà Lạt cho nhóm",
                 "homestay Đà Lạt yên tĩnh", "khách sạn Đà Lạt kiến trúc Pháp",
                 "cắm trại Đà Lạt có lều", "homestay Đà Lạt sống ảo",
                 "resort Đà Lạt nghỉ dưỡng", "chỗ ở Đà Lạt cho cặp đôi"]
NHOM = [("A · theo loại hình", TV_LOAI),
        ("B · theo nhu cầu", TV_NHU_CAU),
        ("C · theo phong cách", TV_PHONG_CACH)]

khoa, nguon = doc_khoa()
if not khoa:
    print("KHONG tim thay YOUTUBE_API_KEY. Dung.")
    sys.exit(0)
print(f"khoá đọc từ: {nguon}  (giá trị không in ra)\n")

# ── Tu dien doi chieu ──────────────────────────────────────────────────────
biz = {}          # ten_folded -> ban ghi da chuan hoa
bo_ngan, bo_chung = [], []


def them(ten, r, tang):
    n = fold(ten)
    if len(n) < MIN_TEN:
        bo_ngan.append(ten)
        return
    if not co_ten_rieng_luu_tru(n):
        bo_chung.append(ten)
        return
    if n in biz and biz[n]["tang"] == "A":
        return            # tang A thang: gia tham dinh nha nuoc manh hon
    biz[n] = dict(r, tang=tang)


# Tang A — dang ky luu tru nha nuoc. Mang san gia, so phong, dau tham dinh.
_p = os.path.join(RAW, "luu_tru.json")
_d = json.load(io.open(_p, encoding="utf-8"))
_cs = _d["co_so"] if isinstance(_d, dict) else _d
n_a = 0
for r in _cs:
    if r.get("da_dong_cua"):
        continue
    them(r.get("ten"), {
        "ten": r.get("ten"), "loai": r.get("loai"), "dia_chi": r.get("dia_chi"),
        "dien_thoai": r.get("dien_thoai"), "so_phong": r.get("so_phong"),
        "gia_min": r.get("gia_min"), "gia_max": r.get("gia_max"),
        "tham_dinh": r.get("tham_dinh"), "lat": r.get("lat"), "lon": r.get("lon"),
    }, "A")
    n_a += 1

# Tang B — Overture, chi de lay do phu. KHONG co gia -> khong co phan khuc.
_p = os.path.join(RAW, "overture_dalat.json")
_ov = json.load(io.open(_p, encoding="utf-8"))
n_b = 0
for r in _ov:
    if str(r.get("category")) not in LUU_TRU:
        continue
    them(r.get("name"), {
        "ten": r.get("name"), "loai": r.get("category"), "dia_chi": r.get("address"),
        "dien_thoai": (r.get("phones") or [None])[0], "so_phong": None,
        "gia_min": None, "gia_max": None, "tham_dinh": None,
        "lat": r.get("lat"), "lon": r.get("lon"),
    }, "B")
    n_b += 1

n_tang_a = sum(1 for v in biz.values() if v["tang"] == "A")
print(f"từ điển đối chiếu: {len(biz)} cơ sở lưu trú có tên đặc trưng")
print(f"   tầng A · đăng ký nhà nước (CÓ giá): {n_tang_a} trong {n_a} dòng")
print(f"   tầng B · Overture (chưa có giá công bố): {len(biz) - n_tang_a}"
      f" trong {n_b} dòng")
print(f"   loại {len(bo_ngan)} tên ngắn hơn {MIN_TEN} ký tự"
      f" · {len(bo_chung)} tên toàn từ chung")

# ── Moc so sanh + du toan han muc ──────────────────────────────────────────
cu = None
if os.path.exists(OUT):
    try:
        cu = json.load(io.open(OUT, encoding="utf-8"))
    except Exception:
        # Mot file KHONG DOC DUOC khac han mot file KHONG CO. Coi no la rong
        # se am tham tut moc so sanh ve 0 va vo hieu hoa ban chong ghi de —
        # dung luc can nhat. Dung han, dung tieu han muc.
        print(f"\nDỪNG: {OUT} tồn tại nhưng KHÔNG đọc được."
              " Không tiêu hạn mức khi mốc so sánh không tin được."
              " Sửa hoặc xoá file rồi chạy lại.")
        sys.exit(1)
cu_hang = cu.get("co_so", []) if isinstance(cu, dict) else (cu or [])
print(f"\nmốc so sánh: {len(cu_hang)} cơ sở trong {os.path.basename(OUT)}")

NHAT_KY = os.path.join(RAW, "yt_lenh_theo_ngay.json")
NGAY = ngay_pacific()
_nk = doc_nhat_ky(NHAT_KY)
da_dung_hom_nay = int(_nk.get(NGAY, 0))

du_kien = sum(len(t) for _, t in NHOM)
print(f"dự kiến {du_kien} lệnh search · {du_kien * 100 + du_kien} đơn vị")
if da_dung_hom_nay:
    print(f"⚠ khoá này đã dùng {da_dung_hom_nay} lệnh search HÔM NAY"
          f" (ngày Pacific {NGAY}) theo {os.path.basename(NHAT_KY)}")
    print(f"  còn ~{TRAN_LENH_SEARCH - da_dung_hom_nay}/{TRAN_LENH_SEARCH} lệnh.")
if da_dung_hom_nay + du_kien > TRAN_LENH_SEARCH:
    print(f"\nDỪNG: {da_dung_hom_nay} + {du_kien} vượt trần {TRAN_LENH_SEARCH}"
          " lệnh/ngày.\nHạn mức cấp lại sau 15:00 giờ Việt Nam."
          " Không chạy dở để rồi mất kết quả.")
    sys.exit(0)
print()

don_vi_dung = 0
lenh_search = 0


def goi(api, params):
    global don_vi_dung, lenh_search
    u = api + "?" + urllib.parse.urlencode(dict(params, key=khoa))
    with urllib.request.urlopen(u, timeout=40) as r:
        dv, ls = chi_phi(api)       # HAI han muc — xem yt_chung.chi_phi
        don_vi_dung += dv
        lenh_search += ls
        return json.load(r)


nhac_kenh = defaultdict(set)
nhac_video = defaultdict(set)
tu_truy_van = defaultdict(set)
the_cua = defaultdict(set)
loi = []
dung_het = False

for ten_nhom, truy_vans in NHOM:
    if dung_het:
        break
    print(f"── {ten_nhom} · {len(truy_vans)} truy vấn ──")
    for q in truy_vans:
        if lenh_search >= TRAN_LENH_SEARCH - da_dung_hom_nay:
            print("   (dừng: cạn ngân sách lệnh search của ngày)")
            dung_het = True
            break
        try:
            d = goi(S_API, {"part": "snippet", "type": "video", "maxResults": MAX_KQ,
                            "q": q, "relevanceLanguage": "vi"})
            ids = [i["id"]["videoId"] for i in d.get("items", [])]
            if not ids:
                print(f"   {q[:44]:46s} 0 video")
                continue
            d2 = goi(V_API, {"part": "snippet", "id": ",".join(ids)})
            n_khop = 0
            for it in d2.get("items", []):
                vid, kenh = it["id"], it["snippet"].get("channelId")
                sn = it["snippet"]
                # KHOP TUNG TRUONG RIENG, KHONG GOP CHUOI. Noi hai truong bang
                # mot dau cach tao ra ke lien ky tu khong ton tai trong truong
                # nao, nen moi khop vat qua ke la khop BIA. Da do duoc ben lop
                # an uong: mot trong chin video la ao.
                truong = [t for t in (fold(sn.get("title", "")),
                                      fold(sn.get("description", ""))) if t]
                if not truong:
                    continue
                the_video = {t for t, cums in THE.items()
                             for tr in truong if any(fold(c) in tr for c in cums)}
                for n in biz:
                    if not any(next(tim_cum(t, n), None) is not None for t in truong):
                        continue
                    nhac_kenh[n].add(kenh)
                    nhac_video[n].add(vid)
                    tu_truy_van[n].add(q)
                    the_cua[n] |= the_video
                    n_khop += 1
            print(f"   {q[:44]:46s} {len(ids):2d} video · {n_khop} lượt khớp")
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            reason, msg = ly_do_403(body)
            loi.append((q, e.code, reason))
            print(f"   {q[:44]:46s} LỖI {e.code} · {reason or '?'}")
            if e.code in (403, 429):
                print(f"      {msg}")
                if reason in LY_DO_HAN_MUC or not reason:
                    print("      Hết hạn mức ngày — DỪNG. Cấp lại sau 15:00 giờ VN.")
                else:
                    print("      KHÔNG phải hết hạn mức — KHOÁ có vấn đề"
                          f" ({reason}). Chờ mai KHÔNG sửa được;"
                          " tạo lại khoá ở console.cloud.google.com.")
                dung_het = True
                break
        except Exception as e:
            loi.append((q, type(e).__name__, ""))
            print(f"   {q[:44]:46s} LỖI {type(e).__name__}")
        time.sleep(0.3)
    print()

# ── Loc theo nguong va xuat ────────────────────────────────────────────────
# Nguong dem KENH, khong dem VIDEO. `search.list` thien vi noi dung nhoi tu
# khoa ("Top 10 khách sạn Đà Lạt"), nen mot kenh dang nhieu video — hoac mot
# trang farm reup mot danh sach — tu thoa ">=2 video" voi ZERO chung thuc doc
# lap. Nguong phai dem TAC NHAN doc lap, vi artifact thi nhan ban re.
out = []
for n, kenhs in nhac_kenh.items():
    if len(kenhs) < MIN_KENH:
        continue
    r = biz[n]
    out.append({
        "ten": r["ten"], "loai": r.get("loai"), "tang": r["tang"],
        "dia_chi": r.get("dia_chi"), "dien_thoai": r.get("dien_thoai"),
        "so_phong": r.get("so_phong"),
        # Sweep KHONG chia bac gia — `an_ngu_data.BAC_GIA` lam viec do luc
        # render. Mot nguong gia nam o hai noi la mot nguong se lech.
        "gia_min": r.get("gia_min"), "gia_max": r.get("gia_max"),
        "co_gia_cong_bo": r.get("gia_min") is not None,
        "tham_dinh": r.get("tham_dinh"),
        "lat": r.get("lat"), "lon": r.get("lon"),
        "so_kenh_nhac": len(kenhs), "so_video_nhac": len(nhac_video[n]),
        "the_phong_cach": sorted(the_cua[n]),
        "truy_van": sorted(tu_truy_van[n]),
    })
out.sort(key=lambda r: (-r["so_kenh_nhac"], -r["so_video_nhac"], r["ten"]))
goi_ra = {"phien_ban": PHIEN_BAN, "co_so": out}

# ── Ghi, voi ban chong ghi de ──────────────────────────────────────────────
# Nguon du lieu do theo NGAY thi mot lan chay dut giua duong la chuyen BINH
# THUONG, phai thiet ke cho no — khong phai mot ngoai le. Mot ket qua NGHEO
# HON khong duoc thay ket qua giau hon chi vi no MOI hon.
#
# ⚠ LAN CHAY DAU TIEN cung phai duoc bao ve. Ban dau dieu kien co `cu is not
# None`, nghia la khi CHUA co file thi khong co moc so sanh nen no ghi thang —
# va mot lan chay dut giua duong luc do de lai file chinh NGHEO, roi chinh file
# do thanh moc cho lan sau. Do la dung lop loi ma ban ve nay sinh ra de chan,
# chi dich sang bien. Coi "chua co file" la moc 0 dong thi lo hong bien mat:
# 0 <= 0 nen mot lan chay loi khong thu duoc gi se di vao file phu.
moc = len(cu_hang)
if loi and len(out) <= moc:
    bak = OUT.replace(".json", f".dorang-{len(out)}coso.json")
    luu_json(bak, goi_ra)
    print(f"⚠ Lần chạy này DỞ ({len(loi)} truy vấn lỗi) và chỉ thu {len(out)}"
          f" cơ sở, ít hơn {len(cu_hang)} đã có. KHÔNG ghi đè.")
    print(f"  Kết quả dở lưu riêng ở: {bak}")
    out = cu_hang
    da_luu_vao = bak
else:
    luu_json(OUT, goi_ra)
    da_luu_vao = OUT
ghi_nhat_ky(NHAT_KY, _nk, NGAY, lenh_search)

duoi_nguong = sum(1 for v in nhac_kenh.values() if len(v) < MIN_KENH)
print("═" * 62)
print(f"{len(out)} cơ sở đạt ngưỡng ≥{MIN_KENH} KÊNH · {duoi_nguong} cơ sở chỉ"
      " 1 kênh (đã loại, KHÔNG hạ ngưỡng để lấp)")
print(f"hạn mức: {lenh_search} lệnh search (+{da_dung_hom_nay} đã dùng hôm nay)"
      f" / {TRAN_LENH_SEARCH} · {don_vi_dung}/{TRAN_DON_VI} đơn vị")
co_gia = sum(1 for r in out if r.get("co_gia_cong_bo"))
print(f"trong đó {co_gia} cơ sở CÓ giá công bố (tầng A) ·"
      f" {len(out) - co_gia} chưa có giá công bố")
if loi:
    print(f"lỗi: {len(loi)} truy vấn — {loi[:3]}")

print(f"\n{'Cơ sở':38} {'Kênh':>4} {'Video':>5}  Giá/đêm · Thẻ")
for r in out[:30]:
    g = (f"{r['gia_min']:,}–{r['gia_max']:,}đ".replace(",", ".")
         if r.get("co_gia_cong_bo") else "chưa công bố giá")
    the = (" · " + ", ".join(r["the_phong_cach"])) if r.get("the_phong_cach") else ""
    print(f"{r['ten'][:36]:38} {r['so_kenh_nhac']:4} {r['so_video_nhac']:5}  {g}{the}")

print(f"\nsaved -> {da_luu_vao}")
print("raw/ chỉ chứa tên cơ sở, số kênh, số video, thẻ — không tên kênh,"
      " tiêu đề, mô tả, ID video.")
