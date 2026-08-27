import { describe, it, expect } from 'vitest';
import { extractFromText, applyExtracted, withGroup, missingRequired, applyChip } from '../slots';
import type { Slots } from '../slots';

describe('extractFromText — bóc tất định budget-số + nhóm (bảng MỤC 3)', () => {
  it('ngân sách "khoảng 3 triệu" → 3.000.000/người', () =>
    expect(extractFromText('mình muốn đi Đà Lạt, ngân sách khoảng 3 triệu').budgetPerPerson).toBe(3_000_000));

  it('ngân sách "5 triệu mỗi người" → 5.000.000', () =>
    expect(extractFromText('ngân sách 5 triệu mỗi người').budgetPerPerson).toBe(5_000_000));

  it('"300k" → 300.000', () =>
    expect(extractFromText('tầm 300k một người').budgetPerPerson).toBe(300_000));

  it('"3 ngày 2 đêm" KHÔNG bị nhận nhầm là tiền', () =>
    expect(extractFromText('đi 3 ngày 2 đêm, 2 người').budgetPerPerson).toBeUndefined());

  it('"cùng bạn bè" → nhom ban-be', () =>
    expect(extractFromText('đi Nha Trang cùng bạn bè').nhom).toBe('ban-be'));

  it('"cùng gia đình" → nhom gia-dinh', () =>
    expect(extractFromText('đi cùng gia đình 4 người').nhom).toBe('gia-dinh'));

  it('"cặp đôi" / "người yêu" → cap-doi', () => {
    expect(extractFromText('chuyến đi cặp đôi').nhom).toBe('cap-doi');
    expect(extractFromText('đi với người yêu').nhom).toBe('cap-doi');
  });

  it('"đồng nghiệp/công tác" → cong-tac', () =>
    expect(extractFromText('đi công tác với đồng nghiệp').nhom).toBe('cong-tac'));
});

describe('applyExtracted — nhóm preset party, budget gán', () => {
  it('gia-dinh khi chưa có người → 2 lớn + 2 nhỏ', () => {
    const n = applyExtracted({}, { nhom: 'gia-dinh' });
    expect(n.nhom).toBe('gia-dinh');
    expect(n.adults).toBe(2);
    expect(n.children).toBe(2);
  });

  it('không đè party nếu đã có số người', () => {
    const n = applyExtracted({ adults: 3 }, { nhom: 'ban-be' });
    expect(n.adults).toBe(3);
  });

  it('budgetPerPerson được gán', () =>
    expect(applyExtracted({}, { budgetPerPerson: 3_000_000 }).budgetPerPerson).toBe(3_000_000));
});

describe('withGroup / applyChip — KHÔNG auto suy diễn sở thích hiển thị', () => {
  it('cap-doi KHÔNG tự thêm "lang-man" vào interests', () => {
    expect((withGroup({}, 'cap-doi').interests ?? [])).not.toContain('lang-man');
    expect((applyChip({}, 'nhom', 'Cặp đôi').interests ?? [])).not.toContain('lang-man');
  });

  it('gia-dinh vẫn set avoidSteep (ngầm, không phải chip sở thích)', () =>
    expect(withGroup({}, 'gia-dinh').avoidSteep).toBe(true));
});

describe('missingRequired — đếm slot bắt buộc còn thiếu', () => {
  it('rỗng → 3', () => expect(missingRequired({})).toBe(3));
  it('đủ điểm đến + ngày + người → 0', () => {
    const s: Slots = { dia_diem: 'da-lat', days: 3, adults: 2 };
    expect(missingRequired(s)).toBe(0);
  });
  it('chỉ có điểm đến → 2', () => expect(missingRequired({ dia_diem: 'da-lat' })).toBe(2));
});
