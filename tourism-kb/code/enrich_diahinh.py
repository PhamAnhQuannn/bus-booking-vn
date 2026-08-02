# -*- coding: utf-8 -*-
"""Suy ra dac diem dia hinh: do cao, do nho, huong mo, phuong vi mat troi moc.

Vi sao phai TINH thay vi TRA: san may khong phai thuoc tinh cua dia diem. No la
ket qua cua do cao + mua + gio + troi dem hom truoc. Khong bo du lieu nao tren
the gioi ghi "cho nay san may duoc", nen phai dung tu vat ly.

Nguon do cao: OpenTopoData SRTM 30 m — mien phi, khong can khoa.
Chinh sach: toi da 100 diem/yeu cau, 1 yeu cau/giay.

Moi gia tri o day la SUY RA, khong phai quan sat thuc dia. Danh dau [SUY RA].
"""
import json, os, sys, io, math, time, urllib.request

RAW = sys.argv[1]
ENRICH = os.path.join(RAW, "enrichment.json")
CACHE = os.path.join(RAW, "dem.json")
API = "https://api.opentopodata.org/v1/srtm30m"
UA = {"User-Agent": "BusBooking-KB/0.1 (tourism research)"}
D = "28/07/2026"

# Vanh dai 800 m qua hep: nen thanh pho Da Lat da ~1.500 m nen moi toa nha trong
# pho deu "nho len" so voi pho xung quanh. Phai so voi CAO NGUYEN, khong phai voi
# khu pho — nen lay them vanh 2,5 km.
RING_M = 800
RING_FAR_M = 2500
N_DIR = 8             # 8 huong


def deg_offset(lat, lon, bearing_deg, dist_m):
    R = 6371000.0
    b = math.radians(bearing_deg)
    d = dist_m / R
    p1, l1 = math.radians(lat), math.radians(lon)
    p2 = math.asin(math.sin(p1) * math.cos(d) + math.cos(p1) * math.sin(d) * math.cos(b))
    l2 = l1 + math.atan2(math.sin(b) * math.sin(d) * math.cos(p1),
                         math.cos(d) - math.sin(p1) * math.sin(p2))
    return math.degrees(p2), math.degrees(l2)


cache = json.load(io.open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}


def elevations(coords):
    """coords: [(lat, lon)] -> [m]. Dung bo nho dem, goi theo lo 90 diem."""
    need = [c for c in coords if f"{c[0]:.5f},{c[1]:.5f}" not in cache]
    for i in range(0, len(need), 90):
        batch = need[i:i + 90]
        loc = "|".join(f"{la:.6f},{lo:.6f}" for la, lo in batch)
        try:
            with urllib.request.urlopen(
                    urllib.request.Request(f"{API}?locations={loc}", headers=UA), timeout=120) as r:
                d = json.load(r)
            for (la, lo), res in zip(batch, d.get("results", [])):
                cache[f"{la:.5f},{lo:.5f}"] = res.get("elevation")
        except Exception as e:
            print(f"  lo {i//90+1}: LOI {type(e).__name__} {e}")
        time.sleep(1.2)
    return [cache.get(f"{la:.5f},{lo:.5f}") for la, lo in coords]


DIRS = ["Bắc", "Đông Bắc", "Đông", "Đông Nam", "Nam", "Tây Nam", "Tây", "Tây Bắc"]


def sunrise_azimuth(lat, month):
    """Goc phuong vi mat troi moc, do tu huong Bac. Cong thuc thien van thuan.

    Da Lat ~11.94 vi Bac: mua dong mat troi moc lech Nam, mua he lech Bac.
    """
    day = [17, 47, 75, 105, 135, 162, 198, 228, 258, 288, 318, 344][month - 1]
    decl = 23.44 * math.sin(math.radians(360 / 365 * (day - 81)))
    p, dcl = math.radians(lat), math.radians(decl)
    try:
        cos_az = math.sin(dcl) / math.cos(p)
        return math.degrees(math.acos(max(-1.0, min(1.0, cos_az))))
    except Exception:
        return 90.0


picked = json.load(io.open(os.path.join(RAW, "guide_data.json"), encoding="utf-8"))["picked"]
rows = json.load(io.open(ENRICH, encoding="utf-8"))
seen = {(r["id"], r["field"]) for r in rows}

# 1) do cao chinh diem + vanh dai 8 huong
all_pts, index = [], {}
for p in picked:
    index[p["id"]] = {"self": len(all_pts)}
    all_pts.append((p["lat"], p["lon"]))
    index[p["id"]]["ring"] = []
    index[p["id"]]["far"] = []
    for k in range(N_DIR):
        index[p["id"]]["ring"].append(len(all_pts))
        all_pts.append(deg_offset(p["lat"], p["lon"], k * 360 / N_DIR, RING_M))
    for k in range(N_DIR):
        index[p["id"]]["far"].append(len(all_pts))
        all_pts.append(deg_offset(p["lat"], p["lon"], k * 360 / N_DIR, RING_FAR_M))
print(f"can do cao cho {len(all_pts)} toa do ({len(picked)} diem x {2*N_DIR+1})")
els = elevations(all_pts)
json.dump(cache, io.open(CACHE, "w", encoding="utf-8"))
print(f"bo nho dem DEM: {len(cache)} toa do")

added = 0


def emit(pid, field, value, note):
    global added
    if (pid, field) in seen:
        return
    seen.add((pid, field))
    rows.append({"id": pid, "field": field, "value": value, "source": "SRTM 30 m (OpenTopoData)",
                 "url": API, "date": D, "method": "pass10-diahinh", "note": note,
                 "match_m": None})
    added += 1


# Nen thanh pho do TU DU LIEU, khong viet cung. Da Lat ~1.500 m nen moc tuyet doi
# 1.450 m chon gan nhu moi diem — dung trung vi cua chinh 36 diem lam moc.
_valid = [els[index[p["id"]]["self"]] for p in picked if els[index[p["id"]]["self"]] is not None]
FLOOR = sorted(_valid)[len(_valid) // 2]
print(f"nen cao nguyen (trung vi 36 diem): {FLOOR:.0f} m — moc san may = {FLOOR+80:.0f} m\n")

out = []
for p in picked:
    ix = index[p["id"]]
    e0 = els[ix["self"]]
    ring = [els[i] for i in ix["ring"]]
    far = [els[i] for i in ix["far"]]
    if e0 is None or any(x is None for x in ring) or any(x is None for x in far):
        continue
    med = sorted(ring)[len(ring) // 2]
    med_far = sorted(far)[len(far) // 2]
    prom = e0 - med
    prom_far = e0 - med_far               # so voi cao nguyen, khong phai voi khu pho
    open_dirs = [DIRS[k] for k, v in enumerate(ring) if v < e0 - 15]
    emit(p["id"], "do_cao", f"{e0:.0f} m", "SRTM 30 m")
    emit(p["id"], "do_nho", f"{prom_far:+.0f} m so với vùng xung quanh bán kính 2,5 km",
         "cao hơn xung quanh thì tầm nhìn thoáng, thấp hơn thì bị che")
    if open_dirs:
        emit(p["id"], "huong_mo", ", ".join(open_dirs), "hướng mà địa hình thấp hơn điểm đứng")
    east_open = any(d in open_dirs for d in ("Đông", "Đông Bắc", "Đông Nam"))
    # Ba dieu kien CUNG LUC: cao hon nen cao nguyen, nho len so voi vung 2,5 km,
    # va mo ve huong Dong. Chi cao thoi thi chua du — dung trong long chao van khong thay gi.
    ok = e0 >= FLOOR + 80 and prom_far >= 40 and east_open
    if ok:
        emit(p["id"], "san_may", "CÓ THỂ — cao hơn nền cao nguyên, nhô lên rõ, mở hướng Đông",
             "suy ra từ địa hình; mùa Oct–Mar, 04:30–06:30, cần đêm trước lạnh và quang")
    az = sunrise_azimuth(p["lat"], 12)
    emit(p["id"], "huong_binh_minh", f"khoảng {az:.0f}° so với hướng Bắc (tháng 12)",
         "góc mặt trời mọc, tính theo vĩ độ")
    out.append((p["id"], p["name"], e0, prom_far, east_open, open_dirs, ok))

json.dump(rows, io.open(ENRICH, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
out.sort(key=lambda x: -x[2])
print(f"{'ID':7s}{'Tên':30s}{'Cao':>7s}{'Nhô':>7s}  Săn mây  Hướng mở")
for pid, nm, e0, prom, eo, od, ok in out[:20]:
    flag = "CÓ" if ok else "—"
    print(f"{pid:7s}{nm[:28]:30s}{e0:7.0f}{prom:+7.0f}  {flag:7s}  {', '.join(od[:3])}")
print(f"\nenrichment.json +{added} -> {len(rows)} dòng")
print(f"ứng viên săn mây: {sum(1 for x in out if x[6])}/{len(out)}")
