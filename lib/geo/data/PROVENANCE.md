# VN administrative-unit dataset

**File:** `vn-admin-tree.json` — slim normalized 3-tier hierarchy (Tỉnh/Thành phố → Quận/Huyện → Phường/Xã).

**Shape:**
```jsonc
{
  "provinces": [{ "code": "1", "name": "Thành phố Hà Nội" }],
  "districts": [{ "code": "1", "name": "Quận Ba Đình", "provinceCode": "1" }],
  "wards":     [{ "code": "1", "name": "Phường Phúc Xá", "districtCode": "1" }]
}
```

**Counts:** 63 provinces · 696 districts · 10,051 wards.

**Source:** `https://provinces.open-api.vn/api/?depth=3` — General Statistics Office (GSO) administrative coding.
**Fetched:** 2026-06-08. **Pinned** — no runtime fetch; this is the single vendored snapshot.

**Codes** are GSO numeric codes, stored as strings. Unique within each level. The raw response's
`division_type` / `codename` / `phone_code` fields were dropped to slim the bundle.

## Re-versioning

Vietnam's 2025 reform moves toward a 2-tier (province → commune) structure. This snapshot is the
**legacy 3-tier** model by product decision (issue 103). To swap datasets, replace this file with the
same `{provinces, districts, wards}` shape and keep `lib/geo/vnAdmin.ts` unchanged. Booking rows
snapshot the resolved label (`pickupAreaLabel`) so a future swap does not orphan historical pickups.
