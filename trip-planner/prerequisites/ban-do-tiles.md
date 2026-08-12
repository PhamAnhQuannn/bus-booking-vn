# Bản đồ: thư viện + nguồn tile

status: **done (đã chọn hướng)** · nguồn tra: 2026-08-02

## Phân biệt quan trọng: THƯ VIỆN ≠ NGUỒN TILE

- **Thư viện** (miễn phí, không ràng buộc): **Leaflet** hoặc **MapLibre GL JS**. Render bản đồ,
  marker, đường đi. Không tốn tiền.
- **Nguồn tile** (ảnh bản đồ): ĐÂY mới là chỗ có ràng buộc + chi phí. **Không được** dùng thẳng
  `tile.openstreetmap.org` cho production.

## Vì sao không dùng tile OSM công cộng cho production

Chính sách OSM: dữ liệu miễn phí, nhưng **máy chủ tile chạy bằng quyên góp, dung lượng hạn chế**.
Cấm dùng nặng/không phù hợp; **cấm offline** (tải sẵn vùng); có thể **chặn không báo trước** nếu
làm giảm dịch vụ. Không đủ cho một sản phẩm có người dùng thật.
→ Phải: (a) dùng nhà cung cấp tile có free-tier hợp lệ, hoặc (b) tự host tile.

## Lựa chọn (khuyến nghị theo cheapest-first)

| Cách | Chi phí | Ghi chú |
|---|---|---|
| **MapTiler / Stadia Maps free-tier** (khuyến nghị V1) | free tới hạn mức | tile hợp pháp cho production, có API key, ghi công OSM. Hạn mức đủ cho lưu lượng V1 nhỏ. |
| **Mapbox** | 50.000 map loads/tháng free | KHÔNG cần thẻ để tạo token; **KHÔNG có trần chi tiêu** → traffic vọt là tính tiền, chỉ báo email. Rủi ro hoá đơn. |
| **Tự host tile** (OpenMapTiles) | ~$10–20/tháng VM | không ràng buộc bên thứ ba, làm khi lưu lượng lớn (theo bậc thang chi phí như KB). |

**Chốt V1**: Leaflet (hoặc MapLibre) + một nhà cung cấp tile free-tier (MapTiler/Stadia), luôn
hiện `© OpenStreetMap contributors`. Escalate sang tự-host khi vượt free-tier (trigger theo đo).

## Ràng buộc Google Places (đọc trước khi vẽ)

Ta lưu `place_id` (được phép lưu vĩnh viễn). Nhưng **Google §5.3 cấm để nội dung Places cạnh
bản đồ KHÔNG-phải-Google**. Nên: nội dung từ `place_id` chỉ dùng để tạo **deep-link mở Google
Maps**, KHÔNG hiển thị cạnh bản đồ Leaflet/OSM. Bản đồ của ta chỉ vẽ dữ liệu KB của ta (toạ độ
Overture/OSM/khảo sát). Chi tiết ở [google-places.md](google-places.md).

## Mapbox — tạo token (nếu chọn Mapbox)

1. Đăng ký mapbox.com (không cần thẻ để bắt đầu).
2. Token mặc định ở trang Account; production nên tạo **scoped token** (Account > Access Tokens
   > Create a Token), giới hạn scope + URL.
3. **Không có spending cap** → đặt cảnh báo, cân nhắc rotate token nếu lộ.

## PDF
Không cần nhà cung cấp bản đồ riêng cho PDF: tái dùng `@react-pdf/renderer` sẵn có
(`lib/booking/ticketPdf.tsx`). V1 có thể chỉ liệt kê chặng + deep-link thay vì nhúng ảnh bản đồ.

## Nguồn (tra 2026-08-02)
- https://operations.osmfoundation.org/policies/tiles/
- https://apicostcalc.com/mapbox.html
- Nội bộ: `tourism-kb/code/sweep_google_placeid.py` (docstring điều khoản Google).
