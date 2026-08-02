# -*- coding: utf-8 -*-
"""Trich truong tu file bang chung Facebook da luu. KHONG cham mang.

Vi sao tach khoi fb_pages_crawl.mts: khau trich SE sai vai lan truoc khi dung
(no da sai ngay lan dau — bat so dien thoai trong doan van thay vi truong co
cau truc). Neu trich nam trong script duyet thi moi lan sua la 35 luot tai
trang. Tach ra thi sua bao nhieu lan cung duoc, doc lai tu dia.

MOT bo trich duy nhat. Script duyet chi tai va luu; moi hieu biet ve dinh dang
trang nam o day. Hai bo trich cho cung mot byte la cach sinh ra lech — du an
nay da dinh dung mot lan (parser VNPay, 26/07).

Chay:  python tourism-kb/code/parse_fb_pages.py <thu-muc-raw>
Doc    raw/pages/fb-*.txt + raw/fb_targets.json + raw/fb_pages.json (URL)
Ghi    raw/fb_pages.json
"""
import json, os, sys, io, re, glob

RAW = sys.argv[1]
PAGES = os.path.join(RAW, "pages")
OUT = os.path.join(RAW, "fb_pages.json")

targets = {t["id"]: t for t in json.load(
    io.open(os.path.join(RAW, "fb_targets.json"), encoding="utf-8"))}
# fb_pages.json cu giu URL cuoi + co chuyen huong khong — do la thu chi luc
# duyet moi biet, khong suy ra duoc tu van ban.
prev = {}
if os.path.exists(OUT):
    prev = {r["id"]: r for r in json.load(io.open(OUT, encoding="utf-8"))}


def che_sdt(s):
    """Che so dien thoai truoc khi in ra man hinh.

    stdout khong phai noi kin. No bi chuyen huong vao file (`> scratch_out.txt`),
    dan vao bao cao, dan vao issue. `.gitignore` phai them han luat
    `/scratch_out*.txt` CHINH VI mot file kieu vay tung chua ten quan, dia chi va
    so dien thoai that — nen day khong phai lo xa, day la duong da di qua mot lan.

    Cai chan doan nay can biet HAI NGUON CO LECH NHAU KHONG, khong can biet con
    so. Giu 4 ky tu dau va 1 ky tu cuoi la du de doi chieu bang mat ma khong
    cong bo so.
    """
    if not s:
        return "—"
    s = str(s)
    return s if len(s) <= 5 else f"{s[:4]}{'x' * (len(s) - 5)}{s[-1]}"


def g(text, pattern, flags=0):
    m = re.search(pattern, text, flags)
    if not m:
        return None
    return (m.group(1) if m.lastindex else m.group(0)).strip()


def digits(s):
    return re.sub(r"\D", "", s or "")


# Dau vet bai dang. Neu con thi file bang chung khong duoc phep dung.
POISON = re.compile(r"(đang ở |\bis at |Bình luận|\bComment\b|Tác giả|Tất cả cảm xúc|All reactions)")


def parse(text):
    d = {}
    d["nhiem_du_lieu_ca_nhan"] = bool(POISON.search(text))
    d["loai_trang"] = ("khong_chinh_thuc"
                       if re.search(r"Unofficial Page|Trang không chính thức", text)
                       else "quan_ly")
    d["danh_muc"] = g(text, r"(?:^|\n)(?:Page|Trang|Profile)\s*·\s*([^\n]+)")
    d["dia_chi_fb"] = g(text, r"\n([^\n]{10,200},\s*(?:Vietnam|Việt Nam))\n")

    # Dien thoai: uu tien DONG CHI CHUA SO — do la truong co cau truc cua
    # Facebook. Bat trong doan van la sai: mot trang trong bo du lieu viet
    # "Liên hệ: 08xx.xxx.xxx hoặc 0263x.xxx.xxx" o phan gioi thieu, va so dau
    # tien khong phai so tong dai; truong co cau truc ben duoi moi la.
    #
    # ⚠ Comment nay TUNG chua so di dong THAT cua mot doanh nghiep co ten, va
    # da duoc commit (a852fd5, 28/07). No lot qua gitleaks vi quy tac PII cua
    # du an la `\+84[35789]\d{8}` — dang `08xx.xxx.xxx` co so 0 dau va dau cham
    # nen khong khop. Vi du minh hoa trong comment phai dung so da che; du lieu
    # that thuoc `tourism-kb/raw/` (da gitignore), khong thuoc ma nguon.
    #
    # (Ban dau chinh dong tren nay viet lai nguyen so that trong luc giai thich
    # vi sao no lot — bat duoc o lan quet cuoi truoc khi commit.)
    d["dien_thoai_fb"] = (g(text, r"\n((?:\+84|0)[\d\s().-]{8,16})\n")
                          or g(text, r"(?:\+84|0)[\d\s().-]{8,14}"))

    d["email_fb"] = g(text, r"[\w.+-]+@[\w-]+\.[\w.]{2,}")
    d["website_fb"] = g(text, r"\n((?:https?://)?[a-z0-9][a-z0-9.-]*\.(?:vn|com|net|org)(?:/[^\s\n]*)?)\n", re.I)
    d["gio_mo_cua_fb"] = g(
        text,
        r"(Always open|Open now[^\n]*|Closed now[^\n]*|Opens? at [^\n]*|Closes? at [^\n]*"
        r"|Open 24 hours|Luôn mở cửa|Đang mở cửa[^\n]*|Đã đóng cửa[^\n]*"
        r"|Mở cửa lúc[^\n]*|Đóng cửa lúc[^\n]*|Mở cửa 24 giờ)", re.I)
    d["khoang_gia_fb"] = g(text, r"(?:Price Range|Mức giá|Khoảng giá)\s*·\s*([^\n]+)", re.I)
    d["ty_le_gioi_thieu"] = g(text, r"(\d+)%\s*(?:recommend|đề xuất|giới thiệu)", re.I)
    d["so_luot_danh_gia"] = g(
        text, r"(?:recommend|đề xuất|giới thiệu)[^\n(]*\((\d[\d,.]*)\s*(?:Review|lượt đánh giá|đánh giá)", re.I)
    d["so_nguoi_theo_doi"] = g(text, r"([\d.,]+[KM]?)\s+(?:followers|người theo dõi)")
    d["so_luot_checkin"] = g(text, r"([\d,.]+)\s+(?:people checked in here|người đã check in tại đây)")
    d["trang_thai_dong_cua"] = g(
        text, r"(Permanently closed|Temporarily closed|Đã đóng cửa vĩnh viễn|Tạm thời đóng cửa)", re.I)
    return d


rows, nhiem = [], []
for path in sorted(glob.glob(os.path.join(PAGES, "fb-*.txt"))):
    pid = os.path.basename(path)[3:-4]
    text = io.open(path, encoding="utf-8").read()
    d = parse(text)
    if d["nhiem_du_lieu_ca_nhan"]:
        nhiem.append(pid)
        continue
    t = targets.get(pid, {})
    p = prev.get(pid, {})
    row = {"id": pid, "ten": t.get("ten"),
           "fb_url_yeu_cau": t.get("fb_url"),
           "fb_url_cuoi": p.get("fb_url_cuoi"),
           "chuyen_huong_id_khac": p.get("chuyen_huong_id_khac", False)}
    row.update(d)
    # Doi chieu doc lap: so Facebook co trung so Overture khong. 9 chu so cuoi
    # de bo qua khac biet +84 / 0 dau so.
    fb, ov = d["dien_thoai_fb"], t.get("dien_thoai_overture")
    row["dien_thoai_khop_overture"] = (
        digits(fb)[-9:] == digits(ov)[-9:] if (fb and ov) else None)
    rows.append(row)

json.dump(rows, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def n(f):
    return sum(1 for r in rows if r.get(f))


ql = sum(1 for r in rows if r["loai_trang"] == "quan_ly")
print(f"{len(rows)} trang doc duoc · quan ly {ql} · khong chinh thuc {len(rows)-ql}")
if nhiem:
    print(f"⛔ BO {len(nhiem)} file con dau vet bai dang: {', '.join(nhiem)}")
print(f"dien thoai {n('dien_thoai_fb')} · email {n('email_fb')} · website {n('website_fb')}"
      f" · dia chi {n('dia_chi_fb')}")
print(f"gio mo cua {n('gio_mo_cua_fb')} · khoang gia {n('khoang_gia_fb')}"
      f" · ty le gioi thieu {n('ty_le_gioi_thieu')} · so danh gia {n('so_luot_danh_gia')}")
print(f"check-in {n('so_luot_checkin')} · theo doi {n('so_nguoi_theo_doi')}"
      f" · dong cua {n('trang_thai_dong_cua')}")

khop = [r for r in rows if r["dien_thoai_khop_overture"] is True]
lech = [r for r in rows if r["dien_thoai_khop_overture"] is False]
print(f"\ndoi chieu dien thoai voi Overture: {len(khop)} khop, {len(lech)} lech")
for r in lech:
    print(f"  LECH {r['id']} {r['ten']}: fb={che_sdt(r['dien_thoai_fb'])}"
          f" ovt={che_sdt(targets.get(r['id'],{}).get('dien_thoai_overture'))}")

nghi = [r for r in rows if r["chuyen_huong_id_khac"]]
if nghi:
    print(f"\n⚠ {len(nghi)} trang chuyen huong sang ID khac — XEM TAY:")
    for r in nghi:
        print(f"  {r['id']} {r['ten']} · theo doi={r['so_nguoi_theo_doi']}"
              f" · web={'co' if r['website_fb'] else '—'}")
print(f"\nsaved -> {OUT}")
