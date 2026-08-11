# DS-018 — Trip-Planner Geographic Selection Ruleset (v2)

**Status:** v2 — partition-first + guard-HARD + **compactness-at-selection (nhóm A + G4)** IMPLEMENTED (2026-08-09); nhóm C-robustness/D-nâng-cao/F-thời-gian/E-anchor còn STAGED.
**Scope:** Logic chọn/sắp điểm tham quan của engine trip-planner (`trip-planner/lib/planner/`), deterministic V1, KHÔNG LLM.
**Xref:** `business/tour-discovery/README.md` (Finding 1 — đơn vị lo là ĐOẠN NỐI, không phải điểm; Finding 4 — anchor+flex; Finding 11 — greenfield, chưa có spec). `documentation/AGENTS.md` (7-series).

---

## 1. Mục tiêu & non-goal

**Mục tiêu.** Với một `TripRequest` (slug thành phố, số ngày, party, pace, interests, accessibility), engine chọn + sắp điểm sao cho **mỗi ngày nằm trong một vùng thuận tiện** — không nhảy 2 đầu thành phố rồi vòng lại cả ngày (than phiền gốc "it never looked at a map"). Itinerary là **đồ thị có chi phí đi lại thật**, không phải danh sách tên.

**Non-goal (V1).** Không LLM; không đặt/thanh toán khách sạn-quán-điểm (marketplace-info, last-verified date); không giá gộp (tránh kinh doanh lữ hành); không trục thời gian đầy đủ (data-gated — xem §4).

---

## 2. Ruleset v2 (A–G)

Mỗi rule: mô tả thực thi + ngưỡng + **trạng thái**. Trạng thái: `IMPLEMENTED` · `STAGED-CODE` (làm được với data hiện tại, chưa code) · `STAGED-DATA` (cần data/schema mới, xem §4).

### A — CHỌN (selection: đưa địa lý vào bước chọn) — IMPLEMENTED 2026-08-09 (`growCompact`)
| ID | Rule | Trạng thái |
|----|------|-----------|
| A1 | Compactness: quality chỉ quyết TRONG cụm (`pts` sort điểm giảm dần); cụm xa bị loại. | IMPLEMENTED |
| A2 | Cùng vùng ưu tiên: duyệt cụm theo distToSeed tăng dần, giữ cụm gần seed. | IMPLEMENTED |
| A3 | Coverage floor + trade-off: compactness THẮNG coverage — cụm xa bị loại (kèm note lịch ngắn), không kéo vào cho đủ số. | IMPLEMENTED |
| A0 | Cụm hoá TRƯỚC chọn: group theo `region_id`; gap-stop `d > max(ABS_GAP_KM, GAP_FACTOR×median(dists))` tách cụm xa (chống chaining bằng cách neo distToSeed cố định). | IMPLEMENTED |
| A4 | Diameter-gate lúc chọn: cụm vượt gap-stop khỏi seed → LOẠI (không nhận điểm phình đường kính). | IMPLEMENTED |
| A5 | Seed = cụm `mass` (Σscore) cao nhất, tie `distTam`/`key` — có sẵn trước khi chọn, không chicken-egg. | IMPLEMENTED |
| A6 | Fallback KB thưa: điểm thiếu `region_id` → `clusterByCoord` (single-linkage `ABS_GAP_KM`), không để mỗi điểm thành cụm rời. | IMPLEMENTED |

**Hằng số** (`plan.ts`): `GAP_FACTOR=2`, `ABS_GAP_KM=8`, `MIN_JOINS_FOR_GAP=2`. **Guard mới:** golden-trip `=== KIỂM CHỌN ===` HARD-fail khi ≥2 ngày cách trọng tâm >`SELECT_CAP_KM=12` (cho phép ≤1 ngày marquee). Marquee (C1) giờ chạy TRONG cụm đã giữ — KHÔNG bảo vệ cụm xa.

### B — SẮP trong ngày (ordering)
| ID | Rule | Trạng thái |
|----|------|-----------|
| B1 | 1 ngày = 1 cụm liền kề (1 zone). | IMPLEMENTED |
| B2 | Vòng kín từ khách sạn: TSP brute-force ≤6 điểm (ma trận OSRM), NN fallback >6. | IMPLEMENTED (`orderLoop`) |
| B3 | KHÔNG tái nhập vùng (không sáng-nam→trưa-bắc→tối-nam). HARD invariant. | IMPLEMENTED (`golden-trip.ts` re-entry) |
| B4 | Đơn điệu hướng: NN centroid từ tâm, không zig-zag tiến-lùi. | IMPLEMENTED (`macroOrder`) |
| **B5** | **Partition-first: gán TRỌN region vào từng ngày; ranh giới ngày rơi trên biên region; chỉ gộp khu nhỏ macro-kề khi còn chỗ. Bỏ order-then-cut (cắt index cơ học).** | **IMPLEMENTED (`packDays`, 2026-08-09)** |
| B1b | Corridor exempt: bbox aspect > 2.5 (hoặc PCA 1D) → đo bằng khoảng cách chiếu trục chính, không diameter 2D. | STAGED-CODE |

### C — OUTLIER xa (marquee)
| ID | Rule | Trạng thái |
|----|------|-----------|
| C1 | Điểm cách tâm > `FAR_FACTOR×median` (2×) + region `card ≤ MARQUEE_CARD_MAX` (2) → ngày riêng hoặc loại (kèm note). | IMPLEMENTED |
| C1b | n < 5 điểm/ngày → ngưỡng km tuyệt đối theo config vùng, bỏ median (median loạn ở n=3–4). | STAGED-CODE |
| C1c | must-see auto `anchor=true` trước A/C — tránh C1 loại nhầm must-see xa. | STAGED-CODE |
| C2 | Bỏ ràng cứng `card≤2`; dùng ngưỡng khoảng cách + mật độ. | STAGED-CODE |
| C3 | `days<3` vẫn phải cách ly outlier (loại-kèm-note, không im lặng trộn). | STAGED-CODE |
| C4 | Verify `region_id` runtime bằng DBSCAN: điểm cùng region phải trong bán kính quanh centroid; lệch → solo/cảnh báo. | STAGED-DATA |

### D — INVARIANT / guard (regression gate)
| ID | Rule | Trạng thái |
|----|------|-----------|
| D2 | Cap phút lái mỗi leg → **HARD-fail** khi `leg > max(3×median, 3)km` (đo leg liên tiếp = route-leg, không diameter 2D). | IMPLEMENTED (`golden-trip.ts`, 2026-08-09) |
| D4 | Bán kính chọn quán/ks động `dynamicCapKm = clamp(span×0.6, 5, 10)km`. | IMPLEMENTED |
| D1 | Cap đường kính không gian/ngày → HARD. | STAGED-CODE |
| D1' | Đo cap đường kính theo CHIỀU DÀI TUYẾN, không Euclidean điểm-xa-nhất (tránh false-fail corridor). | STAGED-CODE |
| D3 | Cap tổng lái/ngày theo pace (relaxed<moderate<packed). | STAGED-CODE |

### E — NEO (anchor)
| ID | Rule | Trạng thái |
|----|------|-----------|
| E2 | ~~Nhà hàng trên tuyến (seam)~~ — **BỎ 2026-08-09**: nhà hàng KHÔNG slot vào timeline nữa; thành **danh sách GỢI Ý riêng** (`recommendRestaurants`, top-N theo ảnh hưởng VQS trong vùng). Timeline chỉ điểm-đến. Khớp mẫu lịch trình khách. | CHANGED |
| E1 | Anchor cố định (giỗ, must-see, giờ ăn) neo lịch, fill quanh; anchor thắng zone khi xung đột. | STAGED-DATA |
| E3 | Anchor cấp TRIP: bến xe/ga/sân bay = anchor bắt buộc block đầu-ngày-đầu + cuối-ngày-cuối. | STAGED-DATA |

### F — TRỤC THỜI GIAN (hiện VẮNG hoàn toàn)
| ID | Rule | Trạng thái |
|----|------|-----------|
| F1 | TSPTW thay TSP thuần: mỗi node `[open, close, last_entry]`; loại hoán vị `ETA ∉ [open, last_entry]`; hết hoán vị hợp lệ → tách ngày. | STAGED-DATA |
| F2 | Traffic-by-hour: OSRM speed × `peak_factor(giờ × đoạn)` (đèo 16–19h ×1.8) thay `ASSUMED_SPEED_KMH=25`. | STAGED-DATA |
| F3 | Ma trận theo `vehicleType` (xe máy/ô tô/bus 45 chỗ + giờ cấm nội đô); leg phà = bảng giờ cố định, tách OSRM. | STAGED-DATA |
| F4 | Buffer theo profile: elderly/child +20% thời lượng + buffer ≥15p; chèn cứng khung ăn 11–13h/18–19:30h (lệch ≤±30p). | STAGED-DATA |
| F5 | Zoning = KHÔNG GIAN ∩ THỜI GIAN: "1 ngày 1 zone" → "cùng zone AND time-window giao nhau". | STAGED-DATA |

### G — LIÊN-NGÀY / META
| ID | Rule | Trạng thái |
|----|------|-----------|
| G1 | Liên-tục liên-ngày: điểm đầu (hoặc KS) ngày N+1 ≤5km hoặc cùng `region_id` với điểm cuối ngày N, trừ "city switch" tường minh. | STAGED-CODE (một phần ngầm qua B5+macroOrder) |
| G2 | Cân tải: `|count(ngày i) − avg(perDay)| ≤ 1`; vượt → rebalance bắt buộc. | STAGED-CODE |
| G3 | Explainability: điểm bị loại trả reason code (`over_diameter`/`far_outlier`/`region_mismatch`/`coverage_capped`/`window_infeasible`). | STAGED-CODE |
| G4 | Feasibility guard trước B3: tập không có thứ tự nào thỏa no-re-entry → re-partition. | IMPLEMENTED-by-construction (tập đã chọn region-coherent qua `growCompact`+`packDays` → B3 không bao giờ infeasible; guard `golden-trip` bắt regress) |

---

## 3. Trade-off — luật quyết định khi mâu thuẫn

3 trục xung đột: **coverage (A3) ↔ compactness (A1/A4) ↔ khả-thi-thời-gian (F1)**. Ưu tiên khi va:

1. **Khả-thi-thời-gian tối thượng** (F1/D2 HARD) — điểm không vào được time-window thì mọi tối ưu không gian vô nghĩa. Không ngoại lệ.
2. **Compactness thắng coverage ở BƯỚC CHỌN** (A0/A4) — sửa gốc lỗi "chọn mù địa lý".
3. **Coverage thắng compactness CHỈ cho must-see/anchor** (A3+C1c) — khi thắng phải gắn flag `compactness_violated` để hạ ưu tiên vòng chọn kế, không để 1 nhượng bộ lan thành lịch phân tán.

**Corridor** (thành phố dọc trục / ven biển dài) = ngoại lệ hình học được A0/B1b/D1' công nhận, KHÔNG phải vi phạm compactness.

---

## 4. Data / schema gate (vì sao F/E/C4 STAGED-DATA)

| Rule | Data/schema còn thiếu |
|------|----------------------|
| F1, F5 | `KbOpeningSlot` hiện chỉ `{open?, close?}` — không có ngày-trong-tuần, không `last_entry`; đa số điểm thiếu giờ (→ `goi_truoc`). Cần giờ mở đầy đủ + last_entry per điểm. |
| F2 | OSRM matrix tĩnh (`meta.osrm_diem_den.durations`), không theo giờ. Cần OSRM time-dependent hoặc bảng `peak_factor`. |
| F3 | `TripRequest` không có `vehicleType`; OSRM chỉ 1 profile + chỉ điểm-đến (không quán/ks). Cần field + ma trận per-profile; bảng giờ phà. |
| E1, E3 | `TripRequest` không có `anchor[]` (điểm/sự kiện cố định + thời điểm). Cần field + UI thu thập. |
| C4 | `region_id` là nhãn tĩnh KB, không verify. Cần lat/lng cluster runtime (đã có toạ độ — chủ yếu là công code, nhưng phụ thuộc chất lượng `region_id` KB). |

---

## 5. Acceptance criteria — patch 2026-08-09 (B5 + D2)

- **AC1** — Không ngày nào chứa >1 region trừ khi các region gộp là macro-kề VÀ tổng điểm ≤ `perDay` (`packDays`). Ranh giới ngày rơi trên biên region.
- **AC2** — `golden-trip.ts` leg-outlier là HARD-fail (`zz++` + `process.exit(1)`), không còn WARN.
- **AC3** — Re-entry HARD (B3) giữ nguyên hiệu lực.
- **AC4** — Không ngày rỗng; determinism giữ nguyên (output byte-identical qua 2 lần chạy).
- **Verify:** `pnpm tsx trip-planner/scripts/golden-trip.ts {da-lat,da-nang}` → "OK — mỗi ngày một khu, không quay đầu." + exit 0. Đã pass 2026-08-09.

---

## 6. Roadmap triển khai tiếp (thứ tự đề xuất)

1. ~~STAGED-CODE — compactness lúc chọn (A0/A4/A5 + G4)~~ — ✅ DONE 2026-08-09 (`growCompact`).
2. **STAGED-CODE — robustness** (C1b/C1c/C2/C3, B1b corridor, D1'/D1/D3, G1/G2/G3). Ưu tiên kế.
3. **STAGED-DATA — anchor** (E1/E3): cần `TripRequest.anchor[]` + UI.
4. **STAGED-DATA — trục thời gian** (F1–F5): cần KB giờ mở đầy đủ + OSRM time-dependent + `vehicleType`. Lớn nhất, phụ thuộc supply-data pipeline (`tourism-kb/`).

---

## 7. Vibe layer — phân loại điểm-đến theo "không khí" (IMPLEMENTED 2026-08-10)

**Phạm vi.** Vibe CHỈ phân loại **điểm-đến**. Nhà hàng/khách sạn giữ nguyên là danh sách gợi ý (thứ tự ảnh hưởng VQS), KHÔNG gắn vibe.

**Mục tiêu.** Khách nêu "không khí" (lãng mạn / thư giãn / sống ảo / tâm linh…) → engine **nghiêng lịch trình** về điểm-đến hợp vibe. Deterministic, KHÔNG LLM lúc dựng lịch, KHÔNG vector/RAG.

**Tập đóng `VIBE_VOCAB`** (11 slug, single-source 2 phía — `trip-planner/lib/planner/vibes.ts` ⇄ `tourism-kb/code/vibes.py`, sửa 1 sửa cả 2): `ngam-canh, tam-linh, lich-su-van-hoa, thien-nhien-mao-hiem, mua-sam, nong-nghiep-sinh-thai, bien-dao, suoi-nuoc-nong, song-ao-chup-hinh, thu-gian-yen-tinh, lang-man`.

**Sinh tag (offline, frozen vào KB `ext.destination.vibes[]` — mảng slug RỜI RẠC, cấm chuỗi ghép "X/Y"):**
- **RULE** (`vibes.py:nhan_vibes_rule`): suy từ `category.primary/secondary` (tin cậy). Category catch-all/mơ hồ (`Khu vui chơi`, `Bảo tàng`, `Điểm tham quan`, `Khác`) CỐ Ý bỏ qua → nhường enrich (tránh gán sai, vd ga tàu cổ ≠ vui chơi).
- **ENRICH** (`enrich_vibes.py`, Gemini `temperature=0`): đọc name+description gán vibe fuzzy (lãng mạn/thư giãn/sống ảo) + override category mơ hồ. Guard: reject slug ngoài `VIBE_VOCAB`; `lang-man` chỉ gán khi có từ khoá cặp đôi tường minh (không suy từ "đẹp/view"); cache + provenance `vibes_nguon` (rule|llm|rule+llm|none). **Review tay 100% trước upload.**

**Match (`plan.ts:scoreDestination`).** `interests[]` (slug đã qua allowlist `filterVibes` ở `fromParams`+`partialFromArgs`) khớp `d.vibes[]` bằng **EXACT-SET** (không substring) → **+2 soft bonus**. KHÔNG filter — chỉ xếp hạng (feed `growCompact` mass/seed + thứ tự chất lượng trong cụm).

**Giới hạn đã biết.** Vibe chỉ đổi TẬP điểm khi có **áp lực chọn** (region overflow / cụm cạnh tranh seed). Với city compact + KB thưa (Đà Lạt 36 điểm, ~9-12 chọn, một cụm trung tâm, không overflow) → mọi điểm trung tâm đều vào lịch → **vibe hiện chưa đổi được lịch**. Không phải bug: là hệ quả compactness-first (§3) + KB density. Effect dày lên khi KB nhiều điểm hơn / city đa-cụm. Thứ tự trong ngày KHOÁ bởi TSP (B2/B3) — vibe KHÔNG reorder.
