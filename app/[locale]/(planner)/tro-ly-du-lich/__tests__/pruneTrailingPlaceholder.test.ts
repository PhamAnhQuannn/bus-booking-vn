import { describe, it, expect } from 'vitest';
import { pruneTrailingPlaceholder, isPlaceholder } from '../page';

// Msg không export — fixture tối thiểu, cast qua unknown (helper chỉ đọc role/text/error/dto/suggestions/options).
const M = (m: Record<string, unknown>) => m as unknown as Parameters<typeof isPlaceholder>[0];
const bot = (x: Record<string, unknown> = {}) => M({ role: 'bot', text: '', ...x });
const user = (text = 'hi') => M({ role: 'user', text });

describe('pruneTrailingPlaceholder / isPlaceholder (#UI orphan fix)', () => {
  it('bỏ placeholder bot rỗng ở đuôi (bug "Trợ lý đang trả lời…" kẹt)', () => {
    const msgs = [user(), bot()];
    expect(pruneTrailingPlaceholder(msgs)).toHaveLength(1);
    expect(pruneTrailingPlaceholder(msgs)[0]).toEqual(user());
  });
  it('bỏ placeholder planning rỗng (edit mid-build → bubble cũ morph, không nhân đôi)', () => {
    expect(isPlaceholder(bot({ planning: true }))).toBe(true);
    expect(pruneTrailingPlaceholder([user(), bot({ planning: true })])).toHaveLength(1);
  });
  it('GIỮ bot có text (không xoá tin thật)', () => {
    const msgs = [user(), bot({ text: 'Xin chào' })];
    expect(pruneTrailingPlaceholder(msgs)).toHaveLength(2);
    expect(isPlaceholder(bot({ text: 'x' }))).toBe(false);
  });
  it('GIỮ bot có suggestions (text rỗng nhưng mang gợi ý)', () => {
    expect(isPlaceholder(bot({ suggestions: [{}] }))).toBe(false);
    expect(pruneTrailingPlaceholder([user(), bot({ suggestions: [{}] })])).toHaveLength(2);
  });
  it('GIỮ bubble câu hỏi (options + text)', () => {
    expect(isPlaceholder(bot({ text: 'Đi mấy ngày?', options: {} }))).toBe(false);
    expect(pruneTrailingPlaceholder([user(), bot({ text: 'Đi mấy ngày?', options: {} })])).toHaveLength(2);
  });
  it('GIỮ khi đuôi là user (không phải bot)', () => {
    expect(pruneTrailingPlaceholder([bot({ text: 'a' }), user()])).toHaveLength(2);
  });
  it('mảng rỗng → rỗng (không crash)', () => {
    expect(pruneTrailingPlaceholder([])).toEqual([]);
  });
});
