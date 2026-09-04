// P3 (chore/planner-pipeline-hygiene): regFame() dùng substring 2 chiều không biên từ ("s.includes(nm)"
// / "nm.includes(s)") — fame token ngắn (>=5 ký tự folded) có thể khớp GIỮA một từ khác không liên quan.
// Ví dụ thật: fame "Hoa Lư" fold "hoa lu" từng khớp lọt vào "Khách sạn Nhật Hoa Luxury" (folded
// "... hoa luxury" chứa đúng chuỗi con "hoa lu" từ "Hoa" + " " + "Lu" của "Luxury") — hai địa danh
// không liên quan. boundedIncludes() (mirror slots.ts city-match) đòi hỏi biên đầu/cuối là ký tự
// không phải chữ/số nên loại khớp giữa-từ này, giữ nguyên khớp thật (toàn bộ cụm từ, có biên).
import { describe, it, expect } from 'vitest';
import { regFame } from '../plan';
import type { KbRecord } from '../types';

function rec(id: string, name: string): KbRecord {
  return { id, name, region_id: 'r1', source_ids: ['s1'], coordinates: { latitude: 10, longitude: 106 } };
}

describe('regFame — word-boundary guard (false-positive fix)', () => {
  const fameSpots = ['hoa lu']; // fold("Hoa Lư") — signatureSpot đã fold sẵn (như fameSpotsForSlug())

  it('KHÔNG khớp "Khách sạn Nhật Hoa Luxury" (chuỗi con "hoa lu" nằm giữa từ "Luxury", không có biên)', () => {
    const pts = [rec('h1', 'Khách sạn Nhật Hoa Luxury')];
    expect(regFame(pts, fameSpots)).toBe(0);
  });

  it('VẪN khớp "Nhà hàng Hoa Lư Quán" (cụm từ "Hoa Lư" trọn vẹn, có biên khoảng trắng cả hai đầu)', () => {
    const pts = [rec('h2', 'Nhà hàng Hoa Lư Quán')];
    expect(regFame(pts, fameSpots)).toBe(1);
  });

  it('cụm hỗn hợp: chỉ điểm khớp thật đóng góp fame, điểm false-positive bị bỏ qua', () => {
    const pts = [rec('h1', 'Khách sạn Nhật Hoa Luxury'), rec('h2', 'Nhà hàng Hoa Lư Quán')];
    expect(regFame(pts, fameSpots)).toBe(1);
  });

  it('không có fameSpots → 0 (hành vi cũ giữ nguyên)', () => {
    expect(regFame([rec('h3', 'Bất kỳ tên nào')], [])).toBe(0);
  });
});
