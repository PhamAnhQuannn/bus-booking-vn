import { describe, it, expect } from 'vitest';
import { slugify } from '../slugify';

describe('slugify', () => {
  it('converts Vietnamese names with diacritics', () => {
    expect(slugify('Hà Nội')).toBe('ha-noi');
    expect(slugify('Đà Nẵng')).toBe('da-nang');
    expect(slugify('Sài Gòn')).toBe('sai-gon');
    expect(slugify('Buôn Ma Thuột')).toBe('buon-ma-thuot');
    expect(slugify('Thành phố Hồ Chí Minh')).toBe('thanh-pho-ho-chi-minh');
  });

  it('handles d-stroke (đ/Đ) separately from NFD decomposition', () => {
    expect(slugify('Đắk Lắk')).toBe('dak-lak');
    expect(slugify('Điện Biên Phủ')).toBe('dien-bien-phu');
  });

  it('lowercases and strips non-alphanumeric', () => {
    expect(slugify('Ho Chi Minh City')).toBe('ho-chi-minh-city');
    expect(slugify('  Leading Spaces  ')).toBe('leading-spaces');
  });

  it('returns "unnamed" for empty/whitespace input', () => {
    expect(slugify('')).toBe('unnamed');
    expect(slugify('   ')).toBe('unnamed');
  });

  it('collapses consecutive separators', () => {
    expect(slugify('Hà  --  Nội')).toBe('ha-noi');
  });
});
