// countOutOfEnum — đếm giá trị enum LẠ (city slug / vibe / pace bịa) model phát ra TRƯỚC allowlist.
// Đây là metric cổng eval-gate (PR-0, planner-100convday) + log prod per-provider (PR-8): mis-extract
// của model yếu = HTTP 200 + lịch trông bình thường = vô hình nếu không đếm. Test khoá đúng đại lượng.
import { describe, expect, it } from 'vitest';
import { countOutOfEnum } from '../parseIntent';

describe('countOutOfEnum — trich', () => {
  it('args toàn hợp lệ → 0', () => {
    expect(countOutOfEnum('trich', { dia_diem: 'da-lat', days: 3, pace: 'relaxed', interests: ['bien-dao', 'ngam-canh'] })).toBe(0);
  });

  it('dia_diem bịa (không trong CITY_SLUGS) → 1', () => {
    expect(countOutOfEnum('trich', { dia_diem: 'atlantis' })).toBe(1);
  });

  it('pace ngoài enum → 1; pace hợp lệ → 0', () => {
    expect(countOutOfEnum('trich', { pace: 'super-fast' })).toBe(1);
    expect(countOutOfEnum('trich', { pace: 'packed' })).toBe(0);
  });

  it('mỗi interest lạ đếm riêng (2 lạ + 1 thật → 2)', () => {
    expect(countOutOfEnum('trich', { interests: ['bien-dao', 'skydiving', 'casino'] })).toBe(2);
  });

  it('cộng dồn nhiều trục (slug lạ + pace lạ + 1 vibe lạ → 3)', () => {
    expect(countOutOfEnum('trich', { dia_diem: 'narnia', pace: 'chill', interests: ['teleport'] })).toBe(3);
  });

  it('field CHƯA RÕ (empty/thiếu) KHÔNG tính là enum lạ', () => {
    expect(countOutOfEnum('trich', { dia_diem: '', days: 2, adults: 4 })).toBe(0); // thiếu ≠ bịa
    expect(countOutOfEnum('trich', {})).toBe(0);
  });

  it('số ngoài range KHÔNG tính (clamp, không phải enum bịa)', () => {
    expect(countOutOfEnum('trich', { days: 999, adults: -5, children: 100 })).toBe(0);
  });

  it('interests không phải mảng → bỏ qua an toàn', () => {
    expect(countOutOfEnum('trich', { interests: 'bien-dao' as unknown as string[] })).toBe(0);
  });
});

describe('countOutOfEnum — goi_y_vibe', () => {
  it('dia_diem + vibe hợp lệ → 0', () => {
    expect(countOutOfEnum('goi_y_vibe', { dia_diem: 'sa-pa', vibe: 'lang-man' })).toBe(0);
  });

  it('vibe bịa → 1', () => {
    expect(countOutOfEnum('goi_y_vibe', { dia_diem: 'nha-trang', vibe: 'nightlife' })).toBe(1);
  });

  it('slug bịa + vibe bịa → 2', () => {
    expect(countOutOfEnum('goi_y_vibe', { dia_diem: 'gotham', vibe: 'nightlife' })).toBe(2);
  });

  it('vibe hoa/thừa khoảng trắng vẫn khớp (normalize) → 0', () => {
    expect(countOutOfEnum('goi_y_vibe', { dia_diem: 'da-lat', vibe: '  BIEN-DAO  ' })).toBe(0);
  });
});

describe('countOutOfEnum — fn ngoài phạm vi', () => {
  it('fn không phải trich/goi_y_vibe → 0 (không phạt call refusal đúng)', () => {
    expect(countOutOfEnum('', { dia_diem: 'atlantis' })).toBe(0);
    expect(countOutOfEnum('unknown_fn', { vibe: 'nightlife' })).toBe(0);
  });
});
