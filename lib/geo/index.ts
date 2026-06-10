// geo domain public API barrel (SYS20 rule 3).
// SERVER-SIDE ONLY: vnAdmin statically imports a ~690 KB dataset. Do NOT import this
// barrel from 'use client' components — it would ship the whole tree into the browser
// bundle. Client code uses GET /api/geo instead (components/geo/AdminUnitPicker).

export {
  listProvinces,
  listDistricts,
  listWards,
  getProvince,
  getDistrict,
  getWard,
  isValidSelection,
  resolveLabel,
  type Province,
  type District,
  type Ward,
  type AreaSelection,
} from './vnAdmin';
