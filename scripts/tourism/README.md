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
| Dựng tài liệu | `build_huong_dan.py` **rồi** `build_huong_dan_docx.py` | `.md` + `.docx` | Thứ tự bắt buộc — xem dưới |
| Kiểm hai bản khớp nhau | `kiem_parity.py` | exit 0/1 | Chạy sau mỗi lần dựng |
| Liên kết Google Maps | `sweep_google_placeid.py <raw> [--bo hxh\|quanhxh]` | `place_id*.json` | ⚠ `GOOGLE_MAPS_API_KEY`; **chỉ lưu `place_id`** |
| Xếp hạng (in ra chat) | `xep_hang_song.py <raw> quan_hxh\|luu_tru_hxh` | **không ghi file** | Tính lại mỗi lần chạy — xem dưới |
| Kiểm công thức xếp hạng | `test_xep_hang.py` | exit 0/1 | Offline, 0 quota |

### Thứ tự dựng tài liệu là bắt buộc

`build_huong_dan.py` **ghi** `guide_data.json`; bản `.docx` chỉ **đọc** lại file
đó. Chạy riêng bản `.docx` sẽ dùng bộ điểm của lần chạy `.md` gần nhất — không
lỗi, không cảnh báo, chỉ là dữ liệu cũ. Bản `.docx` nay dừng hẳn nếu
`enrichment.json` hoặc `lan_can*.json` mới hơn `guide_data.json`, nên trường hợp
im lặng đó đã thành ồn ào; việc tách logic chọn ra `diem_den_data.py` để xoá hẳn
lớp lỗi này vẫn còn treo.

```bash
python scripts/tourism/build_huong_dan.py      .tourism-data/raw
python scripts/tourism/build_huong_dan_docx.py .tourism-data/raw
python scripts/tourism/kiem_parity.py
```

### `docs/` giữ ĐÚNG BA bản giao

`Diem-Den-Da-Lat.docx` · `Nha-Hang-Da-Lat.docx` · `Khach-San-Da-Lat.docx`, dựng
bằng `--tai-lieu diemden|nhahang|khachsan`. Số mục **cấp 1 và cấp 2 đều được
cấp phát lại theo từng tài liệu** (`muc_con()`), nên bản khách sạn in `2.1/2.2`
chứ không phải `6.1/6.2` — không để lỗ hổng số làm người đọc tưởng thiếu nội dung.

Bản **gộp** ghi ra `.tourism-data/build/Huong-Dan-Da-Lat.docx`, **không** nằm
trong `docs/`: nó không phải bản giao, nó là **mốc neo của `kiem_parity.py`** —
chỉ bản gộp mới đánh số giống bản `.md`, nên ba bản tách không so trực tiếp với
`.md` được.

**Chạy cả hai trong CÙNG một lượt, không tách ra.** `kiem_parity.py` từ chối so
nội dung khi hai file cách nhau quá 300 giây (`LECH BUILD`) — nên dựng lại một
bản rồi để bản kia nguyên vì "nó vẫn đúng" sẽ khiến bộ chặn đỏ vĩnh viễn, và
một bộ chặn đỏ vĩnh viễn thì không ai đọc nữa. Nếu bản `.docx` ghi hỏng (Word
đang mở file → `PermissionError`), đóng Word rồi chạy lại **cả hai**.

**`kiem_parity.py` là bộ chặn duy nhất cho quy tắc "một nguồn chọn lọc, hai
nguồn định dạng".** Quy tắc đó đã bị phá hai lần, cả hai lần im lặng: khối phụ
lục xuất xứ chỉ tồn tại ở bản `.md` (32 link Facebook, 21 lượt check-in, bảng
thứ hạng — bản `.docx` mất trắng), và mục 12/13 xếp hạng bằng hai công thức khác
nhau nên hai bản bất đồng về thứ tự gọi điện xác minh. Cả hai chỉ lộ ra khi so
hai file bằng tay.

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
  Tài liệu phát **liên kết `place_id`** để người đọc thấy điểm hiện tại trên bề
  mặt Google — một thứ hạng in ra giấy sẽ cũ đi mà không có gì báo rằng nó sai.
  Google **không** phát số review theo từng mức sao ở bất kỳ tầng giá nào; chỉ có
  điểm trung bình, tổng số lượt, một MẪU review và tóm tắt AI.
- **Xếp hạng: quy tắc vào file, con số KHÔNG vào file.** `xep_hang.py` giữ ngưỡng
  (cận dưới Wilson 95%: A ≥ 4,7 · B ≥ 4,4 · C ≥ 4,0, sàn 30 lượt) và **không có
  I/O** nên test được offline với 0 quota. `xep_hang_song.py` gọi Google, in bảng
  ra màn hình, **không mở handle ghi nào**. Tài liệu `.md`/`.docx` chỉ chứa quy
  tắc + câu lệnh, không chứa điểm/số lượt/hạng.
  **Ngưỡng là TUYỆT ĐỐI, không neo vào một quán mốc** — bản neo-vào-mốc đã bị bỏ
  sau khi đo: giữ nguyên 172 quán, chỉ đổi quán mốc thì hạng A đi từ 12 lên 27,
  vì `n₀` là giá trị cực đại của một phân phối lệch nặng. Quán mốc chỉ dùng để
  **định cỡ ngưỡng một lần**, rồi ngưỡng đóng băng thành hằng dùng chung.
  Hai trạng thái âm phải phân biệt: `—` *dưới chuẩn* (một kết luận) khác `None`
  *chưa đủ đánh giá* (một khoảng trống).
- **Không có hạng sao khách sạn.** 0/420 cơ sở mang nó, và nguồn công bố (đăng ký
  Cục Du lịch) trả 403 từ 31/07/2026. Mọi nhãn kiểu "3 sao" trong tài liệu là
  **quy ước giá** (`an_ngu_data.GIA_3SAO`) và phải được nói rõ như vậy tại chỗ.
- **Giá từ nguồn thương mại vào `gia_tham_khao`, kèm mọi giá trị mâu thuẫn.**
  Ba nguồn từng lệch nhau 3 lần cho cùng một địa điểm.
