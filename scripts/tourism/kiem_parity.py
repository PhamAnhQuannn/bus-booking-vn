# -*- coding: utf-8 -*-
"""Kiem HAI BAN DAU RA co khop nhau khong. Exit 1 neu lech.

VI SAO CAN. Du an nay co quy tac "mot nguon chon loc, hai nguon dinh dang" —
nhung khong co gi kiem tra rang quy tac do dang duoc tuan thu. Va no da bi pha
hai lan, ca hai lan im lang:

  1. Khoi phu luc xuat xu duoc viet TRUC TIEP trong build_huong_dan.py, nen no
     khong bao gio den duoc ban .docx. Do duoc: 32 link Facebook, 21 luot
     check-in, 4 ti le de xuat va ca bang thu hang co trong .md, BANG KHONG
     trong .docx — trong khi nam truong do da bi bo khoi the cua ca hai ban.
     Ban .docx mat trang du lieu.
  2. Muc 12/13 xep hang bang hai cong thuc khac nhau: `.md` theo `_score`,
     `.docx` theo `(-len(src), -conf)`, vi `guide_data.json` loc bo moi khoa bat
     dau bang `_`. Hai ban bat dong ve THU TU GOI DIEN xac minh tu hang thu 9.

Ca hai chi lo ra khi so hai file BANG TAY. Bo kiem nay lam viec do tu dong.

No doc DUY NHAT hai file dau ra — khong import bo dung, khong doc du lieu goc —
nen no khong the lech theo cung mot loi voi thu no dang kiem.

Chay:  python scripts/tourism/kiem_parity.py [duong-md] [duong-docx]
"""
import io
import re
import sys

MD = sys.argv[1] if len(sys.argv) > 1 else \
    "documentation/tourism/destinations/da-lat/huong-dan-diem-den.md"
DOCX = sys.argv[2] if len(sys.argv) > 2 else "docs/Huong-Dan-Da-Lat.docx"

loi = []


def sai(muc, a, b, ghi=""):
    loi.append((muc, a, b, ghi))


md = io.open(MD, encoding="utf-8").read()
try:
    from docx import Document
except ImportError:
    print("khong co python-docx — khong kiem duoc")
    sys.exit(0)
d = Document(DOCX)
dx_para = [p.text for p in d.paragraphs]
dx_cell = [c.text for t in d.tables for r in t.rows for c in r.cells]
dx = "\n".join(dx_para + dx_cell)


def fold(s):
    """Bo dau va ha chu de so tieu de: hai bo dung viet hoa khac nhau
    ("DANH SÁCH ĐIỂM ĐẾN" vs "Danh sách điểm đến") — do la dinh dang, khong
    phai noi dung, nen khong tinh la lech."""
    import unicodedata
    s = unicodedata.normalize("NFD", (s or "").lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn").strip()


# ── 1. tieu de muc cap 1, dung thu tu ──────────────────────────────────────
md_h = [l[3:].strip() for l in md.split("\n") if l.startswith("## ")]
dx_h = [p.text.strip() for p in d.paragraphs if p.style.name == "Heading 1"]
if len(md_h) != len(dx_h):
    sai("so muc cap 1", len(md_h), len(dx_h))
for i in range(min(len(md_h), len(dx_h))):
    a, b = fold(md_h[i]), fold(dx_h[i])
    # So 18 ky tu dau: du de bat lech so muc va lech ten, bo qua phan duoi
    # ngoac dai khac nhau giua hai dinh dang.
    if a[:18] != b[:18]:
        sai(f"tieu de muc #{i}", md_h[i][:40], dx_h[i][:40])

# ── 2. tap tham chieu "muc N" ──────────────────────────────────────────────
# Neu mot ban doi so muc ma ban kia khong doi, tap nay lech ngay.
md_ref = sorted({int(x) for x in re.findall(r"mục (\d+)", md)})
dx_ref = sorted({int(x) for x in re.findall(r"mục (\d+)", dx)})
if md_ref != dx_ref:
    sai("tap tham chieu 'muc N'", md_ref, dx_ref)

# Moi tham chieu phai tro den mot muc CO THAT.
so_muc = {int(m.group(1)) for h in md_h
          for m in [re.match(r"(\d+)\.", h)] if m}
for n in md_ref:
    if n not in so_muc:
        sai("tham chieu tro vao muc khong ton tai", f"mục {n}", sorted(so_muc))

# ── 3. cac khoi phai co o CA HAI ban ──────────────────────────────────────
KHOI = [("phu luc nghien cuu", "Trang Facebook", 1),
        ("luot check-in", "Lượt check-in", 1),
        ("ti le de xuat", "Tỉ lệ đề xuất", 1),
        ("thu hang du lieu", "Ưu tiên xác minh trước", 1),
        ("khoi khu vuc", "Lưu trú & ăn uống trong khu vực", 9),
        ("tro ve khoi khu vuc", "xem khối đầu khu vực", 36),
        ("canh bao website", "Website đã lưu", 8),
        ("lop dia hinh", "Độ nhô", 1)]
for ten, chuoi, toi_thieu in KHOI:
    a, b = md.count(chuoi), dx.count(chuoi)
    if a == 0 or b == 0:
        sai(f"khoi '{ten}' chi co o mot ban", f".md={a}", f".docx={b}")
    elif a < toi_thieu or b < toi_thieu:
        sai(f"khoi '{ten}' it hon mong doi ({toi_thieu})", f".md={a}", f".docx={b}")

# ── 4. thu tu goi dien — dung thu hai ban tung bat dong ───────────────────
md_goi = re.findall(r"\| \d+ \| (DL-\d\d) ·", md.split("theo thứ tự ưu tiên")[-1])
dx_goi = []
for t in d.tables:
    if [c.text.strip() for c in t.rows[0].cells][:3] == ["#", "Điểm", "Điện thoại"]:
        dx_goi = [m.group(1) for r in t.rows[1:]
                  for m in [re.match(r"(DL-\d\d)", r.cells[1].text.strip())] if m]
if not md_goi or not dx_goi:
    sai("khong doc duoc danh sach goi dien", bool(md_goi), bool(dx_goi))
elif md_goi != dx_goi:
    k = next((i for i, (x, y) in enumerate(zip(md_goi, dx_goi)) if x != y), 0)
    sai(f"thu tu goi dien lech tu hang {k+1}", md_goi[:6], dx_goi[:6])

# ── 5. day so A.x lien tuc tu A.1, o CA HAI ban ───────────────────────────
def day_so_md(txt):
    ra, cur = [], []
    for ln in txt.split("\n"):
        if ln.startswith("#### DL-"):
            if cur:
                ra.append(cur)
            cur = []
        m = re.match(r"\*\*A\.(\d+) — ", ln.lstrip())
        if m:
            cur.append(int(m.group(1)))
    if cur:
        ra.append(cur)
    return ra


for nhan, days in (("md", day_so_md(md)),
                   ("docx", [[int(m.group(1)) for r in t.rows
                              for m in [re.match(r"A\.(\d+) — ", r.cells[0].text.strip())]
                              if m] for t in d.tables])):
    xau = [x for x in days if x and x != list(range(1, len(x) + 1))]
    if xau:
        sai(f"day so A.x khong lien tuc ({nhan})", len(xau), xau[:2])

# ── 6. rating phai VANG o ca hai ban ──────────────────────────────────────
for nhan, txt in (("md", md), ("docx", dx)):
    n = txt.count("Đánh giá:")
    if n:
        sai(f"co truong danh gia ({nhan}) — bi chan boi giay phep luu tru", n, 0)

# ── ket qua ───────────────────────────────────────────────────────────────
print(f"{MD}\n{DOCX}\n")
print(f"muc cap 1: {len(md_h)} / {len(dx_h)}   ·   tham chieu: {md_ref}")
if not loi:
    print("\nKHOP — hai ban dau ra khong lech o diem nao duoc kiem.")
    sys.exit(0)
print(f"\nLECH {len(loi)} diem:\n")
for muc, a, b, _ in loi:
    print(f"  {muc}")
    print(f"      .md   {a}")
    print(f"      .docx {b}")
sys.exit(1)
