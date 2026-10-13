// System prompt không được "mồi" thuật ngữ nội bộ cho model nói lại với khách. Eval hội thoại
// (planner-conv-eval, 1219 cuộc) thấy 28% cuộc có câu "để mình trích ràng buộc…" — chép từ prompt.
import { describe, expect, it } from 'vitest';
import { systemFor, TRICH_DECL } from '../llm/prompt';

describe('system prompt — không mồi thuật ngữ nội bộ', () => {
  it.each(['vi', 'en'] as const)('%s: cấm nói thuật ngữ nội bộ, không còn câu mẫu "trích ràng buộc"', (locale) => {
    const s = systemFor(locale);
    expect(s).toContain('KHÔNG nói với khách các từ kỹ thuật nội bộ');
    expect(s).not.toMatch(/để trích ràng buộc/);
    // the tool-use instruction must survive the rewording
    expect(s).toContain('Mặc định gọi `trich`');
    // the contiguous phrase must not appear anywhere (the ban line lists the words separately)
    expect(s).not.toContain('trích ràng buộc');
    if (locale === 'en') expect(s).toContain('Never say internal technical terms');
  });
});

describe('tool declaration — model nhìn thấy mô tả tool', () => {
  it('mô tả trich không chứa "ràng buộc"', () => expect(TRICH_DECL.description).not.toMatch(/ràng buộc/i));
});

// planner-conv-eval: phân tích 1.219 hội thoại — trợ lý hỏi checklist nhóm chung cho mọi khách, không có lời
// khuyên riêng cho trẻ em/xe lăn, và chỉ 52% hội thoại xe lăn được ghi nhận wheelchair.
describe('system prompt — luật theo nhóm khách', () => {
  const s = systemFor('vi');
  it('xe lăn → wheelchair + avoidSteep', () => expect(s).toMatch(/xe lăn[^\n]*wheelchair = true/));
  it('trẻ nhỏ: điền children, không tự đặt pace', () => expect(s).toMatch(/Có trẻ nhỏ -> điền children/));
  it('1 câu riêng cho nhóm, không hứa dữ liệu chưa xác minh', () => expect(s).toMatch(/ĐÚNG 1 câu ngắn dành cho nhóm/));
  it('không hỏi lại / không liệt kê danh sách câu hỏi', () => expect(s).toMatch(/KHÔNG liệt kê danh sách câu hỏi/));
  it('vẫn hỏi thành phố khi gợi ý vibe mà chưa rõ thành phố (không under-ask)', () => expect(s).toMatch(/riêng khi khách HỎI GỢI Ý mà chưa rõ thành phố thì vẫn hỏi thành phố/));
  it('câu riêng cho nhóm không hứa chỗ nghỉ / lối xe lăn', () => expect(s).not.toMatch(/có chỗ nghỉ giữa buổi\)/));
  it('bản EN giữ nguyên các luật nhóm khách', () => expect(systemFor('en')).toContain(s));
});
