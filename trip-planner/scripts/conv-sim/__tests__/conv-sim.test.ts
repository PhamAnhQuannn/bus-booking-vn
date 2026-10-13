// conv-sim: phần thuần của eval-proxy (usage/giá/PII), user-sim (perturb/chip/parse), Wilson CI.
import { describe, expect, it } from 'vitest';
import { parseUsage, usdOf, piiHits, priceOf, conservativeUsage } from '../proxyLib';
import { perturb, chooseChip, parseSimReply, stripDiacritics } from '../simLib';
import { wilson } from '../stats';
import type { Scenario } from '../types';

const sse = (o: object) => `data: ${JSON.stringify(o)}\n\n`;

describe('proxyLib.parseUsage + usdOf', () => {
  it('Anthropic SSE: input ở message_start, output ở message_delta; Haiku $1/$5', () => {
    const body = sse({ type: 'message_start', message: { model: 'claude-haiku-4-5', usage: { input_tokens: 4871, output_tokens: 1 } } })
      + sse({ type: 'message_delta', usage: { output_tokens: 133 } });
    const u = parseUsage('anthropic', body, 'claude-haiku-4-5');
    expect(u).toMatchObject({ input: 4871, output: 133 });
    expect(usdOf(u)).toBeCloseTo(0.005536, 6); // khớp callUsd prod log
  });
  it('Anthropic JSON (non-stream, sim/judge) + cache tokens', () => {
    const u = parseUsage('anthropic', JSON.stringify({ type: 'message', model: 'claude-haiku-4-5', usage: { input_tokens: 100, output_tokens: 10, cache_creation_input_tokens: 1000, cache_read_input_tokens: 2000 } }), '');
    expect(usdOf(u)).toBeCloseTo((100 + 1250 + 200 + 50) / 1e6, 9);
  });
  it('Gemini usageMetadata (thoughts tính vào output) + Groq usage chunk cuối', () => {
    expect(parseUsage('gemini', sse({ usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 5, thoughtsTokenCount: 2 } }), 'gemini-3.5-flash')).toMatchObject({ input: 50, output: 7 });
    expect(parseUsage('groq', sse({ model: 'openai/gpt-oss-20b', usage: { prompt_tokens: 9, completion_tokens: 3 } }) + 'data: [DONE]\n', '')).toMatchObject({ input: 9, output: 3 });
  });
  it('model lạ → giá cao nhất đã biết (bảo thủ, chống vượt trần)', () => {
    expect(priceOf('mystery-model')).toEqual([10, 50]);
  });
});

describe('proxyLib.conservativeUsage', () => {
  it('stream đứt: output = max_tokens của request, input ≥ ký tự/3 → không lọt $0', () => {
    const body = JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 1200, messages: [{ role: 'user', content: 'x'.repeat(3000) }] });
    const u = conservativeUsage(parseUsage('anthropic', '', 'claude-haiku-4-5'), body);
    expect(u.output).toBe(1200);
    expect(u.input).toBeGreaterThanOrEqual(1000);
    expect(usdOf(u)).toBeGreaterThan(0);
  });
  it('không đè usage thật khi lớn hơn ước lượng', () => {
    const u = conservativeUsage({ model: 'm', input: 9999, output: 5000, cacheWrite: 0, cacheRead: 0 }, '{"max_tokens":100}');
    expect(u).toMatchObject({ input: 9999, output: 5000 });
  });
});

describe('proxyLib.piiHits — mọi dạng fake mà catalog sinh', () => {
  const local = ['09', '00', '000', '123'].join('');
  it.each([
    local,
    `${local.slice(0, 4)}.${local.slice(4, 7)}.${local.slice(7)}`,
    `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`,
    `+84 ${local.slice(1, 4)} ${local.slice(4, 7)} ${local.slice(7)}`,
    'không chín không không không không không một hai ba',
    'khach123@example.invalid',
  ])('bắt %s', (v) => expect(piiHits(`liên hệ ${v} nhé`)).toBeGreaterThan(0));
  it('câu thường không có PII → 0', () => expect(piiHits('đi Đà Lạt 3 ngày 2 người lớn')).toBe(0));
});

const SC = {
  id: 'cs-0001', place: { slug: 'da-lat', ten: 'Đà Lạt' }, style: 'tung-buoc', reachable: { party: 'chip' },
  hidden_goal: { days: 3, party: { adults: 2, children: 0, elders: 0 }, pace: null, interests: ['ngam-canh'], nhom: 'cap-doi' },
  perturb: { strip_diacritics: true, typo_rate: 0, teencode: true, truncate: false },
} as unknown as Scenario;

describe('simLib', () => {
  it('perturb: teencode rồi bỏ dấu', () => {
    expect(perturb('Mình không biết đi đâu', SC.perturb, () => 0.5)).toBe('mk ko bik di dau');
    expect(stripDiacritics('Đà Lạt')).toBe('Da Lat');
  });
  it('chooseChip dùng applyChip thật: city, days, nhóm preset, sở thích', () => {
    expect(chooseChip(SC, 'dia_diem', ['Hà Nội', 'Đà Lạt'], new Set())).toBe('Đà Lạt');
    expect(chooseChip(SC, 'thoi_luong', ['3 ngày 2 đêm', '5 ngày', '7 ngày'], new Set())).toBe('3 ngày 2 đêm');
    expect(chooseChip(SC, 'nhom', ['Cặp đôi', 'Gia đình', 'Bạn bè', 'Công tác'], new Set())).toBe('Cặp đôi');
    expect(chooseChip(SC, 'so_thich', ['Ngắm cảnh', 'Tâm linh', 'Bỏ qua'], new Set())).toBe('Ngắm cảnh');
  });
  it('chooseChip: số ngày không có chip → null (sim gõ text)', () => {
    expect(chooseChip({ ...SC, hidden_goal: { ...SC.hidden_goal, days: 4 } }, 'thoi_luong', ['3 ngày 2 đêm', '5 ngày'], new Set())).toBeNull();
  });
  it('parseSimReply: JSON trong text thừa; hỏng → text thô', () => {
    expect(parseSimReply('ok {"text":"đi Huế","uttered_fields":["dia_diem"],"give_up":false}')).toMatchObject({ text: 'đi Huế', uttered_fields: ['dia_diem'] });
    expect(parseSimReply('không phải json').text).toBe('không phải json');
    // khối ```josn (nhãn gõ sai) hỏng cú pháp → chỉ lấy trường text, KHÔNG gửi JSON thô làm tin nhắn
    expect(parseSimReply('```josn\n{"text": "đi Huế 2 ngày", "uttered_fields": ["dia_diem",}\n```').text).toBe('đi Huế 2 ngày');
  });
});

describe('stats.wilson', () => {
  it('0/80 → cận trên ~4.6% (không phải 0)', () => {
    const [lo, hi] = wilson(0, 80);
    expect(lo).toBe(0);
    expect(hi).toBeGreaterThan(0.04);
    expect(hi).toBeLessThan(0.05);
  });
  it('n=0 → [0,0]', () => expect(wilson(0, 0)).toEqual([0, 0]));
});
