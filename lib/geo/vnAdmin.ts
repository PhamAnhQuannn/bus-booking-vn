/**
 * vnAdmin — pure loader over the vendored 3-tier VN administrative dataset
 * (Tỉnh/Thành phố → Quận/Huyện → Phường/Xã). See `lib/geo/data/PROVENANCE.md`.
 *
 * Deep module (SYS20): small, stable interface over the bundled JSON. Lookups are
 * O(1) via indexes built once at module load.
 *
 * SERVER-SIDE ONLY: the static import pulls a ~690 KB dataset, so this must NOT be
 * imported from 'use client' components (it would bloat the browser bundle). Client
 * code reads the tiers on demand via GET /api/geo (see components/geo/AdminUnitPicker).
 * Server components, route handlers, and server-side validation (createOperatorPickupArea)
 * use it directly.
 */

import tree from '@/lib/geo/data/vn-admin-tree.json';

export interface Province {
  code: string;
  name: string;
}
export interface District {
  code: string;
  name: string;
  provinceCode: string;
}
export interface Ward {
  code: string;
  name: string;
  districtCode: string;
}

/** A fully-resolved area selection (codes) plus its human label. */
export interface AreaSelection {
  provinceCode: string;
  districtCode: string;
  wardCode: string;
}

const data = tree as { provinces: Province[]; districts: District[]; wards: Ward[] };

// ---- indexes (built once) -------------------------------------------------

const provinceByCode = new Map<string, Province>(data.provinces.map((p) => [p.code, p]));
const districtByCode = new Map<string, District>(data.districts.map((d) => [d.code, d]));
const wardByCode = new Map<string, Ward>(data.wards.map((w) => [w.code, w]));

const districtsByProvince = new Map<string, District[]>();
for (const d of data.districts) {
  const list = districtsByProvince.get(d.provinceCode);
  if (list) list.push(d);
  else districtsByProvince.set(d.provinceCode, [d]);
}

const wardsByDistrict = new Map<string, Ward[]>();
for (const w of data.wards) {
  const list = wardsByDistrict.get(w.districtCode);
  if (list) list.push(w);
  else wardsByDistrict.set(w.districtCode, [w]);
}

// ---- public interface -----------------------------------------------------

/** All 63 provinces, in dataset order. */
export function listProvinces(): Province[] {
  return data.provinces;
}

/** Districts belonging to a province; empty array for an unknown province. */
export function listDistricts(provinceCode: string): District[] {
  return districtsByProvince.get(provinceCode) ?? [];
}

/** Wards belonging to a district; empty array for an unknown district. */
export function listWards(districtCode: string): Ward[] {
  return wardsByDistrict.get(districtCode) ?? [];
}

export function getProvince(code: string): Province | null {
  return provinceByCode.get(code) ?? null;
}
export function getDistrict(code: string): District | null {
  return districtByCode.get(code) ?? null;
}
export function getWard(code: string): Ward | null {
  return wardByCode.get(code) ?? null;
}

/**
 * True only when the triple is internally consistent: the ward belongs to the
 * district, and the district belongs to the province.
 */
export function isValidSelection(sel: AreaSelection): boolean {
  const ward = wardByCode.get(sel.wardCode);
  const district = districtByCode.get(sel.districtCode);
  if (!ward || !district) return false;
  if (ward.districtCode !== sel.districtCode) return false;
  if (district.provinceCode !== sel.provinceCode) return false;
  return true;
}

/**
 * Resolve a code triple to a human label "Phường X, Quận Y, Thành phố Z"
 * (ward → district → province, Vietnamese address order). Returns null if the
 * triple is not internally consistent.
 */
export function resolveLabel(sel: AreaSelection): string | null {
  if (!isValidSelection(sel)) return null;
  const ward = wardByCode.get(sel.wardCode)!;
  const district = districtByCode.get(sel.districtCode)!;
  const province = provinceByCode.get(sel.provinceCode)!;
  return `${ward.name}, ${district.name}, ${province.name}`;
}
