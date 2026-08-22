# -*- coding: utf-8 -*-
"""Nhan trai nghiem cho diem den — single source (export_planner + build_diem_den_docx doc chung).

category.primary (loai vat ly tu OSM) -> nhan trai nghiem con nguoi doc ("Ngam canh",
"Vui choi dich vu / ngam canh"...). Truoc day map nay nam trong build_diem_den_docx.py; tach ra
day de export_planner ghi thanh field luu (ext.destination.trai_nghiem) va docx doc lai — khong drift
2 noi (lesson shared-rule 2026-07-30).
"""

# category.primary -> nhan trai nghiem ghep
EXP_MAP = {
    "Bảo tàng": "Tham quan lịch sử / văn hóa",
    "Chùa / Thiền viện": "Tham quan tâm linh / kiến trúc",
    "Nhà thờ": "Tham quan kiến trúc / tâm linh",
    "Dinh thự / Di tích": "Tham quan lịch sử / kiến trúc",
    "Thác nước": "Ngắm cảnh",
    "Hồ / Đập": "Ngắm cảnh / đi dạo",
    "Công viên / Vườn hoa": "Ngắm cảnh / chụp ảnh",
    "Điểm ngắm cảnh": "Ngắm cảnh",
    "Khu vui chơi": "Vui chơi dịch vụ / ngắm cảnh",
    "Khu du lịch giải trí (vui chơi trả phí)": "Vui chơi trả phí / trải nghiệm (nửa–cả ngày)",
    "Chợ / Mua sắm": "Mua sắm / ăn uống / tham quan",
    "Núi / Đèo / Đường mòn": "Ngắm cảnh / leo núi",
    "Cáp treo": "Ngắm cảnh / vui chơi dịch vụ",
    "Bãi biển": "Ngắm cảnh / tắm biển",
    # loai tu nguon OSM (sweep_osm_diem_den)
    "Điểm tham quan": "Tham quan / ngắm cảnh",
    "Hang động": "Tham quan hang động",
    "Đảo": "Ngắm cảnh / biển đảo",
    "Vườn quốc gia / Khu bảo tồn": "Sinh thái / thiên nhiên",
    "Đền / Miếu": "Tham quan tâm linh",
    "Suối nước nóng": "Nghỉ dưỡng / tắm khoáng",
    "Nông trại / Vườn": "Tham quan nông nghiệp",
}

FALLBACK = "Tham quan / ngắm cảnh"


def nhan_trai_nghiem(primary):
    """category.primary -> nhan trai nghiem; fallback generic cho loai la (giu hanh vi cu docx)."""
    return EXP_MAP.get(primary, FALLBACK)
