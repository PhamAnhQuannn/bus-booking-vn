# -*- coding: utf-8 -*-
"""Ban .docx cua huong dan diem den Da Lat.

Doc raw/guide_data.json do build_huong_dan.py xuat ra — MOT lan chon, MOT lan
hop nhat, hai dinh dang dau ra. Khong lam lai logic chon/hop nhat o day.

Word lam duoc mot viec Markdown khong lam duoc: TO MAU. Ca gia tri cua tai lieu
nay nam o cho [CHƯA XÁC MINH] khong the bo qua duoc — mau do lam duoc dieu do,
chu **in dam** thi khong.
"""
import json, os, sys, io
from collections import Counter, defaultdict
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hoat_dong_data as _hoat_dong   # CUNG module chon loc voi ban .md

RAW, OUT = sys.argv[1], sys.argv[2]
G = json.load(io.open(os.path.join(RAW, "guide_data.json"), encoding="utf-8"))
picked, NEAR, mat = G["picked"], G["near"], G["matrix"]
BUILD_DATE = G["build_date"]
byid = {r["id"]: r for r in picked}
UNV = "[CHƯA XÁC MINH]"

# lop lam giau — doc cung mot file enrichment.json nhu ban .md
_ep = os.path.join(RAW, "enrichment.json")
ENR = {}
if os.path.exists(_ep):
    for _e in json.load(io.open(_ep, encoding="utf-8")):
        ENR.setdefault(_e["id"], {}).setdefault(_e["field"], _e)


def ev(pid, field, tail=""):
    e = ENR.get(pid, {}).get(field)
    if not e:
        return UNV + tail
    return str(e["value"])


def has(pid, field):
    return field in ENR.get(pid, {})

RED = RGBColor(0xC0, 0x1C, 0x1C)        # chua xac minh — cam noi ra
AMBER = RGBColor(0xB0, 0x6A, 0x00)      # suy dien — phai rao
GREY = RGBColor(0x5A, 0x5A, 0x5A)       # da xac minh — nguon va ngay
INK = RGBColor(0x1A, 0x1A, 0x1A)


# Tai lieu chi danh cho nguoi doc tieng Viet. Ten dia diem trong nguon co the
# kem chu Han/Hangul/Kana/Kirin (vd "Thiên Vương Cổ Sát Chùa Tàu - 大叻市 天王古剎").
# Do la du lieu that, nhung khong danh cho doc gia nay.
_FOREIGN = __import__("re").compile(r"[가-힯一-鿿぀-ヿЀ-ӿ]+")


def vn_only(s):
    """Bo chu ngoai (Han, Hangul, Kana, Kirin). Giu tieng Viet va chu Latin."""
    s = _FOREIGN.sub("", str(s or ""))
    s = __import__("re").sub(r"\s{2,}", " ", s)
    return s.strip(" ,-·/")

doc = Document()
st = doc.styles["Normal"]
st.font.name = "Calibri"
st.font.size = Pt(10)


def shade(cell, hexcolor):
    el = OxmlElement("w:shd")
    el.set(qn("w:val"), "clear")
    el.set(qn("w:fill"), hexcolor)
    cell._tc.get_or_add_tcPr().append(el)


def H(t, lvl=1):
    return doc.add_heading(t, level=lvl)


def P(t="", bold=False, italic=False, size=10, color=None):
    p = doc.add_paragraph()
    r = p.add_run(t)
    r.bold, r.italic = bold, italic
    r.font.size = Pt(size)
    r.font.color.rgb = color or INK
    return p


def B(t):
    doc.add_paragraph(t, style="List Bullet")


def value_run(par, text):
    """To mau theo muc tin cay. Day la ly do ban .docx ton tai."""
    if text.startswith(UNV):
        r = par.add_run(UNV)
        r.bold = True
        r.font.color.rgb = RED
        r.font.size = Pt(9.5)
        rest = text[len(UNV):]
        if rest:
            r2 = par.add_run(rest)
            r2.italic = True
            r2.font.size = Pt(8.5)
            r2.font.color.rgb = RED
        return
    head, tag = text, ""
    for mark in ():
        if mark in text:
            i = text.index(mark)
            head, tag = text[:i], text[i:]
            break
    if head:
        r = par.add_run(head)
        r.font.size = Pt(9.5)
        r.font.color.rgb = INK
    if tag:
        r = par.add_run(tag)
        r.font.size = Pt(8)
        r.italic = True
        r.font.color.rgb = AMBER if tag.startswith("[SUY RA") else GREY


def field_table(rows_spec):
    """rows_spec: ('group', title) | ('f', nhan, gia tri) | ('note', text)

    Chi giu truong DA XAC MINH: moi dong co gia tri [CHƯA XÁC MINH] bi bo, va nhom
    nao khong con dong nao thi bo luon tieu de nhom.
    """
    kept = [x for x in rows_spec if not (x[0] == "f" and str(x[2]).startswith(UNV))]
    out = []
    for i, x in enumerate(kept):
        if x[0] == "group":
            nxt = kept[i + 1] if i + 1 < len(kept) else None
            if nxt is None or nxt[0] == "group":
                continue
        out.append(x)
    rows_spec = out
    t = doc.add_table(rows=0, cols=2)
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.LEFT
    for spec in rows_spec:
        cells = t.add_row().cells
        if spec[0] == "group":
            cells[0].merge(cells[1])
            c = t.rows[-1].cells[0]
            c.text = ""
            r = c.paragraphs[0].add_run(spec[1])
            r.bold = True
            r.font.size = Pt(9.5)
            shade(c, "E8EDF3")
            continue
        if spec[0] == "note":
            cells[0].merge(cells[1])
            c = t.rows[-1].cells[0]
            c.text = ""
            r = c.paragraphs[0].add_run(spec[1])
            r.italic = True
            r.font.size = Pt(8.5)
            r.font.color.rgb = RED
            shade(c, "FDF2F2")
            continue
        cells[0].text = ""
        r = cells[0].paragraphs[0].add_run(spec[1])
        r.font.size = Pt(9)
        r.font.color.rgb = GREY
        cells[0].width = Cm(4.6)
        cells[1].text = ""
        value_run(cells[1].paragraphs[1] if False else cells[1].paragraphs[0], spec[2])
        cells[1].width = Cm(11.4)
    doc.add_paragraph()
    return t


def TBL(headers, data, widths=None, size=8.5):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Light Grid Accent 1"
    for i, h in enumerate(headers):
        c = t.rows[0].cells[i]
        c.text = ""
        r = c.paragraphs[0].add_run(h)
        r.bold = True
        r.font.size = Pt(size)
    for row in data:
        cs = t.add_row().cells
        for i, v in enumerate(row):
            cs[i].text = ""
            r = cs[i].paragraphs[0].add_run(str(v))
            r.font.size = Pt(size)
    if widths:
        for rr in t.rows:
            for i, wd in enumerate(widths):
                rr.cells[i].width = Cm(wd)
    doc.add_paragraph()
    return t


# ==================================================== bia + quy tac doc
H("HƯỚNG DẪN ĐIỂM ĐẾN ĐÀ LẠT", 0)
P(f"Hồ sơ chi tiết {len(picked)} điểm đến · sinh tự động ngày {BUILD_DATE}", italic=True, size=11)
P("Nguồn: OpenStreetMap · Overture Maps · Foursquare OS · Wikidata · OSRM · "
  "đăng ký lưu trú Cục Du lịch Quốc gia", italic=True, size=9, color=GREY)

H("0. QUY TẮC ĐỌC — BẮT BUỘC", 1)
P("QUAN TRỌNG — tài liệu này CHỈ liệt kê những trường ĐÃ XÁC MINH. "
  "Một trường KHÔNG xuất hiện trong hồ sơ nghĩa là CHƯA BIẾT, không phải là “không có”. "
  "Không được suy đoán giá trị cho trường vắng mặt.", bold=True, color=RED)
P("Ba điều tuyệt đối không được làm:", bold=True)
B("KHÔNG thay [CHƯA XÁC MINH] bằng một giá trị thường gặp. “Giờ mở cửa 08:00–17:00” là hình "
  "dạng của một giờ mở cửa, không phải giờ mở cửa của nơi này.")
B("KHÔNG suy ra giá vé, giờ mở cửa, thời lượng thăm hay mức độ dễ đi lại từ loại hình. "
  "Chỉ ba suy diễn được duyệt: trong nhà/ngoài trời, link bản đồ, điểm lân cận.")
B("KHÔNG viết mô tả, “lý do nên đến” hay “điểm nhấn” — tài liệu cố ý KHÔNG sinh "
  "những mục đó vì mọi chữ trong đó sẽ là bịa. Mục 3 có liệt kê hoạt động, và đó "
  "không phải ngoại lệ: mỗi hoạt động ở đó gắn với một cơ sở, một điểm trong danh "
  "mục, hoặc một đơn vị tổ chức cụ thể. Được nói “ở Đà Lạt có hái dâu tại vườn, đây "
  "là các vườn”; không được nói “Đà Lạt lãng mạn, hợp cho các cặp đôi”.")
P("Nhịp độ mặc định (chuyến thư giãn): tối đa 4 điểm/ngày · tối đa 2 giờ di chuyển/ngày · "
  "mỗi ngày chừa một khoảng trống.", bold=True)
P("Bay flycam: mặc định COI NHƯ BỊ CẤM trừ khi có xác nhận ngược lại. Sai theo hướng an toàn "
  "thì mất một tấm ảnh; sai theo hướng kia thì khách bị phạt.", bold=True, color=RED)

# ==================================================== 1. tong quan
H("1. Tổng quan điểm đến", 1)
TBL(["Mục", "Giá trị"],
    [["Thành phố", "Đà Lạt, tỉnh Lâm Đồng"],
     ["Số điểm trong hồ sơ", str(len(picked))],
     ["Kho dữ liệu đầy đủ", "diem-tham-quan.md — 1.361 điểm"],
     ["Thời tiết theo tháng", UNV],
     ["Lịch lễ hội", UNV],
     ["Ảnh hưởng Tết", UNV + " — nhiều nơi đóng cửa, giá tăng mạnh"],
     ["Đi lại tới Đà Lạt", UNV + " — chưa thu thập tuyến xe / máy bay"],
     ["Phương tiện tại chỗ", UNV + " — chưa thu thập giá thuê xe / taxi"]],
    widths=[5.0, 11.0], size=9)
P("⚠ Năm hàng cuối là khoảng trống có thật, không phải lỗi hiển thị. Một lịch trình không biết "
  "khách tới bằng gì và đi lại bằng gì thì chưa phải một lịch trình.", bold=True, color=RED)

# ==================================================== 2. ho so tung diem
doc.add_page_break()
H("2. Danh sách điểm đến", 1)
P("Thứ tự các mục trong mỗi hồ sơ là cổng lọc trước, mô tả sau: nhận dạng → khả năng tiếp cận "
  "→ kế hoạch thăm → giờ giấc. Một ràng buộc về đi lại loại bỏ địa điểm trước khi chi tiết "
  "chụp ảnh có ý nghĩa gì.", italic=True)

INDOOR_NOTE = {"trong nhà": "không gian trong nhà", "có mái": "phần lớn có mái che",
               "hỗn hợp": "vừa có mái vừa ngoài trời", "ngoài trời": "địa hình ngoài trời"}
cur_area = None
for r in picked:
    if r["area"] != cur_area:
        cur_area = r["area"]
        doc.add_page_break()
        H(f"Khu vực: {cur_area}", 2)
    H(f"{r['id']} · {r['name']}", 3)
    srcs = "+".join(r["src"])
    spec = [("group", "A.1 — Nhận dạng"),
            ("f", "Tên", r["name"]),
            ("f", "Tên khác", ", ".join(vn_only(x) for x in (r.get("alt") or []) if vn_only(x)) or UNV),
            ("f", "Loại hình", r["loai_vn"]
             + (f" (phụ: {', '.join(r['loai_phu'])})" if r.get("loai_phu") else "")
             ),
            ("f", "Địa chỉ", ev(r["id"], "dia_chi_day_du")),
            ("f", "Điện thoại", r.get("tel") or UNV),
            ("f", "Website", r.get("web") or UNV),
            ("f", "Tình trạng hoạt động", "đang hoạt động")]
    # Muc do pho bien de o day, KHONG phai o "Danh gia cua khach" — ti le de
    # xuat cua Facebook la thang do khac, khong quy doi sang sao duoc.
    for _lab, _k in (("Email", "email"),
                     ("Ảnh (tự do bản quyền)", "anh"),
                     ("Website chính thức", "website_chinh_thuc"),
                     ("⚠ Website đã lưu", "canh_bao_website"),
                     ("Kiểm tra trang web", "kiem_tra_website"),
                     ("Trang Facebook", "trang_facebook"),
                     ("Email (Facebook)", "email_facebook"),
                     ("Lượt check-in", "luot_checkin"),
                     ("Người theo dõi FB", "nguoi_theo_doi"),
                     ("Tỉ lệ đề xuất (FB)", "ty_le_gioi_thieu")):
        if has(r["id"], _k):
            spec.append(("f", _lab, ev(r["id"], _k)))
    spec += [
            ("group", "A.11 — Tiện nghi tại chỗ  ·  cổng lọc đầu tiên")]
    _fac = [("Nhà vệ sinh", "nha_ve_sinh"), ("Bãi đỗ xe", "bai_do_xe"),
            ("Chỗ ngồi nghỉ", "cho_ngoi"), ("Hàng ăn", None), ("Hàng nước", "nuoc_uong"),
            ("Quà lưu niệm", "qua_luu_niem"), ("Hướng dẫn viên", None),
            ("Quầy thông tin", "quay_thong_tin"), ("Lối cho xe lăn", "loi_xe_lan"),
            ("Sơ cứu y tế", "so_cuu")]
    _nf = 0
    for _lab, _k in _fac:
        if _k and has(r["id"], _k):
            _nf += 1
            spec.append(("f", _lab, ev(r["id"], _k)))
        else:
            spec.append(("f", _lab, UNV))
    if has(r["id"], "wifi"):
        spec.append(("f", "Wifi", ev(r["id"], "wifi")))
    ind = None
    for lab, note in INDOOR_NOTE.items():
        pass
    from_cat = {"Bảo tàng": "trong nhà", "Nghệ thuật / Triển lãm": "trong nhà",
                "Chợ / Mua sắm": "có mái", "Nhà thờ": "có mái",
                "Chùa / Thiền viện": "hỗn hợp", "Dinh thự / Di tích": "hỗn hợp",
                "Khu vui chơi": "hỗn hợp", "Thác nước": "ngoài trời", "Hồ / Đập": "ngoài trời",
                "Công viên / Vườn hoa": "ngoài trời", "Điểm ngắm cảnh": "ngoài trời",
                "Núi / Đèo / Đường mòn": "ngoài trời", "Nông trại / Vườn": "ngoài trời",
                "Cáp treo": "ngoài trời"}
    ind = from_cat.get(r["loai_vn"])
    spec += [("group", "A.9 — Kế hoạch thăm"),
             ("f", "Thời lượng thăm", UNV + " ← không có mục này thì không xếp được lịch một ngày"),
             ("f", "Thời điểm tốt trong ngày", UNV),
             ("f", "Mùa tốt nhất", UNV),
             ("f", "Trong nhà / ngoài trời",
              ind if ind else UNV),
             ("f", "Quãng đi bộ", UNV),
             ("f", "Độ khó", UNV),
             ("f", "Phù hợp trẻ nhỏ", UNV),
             ("f", "Phù hợp người cao tuổi", UNV),
             ("group", "A.3 — Giờ giấc và chi phí"),
             ("f", "Ngày mở cửa", UNV),
             ("f", "Giờ mở cửa", r["hours"] if r.get("hours")
              else ev(r["id"], "gio_mo_cua")),
             ("f", "Giờ nhận khách cuối", UNV),
             ("f", "Giá vé", (str(r["fee"])) if r.get("fee")
              else UNV + " ← KHÔNG nêu số tiền; nói giá có thể thay đổi"),
             ("f", "Phí gửi xe", UNV),
             ("f", "Cần đặt trước", ev(r["id"], "can_dat_truoc"))]
    if has(r["id"], "gia_ve_tham_khao"):
        spec.append(("f", "Giá vé THAM KHẢO", ev(r["id"], "gia_ve_tham_khao")))
    if has(r["id"], "khoang_gia_facebook"):
        spec.append(("f", "Khoảng giá (Facebook)",
                     ev(r["id"], "khoang_gia_facebook") + "  (thang 4 bậc, chủ cơ sở tự khai)"))
    if has(r["id"], "gia_ve_ghi_chu"):
        spec.append(("f", "Ghi chú giá vé", ev(r["id"], "gia_ve_ghi_chu")))
    if r.get("csdl_gia_min"):
        g = f"{r['csdl_gia_min']:,}".replace(",", ".")
        if r.get("csdl_gia_max") and r["csdl_gia_max"] != r["csdl_gia_min"]:
            g += "–" + f"{r['csdl_gia_max']:,}".replace(",", ".")
        spec.append(("f", "Giá phòng (lưu trú)", f"{g}₫/đêm"))
    spec.append(("group", "A.12 — Lưu ý quan trọng"))
    for f_ in ("Trang phục", "Giày dép", "Lưu ý thời tiết", "An toàn", "Giờ đông khách",
               "Nên mang theo", "Điều cấm"):
        spec.append(("f", f_, UNV))
    spec += [("group", "A.4 — Vị trí và di chuyển"),
             ("f", "Từ hồ Xuân Hương",
              f"{r['km']:.1f} km · {r['min']:.0f} phút"
              if r.get("min") is not None else UNV),
             ("f", "Từ khách sạn", "→ thuộc hồ sơ chuyến đi, tính khi biết khách ở đâu"),
             ("f", "Đường chính gần nhất", ev(r["id"], "duong_gan_nhat")),
             ("f", "Tình trạng đường", UNV),
             ("f", "Phương tiện tới được", UNV),
             ("f", "Bãi đỗ xe", UNV),
             ("group", "A.10 — Chụp ảnh")]
    for f_ in ("Điểm chụp đẹp", "Giờ chụp đẹp", "Ngắm bình minh / hoàng hôn",
               "Phí chụp ảnh", "Lưu ý chụp ảnh"):
        spec.append(("f", f_, UNV))
    spec.append(("f", "Bay flycam", "COI NHƯ BỊ CẤM cho tới khi có xác nhận ngược lại"))
    for _lab, _k in (("Năm khánh thành", "nam_khanh_thanh"), ("Năm xây dựng", "nam_xay_dung"),
                     ("Kiến trúc", "kien_truc"), ("Xếp hạng di tích", "xep_hang_di_tich"),
                     ("Tôn giáo", "ton_giao"), ("Diện tích", "dien_tich")):
        if has(r["id"], _k):
            spec.append(("f", _lab, ev(r["id"], _k)))
    field_table(spec)

    if NEAR.get(r["id"]):
        P("A.13 — Điểm lân cận (thời gian đường bộ thật, không phải đường chim bay)", bold=True, size=9.5)
        TBL(["#", "Điểm", "Loại", "Km", "Phút"],
            [[i, f"{oid} · {byid[oid]['name']}", byid[oid]["loai_vn"], f"{dkm:.1f}", f"{tmin:.0f}"]
             for i, (oid, dkm, tmin) in enumerate(NEAR[r["id"]], 1)],
            widths=[1.0, 7.0, 4.0, 2.0, 2.0])

    n_unv = 41 - sum(bool(r.get(k)) for k in ("addr", "tel", "web", "hours", "fee"))
    pv = doc.add_paragraph()
    rr = pv.add_run(f"Kiểm chứng: CHƯA GỌI · khoảng {n_unv} trường còn [CHƯA XÁC MINH] · "
                    f"gọi {r.get('tel') or 'CHƯA CÓ SỐ'} để đóng ~9 trường "
                    "(giờ mở, ngày mở, giá vé, phí gửi xe, đặt trước, thời lượng, flycam, "
                    "nhà vệ sinh, lối xe lăn)")
    rr.bold = True
    rr.font.size = Pt(8.5)
    rr.font.color.rgb = RED

# ==================================================== 3. HOAT DONG
# Cung mot module chon loc voi ban .md — `hoat_dong_data.tai()`. Neu viet lai
# logic cat gon o day thi hai ban se lech nhau va khong ai biet cho toi khi doc
# canh nhau; du an da dinh dung lop loi do (hai bo trich cung payload VNPay).
_HD, _HDTK = _hoat_dong.tai(RAW)
_MON = _hoat_dong.tai_mon_an(RAW)

doc.add_page_break()
H("3. Hoạt động — làm gì ở Đà Lạt", 1)
P(f"{_HDTK['so_hoat_dong']} hoạt động, {_HDTK['so_nhom']} nhóm. Mỗi hoạt động đều có "
  "ít nhất một bằng chứng vật chất — một cơ sở đang hoạt động, một điểm trong danh "
  "mục, hoặc một đơn vị tổ chức. Mã DL-xx dẫn về mục chi tiết ở mục 2.",
  italic=True, size=9, color=GREY)

_nhom_hien = None
for _a in _HD:
    if _a["nhom"] != _nhom_hien:
        _nhom_hien = _a["nhom"]
        H(_nhom_hien.upper(), 2)
    H(_a["ten"], 3)
    if _a["noi"]:
        P(f"Làm ở đâu — {_a['tong_noi']} nơi, in {len(_a['noi'])}:", bold=True, size=9)
        for _n in _a["noi"]:
            B((f"[{_n['ma']}] " if _n["ma"] else "") + _n["ten"]
              + (f" — {_n['khu_vuc']}" if _n.get("khu_vuc") else ""))
    if _a["don_vi"]:
        P(f"Đơn vị tổ chức — {_a['tong_don_vi']} đơn vị, in {len(_a['don_vi'])}:",
          bold=True, size=9)
        for _d in _a["don_vi"]:
            B(_d["ten"] + (f" — {_d['dien_thoai']}" if _d.get("dien_thoai")
                           else " — chưa có số"))
    if _a.get("tour_web"):
        P("Đã đọc trang tour (đã xác minh trang đúng là của đơn vị đó):",
          bold=True, size=9)
        for _t in _a["tour_web"]:
            B(f"{_t['ten']} — {_t['url']}")
            if _t["khoang_gia_don_vi"]:
                _pp = doc.add_paragraph(style="List Bullet 2")
                _rr = _pp.add_run(f"Khoảng giá của cả đơn vị: {_t['khoang_gia_don_vi']}"
                                  " — không phải giá một tour cụ thể; trang liệt kê "
                                  "nhiều tour nên không quy được giá về từng tour")
                _rr.font.size = Pt(8.5)
                _rr.font.color.rgb = AMBER
            for _n in _t["ten_tour"]:
                doc.add_paragraph(_n, style="List Bullet 2")
    if not _a["don_vi"]:
        P("Không cần đơn vị tổ chức — tự đi được.", italic=True, size=9, color=GREY)

if _MON:
    H("ẨM THỰC — MÓN ĐẶC TRƯNG", 2)
    P(f"{sum(m[1] for m in _MON)} quán khớp theo tên món trên {len(_MON)} món. Khớp giữ "
      "nguyên dấu và đòi biên từ — bỏ dấu thì “sữa chua” khớp “sửa chữa”.",
      italic=True, size=9, color=GREY)
    TBL(["Món", "Số quán", "Gợi ý (theo độ tin cậy dữ liệu)"],
        [[_m, str(_sl), " · ".join(q["ten"][:26] for q in _q[:3])]
         for _m, _sl, _q in _MON], widths=[3.2, 1.6, 11.0])

# Ba truong trong. In ra la trong, kem ly do — KHONG in bang cheo mua x hoat dong
# khi moi o deu rong: mot bang trang trong nhu du lieu bi mat.
if _HDTK["thieu"]:
    _ten_vn = {"mua": "mùa trong năm", "gio_trong_ngay": "giờ trong ngày",
               "thoi_luong": "thời lượng"}
    H("Chưa có: " + ", ".join(_ten_vn[k] for k in _HDTK["thieu"]), 2)
    _p = doc.add_paragraph()
    _r = _p.add_run(f"Ba trường này trống trên toàn bộ {_HDTK['so_hoat_dong']} hoạt động, "
                    "và trống vì chưa nguồn nào nói về chúng — không phải vì hoạt động "
                    "diễn ra quanh năm.")
    _r.bold = True
    _r.font.size = Pt(9)
    _r.font.color.rgb = RED
    B("Giờ trong ngày — suy ra được từ giờ mặt trời mọc (đã tính cho 36 điểm ở mục 2); "
      "chưa ghép vào đây.")
    B(f"Thời lượng — phải lấy từ trang tour. Đã thử {_HDTK['tong_website_thu']} website: "
      f"{_HDTK['ten_mien_chet']} tên miền không còn phân giải, các trang còn lại liệt kê "
      "nhiều tour trên một trang nên không quy được thời lượng về từng tour.")
    B(f"Mùa — không nguồn nào trong {_HDTK['tong_website_thu']} website nêu mùa. Mùa hoa "
      "(cỏ hồng, mai anh đào, dã quỳ) cần nguồn tỉnh Lâm Đồng hoặc gọi điện. Để trống, "
      "không đoán.")
    _p2 = doc.add_paragraph()
    _r2 = _p2.add_run(f"Đơn vị tour nhỏ ở Đà Lạt sống trên Facebook, không sống trên "
                      f"website — {_HDTK['ten_mien_chet']}/{_HDTK['tong_website_thu']} "
                      "tên miền đã chết, gồm canyoningdalat.com, dalatjeep.com, "
                      "toursanmaydalat.com. Trước khi tra một đơn vị, tra trang Facebook "
                      "của họ chứ đừng tra tên miền.")
    _r2.bold = True
    _r2.font.size = Pt(9)
    _r2.font.color.rgb = AMBER

# ==================================================== 4-12 chi muc
doc.add_page_break()
H("4. Bảng so sánh", 1)
P("Sinh tự động từ mục 2 — không sửa tay.", italic=True, size=9, color=GREY)
TBL(["ID", "Điểm", "Loại", "Khu vực", "Km", "Phút", "Vé", "Nguồn"],
    [[r["id"], r["name"][:34], r["loai_vn"], r["area"][:20], f"{r['km']:.1f}",
      f"{r['min']:.0f}", r.get("fee") or UNV, len(r["src"])] for r in picked],
    widths=[1.4, 5.0, 3.0, 3.2, 1.2, 1.2, 1.6, 1.2], size=8)

H("5. Theo loại hình", 1)
for k, v in sorted(Counter(r["loai_vn"] for r in picked).items(), key=lambda x: -x[1]):
    P(f"{k} ({v}): " + " · ".join(f"{r['id']} {r['name']}" for r in picked
                                  if r["loai_vn"] == k), size=9)

H("6. Theo khu vực", 1)
for a in sorted({r["area"] for r in picked}):
    lst = [r for r in picked if r["area"] == a]
    P(f"{a} ({len(lst)}): " + " · ".join(f"{r['id']} {r['name']}" for r in lst), size=9)

H("7. Theo khoảng cách từ hồ Xuân Hương", 1)
for lo, hi, lab in ((0, 5, "Dưới 5 km"), (5, 10, "5 – 10 km"),
                    (10, 20, "10 – 20 km"), (20, 9e9, "Trên 20 km")):
    lst = [r for r in picked if lo <= r["km"] < hi]
    P(f"{lab} ({len(lst)}): " + (" · ".join(f"{r['id']} {r['name']} ({r['min']:.0f}′)"
                                            for r in lst) or "—"), size=9)

H("8. Theo thời điểm thăm", 1)
p = doc.add_paragraph()
r_ = p.add_run("Bình minh · sáng · chiều · hoàng hôn · tối: ")
r_.font.size = Pt(9.5)
r_ = p.add_run(UNV)
r_.bold = True
r_.font.color.rgb = RED
r_ = p.add_run(" — trường “thời điểm tốt trong ngày” chưa xác minh cho bất kỳ điểm nào. "
               "Không được xếp lịch theo giờ dựa trên suy đoán.")
r_.font.size = Pt(9.5)
P("Điểm đi được khi trời mưa (suy ra từ loại hình — đã được duyệt):", bold=True)
for lab in ("trong nhà", "có mái", "hỗn hợp"):
    lst = [r for r in picked if from_cat.get(r["loai_vn"]) == lab]
    if lst:
        P(f"  {lab}: " + " · ".join(f"{r['id']} {r['name']}" for r in lst), size=9)

H("9. Tuyến gợi ý theo khu vực", 1)
P("Thứ tự dựng bằng thuật toán láng giềng gần nhất trên ma trận OSRM, xuất phát từ điểm gần "
  "trung tâm nhất.", italic=True, size=9, color=GREY)
if mat:
    idx = {pid: i for i, pid in enumerate(mat["ids"])}
    for a in sorted({r["area"] for r in picked}):
        lst = [r for r in picked if r["area"] == a]
        if len(lst) < 2:
            continue
        cur = min(lst, key=lambda x: x["min"])
        route, left, tot = [cur], [x for x in lst if x is not cur], 0.0
        while left:
            nxt = min(left, key=lambda x: mat["durations"][idx[cur["id"]]][idx[x["id"]]] or 9e9)
            tot += (mat["durations"][idx[cur["id"]]][idx[nxt["id"]]] or 0) / 60.0
            route.append(nxt)
            left.remove(nxt)
            cur = nxt
        P(f"{a} — {len(route)} điểm · di chuyển giữa các điểm ~{tot:.0f} phút", bold=True, size=9.5)
        P("   " + " → ".join(f"{x['id']} {x['name']}" for x in route), size=9)

H("10. Ma trận thời gian giữa các điểm (phút)", 1)
if mat:
    ids = mat["ids"]
    TBL([""] + [i.replace("DL-", "") for i in ids],
        [[ids[i].replace("DL-", "")] +
         ["—" if i == j or mat["durations"][i][j] is None
          else f"{mat['durations'][i][j]/60:.0f}" for j in range(len(ids))]
         for i in range(len(ids))], size=6)

H("11. Danh sách rút gọn", 1)
P("⚠ Xếp hạng dựa trên mức độ hiện diện trên bản đồ, KHÔNG phải chất lượng trải nghiệm — thứ đó "
  "chưa có dữ liệu. Dùng làm thứ tự gọi xác minh, không dùng làm lời khuyên “nơi này hay hơn "
  "nơi kia”.", bold=True, color=RED)
rank = sorted(picked, key=lambda r: (-len(r["src"]), -(r.get("conf") or 0)))
for lab, seg in (("Ưu tiên xác minh trước", rank[:8]), ("Nhóm hai", rank[8:20]),
                 ("Nhóm ba", rank[20:])):
    P(f"{lab} ({len(seg)}): " + " · ".join(f"{r['id']} {r['name']}" for r in seg), size=9)

H("12. Sổ kiểm chứng — việc cần làm", 1)
n_tel = sum(1 for r in picked if r.get("tel"))
TBL(["Chỉ số", "Giá trị"],
    [["Điểm trong hồ sơ", len(picked)],
     ["Có số điện thoại để gọi", f"{n_tel} / {len(picked)}"],
     ["Chưa có số — cần tìm", len(picked) - n_tel],
     ["Có giờ mở cửa", sum(1 for r in picked if r.get("hours"))],
     ["Có giá vé", sum(1 for r in picked if r.get("fee"))],
     ["Có đánh giá sao", "0 — không nguồn mở nào có"],
     ["Trường [CHƯA XÁC MINH] ước tính", f"~{41*len(picked)}"]],
    widths=[7.0, 9.0], size=9)
P("Gọi một cuộc đóng được khoảng 9 trường. Danh sách cần gọi, theo thứ tự ưu tiên:", bold=True)
TBL(["#", "Điểm", "Điện thoại"],
    [[i, f"{r['id']} · {r['name']}", r["tel"]]
     for i, r in enumerate([x for x in rank if x.get("tel")][:20], 1)],
    widths=[1.2, 9.0, 5.0], size=9)

doc.add_page_break()
H("Phụ lục — Tóm tắt độ phủ (đọc lại trước khi trả lời khách)", 1)
P(f"Tài liệu này theo dõi khoảng {41*len(picked)} trường trên {len(picked)} điểm đến. "
  "Phần lớn mang dấu [CHƯA XÁC MINH].")
P("Nếu khách hỏi về một trường mang dấu [CHƯA XÁC MINH] ở bất kỳ đâu phía trên: nói "
  "“chỗ này em chưa có số liệu đã xác minh, để em gọi hỏi rồi báo lại mình”, và KHÔNG đưa ra "
  "con số, giờ giấc hay đánh giá nào thay thế.", bold=True)
P("Ba trường tuyệt đối không được suy đoán, vì sai là khách mất tiền hoặc mất cả ngày:",
  bold=True, color=RED)
B("giờ mở cửa")
B("giá vé")
B("mức độ dễ đi lại cho người cao tuổi")
P("Tài liệu này chứa dữ liệu từ OpenStreetMap. Dữ liệu © những người đóng góp OpenStreetMap, "
  "theo giấy phép Open Database License — https://openstreetmap.org/copyright",
  italic=True, size=8, color=GREY)

doc.save(OUT)
print("saved ->", OUT)
print(f"diem: {len(picked)}  |  co dien thoai: {n_tel}  |  bang: {len(doc.tables)}")
