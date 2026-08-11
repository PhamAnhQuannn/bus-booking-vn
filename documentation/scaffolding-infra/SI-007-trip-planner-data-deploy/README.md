# SI-007 — Trip-Planner Data Deploy (Runbook)

**Status:** ACTIVE 2026-08-10.
**Scope:** Đưa data KB planner (trip-planner) lên PROD + guard tối thiểu + smoke-test.
**Xref:** `DS-018-trip-planner-geo-ruleset` (engine). Code: `trip-planner/lib/planner/store.ts` (`getStore`/`loadStoreBlob`), `trip-planner/scripts/upload-kb.ts`, `smoke-cities.ts`, `cities.ts` (`CITIES`).

---

## Bối cảnh

Data KB **gitignored → KHÔNG có trong bundle Vercel**. Prod BẮT BUỘC nạp từ **R2 private** qua `getStore → loadStoreBlob` (key `tourism/<slug>/<file>.json`). Serve toàn bộ `CITIES` (`cities.ts`, hiện **30 slug**). 4 file phục vụ/city nhỏ (~0.9–2MB) → cold-start nhẹ.

**Điều kiện sống:** thiếu env `STORAGE_*` → `blobEnabled()` false → fallback đọc đĩa → ENOENT → 500 toàn planner. Slug thiếu R2 → `getStore` throw `CityDataUnavailableError` → caller trả 404 (API) / block "Chưa hỗ trợ" (SSR) — KHÔNG 500.

**KHÔNG cần Google API key** ở runtime — planner dùng KB tĩnh, không fetch rating live.

---

## Quy trình (từng bước)

### 1. Provision R2 (Cloudflare)
- Tạo **bucket private** (vd `bbvn-tourism`). KHÔNG public access.
- Tạo **API token** (R2) → lấy `Access Key ID` + `Secret Access Key`.
- Ghi lại: `endpoint = https://<accountid>.r2.cloudflarestorage.com`, `region = auto`.

### 2. Env Vercel (Production scope)
Set 6 biến (Vercel → Project → Settings → Environment Variables → Production):

| Key | Value |
|-----|-------|
| `STORAGE_STUB` | `false` |
| `STORAGE_BUCKET` | tên bucket (vd `bbvn-tourism`) |
| `STORAGE_ENDPOINT` | `https://<accountid>.r2.cloudflarestorage.com` |
| `STORAGE_REGION` | `auto` |
| `STORAGE_ACCESS_KEY` | R2 Access Key ID |
| `STORAGE_SECRET_KEY` | R2 Secret Access Key |

> Thiếu 1 key → `blobEnabled()` false → planner 500. Bước 5 (smoke) bắt trước khi mở.

### 3. Build export data
- Chạy pipeline `tourism-kb/code/` → sinh 4 file/city (`meta.json`, `diem-den.json`, `nha-hang.json`, `khach-san.json`) vào `tourism-kb/export/<slug>/`.
- Verify: mỗi slug trong `CITIES` có đủ thư mục + 4 file. Đối chiếu `CITIES.length` slug.

### 4. Upload lên R2 (tay)
```bash
STORAGE_STUB=false STORAGE_BUCKET=... STORAGE_ENDPOINT=... STORAGE_REGION=auto \
STORAGE_ACCESS_KEY=... STORAGE_SECRET_KEY=... \
pnpm tsx trip-planner/scripts/upload-kb.ts
```
- Xác nhận log: **PUT = CITIES.length × 4** file (hiện 30×4 = **120**), **0 SKIP**. SKIP = file export thiếu → quay lại bước 3.

### 5. Smoke-test (data prod)
```bash
STORAGE_STUB=false STORAGE_BUCKET=... ... \
pnpm tsx trip-planner/scripts/smoke-cities.ts
```
- Kỳ vọng: **N/N OK, 0 FAIL**. `⚠ THƯA` = city data mỏng (lịch ngắn hơn sàn) — KHÔNG chặn, nhưng cân nhắc bổ sung điểm hoặc tạm ẩn city đó khỏi `CITIES`.
- FAIL bất kỳ → slug đó chưa upload / lỗi data → sửa trước khi deploy.

### 6. Deploy + verify prod
- Deploy Vercel (push nhánh / promote).
- `curl "https://<prod>/api/planner/itinerary?slug=da-lat&days=3&pace=relaxed"` → **200** + JSON `dto`.
- Vài slug khác trong `CITIES` → 200.
- `curl "https://<prod>/api/planner/itinerary?slug=khong-ton-tai&..."` → **404** `city_unavailable` (KHÔNG 500).
- `/lich-trinh?slug=da-lat&days=3` → timeline điểm-đến + "Gợi ý quán ăn" + "Khách sạn gợi ý".

### 7. Freshness (re-verify + re-upload)
- Re-run export + `upload-kb.ts` định kỳ (cadence do Product chốt — DS-018 open item #2).
- ⚠️ Cache RAM per-instance **không TTL** → sau re-upload phải **redeploy / recycle instance** để prod thấy data mới. Không tự động.
- **STAGED (tương lai):** versioned key `tourism/<slug>/v<N>/...` + env trỏ version → refresh không cần recycle.

---

## Guard đã cài (Option A)
- `getStore`: slug ∉ `CITIES` **hoặc** nạp lỗi (R2 NoSuchKey / đĩa ENOENT) → throw `CityDataUnavailableError` (log nguyên nhân gốc, không nuốt mù).
- `/api/planner/itinerary` → catch → **404** `{ error: 'city_unavailable' }`.
- `/lich-trinh` (RSC) → catch → block "Chưa hỗ trợ thành phố này".
- `smoke-cities.ts` → chạy trước go-live, đánh dấu FAIL + lịch thưa.

## Đã kiểm (2026-08-10, dev đĩa)
- `tsc`/`lint` 0 error · smoke 30/30 OK (4 thưa: hung-yen/ca-mau-tp/mong-cai/van-don) · API slug giả → 404 · SSR slug giả → "Chưa hỗ trợ" · golden-trip da-lat/da-nang pass.
