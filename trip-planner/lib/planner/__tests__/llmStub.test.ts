// PR-5: PLANNER_LLM_STUB (SSE canned, không upstream) + GEMINI_BASE_URL (mock server, IGNORE ở prod = exfil
// guard). Khoá: stub bật → KHÔNG fetch; sentinel đúng hành vi; stub ở prod → THROW; base-url bỏ qua khi prod.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { streamChat, ParseIntentError } from '../parseIntent';
import type { ChatTurn } from '../parseIntent';
import { GEMINI_HOST_DEFAULT } from '../llm/geminiAdapter';
import { stubStream } from '../llm/llmStub';

let realProd = false;
vi.mock('@/lib/core/config/deployTier', () => ({ isRealProduction: () => realProd }));

const H = (text: string): ChatTurn[] => [{ role: 'user', text }];
async function drain(history: ChatTurn[]) {
  const events = [];
  for await (const ev of streamChat(history)) events.push(ev);
  return events;
}
const ok = () =>
  new Response('data: {"candidates":[{"content":{"parts":[{"functionCall":{"name":"trich","args":{"dia_diem":"da-lat"}}}]}}]}\n\n', {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });

beforeEach(() => {
  realProd = false;
  process.env.GEMINI_API_KEY = 'test-key';
  delete process.env.PLANNER_LLM_STUB;
  delete process.env.GEMINI_BASE_URL;
});
afterEach(() => {
  delete process.env.PLANNER_LLM_STUB;
  delete process.env.GEMINI_BASE_URL;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PLANNER_LLM_STUB — SSE canned, KHÔNG upstream', () => {
  it('bật stub → yield slots da-lat, KHÔNG gọi fetch', async () => {
    process.env.PLANNER_LLM_STUB = 'true';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const events = await drain(H('Đà Lạt 3 ngày'));
    expect(fetchMock).not.toHaveBeenCalled();
    const slots = events.find((e) => e.kind === 'slots') as { partial: { dia_diem?: string } } | undefined;
    expect(slots?.partial.dia_diem).toBe('da-lat');
    expect(events.some((e) => e.kind === 'sig')).toBe(true);
  });

  it('__noop__ → chỉ prose, KHÔNG slots/suggest', async () => {
    process.env.PLANNER_LLM_STUB = 'true';
    vi.stubGlobal('fetch', vi.fn());
    const events = await drain(H('xin chào __noop__'));
    expect(events.some((e) => e.kind === 'slots')).toBe(false);
    expect(events.some((e) => e.kind === 'suggest')).toBe(false);
    expect(events.some((e) => e.kind === 'token')).toBe(true);
  });

  it('__vibe__ → suggest', async () => {
    process.env.PLANNER_LLM_STUB = 'true';
    vi.stubGlobal('fetch', vi.fn());
    const events = await drain(H('chỗ nào lãng mạn __vibe__'));
    expect(events.some((e) => e.kind === 'suggest')).toBe(true);
  });

  it('__error__ → ném ParseIntentError', async () => {
    process.env.PLANNER_LLM_STUB = 'true';
    vi.stubGlobal('fetch', vi.fn());
    await expect(drain(H('__error__'))).rejects.toBeInstanceOf(ParseIntentError);
  });

  it('PROD-GUARD: stub bật + isRealProduction → THROW (không phát canned)', async () => {
    realProd = true;
    process.env.PLANNER_LLM_STUB = 'true';
    vi.stubGlobal('fetch', vi.fn());
    await expect(drain(H('Đà Lạt 3 ngày'))).rejects.toMatchObject({ name: 'ParseIntentError' });
  });

  it('PROD-GUARD defense-in-depth: stubStream gọi trực tiếp + isRealProduction → THROW', async () => {
    realProd = true;
    const events: unknown[] = [];
    const run = async () => {
      for await (const ev of stubStream(H('Đà Lạt 3 ngày'))) events.push(ev);
    };
    await expect(run()).rejects.toBeInstanceOf(ParseIntentError);
    expect(events).toHaveLength(0);
  });
});

describe('GEMINI_BASE_URL — override dev, IGNORE prod (exfil guard)', () => {
  it('non-prod: fetch dùng base-url override', async () => {
    process.env.GEMINI_BASE_URL = 'http://localhost:8899';
    const fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal('fetch', fetchMock);
    await drain(H('Đà Lạt'));
    expect(String(fetchMock.mock.calls[0][0])).toContain('http://localhost:8899/v1beta/models/');
  });

  it('prod: BỎ QUA base-url → host thật (không exfil key)', async () => {
    realProd = true;
    process.env.GEMINI_BASE_URL = 'http://evil.example/steal';
    const fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal('fetch', fetchMock);
    await drain(H('Đà Lạt'));
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain(`${GEMINI_HOST_DEFAULT}/`);
    expect(url).not.toContain('evil.example');
  });
});
