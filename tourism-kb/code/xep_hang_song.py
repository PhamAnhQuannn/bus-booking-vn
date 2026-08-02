# -*- coding: utf-8 -*-
"""Bang xep hang GOI LIVE — in ra man hinh, KHONG ghi gi xuong dia.

Doc `place_id` da luu (duoc phep luu vinh vien), goi Google lay `rating` +
`userRatingCount` tai thoi diem chay, tinh hang bang `xep_hang.py`, in bang,
roi bo. Khong mot handle ghi nao trong file nay.

═══════════════════════════════════════════════════════════════════════════════
VI SAO BANG NAY KHONG NAM TRONG .docx / .md

Chinh sach Places cua Google: "the place ID … is exempt from the caching
restrictions … store place ID values indefinitely" va "You must not pre-fetch,
cache, or store Places API content beyond the allowed exceptions". Khong co
ngoai le nao cho du lieu PHAI SINH.

Truc phan dinh khong phai "mat mat thong tin hay khong" ma la "TINH LAI moi lan
hien thi hay DONG BANG vao ban phan phoi". Mot file .docx gui cho tu van vien
thi theo dinh nghia la dong bang — nen luu chu "A" va luu THU TU dong rui ro
ngang nhau, khong cai nao an toan hon cai nao.

Ly do thu hai, doc lap voi giay phep: mot thu hang in ra giay se cu di ma
KHONG CO GI trong to giay bao rang no da sai. Du an nay da ghi so lop loi do
nhieu lan (gia ve chep tu blog, gio mo cua chep tu mot trang).

Nen tai lieu tinh mang CON TRO (`place_id`) + QUY TAC (cong thuc, nguong — do
la cua ta, luu tu do), con CON SO thi o day, tinh lai moi lan chay.
═══════════════════════════════════════════════════════════════════════════════

Chay:
  PYTHONIOENCODING=utf-8 python tourism-kb/code/xep_hang_song.py <raw> quan_hxh
  PYTHONIOENCODING=utf-8 python tourism-kb/code/xep_hang_song.py <raw> luu_tru_hxh
"""
import json, os, sys, io, time
import urllib.request, urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import an_ngu_data as _an
import xep_hang as _xh

API = "https://places.googleapis.com/v1/places/"
# CHI xin hai truong. Xin them bat ky truong nao khac se day len tang gia cao
# hon ma khong them gi cho phep tinh — va lam mo ranh gioi "file nay lay dung
# hai truong khong duoc luu".
MASK = "rating,userRatingCount"

# Bo goi: ten -> (ham nap danh sach, ten file place_id, nhan)
_BO = {
    "quan_hxh": (lambda raw: _an.tai_quan_an_quanh_ho(raw)["trong"],
                 "place_id_quan_hxh.json", "quán ăn quanh Hồ Xuân Hương"),
    "luu_tru_hxh": (lambda raw: _an.tai_luu_tru_quanh_ho(raw)["trong"],
                    "place_id_hxh.json", "cơ sở lưu trú quanh Hồ Xuân Hương"),
}


def doc_khoa():
    k = os.environ.get("GOOGLE_MAPS_API_KEY")
    if k and k.strip():
        return k.strip()
    for p in (".env.tourism.local", ".env.local"):
        if os.path.exists(p):
            for line in io.open(p, encoding="utf-8"):
                if line.startswith("GOOGLE_MAPS_API_KEY"):
                    v = line.partition("=")[2].strip().strip("'\"")
                    if v:
                        return v
    return None


def goi_danh_gia(place_id, khoa):
    """Tra ve (rating, userRatingCount). Loi mang -> (None, None), khong ném."""
    req = urllib.request.Request(
        API + place_id,
        headers={"X-Goog-Api-Key": khoa, "X-Goog-FieldMask": MASK})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            d = json.load(r)
        return d.get("rating"), d.get("userRatingCount")
    except urllib.error.HTTPError as e:
        # 429/403 = het han muc. Nem len de vong ngoai DUNG HAN thay vi lang le
        # bo qua vai tram dong roi in mot bang trong nhu that.
        if e.code in (429, 403):
            raise
        return None, None
    except Exception:
        return None, None


def main():
    if len(sys.argv) < 3 or sys.argv[2] not in _BO:
        print(f"Chạy: xep_hang_song.py <thu-muc-raw> [{' | '.join(_BO)}]")
        return 1
    raw, ten_bo = sys.argv[1], sys.argv[2]
    khoa = doc_khoa()
    if not khoa:
        print("thiếu GOOGLE_MAPS_API_KEY"); return 1
    nap, ten_file, nhan = _BO[ten_bo]

    rows = nap(raw)
    _an.gan_place_id(rows, raw, ten_file)
    co_pid = [r for r in rows if r.get("place_id")]
    print(f"{nhan} — {len(rows)} cơ sở, {len(co_pid)} có place_id")
    print(f"{len(co_pid)} lệnh Place Details (chỉ xin {MASK})\n")

    ra, hong = [], 0
    for i, r in enumerate(co_pid, 1):
        try:
            R, n = goi_danh_gia(r["place_id"], khoa)
        except urllib.error.HTTPError as e:
            print(f"DỪNG ở dòng {i}: HTTP {e.code} — hết hạn mức."
                  f" Đã lấy {len(ra)}/{len(co_pid)}, KHÔNG in bảng dở.")
            return 1
        if R is None:
            hong += 1
        else:
            kq = _xh.xep(R, n)
            kq["ten"] = r["ten"]
            kq["dia_chi"] = r.get("dia_chi")
            kq["dien_thoai"] = r.get("dien_thoai")
            kq["m"] = r.get("m")
            ra.append(kq)
        if i % 25 == 0:
            print(f"  ...{i}/{len(co_pid)}", flush=True)
        time.sleep(0.08)

    if not ra:
        print("không lấy được đánh giá nào"); return 1
    _xh.phan_vi(ra)
    xep_duoc = [r for r in ra if r["dat_san"]]
    chua_du = [r for r in ra if not r["dat_san"]]
    _uu = {h: i for i, (_, h) in enumerate(_xh.NGUONG)}
    xep_duoc.sort(key=lambda r: -r["W"])

    print(f"\n{'=' * 108}")
    print(f"XẾP HẠNG — {nhan}   ·   lấy lúc {time.strftime('%d/%m/%Y %H:%M')}")
    print(_xh.mo_ta_nguong())
    print("=" * 108)
    print(f"{'#':>3} {'h':>2} {'Cơ sở':34} {'★':>4} {'lượt':>7} "
          f"{'Wilson':>7} {'khoảng tin cậy':>16} {'%':>4}  điện thoại")
    for i, r in enumerate(xep_duoc, 1):
        ci = f"{r['ci'][0]:.2f}–{r['ci'][1]:.2f}"
        print(f"{i:3} {r['hang']:>2} {r['ten'][:32]:34} {r['R']:>4.1f} "
              f"{r['n']:>7,} {r['W']:>7.3f} {ci:>16} {r['phan_vi']:>4}  "
              f"{r['dien_thoai'] or '—'}")
    import collections
    c = collections.Counter(r["hang"] for r in xep_duoc)
    print("\n   " + " · ".join(f"hạng {h}: {c.get(h, 0)}"
                               for _, h in _xh.NGUONG) +
          f" · {_xh.DUOI_CHUAN} dưới chuẩn: {c.get(_xh.DUOI_CHUAN, 0)}")
    print(f"   {len(chua_du)} cơ sở dưới {_xh.SAN_TOI_THIEU} lượt — CHƯA ĐỦ "
          "đánh giá để kết luận, khác hẳn 'dưới chuẩn':")
    for r in sorted(chua_du, key=lambda r: -(r["n"] or 0))[:8]:
        print(f"      {r['ten'][:34]:36} {r['R']:.1f}★ {r['n']} lượt")
    if len(chua_du) > 8:
        print(f"      … còn {len(chua_du) - 8}")
    if hong:
        print(f"   {hong} cơ sở không lấy được đánh giá")
    print(f"   {len(rows) - len(co_pid)} cơ sở chưa có place_id — ngoài bảng này")
    print("\nĐánh giá & số lượt: Google Maps, lấy lúc chạy, KHÔNG lưu xuống đĩa.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
