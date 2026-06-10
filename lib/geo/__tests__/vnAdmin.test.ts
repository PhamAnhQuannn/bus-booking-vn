import { describe, it, expect } from 'vitest';
import {
  listProvinces,
  listDistricts,
  listWards,
  getProvince,
  isValidSelection,
  resolveLabel,
} from '@/lib/geo';

describe('vnAdmin loader', () => {
  it('lists all 63 provinces', () => {
    expect(listProvinces()).toHaveLength(63);
  });

  it('resolves a known province by code', () => {
    expect(getProvince('1')?.name).toContain('Hà Nội');
    expect(getProvince('999')).toBeNull();
  });

  it('lists districts for a province (Hà Nội = 30) and empty for unknown', () => {
    const districts = listDistricts('1');
    expect(districts).toHaveLength(30);
    expect(districts.some((d) => d.name === 'Quận Ba Đình')).toBe(true);
    expect(listDistricts('999')).toEqual([]);
  });

  it('lists wards for a district and empty for unknown', () => {
    const wards = listWards('1'); // Quận Ba Đình
    expect(wards.some((w) => w.name === 'Phường Phúc Xá')).toBe(true);
    expect(listWards('999999')).toEqual([]);
  });

  it('validates a consistent code triple and rejects an inconsistent one', () => {
    // Phúc Xá (1) ∈ Ba Đình (1) ∈ Hà Nội (1)
    expect(isValidSelection({ provinceCode: '1', districtCode: '1', wardCode: '1' })).toBe(true);
    // ward 1 does NOT belong to district 999
    expect(isValidSelection({ provinceCode: '1', districtCode: '999', wardCode: '1' })).toBe(false);
    // district 1 does NOT belong to province 999
    expect(isValidSelection({ provinceCode: '999', districtCode: '1', wardCode: '1' })).toBe(false);
  });

  it('resolves a label in ward→district→province order', () => {
    expect(resolveLabel({ provinceCode: '1', districtCode: '1', wardCode: '1' })).toBe(
      'Phường Phúc Xá, Quận Ba Đình, Thành phố Hà Nội'
    );
  });

  it('returns null label for an inconsistent triple', () => {
    expect(resolveLabel({ provinceCode: '1', districtCode: '1', wardCode: '999999' })).toBeNull();
  });
});
