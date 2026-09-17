// chatErrorCopy — map reason (429/503 body) → key i18n + cờ Thử lại. Bảo vệ: hết-quota-hôm-nay KHÔNG
// gợi Thử lại (retry vô ích), tạm-thời thì CHO. Key phải khớp messages/*/planner.json (assistant.*).
import { describe, expect, it } from 'vitest';
import { chatErrorCopy } from '../chatErrorCopy';

describe('chatErrorCopy', () => {
  it('hết quota hôm nay (global-budget / per-ip-daily) → quotaExhausted, KHÔNG Thử lại', () => {
    for (const r of ['global-budget', 'per-ip-daily']) {
      expect(chatErrorCopy(r)).toEqual({ key: 'assistant.quotaExhausted', retry: false });
    }
  });

  it('kill-switch tắt (disabled) → paused, KHÔNG Thử lại', () => {
    expect(chatErrorCopy('disabled')).toEqual({ key: 'assistant.paused', retry: false });
  });

  it('breaker mở → paused, CHO Thử lại (cooldown ngắn)', () => {
    expect(chatErrorCopy('breaker')).toEqual({ key: 'assistant.paused', retry: true });
  });

  it('gửi quá nhanh (session / anon-ip) → rateLimited, CHO Thử lại', () => {
    for (const r of ['session', 'anon-ip']) {
      expect(chatErrorCopy(r)).toEqual({ key: 'assistant.rateLimited', retry: true });
    }
  });

  it('reason thiếu / lạ / null → busy, CHO Thử lại (fallback an toàn)', () => {
    for (const r of [undefined, null, '', 'weird-proxy-reason']) {
      expect(chatErrorCopy(r)).toEqual({ key: 'assistant.busy', retry: true });
    }
  });
});
