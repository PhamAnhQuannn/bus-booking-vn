// anthropicAdapter (Claude Messages API) — SSE synthetic: text_delta → token, tool_use input_json_delta
// theo mảnh → gom theo index, JSON hỏng → drop, usage message_start/message_delta, retry 529, 401 fail-fast,
// key CHỈ ở header x-api-key (không URL), gộp turn cùng role / bỏ model turn đầu.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLAUDE_MODEL_DEFAULT, streamChat, toAnthropicMessages } from '../llm/anthropicAdapter';
import { signModelTurn } from '../chatSig';
import { ParseIntentError, type ChatTurn, type StreamEvent } from '../llm/types';

const HISTORY: ChatTurn[] = [{ role: 'user', text: 'Mình muốn đi Đà Lạt 3 ngày' }];
const enc = new TextEncoder();

function streamRes(chunks: (string | Uint8Array)[], status = 200) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(typeof c === 'string' ? enc.encode(c) : c);
      controller.close();
    },
  });
  return new Response(body, { status, headers: { 'Content-Type': 'text/event-stream' } });
}
const status = (code: number) => new Response(`{"type":"error"}`, { status: code });
const sse = (data: Record<string, unknown>) => `event: ${String(data.type)}\ndata: ${JSON.stringify(data)}\n\n`;

async function drain(history: ChatTurn[] = HISTORY): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const ev of streamChat(history)) events.push(ev);
  return events;
}

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  vi.useFakeTimers();
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.PLANNER_CLAUDE_MODEL;
  delete process.env.ANTHROPIC_BASE_URL;
  delete process.env.PLANNER_LLM_STUB;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('anthropicAdapter — stream', () => {
  it('provider trước, text_delta → token + sig, usage in/out cộng dồn', async () => {
    const chunks = [
      sse({ type: 'message_start', message: { usage: { input_tokens: 120, output_tokens: 1 } } }),
      sse({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
      sse({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Đà Lạt ' } }),
      sse({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'đẹp lắm' } }),
      sse({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 30 } }),
      sse({ type: 'message_stop' }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamRes(chunks)));

    const events = await drain();
    expect(events[0]).toEqual({ kind: 'provider', id: 'claude', model: CLAUDE_MODEL_DEFAULT });
    const text = events.filter((e) => e.kind === 'token').map((e) => (e as { text: string }).text).join('');
    expect(text).toBe('Đà Lạt đẹp lắm');
    expect(events).toContainEqual({ kind: 'sig', tag: signModelTurn('Đà Lạt đẹp lắm') });
    expect(events).toContainEqual({ kind: 'usage', inputTokens: 120, outputTokens: 30, totalTokens: 150, thoughtsTokens: 0 });
  });

  it('tool_use args theo mảnh (trich) + goi_y_vibe → slots + suggest', async () => {
    const chunks = [
      sse({ type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 't1', name: 'trich', input: {} } }),
      sse({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"dia_diem":' } }),
      sse({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '"da-lat","days":3}' } }),
      sse({ type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 't2', name: 'goi_y_vibe', input: {} } }),
      sse({ type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"dia_diem":"da-lat","vibe":"lang-man"}' } }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamRes(chunks)));

    const events = await drain();
    const slots = events.find((e) => e.kind === 'slots') as { partial: { dia_diem?: string; days?: number } } | undefined;
    expect(slots?.partial.dia_diem).toBe('da-lat');
    expect(slots?.partial.days).toBe(3);
    expect(events).toContainEqual({ kind: 'suggest', dia_diem: 'da-lat', vibe: 'lang-man' });
  });

  it('tool args JSON hỏng (truncate) → drop im lặng, không throw', async () => {
    const chunks = [
      sse({ type: 'content_block_start', index: 0, content_block: { type: 'tool_use', name: 'trich' } }),
      sse({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"dia_diem":"da-' } }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamRes(chunks)));

    const events = await drain();
    expect(events.some((e) => e.kind === 'slots')).toBe(false);
  });

  it('UTF-8 cắt giữa ký tự nhiều byte vẫn đúng', async () => {
    const full = enc.encode(sse({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Đà' } }));
    const cut = full.indexOf(0xc4) + 1; // giữa byte của "Đ"
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamRes([full.slice(0, cut), full.slice(cut)])));

    const events = await drain();
    expect(events.find((e) => e.kind === 'token')).toEqual({ kind: 'token', text: 'Đà' });
  });

  it('event error giữa stream → ParseIntentError upstream', async () => {
    const chunks = [sse({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } })];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamRes(chunks)));

    await expect(drain()).rejects.toMatchObject({ code: 'upstream' });
  });
});

describe('anthropicAdapter — request / lỗi', () => {
  it('key CHỈ ở header x-api-key, URL không chứa key; body có system + tools input_schema', async () => {
    const fetchMock = vi.fn().mockResolvedValue(streamRes([sse({ type: 'message_stop' })]));
    vi.stubGlobal('fetch', fetchMock);

    await drain();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(url).not.toContain('test-key');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('test-key');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe(CLAUDE_MODEL_DEFAULT);
    expect(body.temperature).toBe(0.3); // Haiku default nhận temperature
    expect(body.stream).toBe(true);
    expect(typeof body.system).toBe('string');
    expect(body.tools.map((t: { name: string }) => t.name)).toEqual(['trich', 'goi_y_vibe']);
    expect(body.tools[0].input_schema.type).toBe('object');
    expect(body.messages).toEqual([{ role: 'user', content: HISTORY[0].text }]);
  });

  it('PLANNER_CLAUDE_MODEL hợp lệ → dùng; giá trị lạ → default', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(streamRes([sse({ type: 'message_stop' })])));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    process.env.PLANNER_CLAUDE_MODEL = 'claude-sonnet-5-5';
    await drain();
    const sonnetBody = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(sonnetBody.model).toBe('claude-sonnet-5-5');
    expect(sonnetBody).not.toHaveProperty('temperature'); // model mới từ chối temperature tuỳ chỉnh

    process.env.PLANNER_CLAUDE_MODEL = 'bad model/../x';
    await drain();
    expect(JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body)).model).toBe(CLAUDE_MODEL_DEFAULT);
  });

  it('529 overloaded → retry rồi thành công', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(status(529))
      .mockResolvedValueOnce(streamRes([sse({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ok' } })]));
    vi.stubGlobal('fetch', fetchMock);

    const p = drain();
    await vi.runAllTimersAsync();
    const events = await p;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(events.some((e) => e.kind === 'token')).toBe(true);
  });

  it('#622: 529 → retry → OK: onRetry gọi đúng 1 lần (attempt hỏng được retry)', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(status(529))
      .mockResolvedValueOnce(streamRes([sse({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ok' } })])));
    const onRetry = vi.fn();
    const p = (async () => { for await (const _ of streamChat(HISTORY, 'vi', { onRetry })) void _; })();
    await vi.runAllTimersAsync();
    await p;
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('401 → fail-fast upstream, message không chứa key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(status(401));
    vi.stubGlobal('fetch', fetchMock);

    const err = await drain().catch((e) => e);
    expect(err).toBeInstanceOf(ParseIntentError);
    expect(err.code).toBe('upstream');
    expect(err.message).toBe('Claude HTTP 401');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('429 rate-limit → fail-fast upstream (KHÔNG retry — chỉ 5xx/529 retry)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(status(429));
    vi.stubGlobal('fetch', fetchMock);

    const err = await drain().catch((e) => e);
    expect(err).toBeInstanceOf(ParseIntentError);
    expect(err.code).toBe('upstream');
    expect(err.message).toBe('Claude HTTP 429');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('timeout (fetch treo quá STREAM_TIMEOUT_MS → abort) → ParseIntentError upstream "Claude timeout"', async () => {
    // fetch treo tới khi signal abort (giống fetch thật) → adapter map abort thành upstream.
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const p = drain().catch((e) => e);
    await vi.advanceTimersByTimeAsync(30_000);
    const err = await p;
    expect(err).toBeInstanceOf(ParseIntentError);
    expect(err.code).toBe('upstream');
    expect(err.message).toBe('Claude timeout');
    expect(fetchMock).toHaveBeenCalledTimes(1); // abort KHÔNG retry
  });

  it('không có key → no_key, không gọi fetch', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(drain()).rejects.toMatchObject({ code: 'no_key' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('PLANNER_LLM_STUB=true → stub, không gọi fetch', async () => {
    process.env.PLANNER_LLM_STUB = 'true';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await drain();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ANTHROPIC_BASE_URL dùng ngoài prod', async () => {
    process.env.ANTHROPIC_BASE_URL = 'http://localhost:9999/';
    const fetchMock = vi.fn().mockResolvedValue(streamRes([sse({ type: 'message_stop' })]));
    vi.stubGlobal('fetch', fetchMock);

    await drain();
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:9999/v1/messages');
  });
});

describe('toAnthropicMessages', () => {
  it('bỏ model turn đầu + gộp turn cùng role liền nhau', () => {
    const out = toAnthropicMessages([
      { role: 'model', text: 'Xin chào' },
      { role: 'user', text: 'a' },
      { role: 'user', text: 'b' },
      { role: 'model', text: 'c' },
    ]);
    expect(out).toEqual([
      { role: 'user', content: 'a\n\nb' },
      { role: 'assistant', content: 'c' },
    ]);
  });

  it('bỏ turn rỗng/chỉ-khoảng-trắng (Anthropic 400) rồi mới áp luật user-đầu + xen kẽ', () => {
    const out = toAnthropicMessages([
      { role: 'user', text: '  ' },
      { role: 'model', text: 'Xin chào' },
      { role: 'user', text: 'a' },
      { role: 'model', text: '' },
      { role: 'user', text: 'b' },
    ]);
    expect(out).toEqual([{ role: 'user', content: 'a\n\nb' }]);
  });
});
