// System prompt không được "mồi" thuật ngữ nội bộ cho model nói lại với khách. Eval hội thoại
// (planner-conv-eval, 1219 cuộc) thấy 28% cuộc có câu "để mình trích ràng buộc…" — chép từ prompt.
import { describe, expect, it } from 'vitest';
import { systemFor } from '../llm/prompt';

describe('system prompt — không mồi thuật ngữ nội bộ', () => {
  it.each(['vi', 'en'] as const)('%s: cấm nói thuật ngữ nội bộ, không còn câu mẫu "trích ràng buộc"', (locale) => {
    const s = systemFor(locale);
    expect(s).toContain('KHÔNG nói với khách các từ kỹ thuật nội bộ');
    expect(s).not.toMatch(/để trích ràng buộc/);
  });
});
