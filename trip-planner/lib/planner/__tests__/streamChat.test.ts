// streamChat retry — gemini-flash-latest trả 503 UNAVAILABLE ("high demand") ngắt quãng; 1 phát 503
// mà không retry = cả lượt hỏng → UI "Trợ lý đang bận". streamChat retry BOUNDED 5xx tạm thời TRƯỚC
// khi stream token đầu; 4xx (key/config) + 429 (quota) fail-fast ngay.
// Backoff dùng fake timers (advanceTimersByTimeAsync) → không chờ wall-clock thật.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { streamChat, ParseIntentError } from '../parseIntent';
import type { ChatTurn } from '../parseIntent';

const HISTORY: ChatTurn[] = [{ role: 'user', text: 'Mình muốn đi Đà Lạt 3 ngày' }];

// SSE body Gemini tối thiểu: 1 functionCall `trich` (không prose → không đụng signModelTurn).
const OK_SSE =
  'data: {"candidates":[{"content":{"parts":[{"functionCall":{"name":"trich","args":{"dia_diem":"da-lat","days":3}}}]}}]}\n\n';

const ok = () => new Response(OK_SSE, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
const status = (code: number) => new Response(`{"error":{"code":${code}}}`, { status: code });

async function drain(history: ChatTurn[]) {
  const events = [];
  for await (const ev of streamChat(history)) events.push(ev);
  return events;
}

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('streamChat — retry 5xx/upstream', () => {
  it('503 → 503 → 200: retry rồi stream thành công (2 retry)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(status(503))
      .mockResolvedValueOnce(status(503))
      .mockResolvedValueOnce(ok());
    vi.stubGlobal('fetch', fetchMock);

    const p = drain(HISTORY);
    await vi.advanceTimersByTimeAsync(400); // backoff lần 1
    await vi.advanceTimersByTimeAsync(800); // backoff lần 2
    const events = await p;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const slots = events.find((e) => e.kind === 'slots');
    expect(slots).toBeDefined();
    expect((slots as { partial: { dia_diem?: string } }).partial.dia_diem).toBe('da-lat');
  });

  it('503 × 3: hết retry → throw ParseIntentError(upstream)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(status(503));
    vi.stubGlobal('fetch', fetchMock);

    const captured = drain(HISTORY).catch((e) => e);
    await vi.advanceTimersByTimeAsync(1200); // 400 + 800, cả 2 backoff
    const err = await captured;

    expect(err).toMatchObject({ name: 'ParseIntentError', code: 'upstream' });
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 initial + 2 retry, không hơn
  });

  it('401: lỗi key/config → throw NGAY, KHÔNG retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue(status(401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(drain(HISTORY)).rejects.toBeInstanceOf(ParseIntentError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('429: rate-limit/quota → throw NGAY, KHÔNG retry (để circuit-breaker lo)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(status(429));
    vi.stubGlobal('fetch', fetchMock);

    await expect(drain(HISTORY)).rejects.toMatchObject({ name: 'ParseIntentError', code: 'upstream' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('lỗi mạng ngắt quãng: fetch reject rồi 200 → retry thành công', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce(ok());
    vi.stubGlobal('fetch', fetchMock);

    const p = drain(HISTORY);
    await vi.advanceTimersByTimeAsync(400); // backoff sau lỗi mạng
    const events = await p;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(events.some((e) => e.kind === 'slots')).toBe(true);
  });

  it('request body gắn tools.functionDeclarations (trich + goi_y_vibe) — nếu thiếu, slots không trích', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal('fetch', fetchMock);

    await drain(HISTORY);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    const decls = body.tools?.[0]?.functionDeclarations ?? [];
    expect(decls.map((d: { name: string }) => d.name)).toEqual(['trich', 'goi_y_vibe']);
  });

  it('thiếu GEMINI_API_KEY → throw no_key, KHÔNG gọi fetch', async () => {
    delete process.env.GEMINI_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(drain(HISTORY)).rejects.toMatchObject({ code: 'no_key' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
