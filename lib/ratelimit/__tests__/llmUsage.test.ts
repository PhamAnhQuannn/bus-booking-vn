// PR-4: recordLlmUsage(provider,…) per-provider. Khoá: giá Gemini $1.5/$7.5 (drift = dashboard sai),
// Groq = $0 (nếu thiếu nhánh → bịa spend), counter memory tách provider, alias recordGeminiUsage.
import { describe, it, expect, vi, beforeEach } from 'vitest';

let backend: 'memory' | 'ioredis' = 'memory';
const fake = {
  incrby: vi.fn(async () => 1),
  expire: vi.fn(async () => 1),
};

vi.mock('@/lib/core/http/ratelimitBackend', () => ({ resolveRatelimitBackend: () => backend }));
vi.mock('../rawRedisClient', () => ({ rawIoRedis: async () => fake, rawUpstash: async () => fake }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

import { recordLlmUsage } from '../llmUsage';

beforeEach(() => {
  backend = 'memory';
  vi.clearAllMocks();
});

describe('recordLlmUsage — giá per-provider', () => {
  it('gemini: $1.5/1M in + $7.5/1M out', async () => {
    expect((await recordLlmUsage('gemini', 1_000_000, 0)).callUsd).toBeCloseTo(1.5);
    expect((await recordLlmUsage('gemini', 0, 1_000_000)).callUsd).toBeCloseTo(7.5);
    expect((await recordLlmUsage('gemini', 500_000, 200_000)).callUsd).toBeCloseTo(0.75 + 1.5);
  });
  it('groq: FREE = $0 (không tính giá Gemini)', async () => {
    const r = await recordLlmUsage('groq', 999_000, 999_000);
    expect(r.callUsd).toBe(0);
    expect(r.dailyUsd).toBe(0);
  });
});

describe('recordLlmUsage — counter memory tách provider', () => {
  it('gemini và groq đếm token ĐỘC LẬP (không cộng chung)', async () => {
    // _mem Map module-level tích luỹ xuyên test → so DELTA (không phải tuyệt đối) để chứng minh isolation.
    const gBase = (await recordLlmUsage('gemini', 0, 0)).dailyInputTokens;
    const qBase = (await recordLlmUsage('groq', 0, 0)).dailyInputTokens;
    await recordLlmUsage('gemini', 100, 50);
    await recordLlmUsage('groq', 700, 300);
    const g = await recordLlmUsage('gemini', 0, 0);
    const q = await recordLlmUsage('groq', 0, 0);
    expect(g.dailyInputTokens - gBase).toBe(100); // gemini +100, KHÔNG lây 700 của groq
    expect(q.dailyInputTokens - qBase).toBe(700); // groq +700, KHÔNG lây 100 của gemini
  });
});

describe('recordLlmUsage — key Redis LITERAL (chống deploy đổi tên counter)', () => {
  // Same day helper as llmUsage.vnDay() — Asia/Ho_Chi_Minh calendar day, YYYY-MM-DD.
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  it("gemini → 'planner-gemini:tok-in|tok-out|usd-micro:<day>'; groq → 'planner-groq:*' exact", async () => {
    backend = 'ioredis';
    await recordLlmUsage('gemini', 1000, 500);
    expect(fake.incrby).toHaveBeenCalledWith(`planner-gemini:tok-in:${day}`, 1000);
    expect(fake.incrby).toHaveBeenCalledWith(`planner-gemini:tok-out:${day}`, 500);
    expect(fake.incrby).toHaveBeenCalledWith(`planner-gemini:usd-micro:${day}`, expect.any(Number));

    await recordLlmUsage('groq', 700, 300);
    expect(fake.incrby).toHaveBeenCalledWith(`planner-groq:tok-in:${day}`, 700);
    expect(fake.incrby).toHaveBeenCalledWith(`planner-groq:tok-out:${day}`, 300);
    expect(fake.incrby).toHaveBeenCalledWith(`planner-groq:usd-micro:${day}`, 0);
  });
});

describe('recordGeminiUsage alias ≡ recordLlmUsage("gemini")', () => {
  it('cùng callUsd', async () => {
    const { recordGeminiUsage } = await import('../geminiUsage');
    const viaAlias = await recordGeminiUsage(1000, 500);
    const viaDirect = await recordLlmUsage('gemini', 1000, 500);
    expect(viaAlias.callUsd).toBeCloseTo(viaDirect.callUsd);
  });
});
