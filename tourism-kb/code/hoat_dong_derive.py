# -*- coding: utf-8 -*-
"""Suy "Có gì ở đây" (hoat_dong) cho điểm đến — REDERIVATION từ loại hình + tag OSM.

Cùng lớp doctrine với `trai_nghiem.py` (`nhan_trai_nghiem`): nhãn suy từ `category.primary`,
KHÔNG phải claim riêng về nơi cụ thể → không mint source_id, chỉ đánh dấu `nguon`. Bullet là
AFFORDANCE vốn có của LOẠI (đúng cho mọi điểm cùng loại); tag OSM chỉ THÊM bullet khi tag TỰ
KHẲNG ĐỊNH (canyoning, viewpoint...) — đó là "osm:<tag>" (nguồn OSM). Câu giả định dịch vụ
được hedge "(nếu có dịch vụ)". KHÔNG bịa đặc điểm riêng.

Dùng: export_planner gọi `hoat_dong(category_primary, tags)` -> [{label, nguon}].
"""

# LOẠI (category.primary) -> bullet affordance vốn có. Phủ đủ 21 loại + FALLBACK.
HD_LOAI = {
    "Thác nước": ["Ngắm thác nước", "Chụp ảnh cảnh quan", "Đi bộ khu vực quanh thác"],
    "Hồ / Đập": ["Ngắm cảnh hồ", "Đi dạo ven hồ", "Chụp ảnh"],
    "Chùa / Thiền viện": ["Tham quan kiến trúc chùa", "Lễ chùa / chiêm bái", "Chụp ảnh khuôn viên"],
    "Nhà thờ": ["Tham quan kiến trúc nhà thờ", "Chụp ảnh"],
    "Bảo tàng": ["Tham quan trưng bày / hiện vật", "Tìm hiểu lịch sử - văn hóa"],
    "Dinh thự / Di tích": ["Tham quan di tích", "Tìm hiểu lịch sử", "Chụp ảnh kiến trúc"],
    "Đền / Miếu": ["Tham quan đền / miếu", "Dâng hương / tín ngưỡng", "Chụp ảnh kiến trúc"],
    "Công viên / Vườn hoa": ["Dạo công viên", "Ngắm hoa / cây cảnh", "Chụp ảnh"],
    "Bãi biển": ["Tắm biển", "Dạo bãi biển", "Ngắm cảnh biển"],
    "Điểm ngắm cảnh": ["Ngắm cảnh", "Chụp ảnh"],
    "Khu vui chơi": ["Vui chơi giải trí", "Trải nghiệm trò chơi / dịch vụ"],
    "Khu du lịch giải trí (vui chơi trả phí)": ["Vui chơi các trò trả phí", "Trải nghiệm dịch vụ giải trí", "Tham quan / chụp ảnh khuôn viên"],
    "Cáp treo": ["Đi cáp treo ngắm cảnh"],
    "Hang động": ["Khám phá hang động", "Chụp ảnh thạch nhũ / cảnh quan"],
    "Đảo": ["Tham quan đảo", "Ngắm cảnh biển đảo", "Tắm biển / lặn ngắm (nếu có dịch vụ)"],
    "Vườn quốc gia / Khu bảo tồn": ["Tham quan sinh thái", "Đi bộ đường mòn thiên nhiên", "Ngắm động - thực vật"],
    "Núi / Đèo / Đường mòn": ["Ngắm cảnh núi / đèo", "Đi bộ / leo núi", "Chụp ảnh"],
    "Suối nước nóng": ["Tắm khoáng nóng", "Nghỉ dưỡng"],
    "Nông trại / Vườn": ["Tham quan nông trại / vườn", "Trải nghiệm nông nghiệp (nếu có dịch vụ)", "Chụp ảnh"],
    "Chợ / Mua sắm": ["Mua sắm đặc sản", "Dạo chợ", "Ăn uống"],
    "Điểm tham quan": ["Tham quan", "Chụp ảnh"],
}
HD_FALLBACK = ["Tham quan", "Chụp ảnh"]

# Tag OSM TỰ KHẲNG ĐỊNH hoạt động cụ thể -> thêm bullet, nguồn "osm". key = (osm_key, osm_value).
HD_TAG = {
    ("sport", "canyoning"): "Canyoning / vượt thác (tour chuyên biệt)",
    ("tourism", "viewpoint"): "Ngắm toàn cảnh từ điểm view",
    ("tourism", "theme_park"): "Chơi các trò công viên chủ đề",
    ("tourism", "water_park"): "Vui chơi công viên nước",
    ("tourism", "zoo"): "Tham quan vườn thú",
    ("tourism", "aquarium"): "Tham quan thủy cung",
    ("natural", "hot_spring"): "Tắm khoáng nóng",
    ("natural", "peak"): "Chinh phục đỉnh / ngắm cảnh",
    ("leisure", "garden"): "Dạo vườn thực vật",
    ("historic", "castle"): "Tham quan thành / lâu đài",
    ("historic", "fort"): "Tham quan thành lũy",
    ("historic", "archaeological_site"): "Tham quan di chỉ khảo cổ",
    ("tourism", "artwork"): "Xem tác phẩm nghệ thuật",
    ("leisure", "water_park"): "Vui chơi công viên nước",
}


def hoat_dong(loai, tags):
    """[{label, nguon}] — base từ loại (nguon 'loại hình') + extra từ tag OSM (nguon 'osm:k=v')."""
    out, seen = [], set()
    for b in HD_LOAI.get(loai, HD_FALLBACK):
        if b not in seen:
            seen.add(b)
            out.append({"label": b, "nguon": "loại hình"})
    for (k, v), b in HD_TAG.items():
        if (tags or {}).get(k) == v and b not in seen:
            seen.add(b)
            out.append({"label": b, "nguon": "osm:%s=%s" % (k, v)})
    return out[:5]
