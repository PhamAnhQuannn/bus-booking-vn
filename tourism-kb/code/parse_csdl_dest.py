# -*- coding: utf-8 -*-
"""Tach + phan loai ban ghi /dest -> per-tinh csdl_dest.json cho build_diem_den.py.

Nguon: raw/_shared/csdl_dest.json (sweep_csdl_dest.py, toan quoc). Moi ban ghi:
- `ten`, `dia_chi` (sau "Địa chỉ:"), `tinh` -> `slug` (fold-match 34 tinh, lay tinh o duoi)
- `loai_vn` phan loai TU TEN (register khong co field "Loại hình"); FALLBACK "Điểm tham quan"
  cho dong khong ro — KHONG bia nhan cu the (rule overture-catchall)
- `quarantine=True` cho ha tang dan sinh (cho, pho di bo, trung tam van hoa, cot moc,
  khu thuong mai...) — KHONG phai diem du lich, KHONG vao diem-den
- `tham_dinh="nhà nước"` cho MOI dong (ca register = danh muc nha nuoc Cuc Du lich QG)

KHONG co toa do o day (geocode o build_diem_den.py cho dong net-new). Ghi per-slug
raw/<slug>/scrape/csdl_dest.json qua write-guard.

Chay:  PYTHONIOENCODING=utf-8 python tourism-kb/code/parse_csdl_dest.py
       [tourism-kb/raw/_shared/csdl_dest.json]
"""
import os, io, sys, json, unicodedata, collections

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dia_diem_config import CONFIG
import duong_dan_ra as _dr

SRC = sys.argv[1] if len(sys.argv) > 1 else "tourism-kb/raw/_shared/csdl_dest.json"


def fold(s):
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " ".join(s.lower().replace("đ", "d").split())


def toks(s):
    return set(fold(s).split())


# tinh (fold) -> slug canonical (last-wins = slug ca-tinh, khong phai city). Lam Dong=lam-dong...
PROV2SLUG = {}
for _slug, _c in CONFIG.items():
    PROV2SLUG[fold(_c["province"])] = _slug

# Register ghi dia chi bang TEN TINH CU (truoc sap nhap 2025). Alias cu -> slug moi (63->34).
# Nguon: nghi quyet sap nhap 2025. Tinh "giu nguyen" da co trong PROV2SLUG.
ALIAS_OLD = {
    "ha giang": "tuyen-quang", "bac kan": "thai-nguyen", "yen bai": "lao-cai",
    "hoa binh": "phu-tho", "vinh phuc": "phu-tho", "bac giang": "bac-ninh",
    "thai binh": "hung-yen", "hai duong": "hai-phong", "ha nam": "ninh-binh",
    "nam dinh": "ninh-binh", "quang binh": "quang-tri", "thua thien hue": "hue",
    "thua thien - hue": "hue", "quang nam": "da-nang-tinh", "kon tum": "quang-ngai",
    "binh dinh": "gia-lai", "phu yen": "dak-lak", "ninh thuan": "khanh-hoa",
    "dak nong": "lam-dong", "dac nong": "lam-dong", "binh thuan": "lam-dong",
    "binh phuoc": "dong-nai", "long an": "tay-ninh", "ba ria - vung tau": "ho-chi-minh",
    "ba ria vung tau": "ho-chi-minh", "ba ria": "ho-chi-minh", "vung tau": "ho-chi-minh",
    "binh duong": "ho-chi-minh", "ben tre": "vinh-long", "tra vinh": "vinh-long",
    "tien giang": "dong-thap", "kien giang": "an-giang", "hau giang": "can-tho",
    "soc trang": "can-tho", "bac lieu": "ca-mau",
    "dac lak": "dak-lak", "dac lac": "dak-lak",   # Dak Lak cach viet cu trong register
}
PROV_LOOKUP = dict(PROV2SLUG)
PROV_LOOKUP.update(ALIAS_OLD)

# Fallback khi tail chi co HUYEN (khong ten tinh). CHI cum ro rang, cao tan so; TRANH ten
# trung tinh (vd huyen "Quang Ninh" o Quang Binh vs tinh Quang Ninh) -> khong dua vao.
DISTRICT_ALIAS = {
    "thuan thanh": "bac-ninh", "tu son": "bac-ninh", "tien du": "bac-ninh",
    "gia binh": "bac-ninh", "que vo": "bac-ninh", "yen phong": "bac-ninh",
    "chau doc": "an-giang", "thoai son": "an-giang", "tri ton": "an-giang",
    "tinh bien": "an-giang", "chau phu": "an-giang", "tan chau": "an-giang",
    "huong hoa": "quang-tri", "vinh linh": "quang-tri", "gio linh": "quang-tri",
    "cam lo": "quang-tri", "trieu phong": "quang-tri", "hai lang": "quang-tri",
    "sa pa": "lao-cai", "bac ha": "lao-cai", "muong khuong": "lao-cai",
    "bat xat": "lao-cai", "bao thang": "lao-cai",
    "pleiku": "gia-lai", "ia grai": "gia-lai", "chu prong": "gia-lai",
    "chu se": "gia-lai", "an khe": "gia-lai",
}


def which_province(text):
    """Tinh o DUOI dia chi. Ten tinh (moi/cu) xuat hien PHAI NHAT; fallback theo huyen."""
    ft = fold(text)
    best, bi = None, -1
    for pf, slug in PROV_LOOKUP.items():
        i = ft.rfind(pf)
        if i > bi:
            bi, best = i, slug
    if best:
        return best
    for df, slug in DISTRICT_ALIAS.items():
        if df in ft:
            return slug
    return None


# ── phan loai tu ten ─────────────────────────────────────────────────────────
# QUAN TRONG: match CO DAU + ranh gioi tu (rule tim_cum) — fold bo dau se lam
# dong(cave)/đồng(field/copper)/đông(east) trung nhau -> gan sai nguy hiem.
def low(s):
    """lowercase GIU DAU, chuan hoa khoang trang; token = tu co dau."""
    return " ".join((s or "").lower().split())


def has_word(f, *words):
    """tu nam o ranh gioi tu trong ' <f> ' (co dau)."""
    p = " " + f + " "
    return any((" " + w + " ") in p or p.startswith(" " + w) or p.endswith(w + " ")
               for w in words)


# Ha tang dan sinh -> cach ly (khong phai diem du lich).
QUARANTINE_SUB = ("trung tâm văn hóa", "trung tâm thương mại", "trung tâm dịch vụ",
                  "khu thương mại", "khu dịch vụ", "phố đi bộ", "chợ trung tâm",
                  "chợ đêm", "cửa khẩu", "sân vận động", "nhà văn hóa", "siêu thị",
                  "bến xe", "sân bay", "ủy ban", "quảng trường",
                  "lễ hội", "liên hoan", "hội thi", "festival")   # su kien, khong phai noi

# Theme-park / KDL giai tri tra phi — seed famous mis-tag + keyword (Part A). Hep, do dem.
THEME_SUB = ("công viên nước", "công viên giải trí")
THEME_SEED = ("đại nam", "suối tiên", "đầm sen", "vinwonders", "vinpearl", "bà nà",
              "suối vàng", "sun world", "asia park", "grand world")


def classify(name):
    f = low(name)
    # quarantine truoc
    if any(sub in f for sub in QUARANTINE_SUB) or has_word(f, "chợ"):
        return None, True
    # theme park / KDL giai tri tra phi
    if any(sub in f for sub in THEME_SUB) or any(sd in f for sd in THEME_SEED):
        return "Khu du lịch giải trí (vui chơi trả phí)", False
    # ton giao / tin nguong
    if any(w in f for w in ("nhà thờ", "giáo xứ", "giáo họ", "thánh đường", "nhà nguyện")):
        return "Nhà thờ", False
    if has_word(f, "đền", "miếu", "đình", "phủ", "am") or "đền thờ" in f or "điện thờ" in f:
        return "Đền / Miếu", False
    if has_word(f, "chùa") or any(w in f for w in ("thiền viện", "tịnh xá", "niệm phật")):
        return "Chùa / Thiền viện", False
    # di tich / luu niem / lich su
    if any(w in f for w in ("di tích", "khu lưu niệm", "nơi thành lập", "căn cứ",
                            "địa đạo", "thành cổ", "nhà cổ", "nhà tù", "khảo cổ",
                            "chiến khu", "lăng mộ", "tưởng niệm", "khu di tích",
                            "nhà lưu niệm", "chứng tích")):
        return "Dinh thự / Di tích", False
    if any(w in f for w in ("bảo tàng", "nhà trưng bày")):
        return "Bảo tàng", False
    # tu nhien — GIU DAU nghiem ngat
    if has_word(f, "thác"):
        return "Thác nước", False
    if any(w in f for w in ("vườn quốc gia", "khu bảo tồn")):
        return "Vườn quốc gia / Khu bảo tồn", False
    if has_word(f, "động", "hang"):
        return "Hang động", False
    if has_word(f, "núi", "đèo") or "đỉnh núi" in f:
        return "Núi / Đèo / Đường mòn", False
    if has_word(f, "biển", "vịnh", "đảo", "hòn") or "bãi biển" in f or "bán đảo" in f or "cù lao" in f:
        return "Bãi biển", False
    if has_word(f, "hồ", "đầm", "đập"):
        return "Hồ / Đập", False
    if any(w in f for w in ("làng nghề", "phố cổ")) or has_word(f, "bản", "buôn"):
        return "Làng nghề / Bản", False
    if "công viên" in f or "vườn hoa" in f:
        return "Công viên / Vườn hoa", False
    return "Điểm tham quan", False   # FALLBACK — khong bia nhan cu the


def parse_addr(text):
    i = text.find("Địa chỉ:")
    return " ".join(text[i + len("Địa chỉ:"):].split()) if i >= 0 else ""


def main():
    rows = json.load(io.open(SRC, encoding="utf-8"))
    by_slug = collections.defaultdict(list)
    dist = collections.Counter()
    n_quar = n_noslug = 0

    for r in rows:
        name = " ".join((r.get("name") or "").split())
        if not name:
            continue
        text = r.get("text") or ""
        addr = parse_addr(text)
        slug = which_province(text)
        if not slug:
            n_noslug += 1
            continue
        loai, quar = classify(name)
        if quar:
            n_quar += 1
            dist["(cách ly)"] += 1
            continue
        dist[loai] += 1
        by_slug[slug].append({"id": r.get("id"), "ten": name, "dia_chi": addr,
                              "tinh": CONFIG[slug]["province"], "slug": slug,
                              "loai_vn": loai, "tham_dinh": "nhà nước"})

    for slug, items in by_slug.items():
        out = os.path.join("tourism-kb", "raw", slug, "scrape", "csdl_dest.json")
        _dr.kiem_loi_ra(out)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        tmp = out + ".tmp"
        json.dump(items, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        os.replace(tmp, out)

    print(f"nguon: {len(rows)}  |  cach ly (ha tang dan sinh): {n_quar}  |  khong ro tinh: {n_noslug}")
    print(f"ghi {sum(len(v) for v in by_slug.values())} diem den qua {len(by_slug)} tinh")
    print("\nphan bo loai_vn (toan quoc):")
    for k, v in dist.most_common():
        print(f"  {v:4}  {k}")
    print("\ntop tinh:")
    for slug, items in sorted(by_slug.items(), key=lambda kv: -len(kv[1]))[:10]:
        print(f"  {len(items):4}  {slug}")


if __name__ == "__main__":
    main()
