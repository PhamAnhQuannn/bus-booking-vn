// probe (PR-10) — drift probe qua endpoint metadata models (0 token). Mock fetch: ok · model_404 (model
// pin vắng danh mục) · auth (401) · down (5xx/network) · skipped_no_key (chưa cấu hình key = SHIP DARK).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { probePlannerProviders } from '../llm/probe';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  process.env.GROQ_API_KEY = 'gk-test';
  process.env.GEMINI_API_KEY = 'gm-test';
  delete process.env.PLANNER_GROQ_MODEL;
  delete process.env.GEMINI_MODEL_OVERRIDE;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.GROQ_API_KEY;
});

describe('probe — Groq (models list)', () => {
  it('model pin CÓ trong /v1/models → ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ data: [{ id: 'openai/gpt-oss-20b' }, { id: 'other' }] })));
    const [r] = await probePlannerProviders(['groq']);
    expect(r).toMatchObject({ provider: 'groq', model: 'openai/gpt-oss-20b', status: 'ok' });
  });

  it('model pin VẮNG danh mục → model_404 (drift)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ data: [{ id: 'some-other-model' }] })));
    const [r] = await probePlannerProviders(['groq']);
    expect(r.status).toBe('model_404');
  });

  it('401 → auth', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({}, 401)));
    const [r] = await probePlannerProviders(['groq']);
    expect(r).toMatchObject({ status: 'auth', httpStatus: 401 });
  });

  it('500 → down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({}, 500)));
    const [r] = await probePlannerProviders(['groq']);
    expect(r).toMatchObject({ status: 'down', httpStatus: 500 });
  });

  it('network throw → down (fail-soft, không reject)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    const [r] = await probePlannerProviders(['groq']);
    expect(r.status).toBe('down');
  });

  it('thiếu GROQ_API_KEY (SHIP DARK) → skipped_no_key, KHÔNG fetch', async () => {
    delete process.env.GROQ_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const [r] = await probePlannerProviders(['groq']);
    expect(r.status).toBe('skipped_no_key');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('probe — Gemini (models metadata)', () => {
  it('200 → ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ name: 'models/gemini-3.5-flash' })));
    const [r] = await probePlannerProviders(['gemini']);
    expect(r).toMatchObject({ provider: 'gemini', status: 'ok' });
  });

  it('404 → model_404 (model biến mất)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: {} }, 404)));
    const [r] = await probePlannerProviders(['gemini']);
    expect(r).toMatchObject({ status: 'model_404', httpStatus: 404 });
  });

  it('key ở HEADER x-goog-api-key, KHÔNG trong URL (không rò qua log/err)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}, 200));
    vi.stubGlobal('fetch', fetchMock);
    const [r] = await probePlannerProviders(['gemini']);
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers?: Record<string, string> }];
    expect(url).not.toContain('gm-test'); // key KHÔNG trong URL
    expect(init.headers?.['x-goog-api-key']).toBe('gm-test'); // key ở header
    expect(JSON.stringify(r)).not.toContain('gm-test'); // result sạch
  });
});

describe('probe — song song', () => {
  it('probe cả hai → 2 kết quả, không throw dù 1 provider down', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(json({ data: [{ id: 'openai/gpt-oss-20b' }] })) // groq ok
      .mockRejectedValueOnce(new Error('gemini down'))); // gemini throw → down
    const results = await probePlannerProviders(['groq', 'gemini']);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.provider)).toEqual(['groq', 'gemini']);
  });
});
