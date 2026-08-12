# -*- coding: utf-8 -*-
"""Config theo dia diem (slug) — MOT seam thay cho literal bbox/center/tinh/prefix/
allowlist rai rac ~30 file. Truoc day toan bo pipeline gan cung Da Lat
(build_data_report.py:381 tu thu). File nay go nut do.

Slug suy ra tu duong dan RAW/OUT: `.../raw/<slug>/...` -> <slug>. `tourism-kb/raw`
phang (Da Lat cu) khong co slug -> fallback "da-lat" (tuong thich nguoc).

bbox luu chuan (lon_min, lat_min, lon_max, lat_max). Moi script tu doc thu tu no can.
"""
import re

CONFIG = {
    "da-lat": {
        "bbox": (108.30, 11.75, 108.65, 12.10),
        "center": (108.4454, 11.9450),        # (lon, lat)
        "radius_km": 25,
        "id_prefix": "DL",
        "city": "Đà Lạt",
        "province": "Lâm Đồng",
        "allowlist": [
            "ho xuan huong", "thung lung tinh yeu", "lang biang", "langbiang",
            "thien vien truc lam", "ho tuyen lam", "ga da lat", "crazy house",
            "biet thu hang nga", "dinh bao dai", "dinh iii", "dinh ii",
            "cho da lat", "thac datanla", "thac prenn", "thac voi", "thac cam ly",
            "doi che cau dat", "chua linh phuoc", "chua linh son", "nha tho con ga",
            "chinh toa da lat", "domaine de marie", "quang truong lam vien",
            "vuon hoa thanh pho", "ho than tho", "doi mong mo", "lang cu lan",
            "bao tang lam dong", "thung lung vang", "duong ham dat set", "xq su quan",
            "thien vuong co sat", "ho da thien",
        ],
    },
    "nha-trang": {
        "bbox": (109.10, 12.18, 109.32, 12.36),
        "center": (109.19, 12.25),
        "radius_km": 20,
        "id_prefix": "NT",
        "city": "Nha Trang",
        "province": "Khánh Hòa",
        "allowlist": [
            "thap ba po nagar", "po nagar", "chua long son", "long son", "thap ba",
            "hon chong", "nha tho nui", "nha tho chanh toa", "chanh toa nha trang",
            "vien hai duong hoc", "hai duong hoc", "cho dam", "vinpearl", "vinwonders",
            "hon mun", "hon tam", "bai dai", "thap tram huong", "chua ong",
            "bai bien nha trang", "cho xom moi", "long thanh", "chua da long",
        ],
    },
    "da-nang": {
        "bbox": (107.98, 15.98, 108.35, 16.13),
        "center": (108.22, 16.06),
        "radius_km": 30,
        "id_prefix": "DN",
        "city": "Đà Nẵng",
        "province": "Đà Nẵng",
        "allowlist": [
            "ngu hanh son", "marble mountain", "ba na", "cau rong", "cau vang",
            "golden bridge", "bien my khe", "my khe", "son tra", "linh ung",
            "chua linh ung", "bao tang cham", "dieu khac cham", "cho han", "cho con",
            "bai but", "ban co", "hai van", "cau tinh yeu", "asia park",
            "sun world", "non nuoc", "cau song han", "bao tang da nang",
        ],
    },
    # ── 34-tinh (sau sap nhap 2025): slug = tinh, bbox ca tinh (Nominatim), auto Overture ──
    "quang-ninh": {
        "bbox": (106.4392, 20.4646, 108.2086, 21.6635),
        "center": (107.2013, 21.1718),
        "radius_km": 90,
        "id_prefix": "QN",
        "city": "Hạ Long",
        "province": "Quảng Ninh",
        "allowlist": [
            "ha long", "bai chay", "yen tu", "tuan chau", "co to", "bai tu long",
            "van don", "sung sot", "ti top", "quan lan", "mong cai", "tra co",
        ],
    },
    "dien-bien": {
        "bbox": (102.1439, 20.8927, 103.5988, 22.5479),
        "center": (103.2169, 21.6547),
        "radius_km": 90,
        "id_prefix": "DB",
        "city": "Điện Biên Phủ",
        "province": "Điện Biên",
        "allowlist": [
            "dien bien phu", "muong phang", "a1", "pa khoang", "muong thanh",
            "him lam", "doc lap", "hong cum",
        ],
    },
    "an-giang": {
        "bbox": (103.0522, 8.9946, 105.5756, 10.9623),
        "center": (104.3139, 9.9784),
        "radius_km": 120,
        "id_prefix": "AG",
        "city": "Rạch Giá",
        "province": "An Giang",
        "allowlist": [],
    },
    "bac-ninh": {
        "bbox": (105.8806, 20.9693, 107.0336, 21.6263),
        "center": (106.4571, 21.2978),
        "radius_km": 120,
        "id_prefix": "BN",
        "city": "Bắc Giang",
        "province": "Bắc Ninh",
        "allowlist": [],
    },
    "ca-mau": {
        "bbox": (103.4821, 8.1791, 106.0553, 9.6375),
        "center": (104.7687, 8.9083),
        "radius_km": 120,
        "id_prefix": "CM",
        "city": "Cà Mau",
        "province": "Cà Mau",
        "allowlist": [],
        "score_min": 0.40,   # tinh mong: it POI co tag wiki -> ha nguong lay POI tier-1 that (2026-08-09)
    },
    "cao-bang": {
        "bbox": (105.2667, 22.3569, 106.8376, 23.1188),
        "center": (106.0522, 22.7379),
        "radius_km": 120,
        "id_prefix": "CB",
        "city": "Cao Bằng",
        "province": "Cao Bằng",
        "allowlist": [],
    },
    "dak-lak": {
        "bbox": (107.4842, 12.1605, 109.6665, 13.6953),
        "center": (108.5754, 12.9279),
        "radius_km": 120,
        "id_prefix": "DK",
        "city": "Buôn Ma Thuột",
        "province": "Đắk Lắk",
        "allowlist": [],
    },
    "dong-nai": {
        "bbox": (106.4116, 10.5792, 107.5778, 12.2985),
        "center": (106.9947, 11.4388),
        "radius_km": 120,
        "id_prefix": "DoN",
        "city": "Biên Hòa",
        "province": "Đồng Nai",
        "allowlist": [],
    },
    "dong-thap": {
        "bbox": (105.1856, 10.1348, 106.9934, 10.9735),
        "center": (106.0895, 10.5541),
        "radius_km": 120,
        "id_prefix": "DoT",
        "city": "Mỹ Tho",
        "province": "Đồng Tháp",
        "allowlist": [],
    },
    "gia-lai": {
        "bbox": (107.4508, 12.9962, 109.5849, 14.7032),
        "center": (108.5179, 13.8497),
        "radius_km": 120,
        "id_prefix": "GL",
        "city": "Quy Nhơn",
        "province": "Gia Lai",
        "allowlist": [],
    },
    "ha-tinh": {
        "bbox": (105.1035, 17.9096, 106.7537, 18.7670),
        "center": (105.9286, 18.3383),
        "radius_km": 120,
        "id_prefix": "HT",
        "city": "Hà Tĩnh",
        "province": "Hà Tĩnh",
        "allowlist": [],
    },
    "hung-yen": {
        "bbox": (105.8953, 20.0772, 107.1193, 21.0070),
        "center": (106.5073, 20.5421),
        "radius_km": 120,
        "id_prefix": "HY",
        "city": "Hưng Yên",
        "province": "Hưng Yên",
        "allowlist": [],
    },
    "lai-chau": {
        "bbox": (102.3205, 21.6861, 103.9858, 22.8139),
        "center": (103.1532, 22.2500),
        "radius_km": 120,
        "id_prefix": "LC",
        "city": "Lai Châu",
        "province": "Lai Châu",
        "allowlist": [],
    },
    "lang-son": {
        "bbox": (106.0954, 21.3252, 107.3641, 22.4615),
        "center": (106.7297, 21.8933),
        "radius_km": 120,
        "id_prefix": "LS",
        "city": "Lạng Sơn",
        "province": "Lạng Sơn",
        "allowlist": [],
        "score_min": 0.36,   # tinh bien gioi it POI wiki -> ha nguong (cap ~11 in-province) (2026-08-09)
    },
    "lao-cai": {
        "bbox": (103.5294, 21.3259, 105.1004, 22.8449),
        "center": (104.3149, 22.0854),
        "radius_km": 120,
        "id_prefix": "LCa",
        "city": "Yên Bái",
        "province": "Lào Cai",
        "allowlist": [],
    },
    "nghe-an": {
        "bbox": (103.8746, 18.5521, 106.2645, 20.0024),
        "center": (105.0695, 19.2772),
        "radius_km": 120,
        "id_prefix": "NA",
        "city": "Vinh",
        "province": "Nghệ An",
        "allowlist": [],
    },
    "ninh-binh": {
        "bbox": (105.7690, 19.4900, 106.9524, 20.7044),
        "center": (106.3607, 20.0972),
        "radius_km": 120,
        "id_prefix": "NB",
        "city": "Hoa Lư",
        "province": "Ninh Bình",
        "allowlist": [],
    },
    "phu-tho": {
        "bbox": (104.8143, 20.3054, 105.8571, 21.7196),
        "center": (105.3357, 21.0125),
        "radius_km": 120,
        "id_prefix": "PT",
        "city": "Việt Trì",
        "province": "Phú Thọ",
        "allowlist": [],
    },
    "quang-ngai": {
        "bbox": (105.3324, 12.0995, 110.5324, 17.2995),
        "center": (107.9324, 14.6995),
        "radius_km": 120,
        "id_prefix": "QNg",
        "city": "Quảng Ngãi",
        "province": "Quảng Ngãi",
        "allowlist": [],
    },
    "quang-tri": {
        "bbox": (105.6077, 16.3022, 107.6920, 18.1316),
        "center": (106.6498, 17.2169),
        "radius_km": 120,
        "id_prefix": "QT",
        "city": "Đồng Hới",
        "province": "Quảng Trị",
        "allowlist": [],
    },
    "son-la": {
        "bbox": (103.2123, 20.5730, 105.0253, 22.0307),
        "center": (104.1188, 21.3019),
        "radius_km": 120,
        "id_prefix": "SL",
        "city": "Sơn La",
        "province": "Sơn La",
        "allowlist": [],
        "score_min": 0.40,   # tinh mong (2026-08-09)
    },
    "tay-ninh": {
        "bbox": (105.5004, 10.3948, 107.2109, 11.7829),
        "center": (106.3556, 11.0888),
        "radius_km": 120,
        "id_prefix": "TN",
        "city": "Tân An",
        "province": "Tây Ninh",
        "allowlist": [],
    },
    "thai-nguyen": {
        "bbox": (105.4311, 21.3265, 106.2470, 22.7414),
        "center": (105.8391, 22.0339),
        "radius_km": 120,
        "id_prefix": "TNg",
        "city": "Thái Nguyên",
        "province": "Thái Nguyên",
        "allowlist": [],
        "score_min": 0.40,   # tinh mong (2026-08-09)
    },
    "thanh-hoa": {
        "bbox": (104.3760, 19.1875, 106.2691, 20.6700),
        "center": (105.3225, 19.9287),
        "radius_km": 120,
        "id_prefix": "TH",
        "city": "Thanh Hóa",
        "province": "Thanh Hóa",
        "allowlist": [],
    },
    "can-tho": {
        "bbox": (105.2257, 8.7025, 106.4538, 10.3252),
        "center": (105.8398, 9.5139),
        "radius_km": 120,
        "id_prefix": "CT",
        "city": "Cần Thơ",
        "province": "Cần Thơ",
        "allowlist": [],
    },
    "ha-noi": {
        "bbox": (105.2890, 20.5645, 106.0200, 21.3854),
        "center": (105.6545, 20.9750),
        "radius_km": 120,
        "id_prefix": "HN",
        "city": "Hà Nội",
        "province": "Hà Nội",
        "allowlist": [],
    },
    "hai-phong": {
        "bbox": (106.1242, 19.9178, 107.9519, 21.2370),
        "center": (107.0380, 20.5774),
        "radius_km": 120,
        "id_prefix": "HP",
        "city": "Hải Phòng",
        "province": "Hải Phòng",
        "allowlist": [],
    },
    "ho-chi-minh": {
        "bbox": (105.9769, 8.3457, 108.4311, 11.5016),
        "center": (107.2040, 9.9236),
        "radius_km": 120,
        "id_prefix": "HCM",
        "city": "Hồ Chí Minh",
        "province": "Hồ Chí Minh",
        "allowlist": [],
    },
    "hue": {
        "bbox": (107.0343, 15.9949, 108.4806, 17.1109),
        "center": (107.7575, 16.5529),
        "radius_km": 120,
        "id_prefix": "HU",
        "city": "Huế",
        "province": "Huế",
        "allowlist": [],
    },
    "tuyen-quang": {
        "bbox": (104.3343, 21.4976, 105.5983, 23.3927),
        "center": (104.9663, 22.4451),
        "radius_km": 120,
        "id_prefix": "TQ",
        "city": "Tuyên Quang",
        "province": "Tuyên Quang",
        "allowlist": [],
    },
    "vinh-long": {
        "bbox": (105.6819, 9.0801, 106.9934, 10.3403),
        "center": (106.3376, 9.7102),
        "radius_km": 120,
        "id_prefix": "VL",
        "city": "Vĩnh Long",
        "province": "Vĩnh Long",
        "allowlist": [],
    },
    # ── 3 hero-province full-scope: slug tinh RIENG (giu da-lat/nha-trang/da-nang city curated).
    # bbox = mainland (bo Truong Sa/Hoang Sa dao xa); boundary.geojson = tinh moi da sap nhap (Nominatim).
    "lam-dong": {   # + Đắk Nông + Bình Thuận (Mũi Né / Phan Thiết)
        "bbox": (107.1500, 10.3500, 109.4200, 12.8200),
        "center": (108.3000, 11.6000),
        "radius_km": 160,
        "id_prefix": "LDG",
        "city": "Đà Lạt",
        "province": "Lâm Đồng",
        "allowlist": [],
    },
    "khanh-hoa": {  # + Ninh Thuận (Phan Rang / Ninh Chữ)
        "bbox": (108.5500, 11.1000, 109.5500, 12.9500),
        "center": (109.1000, 12.0000),
        "radius_km": 120,
        "id_prefix": "KH",
        "city": "Nha Trang",
        "province": "Khánh Hòa",
        "allowlist": [],
    },
    "da-nang-tinh": {  # + Quảng Nam (Hội An / Mỹ Sơn)
        "bbox": (107.2100, 14.9000, 109.0500, 16.3500),
        "center": (108.1500, 15.6000),
        "radius_km": 130,
        "id_prefix": "DNT",
        "city": "Đà Nẵng",
        "province": "Đà Nẵng",
        "allowlist": [],
    },
}


# Danh sach diem den CURATE (hand-authored) — thay chon tu dong (Overture nhieu rac/trung).
# Do dai BIEN THIEN theo city. hint = toa do gan dung de disambiguate/fallback; resolver
# uu tien toa do Overture/Wikidata khop ten, hint chi khi khong khop.
DIEM_CHOT = {
    "nha-trang": [
        {"ten": "Tháp Bà Ponagar", "loai": "Chùa / Thiền viện", "alt": ["po nagar", "ponagar", "thap ba"], "hint": (12.2654, 109.1954)},
        {"ten": "Chùa Long Sơn", "loai": "Chùa / Thiền viện", "alt": ["long son", "kim than phat to"], "hint": (12.2531, 109.1817)},
        {"ten": "Nhà thờ Chánh tòa Nha Trang", "loai": "Nhà thờ", "alt": ["nha tho nui", "nha tho da", "chanh toa"], "hint": (12.2456, 109.1889)},
        {"ten": "Viện Hải Dương Học", "loai": "Bảo tàng", "alt": ["hai duong hoc", "oceanography"], "hint": (12.2151, 109.2160)},
        {"ten": "Khu danh thắng Hòn Chồng", "loai": "Điểm ngắm cảnh", "alt": ["hon chong"], "hint": (12.2687, 109.2076)},
        {"ten": "Hòn Tằm", "loai": "Bãi biển", "alt": ["hon tam"], "hint": (12.2003, 109.2447)},
        {"ten": "VinWonders Nha Trang", "loai": "Khu vui chơi", "alt": ["vinwonders", "vinpearl"], "hint": (12.2145, 109.2508)},
        {"ten": "Tháp Trầm Hương", "loai": "Dinh thự / Di tích", "alt": ["tram huong"], "hint": (12.2410, 109.1965)},
        {"ten": "Chợ Đầm", "loai": "Chợ / Mua sắm", "alt": ["cho dam"], "hint": (12.2497, 109.1930)},
        {"ten": "Khu tắm bùn Tháp Bà", "loai": "Khu vui chơi", "alt": ["tam bun thap ba", "thap ba spa"], "hint": (12.2688, 109.1918)},
        {"ten": "Bãi biển Trần Phú", "loai": "Bãi biển", "alt": ["bai bien nha trang", "tran phu"], "hint": (12.2388, 109.1967)},
        {"ten": "Vịnh Nha Trang", "loai": "Điểm ngắm cảnh", "alt": ["vinh nha trang"], "hint": (12.2050, 109.2200)},
        {"ten": "Chợ Xóm Mới", "loai": "Chợ / Mua sắm", "alt": ["xom moi"], "hint": (12.2478, 109.1875)},
        {"ten": "Bảo tàng Khánh Hòa", "loai": "Bảo tàng", "alt": ["bao tang khanh hoa"], "hint": (12.2445, 109.1936)},
        {"ten": "Chùa Tòng Lâm Lô Sơn", "loai": "Chùa / Thiền viện", "alt": ["tong lam", "lo son"], "hint": (12.2760, 109.1620)},
        {"ten": "Bãi Trũ", "loai": "Bãi biển", "alt": ["bai tru"], "hint": (12.2130, 109.2560)},
        {"ten": "Ga Nha Trang", "loai": "Dinh thự / Di tích", "alt": ["ga nha trang"], "hint": (12.2467, 109.1830)},
        {"ten": "Chùa Hải Đức", "loai": "Chùa / Thiền viện", "alt": ["hai duc"], "hint": (12.2490, 109.1770)},
        {"ten": "Hồ cá Trí Nguyên", "loai": "Khu vui chơi", "alt": ["tri nguyen"], "hint": (12.2010, 109.2420)},
        {"ten": "Công viên Yến Phi", "loai": "Công viên / Vườn hoa", "alt": ["yen phi", "phu dong"], "hint": (12.2360, 109.1990)},
    ],
    "da-nang": [
        {"ten": "Ngũ Hành Sơn", "loai": "Núi / Đèo / Đường mòn", "alt": ["ngu hanh son", "marble mountain"], "hint": (16.0036, 108.2630)},
        {"ten": "Cầu Rồng", "loai": "Dinh thự / Di tích", "alt": ["cau rong", "dragon bridge"], "hint": (16.0614, 108.2276)},
        {"ten": "Bãi biển Mỹ Khê", "loai": "Bãi biển", "alt": ["my khe"], "hint": (16.0544, 108.2470)},
        {"ten": "Bán đảo Sơn Trà", "loai": "Điểm ngắm cảnh", "alt": ["son tra"], "hint": (16.1000, 108.2900)},
        {"ten": "Chùa Linh Ứng Bãi Bụt", "loai": "Chùa / Thiền viện", "alt": ["linh ung", "bai but"], "hint": (16.1000, 108.2777)},
        {"ten": "Bảo tàng Điêu khắc Chăm", "loai": "Bảo tàng", "alt": ["cham", "dieu khac cham"], "hint": (16.0605, 108.2235)},
        {"ten": "Chợ Hàn", "loai": "Chợ / Mua sắm", "alt": ["cho han"], "hint": (16.0688, 108.2246)},
        {"ten": "Chợ Cồn", "loai": "Chợ / Mua sắm", "alt": ["cho con"], "hint": (16.0669, 108.2148)},
        {"ten": "Cầu Tình Yêu", "loai": "Dinh thự / Di tích", "alt": ["cau tinh yeu", "love bridge"], "hint": (16.0700, 108.2300)},
        {"ten": "Cầu sông Hàn", "loai": "Dinh thự / Di tích", "alt": ["cau song han", "han river bridge"], "hint": (16.0730, 108.2270)},
        {"ten": "Asia Park Đà Nẵng", "loai": "Khu vui chơi", "alt": ["asia park", "sun world"], "hint": (16.0392, 108.2260)},
        {"ten": "Làng đá mỹ nghệ Non Nước", "loai": "Chợ / Mua sắm", "alt": ["non nuoc", "lang da"], "hint": (16.0030, 108.2600)},
        {"ten": "Đỉnh Bàn Cờ", "loai": "Điểm ngắm cảnh", "alt": ["ban co"], "hint": (16.1150, 108.2820)},
        {"ten": "Bảo tàng Đà Nẵng", "loai": "Bảo tàng", "alt": ["bao tang da nang"], "hint": (16.0745, 108.2210)},
        {"ten": "Bảo tàng Mỹ thuật Đà Nẵng", "loai": "Bảo tàng", "alt": ["my thuat"], "hint": (16.0680, 108.2200)},
        {"ten": "Nhà thờ Chính tòa Đà Nẵng", "loai": "Nhà thờ", "alt": ["con ga", "chinh toa da nang"], "hint": (16.0664, 108.2233)},
        {"ten": "Công viên Biển Đông", "loai": "Công viên / Vườn hoa", "alt": ["bien dong"], "hint": (16.0870, 108.2470)},
        {"ten": "Bãi biển Non Nước", "loai": "Bãi biển", "alt": ["non nuoc"], "hint": (16.0000, 108.2680)},
        {"ten": "Chùa Quán Thế Âm", "loai": "Chùa / Thiền viện", "alt": ["quan the am"], "hint": (16.0010, 108.2540)},
        {"ten": "Cầu Thuận Phước", "loai": "Dinh thự / Di tích", "alt": ["thuan phuoc"], "hint": (16.0940, 108.2230)},
        {"ten": "Tượng Cá Chép Hóa Rồng", "loai": "Dinh thự / Di tích", "alt": ["ca chep hoa rong", "carp dragon"], "hint": (16.0666, 108.2290)},
        {"ten": "Helio Center", "loai": "Khu vui chơi", "alt": ["helio"], "hint": (16.0370, 108.2210)},
        {"ten": "Bãi biển Phạm Văn Đồng", "loai": "Bãi biển", "alt": ["pham van dong"], "hint": (16.0730, 108.2470)},
        {"ten": "Công viên 29 Tháng 3", "loai": "Công viên / Vườn hoa", "alt": ["29 thang 3", "cong vien 29"], "hint": (16.0570, 108.2100)},
        {"ten": "Nhà hát Trưng Vương", "loai": "Dinh thự / Di tích", "alt": ["trung vuong"], "hint": (16.0670, 108.2200)},
        {"ten": "Rạn Nam Ô", "loai": "Điểm ngắm cảnh", "alt": ["nam o"], "hint": (16.1000, 108.1300)},
        {"ten": "Bà Nà Hills", "loai": "Khu vui chơi", "alt": ["ba na", "cau vang", "golden bridge"], "hint": (15.9977, 107.9960)},
        {"ten": "Chùa Linh Ứng Bà Nà", "loai": "Chùa / Thiền viện", "alt": ["linh ung ba na"], "hint": (15.9980, 107.9970)},
    ],
}


def slug_of(path):
    """Slug tu duong dan; fallback 'da-lat' cho raw/ phang (tuong thich nguoc)."""
    for part in re.split(r"[\\/]+", str(path or "")):
        if part in CONFIG:
            return part
    return "da-lat"


def cfg(path):
    return CONFIG[slug_of(path)]


# Ghi chu curator cho docx diem den (editorial, KHONG phai fact co source_id — giong alt/hint cua
# DIEM_CHOT). Chi note dung/khong tranh cai. Attraction cha gop cap treo/dac trung -> nguoi doc biet.
# Chi render o tang docx (build_diem_den_docx.py), KHONG vao export JSON.
GHI_CHU_DIEM_DEN = {
    "VinWonders Nha Trang": "có cáp treo vượt biển ra đảo Hòn Tre",
    "Bà Nà Hills": "có cáp treo lên đỉnh · Cầu Vàng",
    "Asia Park Đà Nẵng": "có vòng quay Sun Wheel",
}
