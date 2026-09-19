// router (PR-9) — providerOrder + fallback TRƯỚC event nội dung đầu, tối đa 1 lần. Mock 2 adapter để
// điều khiển stream/throw; kiểm: thứ tự theo PLANNER_LLM_PRIMARY · happy chỉ gọi primary · fallback khi
// primary ném trước nội dung · provider-event 1 mình KHÔNG khoá fallback · KHÔNG fallback sau nội dung ·
// all-down → ném.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreamEvent, ChatTurn } from '../llm/types';
import { ParseIntentError } from '../llm/types';

const { geminiFn, groqFn } = vi.hoisted(() => ({ geminiFn: vi.fn(), groqFn: vi.fn() }));
vi.mock('../llm/geminiAdapter', () => ({ streamChat: geminiFn }));
vi.mock('../llm/openaiCompatAdapter', () => ({ streamChat: groqFn }));

import { streamChat, providerOrder } from '../llm/router';

const HISTORY: ChatTurn[] = [{ role: 'user', text: 'Đà Lạt 3 ngày' }];

// impl phát các event rồi (tuỳ chọn) ném — gán trực tiếp làm mockImplementation (async generator fn).
const emit = (events: StreamEvent[], throwAfter = false) =>
  async function* () {
    for (const e of events) yield e;
    if (throwAfter) throw new ParseIntentError('mid-stream', 'upstream');
  };
const throwsNow = (code: 'no_key' | 'upstream' = 'upstream') =>
  async function* (): AsyncGenerator<StreamEvent> {
    throw new ParseIntentError('down', code);
  };

const P = (id: 'gemini' | 'groq'): StreamEvent => ({ kind: 'provider', id, model: `${id}-x` });
const SLOTS: StreamEvent = { kind: 'slots', partial: { dia_diem: 'da-lat' } };

async function drainOf(history: ChatTurn[]): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  for await (const ev of streamChat(history)) out.push(ev);
  return out;
}
const drain = () => drainOf(HISTORY);

beforeEach(() => {
  geminiFn.mockReset();
  groqFn.mockReset();
});
afterEach(() => {
  delete process.env.PLANNER_LLM_PRIMARY;
  delete process.env.PLANNER_LLM_STUB; // #748: process-global — dọn tránh rò sang test khác (gate mới đọc nó)
});

describe('router — providerOrder', () => {
  it('default (unset) → [gemini, groq]', () => {
    expect(providerOrder()).toEqual(['gemini', 'groq']);
  });
  it('PLANNER_LLM_PRIMARY=groq → [groq, gemini]', () => {
    process.env.PLANNER_LLM_PRIMARY = 'groq';
    expect(providerOrder()).toEqual(['groq', 'gemini']);
  });
  it('giá trị lạ → mặc định [gemini, groq]', () => {
    process.env.PLANNER_LLM_PRIMARY = 'openrouter';
    expect(providerOrder()).toEqual(['gemini', 'groq']);
  });
});

describe('router — fallback', () => {
  it('primary (gemini) OK → chỉ gọi primary, KHÔNG chạm groq', async () => {
    geminiFn.mockImplementation(emit([P('gemini'), { kind: 'token', text: 'hi' }, SLOTS]));
    const events = await drain();
    expect(events.map((e) => e.kind)).toEqual(['provider', 'token', 'slots']);
    expect(geminiFn).toHaveBeenCalledTimes(1);
    expect(groqFn).not.toHaveBeenCalled();
  });

  it('primary=groq ném TRƯỚC nội dung (no_key) → fallback gemini', async () => {
    process.env.PLANNER_LLM_PRIMARY = 'groq';
    groqFn.mockImplementation(throwsNow('no_key'));
    geminiFn.mockImplementation(emit([P('gemini'), SLOTS]));
    const events = await drain();
    expect(groqFn).toHaveBeenCalledTimes(1);
    expect(geminiFn).toHaveBeenCalledTimes(1);
    expect(events.find((e) => e.kind === 'provider')).toEqual(P('gemini'));
    expect(events.some((e) => e.kind === 'slots')).toBe(true);
  });

  it('primary phát provider event RỒI ném (chưa có nội dung) → vẫn fallback', async () => {
    process.env.PLANNER_LLM_PRIMARY = 'groq';
    groqFn.mockImplementation(emit([P('groq')], true)); // provider rồi throw, không nội dung
    geminiFn.mockImplementation(emit([P('gemini'), SLOTS]));
    const events = await drain();
    expect(geminiFn).toHaveBeenCalledTimes(1);
    // provider groq (trước khi ném) + provider gemini (fallback) + slots
    expect(events.filter((e) => e.kind === 'provider').map((e) => (e as { id: string }).id)).toEqual(['groq', 'gemini']);
    expect(events.some((e) => e.kind === 'slots')).toBe(true);
  });

  it('primary phát NỘI DUNG rồi ném → KHÔNG fallback, ném ra ngoài', async () => {
    process.env.PLANNER_LLM_PRIMARY = 'groq';
    groqFn.mockImplementation(emit([P('groq'), SLOTS], true)); // đã có slots → không fallback
    geminiFn.mockImplementation(emit([P('gemini')]));
    await expect(drain()).rejects.toMatchObject({ name: 'ParseIntentError', code: 'upstream' });
    expect(geminiFn).not.toHaveBeenCalled();
  });

  it('cả hai chết trước nội dung → ném (provider cuối)', async () => {
    groqFn.mockImplementation(throwsNow('upstream'));
    geminiFn.mockImplementation(throwsNow('upstream'));
    await expect(drain()).rejects.toMatchObject({ name: 'ParseIntentError' });
    expect(geminiFn).toHaveBeenCalledTimes(1);
    expect(groqFn).toHaveBeenCalledTimes(1);
  });
});

// #748: stub gate TRƯỚC vòng provider → stub bật KHÔNG bao giờ chạm adapter thật (llmStub KHÔNG mock →
// stubStream thật chạy: default yield slots; __error__ ném 'upstream' TRƯỚC content). Nếu adapter mock
// bị gọi = gate hỏng (rơi vào vòng fallback = bug gốc). isRealProduction()=false ở vitest (NODE_ENV=test).
describe('router — stub gate (#748)', () => {
  it('stub=true + input thường → phục vụ stub, KHÔNG gọi geminiFn/groqFn', async () => {
    process.env.PLANNER_LLM_STUB = 'true';
    // để adapter mock ném nếu bị gọi → chứng minh KHÔNG bao giờ tới
    geminiFn.mockImplementation(throwsNow('upstream'));
    groqFn.mockImplementation(throwsNow('upstream'));

    const events = await drain();
    expect(geminiFn).not.toHaveBeenCalled();
    expect(groqFn).not.toHaveBeenCalled();
    expect(events.some((e) => e.kind === 'slots')).toBe(true);
  });

  it('stub=true + "__error__" → rejects upstream, KHÔNG fallthrough sang adapter (bug gốc #748)', async () => {
    process.env.PLANNER_LLM_STUB = 'true';
    geminiFn.mockImplementation(emit([SLOTS])); // nếu gate hỏng, fallthrough sẽ gọi cái này → slots
    groqFn.mockImplementation(emit([SLOTS]));

    await expect(drainOf([{ role: 'user', text: '__error__' }])).rejects.toMatchObject({ name: 'ParseIntentError', code: 'upstream' });
    expect(geminiFn).not.toHaveBeenCalled();
    expect(groqFn).not.toHaveBeenCalled();
  });

  it('stub=true + PLANNER_LLM_PRIMARY=groq → vẫn stub, groqFn KHÔNG bị gọi', async () => {
    process.env.PLANNER_LLM_STUB = 'true';
    process.env.PLANNER_LLM_PRIMARY = 'groq';
    geminiFn.mockImplementation(throwsNow('upstream'));
    groqFn.mockImplementation(throwsNow('upstream'));

    const events = await drain();
    expect(groqFn).not.toHaveBeenCalled();
    expect(geminiFn).not.toHaveBeenCalled();
    expect(events.some((e) => e.kind === 'slots')).toBe(true);
  });
});
