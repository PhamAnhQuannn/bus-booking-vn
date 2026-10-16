// router (PR-9) — providerOrder + fallback TRƯỚC event nội dung đầu, tối đa 1 lần. Mock 2 adapter để
// điều khiển stream/throw; kiểm: thứ tự theo PLANNER_LLM_PRIMARY · happy chỉ gọi primary · fallback khi
// primary ném trước nội dung · provider-event 1 mình KHÔNG khoá fallback · KHÔNG fallback sau nội dung ·
// all-down → ném.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreamEvent, ChatTurn } from '../llm/types';
import { ParseIntentError } from '../llm/types';

const { geminiFn, groqFn, claudeFn, warnFn } = vi.hoisted(() => ({ geminiFn: vi.fn(), groqFn: vi.fn(), claudeFn: vi.fn(), warnFn: vi.fn() }));
vi.mock('../llm/geminiAdapter', () => ({ streamChat: geminiFn }));
vi.mock('../llm/openaiCompatAdapter', () => ({ streamChat: groqFn }));
vi.mock('../llm/anthropicAdapter', () => ({ streamChat: claudeFn }));
// #826: router logs the swallowed primary error before fallback.
vi.mock('@/lib/logger', () => ({ logger: { warn: warnFn, info: vi.fn(), error: vi.fn() } }));

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

const P = (id: 'gemini' | 'groq' | 'claude'): StreamEvent => ({ kind: 'provider', id, model: `${id}-x` });
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
  claudeFn.mockReset();
  warnFn.mockReset();
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
    expect(warnFn).not.toHaveBeenCalled(); // #826: no fallback → no fallback log
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
    // #826: the swallowed primary (groq no_key) error is logged before falling back.
    expect(warnFn).toHaveBeenCalledTimes(1);
    expect(warnFn).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'groq', nextProvider: 'gemini', code: 'no_key', err: 'down' }),
      'planner.router.fallback',
    );
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
    expect(warnFn).not.toHaveBeenCalled(); // #826: rethrow after content → no fallback log
  });

  it('cả hai chết trước nội dung → ném (provider cuối)', async () => {
    groqFn.mockImplementation(throwsNow('upstream'));
    geminiFn.mockImplementation(throwsNow('upstream'));
    await expect(drain()).rejects.toMatchObject({ name: 'ParseIntentError' });
    expect(geminiFn).toHaveBeenCalledTimes(1);
    expect(groqFn).toHaveBeenCalledTimes(1);
    // #826: primary (gemini, default order) fallback is logged once before the last (groq) rethrows.
    expect(warnFn).toHaveBeenCalledTimes(1);
    expect(warnFn).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'gemini', nextProvider: 'groq', code: 'upstream' }),
      'planner.router.fallback',
    );
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

describe('router — claude (opt-in)', () => {
  it('PLANNER_LLM_PRIMARY=claude → [claude, gemini]; default KHÔNG có claude', () => {
    expect(providerOrder()).not.toContain('claude');
    process.env.PLANNER_LLM_PRIMARY = 'claude';
    expect(providerOrder()).toEqual(['claude', 'gemini']);
  });

  it('claude happy → chỉ gọi claude', async () => {
    process.env.PLANNER_LLM_PRIMARY = 'claude';
    claudeFn.mockImplementation(emit([P('claude'), SLOTS]));
    expect(await drain()).toEqual([P('claude'), SLOTS]);
    expect(geminiFn).not.toHaveBeenCalled();
    expect(groqFn).not.toHaveBeenCalled();
  });

  it('claude ném trước nội dung → fallback gemini', async () => {
    process.env.PLANNER_LLM_PRIMARY = 'claude';
    claudeFn.mockImplementation(throwsNow('no_key'));
    geminiFn.mockImplementation(emit([P('gemini'), SLOTS]));
    expect(await drain()).toEqual([P('gemini'), SLOTS]);
    expect(groqFn).not.toHaveBeenCalled();
  });
});

describe('router — PLANNER_LLM_FALLBACK=off (eval)', () => {
  afterEach(() => {
    delete process.env.PLANNER_LLM_FALLBACK;
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL;
  });

  it('off → chỉ primary; primary ném trước nội dung → ném, KHÔNG gọi provider kế', async () => {
    process.env.PLANNER_LLM_FALLBACK = 'off';
    process.env.PLANNER_LLM_PRIMARY = 'claude';
    expect(providerOrder()).toEqual(['claude']);
    claudeFn.mockImplementation(throwsNow('upstream'));
    await expect(drain()).rejects.toMatchObject({ code: 'upstream' });
    expect(geminiFn).not.toHaveBeenCalled();
  });

  it('prod thật bỏ qua cờ → giữ lưới fallback', () => {
    process.env.PLANNER_LLM_FALLBACK = 'off';
    process.env.VERCEL_ENV = 'production';
    expect(providerOrder()).toEqual(['gemini', 'groq']);
  });
});

describe('router — PLANNER_LLM_FALLBACK=off ignored on Vercel preview', () => {
  afterEach(() => {
    delete process.env.PLANNER_LLM_FALLBACK;
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL;
  });

  it('preview keeps fallback net', () => {
    process.env.PLANNER_LLM_FALLBACK = 'off';
    process.env.VERCEL = '1';
    process.env.VERCEL_ENV = 'preview';
    expect(providerOrder()).toEqual(['gemini', 'groq']);
  });
});

// #829/#622: accounting breaker per-provider qua hooks route tiêm (router không import lib/ratelimit).
describe('router — breaker hooks per-provider (#829/#622)', () => {
  const mkHooks = (skip: string[] = []) => ({
    skip: new Set(skip) as ReadonlySet<'gemini' | 'groq' | 'claude'>,
    onUpstreamFailure: vi.fn(async () => {}),
    onSuccess: vi.fn(async () => {}),
  });
  const drainWith = async (hooks: ReturnType<typeof mkHooks>) => {
    const out: StreamEvent[] = [];
    for await (const ev of streamChat(HISTORY, 'vi', hooks)) out.push(ev);
    return out;
  };

  it('primary pre-content upstream → fail trên primary, success trên fallback, primary KHÔNG reset', async () => {
    process.env.PLANNER_LLM_PRIMARY = 'claude';
    claudeFn.mockImplementation(throwsNow('upstream'));
    geminiFn.mockImplementation(emit([P('gemini'), SLOTS]));
    const hooks = mkHooks();
    expect(await drainWith(hooks)).toEqual([P('gemini'), SLOTS]);
    expect(hooks.onUpstreamFailure).toHaveBeenCalledTimes(1);
    expect(hooks.onUpstreamFailure).toHaveBeenCalledWith('claude');
    expect(hooks.onSuccess).toHaveBeenCalledTimes(1);
    expect(hooks.onSuccess).toHaveBeenCalledWith('gemini');
  });

  it('happy primary → success CHỈ primary, không failure', async () => {
    process.env.PLANNER_LLM_PRIMARY = 'claude';
    claudeFn.mockImplementation(emit([P('claude'), SLOTS]));
    const hooks = mkHooks();
    await drainWith(hooks);
    expect(hooks.onSuccess).toHaveBeenCalledWith('claude');
    expect(hooks.onSuccess).toHaveBeenCalledTimes(1);
    expect(hooks.onUpstreamFailure).not.toHaveBeenCalled();
  });

  it('primary breaker mở (skip) → KHÔNG gọi primary, đi thẳng fallback', async () => {
    process.env.PLANNER_LLM_PRIMARY = 'claude';
    claudeFn.mockImplementation(emit([P('claude'), SLOTS]));
    geminiFn.mockImplementation(emit([P('gemini'), SLOTS]));
    const hooks = mkHooks(['claude']);
    expect(await drainWith(hooks)).toEqual([P('gemini'), SLOTS]);
    expect(claudeFn).not.toHaveBeenCalled();
    expect(hooks.onSuccess).toHaveBeenCalledWith('gemini');
    expect(hooks.onUpstreamFailure).not.toHaveBeenCalled();
    expect(warnFn).toHaveBeenCalledWith(expect.objectContaining({ skipped: ['claude'] }), 'planner.router.breaker_skip');
  });

  it('mọi provider skip → ném upstream, không gọi adapter, không hook', async () => {
    process.env.PLANNER_LLM_PRIMARY = 'claude';
    const hooks = mkHooks(['claude', 'gemini']);
    await expect(drainWith(hooks)).rejects.toMatchObject({ name: 'ParseIntentError', code: 'upstream' });
    expect(claudeFn).not.toHaveBeenCalled();
    expect(geminiFn).not.toHaveBeenCalled();
    expect(hooks.onUpstreamFailure).not.toHaveBeenCalled();
  });

  it('no_key KHÔNG đếm upstream (#828 semantics)', async () => {
    process.env.PLANNER_LLM_PRIMARY = 'claude';
    claudeFn.mockImplementation(throwsNow('no_key'));
    geminiFn.mockImplementation(emit([P('gemini'), SLOTS]));
    const hooks = mkHooks();
    await drainWith(hooks);
    expect(hooks.onUpstreamFailure).not.toHaveBeenCalled();
    expect(hooks.onSuccess).toHaveBeenCalledWith('gemini');
  });

  it('bad_json KHÔNG đếm upstream', async () => {
    process.env.PLANNER_LLM_PRIMARY = 'claude';
    claudeFn.mockImplementation(async function* (): AsyncGenerator<StreamEvent> {
      throw new ParseIntentError('junk', 'bad_json');
    });
    geminiFn.mockImplementation(emit([P('gemini'), SLOTS]));
    const hooks = mkHooks();
    await drainWith(hooks);
    expect(hooks.onUpstreamFailure).not.toHaveBeenCalled();
  });

  it('mid-stream fail SAU nội dung → đếm ĐÚNG 1 lần, ném, không fallback, không success', async () => {
    process.env.PLANNER_LLM_PRIMARY = 'claude';
    claudeFn.mockImplementation(emit([P('claude'), SLOTS], true));
    const hooks = mkHooks();
    await expect(drainWith(hooks)).rejects.toMatchObject({ code: 'upstream' });
    expect(hooks.onUpstreamFailure).toHaveBeenCalledTimes(1);
    expect(hooks.onUpstreamFailure).toHaveBeenCalledWith('claude');
    expect(hooks.onSuccess).not.toHaveBeenCalled();
    expect(geminiFn).not.toHaveBeenCalled();
  });

  it('cả hai upstream chết → mỗi provider đếm 1 lần trên breaker của nó', async () => {
    process.env.PLANNER_LLM_PRIMARY = 'claude';
    claudeFn.mockImplementation(throwsNow('upstream'));
    geminiFn.mockImplementation(throwsNow('upstream'));
    const hooks = mkHooks();
    await expect(drainWith(hooks)).rejects.toMatchObject({ code: 'upstream' });
    expect(hooks.onUpstreamFailure.mock.calls).toEqual([['claude'], ['gemini']]);
  });

  it('#829 gốc: gemini upstream + groq no_key → ném lỗi upstream của gemini (không che thành no_key)', async () => {
    geminiFn.mockImplementation(async function* (): AsyncGenerator<StreamEvent> {
      throw new ParseIntentError('Gemini HTTP 503', 'upstream');
    });
    groqFn.mockImplementation(throwsNow('no_key'));
    const hooks = mkHooks();
    await expect(drainWith(hooks)).rejects.toMatchObject({ code: 'upstream', message: 'Gemini HTTP 503' });
    expect(hooks.onUpstreamFailure).toHaveBeenCalledTimes(1);
    expect(hooks.onUpstreamFailure).toHaveBeenCalledWith('gemini');
  });

  it('#622: mỗi attempt adapter retry (onRetry) cũng đếm trên breaker provider đó', async () => {
    process.env.PLANNER_LLM_PRIMARY = 'claude';
    // adapter giả: 2 attempt 5xx được retry (onRetry) rồi attempt cuối ném upstream → 3 lần đếm.
    claudeFn.mockImplementation(async function* (_h: ChatTurn[], _l: string, opts?: { onRetry?: () => Promise<void> | void }): AsyncGenerator<StreamEvent> {
      await opts?.onRetry?.();
      await opts?.onRetry?.();
      throw new ParseIntentError('Claude HTTP 529', 'upstream');
    });
    geminiFn.mockImplementation(emit([P('gemini'), SLOTS]));
    const hooks = mkHooks();
    await drainWith(hooks);
    expect(hooks.onUpstreamFailure.mock.calls).toEqual([['claude'], ['claude'], ['claude']]);
    expect(hooks.onSuccess).toHaveBeenCalledWith('gemini');
  });

  it('không truyền hooks → hành vi cũ (không lỗi)', async () => {
    geminiFn.mockImplementation(emit([P('gemini'), SLOTS]));
    expect(await drain()).toEqual([P('gemini'), SLOTS]);
  });
});
