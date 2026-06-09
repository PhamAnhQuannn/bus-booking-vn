// geo domain public API barrel (SYS20 rule 3).
// vnAdmin is pure + client-safe (static JSON + lookups; no server-only/pg/prisma),
// so this barrel is safe to import from 'use client' components.

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
