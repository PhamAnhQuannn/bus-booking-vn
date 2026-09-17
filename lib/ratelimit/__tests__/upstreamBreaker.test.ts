// PR-4: createBreaker(prefix) per-provider. Khoá 2 bất biến CỐT LÕI:
//  (1) prefix isolation — mở breaker groq KHÔNG mở gemini (in-mem state RIÊNG per instance);
//  (2) key Redis LITERAL — alias Gemini PHẢI sinh 'planner-gemini:fails'/'planner-gemini:open' y hệt bản
//      cũ (nếu drift → deploy reset breaker prod đang chạy). Assert EXACT string, không stringContaining.
import { describe, it, expect, vi, beforeEach } from 'vitest';

let backend: 'memory' | 'ioredis' | 'upstash' = 'memory';
const fake = {
  incr: vi.fn(async () => 1),
  expire: vi.fn(async () => 1),
  set: vi.fn(async () => 'OK'),
  del: vi.fn(async () => 1),
  ttl: vi.fn(async () => -2),
};

vi.mock('@/lib/core/http/ratelimitBackend', () => ({ resolveRatelimitBackend: () => backend }));
vi.mock('../rawRedisClient', () => ({ rawIoRedis: async () => fake, rawUpstash: async () => fake }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

import { createBreaker } from '../upstreamBreaker';

const THRESHOLD = 5;

beforeEach(() => {
  backend = 'memory';
  Object.values(fake).forEach((f) => f.mockReset());
  fake.incr.mockResolvedValue(1);
  fake.ttl.mockResolvedValue(-2);
  fake.set.mockResolvedValue('OK');
  fake.expire.mockResolvedValue(1);
  fake.del.mockResolvedValue(1);
});

describe('createBreaker — prefix isolation (in-mem RIÊNG per instance)', () => {
  it('mở breaker groq KHÔNG mở gemini', async () => {
    const gemini = createBreaker('planner-gemini');
    const groq = createBreaker('planner-groq');
    for (let i = 0; i < THRESHOLD; i++) await groq.recordUpstreamFailure();
    expect((await groq.breakerState()).open).toBe(true);
    expect((await gemini.breakerState()).open).toBe(false); // KHÔNG bị lây
  });

  it('threshold: 4 fail chưa mở, fail thứ 5 mở; success reset counter', async () => {
    const b = createBreaker('planner-x');
    for (let i = 0; i < THRESHOLD - 1; i++) await b.recordUpstreamFailure();
    expect((await b.breakerState()).open).toBe(false);
    await b.recordUpstreamSuccess(); // reset về 0
    for (let i = 0; i < THRESHOLD - 1; i++) await b.recordUpstreamFailure();
    expect((await b.breakerState()).open).toBe(false); // mới 4 sau reset
    await b.recordUpstreamFailure();
    const s = await b.breakerState();
    expect(s.open).toBe(true);
    expect(s.retryAfter).toBeGreaterThan(0);
    expect(s.retryAfter).toBeLessThanOrEqual(60);
  });
});

describe('createBreaker — key Redis LITERAL (chống deploy reset)', () => {
  it("gemini alias sinh 'planner-gemini:fails' + ':open' exact", async () => {
    backend = 'ioredis';
    fake.incr.mockResolvedValue(THRESHOLD); // đạt ngưỡng ngay → set OPEN
    const b = createBreaker('planner-gemini');
    await b.recordUpstreamFailure();
    expect(fake.incr).toHaveBeenCalledWith('planner-gemini:fails');
    expect(fake.set).toHaveBeenCalledWith('planner-gemini:open', '1', 'EX', 60);
  });

  it("groq sinh 'planner-groq:fails' + ':open' exact", async () => {
    backend = 'ioredis';
    fake.incr.mockResolvedValue(THRESHOLD);
    const b = createBreaker('planner-groq');
    await b.recordUpstreamFailure();
    expect(fake.incr).toHaveBeenCalledWith('planner-groq:fails');
    expect(fake.set).toHaveBeenCalledWith('planner-groq:open', '1', 'EX', 60);
  });

  it('breakerState đọc OPEN_KEY đúng prefix', async () => {
    backend = 'ioredis';
    fake.ttl.mockResolvedValue(42);
    const b = createBreaker('planner-gemini');
    const s = await b.breakerState();
    expect(fake.ttl).toHaveBeenCalledWith('planner-gemini:open');
    expect(s).toEqual({ open: true, retryAfter: 42 });
  });
});

describe('createBreaker — fail-open khi Redis lỗi', () => {
  it('breakerState trả closed khi backend ném', async () => {
    backend = 'ioredis';
    fake.ttl.mockRejectedValue(new Error('redis down'));
    const b = createBreaker('planner-gemini');
    expect(await b.breakerState()).toEqual({ open: false, retryAfter: 0 });
  });
});

describe('geminiBreaker alias — trỏ instance planner-gemini', () => {
  it('breakerState/recordUpstreamFailure export cũ vẫn dùng key planner-gemini', async () => {
    backend = 'ioredis';
    fake.incr.mockResolvedValue(THRESHOLD);
    const gb = await import('../geminiBreaker');
    await gb.recordUpstreamFailure();
    expect(fake.incr).toHaveBeenCalledWith('planner-gemini:fails');
    expect(gb.BREAKER_COOLDOWN_SEC).toBe(60);
  });
});
