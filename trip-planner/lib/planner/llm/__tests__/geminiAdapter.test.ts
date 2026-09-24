// geminiAdapter (Gemini) — SSE 1-JSON-object/dòng (KHÁC Groq accumulator theo index). Mỗi frame là 1
// object trọn: {candidates:[{content:{parts:[...]}}], usageMetadata?}; part = {text} HOẶC
// {functionCall:{name,args}}. Test synthetic fetch-mock (NO Postgres, NO network) phủ: prose→sig,
// trich→slots(dropped=countOutOfEnum), goi_y_vibe→suggest (gate slug+vibe), retry 5xx / fail-fast
// 4xx+429, idle-timeout abort, STUB gate, resolveGeminiModel, prod-lockout base-url, no_key,
// provider trước token, malformed frame skip, body shape (thinkingBudget=0 + role verbatim).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GEMINI_HOST_DEFAULT, resolveGeminiModel, streamChat } from '../geminiAdapter';
import { countOutOfEnum } from '../prompt';
import { signModelTurn } from '../../chatSig';
import { ParseIntentError, type ChatTurn, type StreamEvent } from '../types';

const HISTORY: ChatTurn[] = [{ role: 'user', text: 'Mình muốn đi Đà Lạt 3 ngày' }];

const enc = new TextEncoder();

// Response với body ReadableStream phát TỪNG chunk (string→utf8, hoặc Uint8Array raw). Mô phỏng ranh giới mạng.
function streamRes(chunks: (string | Uint8Array)[], status = 200) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(typeof c === 'string' ? enc.encode(c) : c);
      controller.close();
    },
  });
  return new Response(body, { status, headers: { 'Content-Type': 'text/event-stream' } });
}
// Non-2xx (retry/fail-fast). res.ok=false → adapter cancel body + throw/retry.
const statusRes = (code: number) => new Response(`{"error":{"code":${code}}}`, { status: code });

// 1 frame Gemini SSE: 1 object trọn/dòng. parts = [{text}|{functionCall}]. extra vd usageMetadata.
const gframe = (parts: unknown[], extra: Record<string, unknown> = {}) =>
  `data: ${JSON.stringify({ candidates: [{ content: { parts } }], ...extra })}\n`;

async function drain(history: ChatTurn[] = HISTORY, locale: 'vi' | 'en' = 'vi'): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const ev of streamChat(history, locale)) events.push(ev);
  return events;
}

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  vi.useFakeTimers();
});

afterEach(() => {
  delete process.env.GEMINI_MODEL_OVERRIDE;
  delete process.env.GEMINI_BASE_URL;
  delete process.env.PLANNER_LLM_STUB;
  delete process.env.PLANNER_CHAT_SECRET;
  delete process.env.VERCEL_ENV;
  delete process.env.GEMINI_API_KEY;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('geminiAdapter — stream events', () => {
  it('(1) prose stream: text parts → token/token rồi sig (ký accProse cộng dồn) ở cuối', async () => {
    process.env.PLANNER_CHAT_SECRET = 'test-secret'; // để signModelTurn sinh HMAC thật, nhạy byte prose
    const chunks = [gframe([{ text: 'Đà Lạt ' }]), gframe([{ text: 'đẹp lắm.' }]), 'data: [DONE]\n'];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamRes(chunks)));

    const events = await drain();
    const tokens = events.filter((e) => e.kind === 'token').map((e) => (e as { text: string }).text);
    expect(tokens).toEqual(['Đà Lạt ', 'đẹp lắm.']);
    const sig = events.find((e) => e.kind === 'sig') as { tag: string } | undefined;
    expect(sig?.tag).toBe(signModelTurn('Đà Lạt đẹp lắm.')); // ký prose ĐÃ cộng dồn
    // sig sau token cuối
    expect(events.map((e) => e.kind).lastIndexOf('token')).toBeLessThan(events.map((e) => e.kind).indexOf('sig'));
  });

  it('(2) functionCall trich → slots; dropped === countOutOfEnum RAW (đếm enum bịa trước allowlist)', async () => {
    // interests có 1 mã bịa "xyz-bia" + 1 hợp lệ "lang-man" → countOutOfEnum=1; partialFromArgs drop mã bịa
    const args = { dia_diem: 'da-lat', days: 3, interests: ['xyz-bia', 'lang-man'] };
    const chunks = [gframe([{ functionCall: { name: 'trich', args } }])];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamRes(chunks)));

    const events = await drain();
    const slots = events.find((e) => e.kind === 'slots') as
      | { partial: { dia_diem?: string; days?: number; interests?: string[] }; dropped?: number }
      | undefined;
    expect(slots?.partial.dia_diem).toBe('da-lat');
    expect(slots?.partial.days).toBe(3);
    expect(slots?.partial.interests).toEqual(['lang-man']); // mã bịa bị allowlist loại
    expect(slots?.dropped).toBe(countOutOfEnum('trich', args)); // gọi hàm THẬT, không hardcode số
    expect(slots?.dropped).toBe(1);
  });

  it('(3a) functionCall goi_y_vibe hợp lệ (slug + vibe pass) → suggest', async () => {
    const chunks = [gframe([{ functionCall: { name: 'goi_y_vibe', args: { dia_diem: 'da-lat', vibe: 'lang-man' } } }])];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamRes(chunks)));

    const events = await drain();
    const suggest = events.find((e) => e.kind === 'suggest');
    expect(suggest).toEqual({ kind: 'suggest', dia_diem: 'da-lat', vibe: 'lang-man' });
  });

  it('(3b) goi_y_vibe city ngoài allowlist → KHÔNG suggest; (3c) vibe bịa → KHÔNG suggest', async () => {
    const badCity = [gframe([{ functionCall: { name: 'goi_y_vibe', args: { dia_diem: 'atlantis', vibe: 'lang-man' } } }])];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamRes(badCity)));
    expect((await drain()).some((e) => e.kind === 'suggest')).toBe(false);

    vi.unstubAllGlobals();
    const badVibe = [gframe([{ functionCall: { name: 'goi_y_vibe', args: { dia_diem: 'da-lat', vibe: 'bia-dat' } } }])];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamRes(badVibe)));
    expect((await drain()).some((e) => e.kind === 'suggest')).toBe(false);
  });

  it('(10) provider={id:gemini,model} phát TRƯỚC token đầu', async () => {
    const chunks = [gframe([{ text: 'chào bạn' }])];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamRes(chunks)));

    const events = await drain();
    expect(events[0]).toEqual({ kind: 'provider', id: 'gemini', model: resolveGeminiModel() });
    expect(events.findIndex((e) => e.kind === 'provider')).toBeLessThan(events.findIndex((e) => e.kind === 'token'));
  });

  it('(11) frame JSON dở giữa stream → skip im lặng, stream vẫn trích frame hợp lệ', async () => {
    const chunks = [
      'data: {"candidates":[{"content":{"parts":[{"text":"x"}\n', // JSON không đóng → parse fail → skip
      gframe([{ functionCall: { name: 'trich', args: { dia_diem: 'da-lat', days: 2 } } }]),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamRes(chunks)));

    const events = await drain();
    expect(events.some((e) => e.kind === 'slots')).toBe(true); // frame hợp lệ vẫn qua
  });

  it('(usage) frame cuối mang usageMetadata → usage event (token thật)', async () => {
    const chunks = [
      gframe([{ functionCall: { name: 'trich', args: { dia_diem: 'da-lat', days: 3 } } }]),
      gframe([], { usageMetadata: { promptTokenCount: 812, candidatesTokenCount: 24, totalTokenCount: 836, thoughtsTokenCount: 0 } }),
      'data: [DONE]\n',
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamRes(chunks)));

    const events = await drain();
    const usage = events.find((e) => e.kind === 'usage');
    expect(usage).toEqual({ kind: 'usage', inputTokens: 812, outputTokens: 24, totalTokens: 836, thoughtsTokens: 0 });
  });
});

describe('geminiAdapter — retry / fail-fast', () => {
  const okFrame = () => streamRes([gframe([{ functionCall: { name: 'trich', args: { dia_diem: 'da-lat', days: 3 } } }])]);

  it('(4a) 503 → 503 → 200: retry backoff tuyến tính 400ms→800ms rồi thành công', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(statusRes(503))
      .mockResolvedValueOnce(statusRes(503))
      .mockResolvedValueOnce(okFrame());
    vi.stubGlobal('fetch', fetchMock);

    const p = drain();
    await vi.advanceTimersByTimeAsync(400); // backoff attempt1
    await vi.advanceTimersByTimeAsync(800); // backoff attempt2
    const events = await p;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(events.some((e) => e.kind === 'slots')).toBe(true);
  });

  it('(4b) 503 × 3: hết attempt → throw ParseIntentError(upstream)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(statusRes(503));
    vi.stubGlobal('fetch', fetchMock);

    const captured = drain().catch((e) => e);
    await vi.advanceTimersByTimeAsync(1200); // 400 + 800
    const err = await captured;

    expect(err).toMatchObject({ name: 'ParseIntentError', code: 'upstream' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('(4c) 429: rate-limit → throw NGAY, KHÔNG retry (fetch 1 lần)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(statusRes(429));
    vi.stubGlobal('fetch', fetchMock);

    await expect(drain()).rejects.toMatchObject({ code: 'upstream' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('(4d) 401 / 400: lỗi key/config → fail-fast, KHÔNG retry', async () => {
    for (const code of [401, 400]) {
      vi.unstubAllGlobals();
      const fetchMock = vi.fn().mockResolvedValue(statusRes(code));
      vi.stubGlobal('fetch', fetchMock);
      await expect(drain()).rejects.toBeInstanceOf(ParseIntentError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it('(5) idle-timeout: stream im lặng qua STREAM_TIMEOUT_MS → abort → throw "Gemini timeout"', async () => {
    // Response body treo mãi; wire abort-signal của fetch để error stream khi idle-timer bắn.
    const hangingRes = (signal: AbortSignal) =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            const abort = () => controller.error(new DOMException('Aborted', 'AbortError'));
            if (signal.aborted) return abort();
            signal.addEventListener('abort', abort, { once: true });
          },
        }),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      );
    const fetchMock = vi.fn((_url: unknown, init: { signal: AbortSignal }) => Promise.resolve(hangingRes(init.signal)));
    vi.stubGlobal('fetch', fetchMock);

    const captured = drain().catch((e) => e);
    await vi.advanceTimersByTimeAsync(30_000); // STREAM_TIMEOUT_MS
    const err = await captured;

    expect(err).toBeInstanceOf(ParseIntentError);
    expect(err).toMatchObject({ code: 'upstream' });
    expect(err.message).toBe('Gemini timeout');
  });
});

describe('geminiAdapter — gates / config', () => {
  it('(6) PLANNER_LLM_STUB=true → phục vụ stub, KHÔNG gọi fetch', async () => {
    process.env.PLANNER_LLM_STUB = 'true'; // isRealProduction()=false ở vitest → stub cho qua
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const events = await drain();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(events.some((e) => e.kind === 'slots')).toBe(true); // stub mặc định phát slots da-lat
  });

  it('(9) thiếu GEMINI_API_KEY → throw no_key, KHÔNG gọi fetch', async () => {
    delete process.env.GEMINI_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(drain()).rejects.toMatchObject({ code: 'no_key' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('(7) resolveGeminiModel: override hợp lệ pass-through; xấu (latest/space/`/`) → default + warn', async () => {
    delete process.env.GEMINI_MODEL_OVERRIDE;
    const def = resolveGeminiModel(); // default khi không override

    process.env.GEMINI_MODEL_OVERRIDE = 'gemini-3.5-flash-lite'; // DATED hợp lệ
    expect(resolveGeminiModel()).toBe('gemini-3.5-flash-lite');

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const bad of ['gemini-flash-latest', 'bad model', 'foo/bar']) {
      process.env.GEMINI_MODEL_OVERRIDE = bad;
      expect(resolveGeminiModel()).toBe(def); // fallback default
    }
    expect(warn).toHaveBeenCalledTimes(3);
  });

  it('(8) prod-lockout: isRealProduction=true → GEMINI_BASE_URL override BỊ BỎ QUA (dùng host default)', async () => {
    // Positive control: ngoài prod, override CÓ hiệu lực.
    process.env.GEMINI_BASE_URL = 'http://mock.local';
    const f1 = vi.fn().mockResolvedValue(streamRes([gframe([{ text: 'x' }])]));
    vi.stubGlobal('fetch', f1);
    await drain();
    expect(String(f1.mock.calls[0][0])).toContain('http://mock.local/v1beta/');

    // Prod thật (VERCEL_ENV=production → isRealProduction true): override bỏ qua, host default.
    vi.unstubAllGlobals();
    process.env.VERCEL_ENV = 'production';
    process.env.GEMINI_BASE_URL = 'http://evil.exfil';
    const f2 = vi.fn().mockResolvedValue(streamRes([gframe([{ text: 'x' }])]));
    vi.stubGlobal('fetch', f2);
    await drain();
    const url = String(f2.mock.calls[0][0]);
    expect(url).toContain(GEMINI_HOST_DEFAULT); // host thật
    expect(url).not.toContain('evil.exfil'); // key-exfil bị chặn
  });

  it('(12) body shape: thinkingBudget=0, role VERBATIM (user/model, KHÔNG remap), 2 tools, system_instruction', async () => {
    const fetchMock = vi.fn().mockResolvedValue(streamRes([gframe([{ text: 'ok' }])]));
    vi.stubGlobal('fetch', fetchMock);

    await drain([
      { role: 'user', text: 'Đi Sa Pa nhé' },
      { role: 'model', text: 'Bạn đi mấy ngày?' },
    ]);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.generationConfig.thinkingConfig.thinkingBudget).toBe(0); // cost-critical
    expect(body.generationConfig.maxOutputTokens).toBe(2048);
    // roles giữ nguyên user/model — KHÔNG đổi 'model'→'assistant' (ngược Groq)
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model']);
    expect(body.contents[0].parts[0].text).toBe('Đi Sa Pa nhé');
    expect(body.tools[0].functionDeclarations.map((d: { name: string }) => d.name)).toEqual(['trich', 'goi_y_vibe']);
    expect(typeof body.system_instruction.parts[0].text).toBe('string');
    expect(body.system_instruction.parts[0].text.length).toBeGreaterThan(0);
  });
});
