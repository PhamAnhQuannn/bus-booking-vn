# Kho dữ liệu du lịch — Đà Lạt

Bộ script dựng cơ sở tri thức tư vấn chuyến đi. Độc lập với ứng dụng đặt vé xe;
không import gì từ `lib/`, không chạm cơ sở dữ liệu.

## Kiến trúc — mô hình memory-architecture

Cả tính năng nằm trong `tourism-kb/`, tách hẳn khỏi app đặt vé xe:

    tourism-kb/
    ├── CLAUDE.md   ← mem: doctrine + nhật ký lỗi (nested, tự nạp trong subtree này)
    ├── README.md   ← tài liệu pipeline này
    ├── code/       ← ctx: toàn bộ script (được theo dõi git — subtree DUY NHẤT được commit)
    ├── raw/        ← raw: mỗi tỉnh một thư mục raw/<slug>/ (gitignored) — xem dưới
    │   └── <slug>/
    │       ├── scrape/   ← JSON thô + trung gian (overture, wikidata, guide_data, place_id*, build/, pages/ …)
    │       ├── noi-bo/   ← data NỘI BỘ (rank_noi_bo_nha_hang.json · rank_noi_bo_khach_san.json) — CẤM ship
    │       └── docx/     ← docx NỘI BỘ (Rank-Noi-Bo-Nha-Hang-<City>.docx · Rank-Noi-Bo-Khach-San-<City>.docx) — CẤM ship
    ├── wiki/       ← wiki: tài liệu bàn giao .md + TRANG-THAI.md (gitignored)
    └── output/     ← output: ba bản phát hành .docx theo địa điểm — output/<địa-điểm>/ + archive/ (gitignored)

**RAW = `tourism-kb/raw/<slug>/scrape`** cho MỌI script (`slug_of` vẫn suy ra `<slug>`).
Pipeline đọc+ghi trong `scrape/`; script NỘI BỘ ghi sang sibling `noi-bo/` + `docx/`
(city = `dirname(RAW)`). Cùng khuôn cho mọi tỉnh — thêm tỉnh = thêm `raw/<slug>/`.

`raw` = sự thật gốc bất biến · `wiki` = tri thức có cấu trúc và liên kết ·
`output` = bản dùng được cho người đọc (tác nhân AI) · `code` = pipeline (quy
tắc/khuôn mẫu) · `CLAUDE.md` = trí nhớ. Xem `CLAUDE.md` cho doctrine + bốn guard.

## Dữ liệu nằm ở đâu, và vì sao không nằm trong git

    tourism-kb/raw/     ← toàn bộ dữ liệu thô + trung gian (gitignored)
    tourism-kb/wiki/    ← tài liệu bàn giao (gitignored)
    tourism-kb/output/  ← ba bản phát hành .docx (gitignored)

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
| Dựng docx điểm đến (**CHUẨN**) | `build_diem_den_docx.py tourism-kb/raw/<slug>/scrape` | `Diem-Den-<City>.docx` — **bản rút gọn 6 cột** | Đọc `export/<slug>/diem-den.json`; chuẩn cho MỌI city |
| Dựng docx nhà hàng (**CHUẨN**) | `build_nha_hang_docx.py tourism-kb/raw/<slug>/scrape` | `Nha-Hang-<City>.docx` — **bản rút gọn 5 cột** | Đọc `export/<slug>/nha-hang.json`, sort theo khoảng cách; NT/DN cần `sweep_nha_hang.py`+`export_planner.py` trước |
| (legacy) verbose + KS | `build_huong_dan.py` **rồi** `build_huong_dan_docx.py` | `.md` + `.docx` Khách sạn | Chỉ khi có data KS; điểm đến/nhà hàng nay dùng bản rút gọn |
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
python tourism-kb/code/build_huong_dan.py      tourism-kb/raw/da-lat/scrape
python tourism-kb/code/build_huong_dan_docx.py tourism-kb/raw/da-lat/scrape
python tourism-kb/code/kiem_parity.py
```

### Docx điểm đến = BẢN RÚT GỌN (chuẩn, mọi city)

Bản giao điểm đến nay là **bản rút gọn 6 cột**, dựng bằng `build_diem_den_docx.py`
(đọc `export/<slug>/diem-den.json`). Bảng: **STT · Tên · Loại hình / trải nghiệm ·
Địa chỉ · Giờ mở cửa - đóng cửa · Giá vé**; ô trống = `Chưa xác minh`. Loại hình →
nhãn trải nghiệm qua `EXP_MAP` (loai_vn → "Tham quan tâm linh / kiến trúc" …).
Slug/city tự suy từ đường dẫn `raw/<slug>` qua `dia_diem_config` (không còn sửa
hằng tay). Chuẩn theo file mẫu `Danh-sach-diem-den-*-rut-gon-phan-loai-trai-nghiem.docx`.

```bash
python tourism-kb/code/build_diem_den_docx.py tourism-kb/raw/nha-trang/scrape   # -> output/nha-trang/Diem-Den-Nha-Trang.docx
```

### Docx nhà hàng = BẢN RÚT GỌN (chuẩn, mọi city)

Bản giao nhà hàng là **bản rút gọn 5 cột**, dựng bằng `build_nha_hang_docx.py`
(đọc `export/<slug>/nha-hang.json`). Bảng: **Nhà hàng / quán ăn · Loại món · Giá trung
bình/người · Địa chỉ · Điểm Google**; **sắp theo MỨC ĐỘ ẢNH HƯỞNG** (thứ tự VQS nội bộ, quán
đông khách/ảnh hưởng cao lên trước — QUYẾT ĐỊNH 2026-08-05, xem `## Thứ tự ảnh hưởng`). **KHÔNG
in điểm/sao/lượt — chỉ THỨ TỰ.** Giá + Điểm Google = `Chưa xác minh`. Loại món qua `HANG_MUC_VN`
(hang_muc Overture → "Cà phê" / "Nhà hàng Trung Hoa" …). Chuẩn theo file mẫu `Danh-sach-*-nha-hang-*-rut-gon.docx`.

City mới cần dựng data nhà hàng trước (Overture-only, không FSQ/vlog):

```bash
python tourism-kb/code/sweep_nha_hang.py  tourism-kb/raw/<slug>/scrape   # -> nha_hang.json
python tourism-kb/code/export_planner.py  tourism-kb/raw/<slug>/scrape   # -> export/<slug>/nha-hang.json (curated 250)
python tourism-kb/code/build_nha_hang_docx.py tourism-kb/raw/<slug>/scrape
```

### Docx khách sạn = BẢN RÚT GỌN (chuẩn, mọi city)

`build_khach_san_docx.py` đọc `export/<slug>/khach-san.json`, **giữ thứ tự export = MỨC ĐỘ ẢNH HƯỞNG**
(không re-sort). Cột: **Khách sạn/lưu trú · Loại hình · Địa chỉ · Điện thoại · Bản đồ(link)**. **BỎ cột
giá/hạng sao** — city nguồn Overture (NT/DN) không có giá; bỏ cột thay vì pad 100% "Chưa xác minh" (cột
toàn trống = claim field không tồn tại). Cột Bản đồ = link Google (place_id nếu có, else toạ độ). KHÔNG in
điểm/sao. Ghi `output/<slug>/Khach-San-<City>.docx`.

### Acquisition khách sạn + nhà hàng cho city KHÔNG có sổ nhà nước (NT/DN)

Đà Lạt lấy khách sạn từ **sổ CSDL nhà nước** (`sweep_csdl`→`parse_csdl`→`sweep_luu_tru` — có giá/hạng sao/
thẩm định). City khác không có registry → **Overture-only** (chỉ field cần thiết, giá/sao/thẩm định = null,
provenance = `SRC_OT` "Overture aggregate, chưa xác minh"):

```bash
# Khách sạn: bulk toàn bộ lodging (0 gọi API) -> luu_tru.json -> export populate khach-san.json
python tourism-kb/code/sweep_luu_tru_overture.py tourism-kb/raw/<slug>/scrape   # NT 1616 · DN 2975
# Nhà hàng rank: resolve place_id ĐÚNG tập export (top-250 theo confidence, KHÔNG nearest-center)
python tourism-kb/code/resolve_quan_overture.py  tourism-kb/raw/<slug>/scrape 250   # -> place_id_quan.json
python tourism-kb/code/rank_noi_bo_nha_hang.py   tourism-kb/raw/<slug>/scrape        # -> noi-bo/ (VQS)
# rồi export_planner + 3 docx (diem-den · nha-hang · khach-san)
```

**CHỐT cap-before-sort:** `export_planner` cắt top-250 nhà hàng theo confidence TRƯỚC khi reorder ảnh hưởng;
resolver phải nhắm đúng tập đó (không thì rank↔export lệch, phí quota — như DL cũ ~30/250). Kết quả NT/DN:
rank top = export top khớp.

### Xếp hạng NỘI BỘ (nhà hàng + khách sạn) — CẤM ship

Để **tự chọn lịch trình**, hai cặp script fetch Google `rating`+`userRatingCount` LIVE rồi
GHI ra file **gitignored** `raw/<slug>/noi-bo/` + `docx/`. Xếp theo **VQS = √lượt × chất-lượng³**
(ưu tiên SỐ LƯỢT/độ đông khách, dìm rating tệ), gate n≥5. **NGOẠI LỆ có chủ đích** với doctrine
no-persist — hợp lệ vì file không bao giờ ship. **★ là Google user-rating, KHÁC hạng sao nhà nước.**
Sản phẩm khách vẫn `Chưa xác minh` / "quy ước giá". Cần `GOOGLE_MAPS_API_KEY` (tốn quota).

```bash
# Nhà hàng (bỏ khách sạn theo tên + primaryType)
python tourism-kb/code/rank_noi_bo_nha_hang.py        tourism-kb/raw/<slug>/scrape
python tourism-kb/code/build_rank_docx_noi_bo.py      tourism-kb/raw/<slug>/scrape
# Khách sạn (giữ lưu trú theo lop, bỏ quán ăn) — đọc place_id_hxh/place_id/place_id_luu_tru.json
python tourism-kb/code/rank_noi_bo_khach_san.py       tourism-kb/raw/<slug>/scrape
python tourism-kb/code/build_rank_docx_khach_san_noi_bo.py tourism-kb/raw/<slug>/scrape
```

**City KHÔNG có sổ đăng ký nhà nước** (Nha Trang, Đà Nẵng — chỉ Đà Lạt có `csdl_parsed.json`):
resolve `place_id` khách sạn **từ Overture** trước khi rank. `resolve_luu_tru_overture.py` lọc category
lodging trong `overture_dalat.json`, thu về **~150 gần trung tâm nhất** (cap chặn chi phí), rồi gọi
matcher 2-trục **chung** của `sweep_google_placeid.py` (import lại — luật chống nhầm định danh viết 1 lần)
→ ghi `place_id_luu_tru.json`. `rank_noi_bo_khach_san.py` tự đọc file này.

```bash
python tourism-kb/code/resolve_luu_tru_overture.py tourism-kb/raw/nha-trang/scrape [150]
# rồi chạy 2 lệnh khách sạn ở trên
```

### Thứ tự ảnh hưởng — output khách sắp theo VQS (QUYẾT ĐỊNH 2026-08-05)

**Quyết định của chủ sản phẩm, đảo doctrine cũ có chủ đích.** Bản khách (`export/<slug>/nha-hang.json`,
`khach-san.json` + docx nhà hàng) nay **SẮP theo THỨ TỰ ẢNH HƯỞNG** = thứ hạng VQS trong `noi-bo/rank_*`
(quán/KS đông khách, ảnh hưởng cao lên trước). **KHÔNG in điểm/★/lượt/hạng — CHỈ thứ tự.** Nhân viên tư vấn
nhìn thứ tự để tư vấn; AI planner đọc từ trên xuống (`plan.ts` chọn nhà hàng/KS theo thứ tự này, guard địa lý).

Cơ chế: `anh_huong.py` đọc `noi-bo/rank_noi_bo_<loai>.json`, join record↔rank theo `place_id` (khi có) rồi
`fold(ten)`; `export_planner.py` gọi `sap_xep()` sau khi dựng mảng. Record chưa có rank giữ thứ tự cũ (xuống sau).

**Đánh đổi (đã cân nhắc, user chấp nhận):**
1. Thứ tự = một thứ hạng **đóng băng** vào bản giao → cũ dần như bất kỳ hạng in ra giấy nào. Doctrine cũ
   (`xep_hang_song.py:16-19`) coi "lưu chữ 'A'" và "lưu THỨ TỰ" rủi ro NGANG nhau — quyết định này override.
2. ToS Google: thứ tự phái sinh từ rating live → bản giao mang một sắp xếp Google-phái-sinh. Con số vẫn
   không lưu/không in; rank file vẫn **gitignored** (chỉ THỨ TỰ chảy vào export, không phải con số).
3. **Coverage:** tập ranked (place_id_* → VQS) thường ≠ tập curated export. DL nhà hàng chỉ ~30/250 có rank
   → phần lớn giữ thứ tự cũ; khách sạn ~57/221. Muốn phủ hơn: rank thêm quán trong export (resolve place_id).

### `output/` chia theo ĐỊA ĐIỂM

`output/<địa-điểm>/` là một thư mục riêng cho mỗi địa điểm, vì nhiều tỉnh và tên
file không được đụng nhau. Bản verbose (legacy) `build_huong_dan_docx.py` giữ hằng
`DIA_DIEM` (nay tự suy từ slug); bản rút gọn suy slug từ `dia_diem_config`.

`output/da-lat/Diem-Den-Da-Lat.docx` · `Nha-Hang-Da-Lat.docx` ·
`Khach-San-Da-Lat.docx`, dựng bằng `--tai-lieu diemden|nhahang|khachsan`. Hậu tố
`-Da-Lat` giữ nguyên trong tên file (không rút gọn) vì G8 rule 3 bắt bản giao bị
chép ra ngoài vùng ignore theo mẫu `*Diem-Den-*`/`*Nha-Hang-*`/`*Khach-San-*` —
tên không hậu tố sẽ lọt lớp guard đó. Số mục **cấp 1 và cấp 2 đều được
cấp phát lại theo từng tài liệu** (`muc_con()`), nên bản khách sạn in `2.1/2.2`
chứ không phải `6.1/6.2` — không để lỗ hổng số làm người đọc tưởng thiếu nội dung.

Bản **gộp** ghi ra `tourism-kb/raw/da-lat/scrape/build/Huong-Dan-Da-Lat.docx`, **không** nằm
trong `output/`: nó không phải bản giao, nó là **mốc neo của `kiem_parity.py`** —
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
PYTHONIOENCODING=utf-8 python tourism-kb/code/<script>.py tourism-kb/raw/<slug>/scrape

# TypeScript — Playwright, không đăng nhập
pnpm tsx tourism-kb/code/<script>.mts tourism-kb/raw/<slug>/scrape
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
  **NGOẠI LỆ (QUYẾT ĐỊNH chủ sản phẩm 2026-08-05):** bản khách (export JSON + docx nhà hàng)
  nay được **SẮP theo THỨ TỰ ảnh hưởng** (VQS nội bộ) — con số vẫn KHÔNG in, chỉ THỨ TỰ đổi.
  Đây là đảo doctrine cũ ("lưu chữ 'A' và lưu THỨ TỰ rủi ro ngang", `xep_hang_song.py`); xem
  `## Thứ tự ảnh hưởng` để rõ đánh đổi (thứ tự = hạng đóng băng sẽ cũ dần + ToS phái sinh).
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
