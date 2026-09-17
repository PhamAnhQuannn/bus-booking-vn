// PR-2 short-circuit turn-1: cổng BỎ gọi LLM khi lượt đầu đủ ràng buộc → dựng tất định ngay.
// shortCircuitEligible là pure (turn-1 = messages.length===0 kiểm ở send()). Test: eligible TRUE khi đủ
// city+days+người & không phủ định/hỏi/discovery; FALSE mọi guard; regression #730 negation; param-parity
// (short-circuit dựng CÙNG params như luồng /chat cho input đủ-slot → nhất quán, không dựng ẩu).
import { describe, expect, it } from 'vitest';
import { shortCircuitEligible, extractFromText, applyExtracted, slotsToParams, complete, type Slots } from '../slots';

describe('shortCircuitEligible — TRUE (đủ ràng buộc, dựng ngay)', () => {
  it('city + days + số người tường minh', () => {
    expect(shortCircuitEligible('Đà Lạt 3 ngày 2 người', {})).toBe(true);
  });
  it('nhóm "cặp đôi" → preset số người', () => {
    expect(shortCircuitEligible('đi Nha Trang 5 ngày cặp đôi', {})).toBe(true);
  });
  it('nhóm "gia đình" → preset số người', () => {
    expect(shortCircuitEligible('Đà Nẵng 3 ngày gia đình', {})).toBe(true);
  });
  it('slots đã có sẵn city, text bù days+người', () => {
    expect(shortCircuitEligible('3 ngày 2 người', { dia_diem: 'da-lat' })).toBe(true);
  });
  it('có nêu sở thích cũng vẫn eligible (interests không phải điều kiện)', () => {
    expect(shortCircuitEligible('Đà Lạt 3 ngày 2 người thích ngắm cảnh', {})).toBe(true);
  });
  it('city ngắn (Huế) + travel-intent "đi" → extractFromText nhận → eligible', () => {
    expect(shortCircuitEligible('đi Huế 3 ngày 2 người', {})).toBe(true);
  });
});

describe('shortCircuitEligible — FALSE (thiếu ràng buộc → cần /chat hoặc chip)', () => {
  it('thiếu số người', () => {
    expect(shortCircuitEligible('Đà Lạt 3 ngày', {})).toBe(false);
  });
  it('thiếu số ngày', () => {
    expect(shortCircuitEligible('Đà Lạt 2 người', {})).toBe(false);
  });
  it('thiếu thành phố', () => {
    expect(shortCircuitEligible('3 ngày 2 người', {})).toBe(false);
  });
  it('chỉ mỗi tên thành phố', () => {
    expect(shortCircuitEligible('Đà Lạt', {})).toBe(false);
  });
});

describe('shortCircuitEligible — FALSE guard (phủ định / hỏi / discovery)', () => {
  it('phủ định (#730) — dù đủ slot vẫn để LLM xử', () => {
    expect(shortCircuitEligible('Đà Lạt 3 ngày 2 người không thích biển', {})).toBe(false);
    expect(shortCircuitEligible('Sa Pa 3 ngày 2 người, đừng cho leo núi', {})).toBe(false);
  });
  it('câu hỏi (dấu ?) — discovery, để goi_y_vibe', () => {
    expect(shortCircuitEligible('Đà Lạt 3 ngày 2 người có gì chơi?', {})).toBe(false);
  });
  it('cụm discovery "chỗ nào" / "gợi ý" / "đi đâu" — dù đủ slot', () => {
    expect(shortCircuitEligible('chỗ nào lãng mạn ở Đà Nẵng 3 ngày 2 người', {})).toBe(false);
    expect(shortCircuitEligible('gợi ý Đà Nẵng 3 ngày 2 người', {})).toBe(false);
    expect(shortCircuitEligible('Đà Lạt 3 ngày 2 người nên đi đâu', {})).toBe(false);
  });
  it('câu ghép nhiều số người ("nhưng") — first-match-wins trích sai, để LLM xử', () => {
    expect(shortCircuitEligible('Gia đình tôi 4 người nhưng chỉ 2 người đi Đà Lạt 3 ngày', {})).toBe(false);
  });
});

describe('shortCircuit — param-parity (dựng KHÔNG ẩu, giống luồng /chat)', () => {
  it('finalSlots đủ complete + params chứa slug/days/adults đúng', () => {
    const text = 'Đà Lạt 3 ngày 2 người';
    const finalSlots: Slots = applyExtracted({}, extractFromText(text));
    expect(complete(finalSlots)).toBe(true);
    const params = slotsToParams(finalSlots);
    expect(params).toContain('slug=da-lat');
    expect(params).toContain('days=3');
    expect(params).toContain('adults=2');
  });
  it('interests từ text vào params (union tất định)', () => {
    const finalSlots = applyExtracted({}, extractFromText('đi Nha Trang 5 ngày cặp đôi thích biển'));
    const params = slotsToParams(finalSlots);
    expect(params).toContain('slug=nha-trang');
    expect(params).toContain('interests=bien-dao');
  });
});
