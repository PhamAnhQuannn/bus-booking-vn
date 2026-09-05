// dayWeight(): trọng-số thời-lượng ngày (bất biến Σ≤1/ngày). FULL=1 (đảo/công viên giải trí/vườn quốc
// gia/lối-vào-đặc-trưng), HALF=0.5 (thác/hang/núi/bãi biển/thung lũng/bản làng), SHORT=0 (còn lại).
// Bảng loại hình từ audit corpus; bẫy "Hòn Chồng" (Điểm ngắm cảnh) KHÔNG lên FULL dù tên bắt đầu "Hòn".
import { describe, it, expect } from 'vitest';
import { dayWeight } from '../plan';
import type { KbRecord } from '../types';

function rec(name: string, primary: string, sigAccess?: string): KbRecord {
  return {
    id: name, name, region_id: 'r1', source_ids: ['s1'],
    coordinates: { latitude: 10, longitude: 106 },
    category: { primary, secondary: [] },
    ext: sigAccess ? { destination: { loi_vao_dac_trung: sigAccess } } : undefined,
  } as KbRecord;
}

describe('dayWeight — bảng loại hình', () => {
  it('FULL=1: đảo, vườn quốc gia, khu du lịch giải trí, khu vui chơi', () => {
    expect(dayWeight(rec('Đảo Bình Ba', 'Đảo'))).toBe(1);
    expect(dayWeight(rec('VQG Cát Tiên', 'Vườn quốc gia / Khu bảo tồn'))).toBe(1);
    expect(dayWeight(rec('VinWonders', 'Khu du lịch giải trí (vui chơi trả phí)'))).toBe(1);
    expect(dayWeight(rec('Công viên Đầm Sen', 'Khu vui chơi'))).toBe(1);
  });

  it('FULL=1: lối-vào-đặc-trưng (sig-access) bất kể loại', () => {
    expect(dayWeight(rec('Fansipan', 'Núi / Đèo / Đường mòn', 'Đi cáp treo lên đỉnh'))).toBe(1);
  });

  it('FULL=1: tên "Hòn/Đảo/Cù Lao" khi loại là Bãi biển/Đảo (đảo bị gán nhầm Bãi biển)', () => {
    expect(dayWeight(rec('Hòn Tằm', 'Bãi biển'))).toBe(1);
    expect(dayWeight(rec('Cù Lao Chàm', 'Đảo'))).toBe(1);
  });

  it('BẪY: "Hòn Chồng" (Điểm ngắm cảnh) = SHORT, KHÔNG lên FULL', () => {
    expect(dayWeight(rec('Hòn Chồng', 'Điểm ngắm cảnh'))).toBe(0);
  });

  it('HALF=0.5: thác, hang động, núi/đèo, bãi biển, thung lũng, bản làng', () => {
    expect(dayWeight(rec('Thác Datanla', 'Thác nước'))).toBe(0.5);
    expect(dayWeight(rec('Hang Múa', 'Hang động'))).toBe(0.5);
    expect(dayWeight(rec('Đèo Hải Vân', 'Núi / Đèo / Đường mòn'))).toBe(0.5);
    expect(dayWeight(rec('Bãi Sau', 'Bãi biển'))).toBe(0.5);
    expect(dayWeight(rec('Thung lũng Bắc Sơn', 'Thung lũng'))).toBe(0.5);
  });

  it('SHORT=0: chùa, đền, nhà thờ, bảo tàng, dinh thự, ngắm cảnh, chợ, công viên, hồ, generic', () => {
    for (const c of ['Chùa / Thiền viện', 'Đền / Miếu', 'Nhà thờ', 'Bảo tàng', 'Dinh thự / Di tích',
      'Điểm ngắm cảnh', 'Chợ', 'Công viên / Vườn hoa', 'Hồ / Đập', 'Điểm tham quan', 'Cầu'])
      expect(dayWeight(rec('X', c))).toBe(0);
  });

  it('không có category → 0 (an toàn)', () => {
    expect(dayWeight({ id: 'x', name: 'x', region_id: 'r', source_ids: [], coordinates: { latitude: 10, longitude: 106 } } as KbRecord)).toBe(0);
  });
});
