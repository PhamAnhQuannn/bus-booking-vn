// #721: trichEvent — cờ badCity khi model gọi trich cho thành phố NGOÀI allowlist (route chặn frame → noop).
// Thành phố đã hỗ trợ (slug HOẶC tên có/không dấu) → event y hệt cũ, KHÔNG có field badCity.
import { describe, expect, it } from 'vitest';
import { trichEvent, partialFromArgs, countOutOfEnum } from '../prompt';
import { isUnsupportedCity } from '../../cities';

describe('isUnsupportedCity (#721)', () => {
  it.each(['hue', 'Huế', 'HUE', ' da-lat ', 'Đà Lạt', 'Hồ Chí Minh', 'ho chi minh'])('supported %s → false', (c) => {
    expect(isUnsupportedCity(c)).toBe(false);
  });
  it.each(['Sài Gòn', 'Saigon', 'TP.HCM', 'HCM', 'Hanoi', 'Dalat', 'Sapa', 'Thừa Thiên Huế'])('alias %s → supported', (c) => {
    expect(isUnsupportedCity(c)).toBe(false);
  });
  it.each(['hoi-an', 'Hội An', 'mui-ne', 'Bangkok'])('unsupported %s → true', (c) => {
    expect(isUnsupportedCity(c)).toBe(true);
  });
  it.each([undefined, null, '', '   ', 42])('no city named (%s) → false', (c) => {
    expect(isUnsupportedCity(c)).toBe(false);
  });
});

describe('trichEvent (#721)', () => {
  it('supported city → byte-identical to the pre-#721 event (no badCity key)', () => {
    const args = { dia_diem: 'hue', days: 3, adults: 2 };
    expect(trichEvent(args)).toStrictEqual({ kind: 'slots', partial: partialFromArgs(args), dropped: countOutOfEnum('trich', args) });
  });
  it('alias city → resolved to slug in partial, no badCity', () => {
    expect(trichEvent({ dia_diem: 'Sài Gòn', days: 2 })).toStrictEqual({ kind: 'slots', partial: { dia_diem: 'ho-chi-minh', days: 2 }, dropped: 1 });
  });
  it('no dia_diem (follow-up "thêm 1 ngày") → no badCity', () => {
    expect(trichEvent({ days: 4 })).toStrictEqual({ kind: 'slots', partial: { days: 4 }, dropped: 0 });
  });
  it('unsupported city → badCity=true; dia_diem already dropped, dependent slots still listed', () => {
    expect(trichEvent({ dia_diem: 'hoi-an', days: 2 })).toStrictEqual({ kind: 'slots', partial: { days: 2 }, dropped: 1, badCity: true });
  });
});
