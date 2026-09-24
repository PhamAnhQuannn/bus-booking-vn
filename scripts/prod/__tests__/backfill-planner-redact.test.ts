import { describe, it, expect } from 'vitest';
import { planRedactions } from '../backfill-planner-redact';
import { redactPii } from '../../../trip-planner/lib/planner/llm/redact';

describe('planRedactions', () => {
  it('plans a change only for rows whose PII text actually changes', () => {
    const rows = [
      { id: 'a', text: 'đi Sa Pa, gọi mình 0912345678' }, // phone → change
      { id: 'b', text: 'đi Đà Lạt 3 ngày 2 đêm' }, // clean → no change
      { id: 'c', text: 'mail quan.pham@gmail.com nhé' }, // email → change
    ];
    const plan = planRedactions(rows);
    expect(plan.map((p) => p.id)).toEqual(['a', 'c']);
    expect(plan[0].newText).toBe('đi Sa Pa, gọi mình [sđt]');
    expect(plan[1].newText).toBe('mail [email] nhé');
    // Each plan entry keeps the exact old text for the race-safe guarded UPDATE.
    expect(plan[0].oldText).toBe('đi Sa Pa, gọi mình 0912345678');
  });

  it('is a no-op on already-redacted (clean) rows', () => {
    expect(planRedactions([{ id: 'x', text: 'đi Sa Pa, gọi mình [sđt]' }])).toEqual([]);
  });

  it('redactPii is a fixed point (a re-run over redacted text changes nothing)', () => {
    for (const t of ['gọi 0912345678', 'mail a@b.dev', 'tên tôi là Quân', 'đi Bến Tre 2 đêm']) {
      const once = redactPii(t);
      expect(redactPii(once)).toBe(once);
    }
  });
});
