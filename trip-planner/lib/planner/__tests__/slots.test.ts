import { describe, it, expect } from 'vitest';
import { extractFromText, applyExtracted, withGroup, missingRequired, applyChip } from '../slots';
import { isAllDay, moTaTrusted } from '../labels';
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

describe('V3 B — bóc dia_diem/days/adults client (mount shell sớm)', () => {
  it('"đi Đà Lạt 3 ngày 2 người" → da-lat + 3 + 2', () => {
    const d = extractFromText('đi Đà Lạt 3 ngày 2 người ngắm cảnh');
    expect(d.dia_diem).toBe('da-lat');
    expect(d.days).toBe(3);
    expect(d.adults).toBe(2);
  });
  it('không dấu "di nha trang" → nha-trang', () =>
    expect(extractFromText('di nha trang cuoi tuan').dia_diem).toBe('nha-trang'));
  it('"3 ngày" KHÔNG bị nhận là số người', () =>
    expect(extractFromText('đi 3 ngày').adults).toBeUndefined());
});

describe('extractFromText — cụm ngày TƯƠNG ĐỐI (M1) không co lịch', () => {
  it('"Thêm 1 ngày nữa vào lịch" (chip) → days undefined (nhường server)', () =>
    expect(extractFromText('Thêm 1 ngày nữa vào lịch').days).toBeUndefined());
  it('"bớt 1 ngày" → days undefined', () =>
    expect(extractFromText('bớt 1 ngày cho gọn').days).toBeUndefined());
  it('"kéo dài thêm 2 ngày" → days undefined', () =>
    expect(extractFromText('kéo dài thêm 2 ngày nữa').days).toBeUndefined());
  // FP guard: "thêm" bổ nghĩa món ăn, KHÔNG kề "N ngày" → absolute sống
  it('"3 ngày Đà Lạt, thêm quán ăn ngon" → days=3 (và da-lat)', () => {
    const d = extractFromText('3 ngày Đà Lạt, thêm quán ăn ngon');
    expect(d.days).toBe(3);
    expect(d.dia_diem).toBe('da-lat');
  });
  it('"đi Huế 3 ngày" → days=3 (absolute vẫn hoạt động)', () =>
    expect(extractFromText('đi Huế 3 ngày').days).toBe(3));
  it('"cho mình lịch 5 ngày" → days=5', () =>
    expect(extractFromText('cho mình lịch 5 ngày').days).toBe(5));
});

describe('extractFromText — đổi/chuyển sang thành phố ngắn (stale-dest) nhận dia_diem', () => {
  it('"Đổi sang Huế 3 ngày cho 4 người" → dia_diem=hue + days=3', () => {
    const d = extractFromText('Đổi sang Huế 3 ngày cho 4 người');
    expect(d.dia_diem).toBe('hue');
    expect(d.days).toBe(3);
  });
  it('"chuyển sang Vinh" → dia_diem=vinh', () =>
    expect(extractFromText('chuyển sang Vinh').dia_diem).toBe('vinh'));
  // FP guard: không có cụm đổi-sang + tên thành phố → KHÔNG nhận
  it('"đổi tiền ở quán" → dia_diem undefined', () =>
    expect(extractFromText('đổi tiền ở quán').dia_diem).toBeUndefined());
  it('"đổi qua Huế" → dia_diem=hue', () =>
    expect(extractFromText('đổi qua Huế').dia_diem).toBe('hue'));
  it('"chuyển qua Vinh" → dia_diem=vinh', () =>
    expect(extractFromText('chuyển qua Vinh').dia_diem).toBe('vinh'));
  // FP: cụm chuyển KHÔNG kề tên thành phố ("sang" theo sau "hoa", không phải "huế") → KHÔNG nhận
  it('"đổi sang hoa huệ" → dia_diem undefined', () =>
    expect(extractFromText('đổi sang hoa huệ').dia_diem).toBeUndefined());
});

describe('V3 C — sở thích không rơi tín hiệu', () => {
  it('"cà phê và cảnh đẹp" → 2 chip (ca-phe + ngam-canh)', () => {
    const d = extractFromText('mình thích cà phê và cảnh đẹp');
    expect(d.interests).toContain('ca-phe');
    expect(d.interests).toContain('ngam-canh');
  });
  it('"biển và đồ nướng" → bien-dao + am-thuc', () => {
    const d = extractFromText('thích biển và đồ nướng');
    expect(d.interests).toEqual(expect.arrayContaining(['bien-dao', 'am-thuc']));
  });
  it('"thích câu cá" (ngoài bảng) → literal "câu cá", KHÔNG drop', () =>
    expect(extractFromText('mình thích câu cá').interests).toContain('câu cá'));
  it('applyExtracted union interests (Gemini + client, dedup)', () => {
    const n = applyExtracted({ interests: ['ngam-canh'] }, { interests: ['ca-phe', 'ngam-canh'] });
    expect(n.interests).toEqual(['ngam-canh', 'ca-phe']);
  });
});

describe('extractFromText — phủ định KHÔNG thêm sở thích (negation guard)', () => {
  it('"không thích biển" → KHÔNG có bien-dao', () =>
    expect(extractFromText('không thích biển').interests ?? []).not.toContain('bien-dao'));
  it('"đừng cho tâm linh" → KHÔNG có tam-linh', () =>
    expect(extractFromText('đừng cho tâm linh').interests ?? []).not.toContain('tam-linh'));
  it('"thích biển, không thích núi" → chỉ bien-dao (núi bị phủ định)', () => {
    const d = extractFromText('thích biển, không thích núi');
    expect(d.interests).toContain('bien-dao');
    expect(d.interests ?? []).not.toContain('thien-nhien-mao-hiem');
  });
  it('"không thích tâm linh, chỉ muốn biển" → chỉ bien-dao', () => {
    const d = extractFromText('không thích tâm linh, chỉ muốn biển');
    expect(d.interests).toContain('bien-dao');
    expect(d.interests ?? []).not.toContain('tam-linh');
  });
  it('positive vẫn hoạt động: "thích tâm linh" → tam-linh', () =>
    expect(extractFromText('thích tâm linh').interests).toContain('tam-linh'));
  // Biên Unicode-aware: "chê"/"chả" (cuối từ có dấu) PHẢI khớp phủ định — trước đây `\b` bỏ sót.
  it('"chê biển" → KHÔNG có bien-dao', () =>
    expect(extractFromText('chê biển').interests ?? []).not.toContain('bien-dao'));
  it('"chả thích núi đâu" → KHÔNG có thien-nhien-mao-hiem', () =>
    expect(extractFromText('chả thích núi đâu').interests ?? []).not.toContain('thien-nhien-mao-hiem'));
  // …nhưng KHÔNG false-fire giữa từ: "chảy" chứa "chả" nhưng theo sau là chữ → không phải phủ định.
  it('"nước chảy ra biển" → VẪN có bien-dao (chả không false-fire trong chảy)', () =>
    expect(extractFromText('nước chảy ra biển').interests).toContain('bien-dao'));
  // Phủ định 1 clause KHÔNG được nuốt literal khẳng định ở clause sau (regression: mất "câu cá").
  it('"không thích núi, thích câu cá" → có câu cá, KHÔNG có thien-nhien-mao-hiem', () => {
    const d = extractFromText('không thích núi, thích câu cá');
    expect(d.interests).toContain('câu cá');
    expect(d.interests ?? []).not.toContain('thien-nhien-mao-hiem');
  });
  // "nhưng" đảo cực: clause sau khẳng định lại biển → bien-dao trở lại (không bị clause phủ định trước nuốt).
  it('"không thích biển nhưng vẫn muốn ra biển" → có bien-dao', () =>
    expect(extractFromText('không thích biển nhưng vẫn muốn ra biển').interests).toContain('bien-dao'));
});

describe('extractFromText — false-positive regression (headcount/budget/city)', () => {
  it('"tìm 3 khách sạn gần biển" KHÔNG set adults ("khách sạn" ≠ "khách")', () =>
    expect(extractFromText('tìm 3 khách sạn gần biển').adults).toBeUndefined());
  it('"gia đình 2 trẻ" KHÔNG set budgetPerPerson ("trẻ" ≠ "tr")', () =>
    expect(extractFromText('gia đình 2 trẻ').budgetPerPerson).toBeUndefined());
  it('"3 trái dừa" KHÔNG set budgetPerPerson ("trái" ≠ "tr")', () =>
    expect(extractFromText('3 trái dừa').budgetPerPerson).toBeUndefined());
  it('"500 ký hành lý" KHÔNG set budgetPerPerson ("ký" ≠ "k")', () =>
    expect(extractFromText('500 ký hành lý').budgetPerPerson).toBeUndefined());
  it('"tôi thích hoa huệ" KHÔNG set dia_diem (huệ ≠ Huế, không tín hiệu du lịch)', () =>
    expect(extractFromText('tôi thích hoa huệ').dia_diem).toBeUndefined());
  it('"vinh danh các anh hùng" KHÔNG set dia_diem (không tín hiệu du lịch)', () =>
    expect(extractFromText('vinh danh các anh hùng').dia_diem).toBeUndefined());

  // Positive controls — vẫn hoạt động bình thường sau khi siết boundary.
  it('"đi Huế 3 ngày" → dia_diem=hue', () =>
    expect(extractFromText('đi Huế 3 ngày').dia_diem).toBe('hue'));
  it('"đi Vinh" → dia_diem=vinh', () =>
    expect(extractFromText('đi Vinh').dia_diem).toBe('vinh'));
  it('"2 người" → adults=2', () =>
    expect(extractFromText('2 người').adults).toBe(2));
  it('"2 triệu" → budgetPerPerson=2.000.000', () =>
    expect(extractFromText('2 triệu').budgetPerPerson).toBe(2_000_000));
  it('"300k" → budgetPerPerson=300.000', () =>
    expect(extractFromText('300k').budgetPerPerson).toBe(300_000));
});

describe('V3 E — isAllDay + moTaTrusted', () => {
  it('00:00-23:59 → cả ngày', () => expect(isAllDay('00:00-23:59')).toBe(true));
  it('08:00-17:00 → không', () => expect(isAllDay('08:00-17:00')).toBe(false));
  it('null → false', () => expect(isAllDay(null)).toBe(false));
  it('beach POI + URL Cầu_Trần_Phú → KHÔNG tin (ẩn)', () =>
    expect(moTaTrusted({ category: 'Bãi biển', name: 'Bãi biển Trần Phú', mo_ta_nguon_url: 'https://vi.wikipedia.org/wiki/Cầu_Trần_Phú' })).toBe(false));
  it('cầu POI + URL cầu → tin', () =>
    expect(moTaTrusted({ category: 'Cầu / Điểm ngắm cảnh', name: 'Cầu Vàng', mo_ta_nguon_url: 'https://vi.wikipedia.org/wiki/Cầu_Vàng' })).toBe(true));
  it('POI thường + URL không hạ tầng → tin', () =>
    expect(moTaTrusted({ category: 'Chùa', name: 'Chùa Linh Ứng', mo_ta_nguon_url: 'https://vi.wikipedia.org/wiki/Chùa_Linh_Ứng' })).toBe(true));
});
