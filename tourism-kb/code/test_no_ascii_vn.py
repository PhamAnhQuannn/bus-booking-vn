# -*- coding: utf-8 -*-
"""test_no_ascii_vn (B1.3) — chặn chuỗi tiếng Việt KHÔNG DẤU lọt ra UI.

Quét các field HIỂN THỊ do pipeline sinh (intro.fact/editorial, mo_ta, phu_hop_voi) trong export.
Heuristic: ≥4 âm tiết VN-không-dấu phổ biến LIỀN nhau → vi phạm (vd "khu trung tam ho xuan huong").
Tên riêng/địa chỉ (name/address) KHÔNG quét (có thể là tiếng Anh hợp lệ). Chạy:
  PYTHONIOENCODING=utf-8 python tourism-kb/code/test_no_ascii_vn.py
"""
import glob
import json
import os
import re

EXPORT = os.path.join(os.path.dirname(__file__), "..", "export")
VN_ASCII = set("""cua va la cho khu trung tam ho phia bac nam dong tay quy uoc uoc khong phai sao gia
cao cap trung binh dan diem den thanh pho tinh duong pho nha hang khach san xuan huong khu vuc nui non
tham quan ngam canh bien dao tam linh lich su van hoa mua sam""".split())


def offending(s):
    run = 0
    for w in re.findall(r"[a-z]+", (s or "").lower()):
        run = run + 1 if w in VN_ASCII else 0
        if run >= 4:
            return True
    return False


def main():
    bad = []
    for f in glob.glob(os.path.join(EXPORT, "*", "diem-den.json")):
        for r in json.load(open(f, encoding="utf-8")):
            ext = (r.get("ext") or {}).get("destination") or {}
            intro = ext.get("intro") or {}
            phv = (ext.get("phu_hop_voi") or {})
            for label, val in (("intro.fact", intro.get("fact")), ("intro.editorial", intro.get("editorial")),
                               ("mo_ta", ext.get("mo_ta")), ("phu_hop_voi", phv.get("value"))):
                if val and offending(val):
                    bad.append(f"{os.path.basename(os.path.dirname(f))}/{r.get('id')} {label}: {val[:70]}")
    if bad:
        print(f"VI PHAM {len(bad)} chuoi VN khong dau ra UI:")
        for b in bad[:30]:
            print("  " + b)
        raise SystemExit(1)
    print("test_no_ascii_vn: 0 vi pham (field hien thi deu co dau).")


if __name__ == "__main__":
    main()
