# Kho dữ liệu du lịch — Đà Lạt

Bộ script dựng cơ sở tri thức tư vấn chuyến đi. Độc lập với ứng dụng đặt vé xe;
không import gì từ `lib/`, không chạm cơ sở dữ liệu.

## Dữ liệu nằm ở đâu, và vì sao không nằm trong git

    .tourism-data/raw/          ← toàn bộ dữ liệu (gitignored)
    documentation/tourism/      ← tài liệu bàn giao (gitignored)

**Không commit, lý do là PII chứ không phải dung lượng.** Tài liệu bàn giao chứa
**416 số di động Việt Nam thật**, kho dữ liệu chứa **14.328 số**. Với hộ kinh
doanh nhỏ — vườn dâu một người, tiệm cho thuê xe máy — "số doanh nghiệp" chính là
số di động cá nhân. Repo này được chuyển công khai trong lúc `/ship` để lấy CI
miễn phí, nên commit đồng nghĩa với công bố.

`.gitleaks.toml` đã có luật bắt đúng mẫu `\+84[35789]\d{8}`. Thêm 14k số thật vào
allowlist là vô hiệu hoá chính luật sinh ra để bắt chúng.

Số điện thoại *là* giá trị của tài liệu — mỗi hàng cần gọi xác minh đều có số kèm
sẵn. Nên chúng ở lại, chỉ là ở lại ngoài git.

## Tái tạo dữ liệu

Cột **Cần** ghi thứ không tự có: khoá, tài khoản, hoặc thoả thuận đã ký.

| Bước | Script | Ra | Cần |
|---|---|---|---|
| Quét OSM | `places_dalat.py` | `dalat_*.json` | — |
| Overture Places | `sweep_overture.py` | `overture_dalat.json` (8 MB) | — |
| Foursquare OS | `sweep_fsq.py` | `fsq_dalat.json` | ⚠ `HF_TOKEN` + **đã chấp nhận điều khoản cổng** trên HuggingFace |
| Đăng ký lưu trú nhà nước | `sweep_csdl.py` → `parse_csdl.py` | `csdl_parsed.json` | — |
| Wikidata | `sweep_wikidata.py` | `wikidata.json` | — |
| Ma trận đường bộ | `sweep_osrm.py` · `osrm_rows.py` | `osrm_*.json` | — |
| Hợp nhất | `build_destinations_md.py` | `merged_dalat.json` | — |
| Làm giàu (11 lượt) | `enrich_*.py` · `sweep_osm_facilities.py` | `enrichment.json` | Lượt 7/11 dùng trình duyệt thật |
| Facebook công khai | `resolve_facebook.py` → `fb_pages_crawl.mts` → `parse_fb_pages.py` → `emit_fb_enrichment.py` | `fb_pages.json` | — |
| Lớp hoạt động | `sweep_hoat_dong.py` → `chon_don_vi_trai_nghiem.py` | `hoat_dong.json` | — |
| Website đơn vị tour | `tour_sites_crawl.mts` → `parse_tour_sites.py` | `tour_sites_sach.json` | — |
| Dựng tài liệu | `build_huong_dan.py` · `build_huong_dan_docx.py` | `.md` + `.docx` | — |

**`fsq_dalat.json` là file khó lấy lại nhất.** Cần tài khoản HuggingFace đã được
duyệt cổng dataset, và bước duyệt đó là một thoả thuận thương mại đã ký (điều
khoản cho phép Foursquare dùng tên và logo công ty trong marketing đối tác).
Đường S3 ẩn danh mà mọi hướng dẫn trích dẫn **không hoạt động** — bucket gốc chỉ
trả về hai file giấy phép. Bản mirror trên HuggingFace mới là đường sống.

**`enrichment.json` không tái tạo hoàn toàn được.** 512 dòng dựng qua 11 lượt
nhiều ngày; lượt 7 là quan sát bằng trình duyệt thật và trang web đã có thể đổi.
Ví dụ: nó ghi lại việc Bảo tàng Lâm Đồng công bố **hai giờ mở cửa khác nhau trên
hai trang của chính họ** (trang chủ 07:30–17:30, trang vé 08:00–17:00).

## Chạy

```bash
# Python — đặt PYTHONIOENCODING trên Windows, nếu không sẽ lỗi mã hoá tiếng Việt
PYTHONIOENCODING=utf-8 python scripts/tourism/<script>.py .tourism-data/raw

# TypeScript — Playwright, không đăng nhập
pnpm tsx scripts/tourism/<script>.mts .tourism-data/raw
```

`fb_pages_crawl.mts` nhận `FB_LIMIT=2` để thử bộ trích trên 2 trang trước khi
chạy cả tập.

## Bốn quy tắc đã trả giá để có

**1. So khớp tên tiếng Việt phải GIỮ NGUYÊN DẤU và đòi biên từ.**
Bỏ dấu thì `sữa chua` khớp `sửa chữa`, `kem bơ` khớp `kem bôi`, `ốc` khớp `Ngọc`.
Thiếu biên từ thì `sup` khớp `súp`, `tour` khớp `tourist`.

**2. Tách TẢI khỏi PHÂN TÍCH.**
`*_crawl.mts` chỉ tải và lưu bằng chứng; `parse_*.py` giữ toàn bộ logic trích.
Bộ trích sẽ sai vài lần trước khi đúng — tách ra thì mỗi lần sửa là chạy lại
ngoại tuyến, không phải tải lại 35 trang. Hệ quả: **bộ lọc quyết định GIỮ gì,
không bao giờ quyết định LƯU gì.**

**3. Trích theo BẢN GHI, không theo trường.**
Một trang liệt kê 8 tour, quét regex theo trường sẽ cho một rổ 12 mức giá không
gắn được vào tour nào. Giá trị không quy được về bản ghi thì không phân biệt được
với giá trị bịa, một khi đã vào tài liệu.

**4. Bộ cắt dữ liệu cá nhân phải khớp MỌI ngôn ngữ trang có thể trả về.**
`fb_pages_crawl.mts` đặt `locale: 'vi-VN'` nhưng marker cắt viết bằng tiếng Anh —
không marker nào khớp, phép cắt thành lệnh rỗng, tên người bình luận vào thẳng
file. Nay marker song ngữ, kèm phép kiểm `POISON` loại bỏ cả hàng nếu còn dấu vết
bài đăng sau khi cắt.

## Ranh giới đã chốt

- **Không lưu bài đăng, tên tài khoản, ảnh mặt.** PDPL 2025 không có miễn trừ
  "đã đăng công khai". Chỉ đọc dữ liệu doanh nghiệp trên trang công khai, không
  đăng nhập, không vượt rào kỹ thuật — đúng phía an toàn của Meta v. Bright Data.
- **Không lưu điểm đánh giá** từ Google Places (chỉ được lưu `place_id`) hay
  TripAdvisor (chỉ được lưu Location ID). Tỉ lệ đề xuất của Facebook nằm ở trường
  riêng `ty_le_gioi_thieu`, không bao giờ ánh xạ vào `Đánh giá của khách`.
- **Giá từ nguồn thương mại vào `gia_tham_khao`, kèm mọi giá trị mâu thuẫn.**
  Ba nguồn từng lệch nhau 3 lần cho cùng một địa điểm.
