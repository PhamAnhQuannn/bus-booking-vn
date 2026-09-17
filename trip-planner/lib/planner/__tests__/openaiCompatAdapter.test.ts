// openaiCompatAdapter (Groq) — accumulator tool-call THEO MẢNH. KHÁC Gemini (functionCall trọn 1 frame):
// OpenAI-compat trả `delta.tool_calls[i].function.arguments` NHIỀU delta → gom theo `index`, JSON.parse
// tại cuối stream. Test synthetic SSE (byte-chunk có kiểm soát) phủ: truncate→drop, index-gap, prose∥
// tool_calls, >1 tool_call, prose UTF-8 cắt giữa "Đ" (decode stream:true), enum lậu→drop, retry/usage.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { streamChat } from '../llm/openaiCompatAdapter';
import { signModelTurn } from '../chatSig';
import { ParseIntentError, type ChatTurn, type StreamEvent } from '../llm/types';

const HISTORY: ChatTurn[] = [{ role: 'user', text: 'Mình muốn đi Đà Lạt 3 ngày' }];

const enc = new TextEncoder();

// Response với body là ReadableStream phát TỪNG chunk theo thứ tự (string → utf8, hoặc Uint8Array raw
// để cắt byte giữa multibyte char). Mô phỏng đúng ranh giới chunk mạng.
function streamRes(chunks: (string | Uint8Array)[], status = 200) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(typeof c === 'string' ? enc.encode(c) : c);
      controller.close();
    },
  });
  return new Response(body, { status, headers: { 'Content-Type': 'text/event-stream' } });
}
const status = (code: number) => new Response(`{"error":{"code":${code}}}`, { status: code });

// 1 frame OpenAI-compat SSE.
const frame = (delta: unknown, extra: Record<string, unknown> = {}) =>
  `data: ${JSON.stringify({ choices: [{ delta }], ...extra })}\n`;

async function drain(history: ChatTurn[] = HISTORY): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const ev of streamChat(history)) events.push(ev);
  return events;
}

beforeEach(() => {
  process.env.GROQ_API_KEY = 'test-key';
  vi.useFakeTimers();
});

afterEach(() => {
  delete process.env.PLANNER_GROQ_MODEL;
  delete process.env.PLANNER_CHAT_SECRET;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('openaiCompatAdapter — accumulator tool-call theo index', () => {
  it('(d) >1 tool_call: trich (index0, args theo mảnh) + goi_y_vibe (index1) → slots + suggest', async () => {
    const chunks = [
      frame({ tool_calls: [{ index: 0, function: { name: 'trich', arguments: '{"dia_diem":' } }] }),
      frame({ tool_calls: [{ index: 0, function: { arguments: '"da-lat","days":3}' } }] }),
      frame({ tool_calls: [{ index: 1, function: { name: 'goi_y_vibe', arguments: '{"dia_diem":"da-lat","vibe":"lang-man"}' } }] }),
      'data: [DONE]\n',
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamRes(chunks)));

    const events = await drain();
    const slots = events.find((e) => e.kind === 'slots') as { partial: { dia_diem?: string; days?: number } } | undefined;
    expect(slots?.partial.dia_diem).toBe('da-lat');
    expect(slots?.partial.days).toBe(3);
    const suggest = events.find((e) => e.kind === 'suggest') as { dia_diem: string; vibe: string } | undefined;
    expect(suggest).toEqual({ kind: 'suggest', dia_diem: 'da-lat', vibe: 'lang-man' });
  });

  it('(PR-8) khai provider=groq TRƯỚC token đầu + slots.dropped = countOutOfEnum RAW', async () => {
    const chunks = [
      // dia_diem hợp lệ nhưng interests có enum bịa "xyz-bịa" → dropped=1 (đếm RAW trước allowlist)
      frame({ tool_calls: [{ index: 0, function: { name: 'trich', arguments: '{"dia_diem":"da-lat","days":3,"interests":["xyz-bịa","lang-man"]}' } }] }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamRes(chunks)));

    const events = await drain();
    expect(events[0]).toEqual({ kind: 'provider', id: 'groq', model: 'openai/gpt-oss-20b' });
    const slots = events.find((e) => e.kind === 'slots') as { dropped?: number } | undefined;
    expect(slots?.dropped).toBe(1);
  });

  it('(a) truncate TRƯỚC finish (args JSON dở) → 0 slots, KHÔNG throw', async () => {
    const chunks = [
      frame({ tool_calls: [{ index: 0, function: { name: 'trich', arguments: '{"dia_diem":"da-' } }] }),
      // stream kết thúc đột ngột — không frame nào đóng JSON
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamRes(chunks)));

    const events = await drain();
    expect(events.some((e) => e.kind === 'slots')).toBe(false);
    expect(events.some((e) => e.kind === 'suggest')).toBe(false);
  });

  it('(b) index-gap + out-of-order: index 2 tới trước index 0 → cả hai gom đúng, phát theo thứ tự index', async () => {
    const chunks = [
      frame({ tool_calls: [{ index: 2, function: { name: 'goi_y_vibe', arguments: '{"dia_diem":"da-lat","vibe":"lang-man"}' } }] }),
      frame({ tool_calls: [{ index: 0, function: { name: 'trich', arguments: '{"dia_diem":"da-lat","days":2}' } }] }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamRes(chunks)));

    const events = await drain();
    const kinds = events.filter((e) => e.kind === 'slots' || e.kind === 'suggest').map((e) => e.kind);
    expect(kinds).toEqual(['slots', 'suggest']); // index0 (trich) trước index2 (goi_y_vibe)
  });

  it('(c) content ∥ tool_calls trong cùng stream → token prose + slots', async () => {
    const chunks = [
      frame({ content: 'Đà Lạt hợp lắm. ' }),
      frame({ content: 'Mình gợi ý nhé.', tool_calls: [{ index: 0, function: { name: 'trich', arguments: '{"dia_diem":"da-lat","days":3}' } }] }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamRes(chunks)));

    const events = await drain();
    const tokens = events.filter((e) => e.kind === 'token').map((e) => (e as { text: string }).text);
    expect(tokens).toEqual(['Đà Lạt hợp lắm. ', 'Mình gợi ý nhé.']);
    expect(events.some((e) => e.kind === 'slots')).toBe(true);
  });

  it('(e) prose UTF-8 cắt giữa "Đ" qua 2 chunk (decode stream:true) → accProse nguyên, sig tag khớp', async () => {
    process.env.PLANNER_CHAT_SECRET = 'test-secret'; // để signModelTurn sinh HMAC nhạy byte prose
    const prose = 'Đà Lạt đẹp';
    const line = frame({ content: prose });
    const bytes = enc.encode(line);
    // "Đ" = 0xC4 0x90; line bắt đầu `data: {"choices":[{"delta":{"content":"Đ...`. Cắt SAU byte 0xC4
    // của "Đ" (byte đầu multibyte) → chunk1 kết bằng nửa char, chunk2 mang nốt. decode(stream:true) ghép.
    const cut = bytes.indexOf(0xc4) + 1;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamRes([bytes.slice(0, cut), bytes.slice(cut)])));

    const events = await drain();
    const proseOut = events.filter((e) => e.kind === 'token').map((e) => (e as { text: string }).text).join('');
    expect(proseOut).toBe(prose); // KHÔNG có replacement char �
    const sig = events.find((e) => e.kind === 'sig') as { tag: string } | undefined;
    expect(sig?.tag).toBe(signModelTurn(prose));
  });

  it('(f) goi_y_vibe enum lậu (city không hợp lệ) → KHÔNG phát suggest', async () => {
    const chunks = [
      frame({ tool_calls: [{ index: 0, function: { name: 'goi_y_vibe', arguments: '{"dia_diem":"atlantis","vibe":"lang-man"}' } }] }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamRes(chunks)));

    const events = await drain();
    expect(events.some((e) => e.kind === 'suggest')).toBe(false);
  });

  it('(f2) goi_y_vibe vibe lậu (không trong VIBE_VOCAB) → KHÔNG phát suggest', async () => {
    const chunks = [
      frame({ tool_calls: [{ index: 0, function: { name: 'goi_y_vibe', arguments: '{"dia_diem":"da-lat","vibe":"bịa-đặt"}' } }] }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamRes(chunks)));

    const events = await drain();
    expect(events.some((e) => e.kind === 'suggest')).toBe(false);
  });

  it('(g-usage) stream_options.include_usage → chunk cuối mang usage → usage event (thoughtsTokens=0)', async () => {
    const chunks = [
      frame({ tool_calls: [{ index: 0, function: { name: 'trich', arguments: '{"dia_diem":"da-lat","days":3}' } }] }),
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 812, completion_tokens: 24, total_tokens: 836 } })}\n`,
      'data: [DONE]\n',
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamRes(chunks)));

    const events = await drain();
    const usage = events.find((e) => e.kind === 'usage') as
      | { inputTokens: number; outputTokens: number; totalTokens: number; thoughtsTokens: number }
      | undefined;
    expect(usage).toEqual({ kind: 'usage', inputTokens: 812, outputTokens: 24, totalTokens: 836, thoughtsTokens: 0 });
  });

  it('malformed frame (JSON dở) giữa stream → bỏ frame đó, không throw, vẫn trích frame hợp lệ', async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"x"}\n', // JSON không đóng → parse fail → skip
      frame({ tool_calls: [{ index: 0, function: { name: 'trich', arguments: '{"dia_diem":"da-lat","days":3}' } }] }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamRes(chunks)));

    const events = await drain();
    expect(events.some((e) => e.kind === 'slots')).toBe(true);
  });
});

describe('openaiCompatAdapter — retry / config', () => {
  const okFrame = () => streamRes([frame({ tool_calls: [{ index: 0, function: { name: 'trich', arguments: '{"dia_diem":"da-lat","days":3}' } }] })]);

  it('503 → 503 → 200: retry rồi thành công (2 retry)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(status(503))
      .mockResolvedValueOnce(status(503))
      .mockResolvedValueOnce(okFrame());
    vi.stubGlobal('fetch', fetchMock);

    const p = drain();
    await vi.advanceTimersByTimeAsync(400);
    await vi.advanceTimersByTimeAsync(800);
    const events = await p;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(events.some((e) => e.kind === 'slots')).toBe(true);
  });

  it('503 × 3: hết retry → throw ParseIntentError(upstream)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(status(503));
    vi.stubGlobal('fetch', fetchMock);

    const captured = drain().catch((e) => e);
    await vi.advanceTimersByTimeAsync(1200);
    const err = await captured;

    expect(err).toMatchObject({ name: 'ParseIntentError', code: 'upstream' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('401: lỗi key → throw NGAY, KHÔNG retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue(status(401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(drain()).rejects.toBeInstanceOf(ParseIntentError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('429: rate-limit → throw NGAY, KHÔNG retry (circuit-breaker lo)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(status(429));
    vi.stubGlobal('fetch', fetchMock);

    await expect(drain()).rejects.toMatchObject({ code: 'upstream' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('thiếu GROQ_API_KEY → throw no_key, KHÔNG gọi fetch', async () => {
    delete process.env.GROQ_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(drain()).rejects.toMatchObject({ code: 'no_key' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('request body: stream=true, tool_choice=auto, tools=[trich,goi_y_vibe], system + history mapped', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okFrame());
    vi.stubGlobal('fetch', fetchMock);

    await drain();
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.stream).toBe(true);
    expect(body.stream_options).toEqual({ include_usage: true });
    expect(body.tool_choice).toBe('auto');
    expect(body.tools.map((t: { function: { name: string } }) => t.function.name)).toEqual(['trich', 'goi_y_vibe']);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1]).toEqual({ role: 'user', content: 'Mình muốn đi Đà Lạt 3 ngày' });
  });

  it('history role model → assistant (OpenAI-compat mapping)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okFrame());
    vi.stubGlobal('fetch', fetchMock);

    await drain([
      { role: 'user', text: 'Đi Sa Pa nhé' },
      { role: 'model', text: 'Bạn đi mấy ngày?' },
    ]);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(['system', 'user', 'assistant']);
  });

  it('PLANNER_GROQ_MODEL hợp lệ (namespace `/`) → dùng; xấu → fallback default', async () => {
    process.env.PLANNER_GROQ_MODEL = 'qwen/qwen3.8-27b';
    const f1 = vi.fn().mockResolvedValue(okFrame());
    vi.stubGlobal('fetch', f1);
    await drain();
    expect(JSON.parse((f1.mock.calls[0][1] as { body: string }).body).model).toBe('qwen/qwen3.8-27b');

    vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.PLANNER_GROQ_MODEL = 'bad model!!';
    const f2 = vi.fn().mockResolvedValue(okFrame());
    vi.stubGlobal('fetch', f2);
    await drain();
    expect(JSON.parse((f2.mock.calls[0][1] as { body: string }).body).model).toBe('openai/gpt-oss-20b');
  });
});
