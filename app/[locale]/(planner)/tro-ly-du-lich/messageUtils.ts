/**
 * Pure message helpers cho /tro-ly-du-lich — KHÔNG 'use client', không React/next.
 * Tách khỏi page.tsx để unit test import từ ĐÂY (không kéo module-graph client).
 * page.tsx re-import các helper này (Msg của nó gán được vào MsgLike bên dưới).
 */

// Hình dạng tối thiểu các helper này ĐỌC (role/text/error/dto/suggestions/options).
// Msg đầy đủ trong page.tsx gán được vào đây (cấu trúc con).
export type MsgLike = {
  role: 'user' | 'bot';
  text?: string;
  error?: boolean;
  dto?: unknown;
  suggestions?: unknown;
  options?: unknown;
};

// Bot CÓ nội dung thật: text | lỗi | dto | gợi ý | câu hỏi(options). Placeholder = KHÔNG có gì.
export const hasBotContent = (m: MsgLike): boolean =>
  !!m.text || !!m.error || !!m.dto || !!m.suggestions || !!m.options;

// Bong bóng bot "chỗ trống" (placeholder) đang chờ nội dung: bot chưa có nội dung thật.
// Đây là bubble mà send()/buildFromSlots() push rỗng rồi patch sau. Trạng thái status (đang phân tích/
// dựng lịch…) hiện Ở ĐÂY và bị THAY khi nội dung thật về.
export const isPlaceholder = (m: MsgLike): boolean => m.role === 'bot' && !hasBotContent(m);

// FIX orphan (#UI): trước khi push message mới, BỎ placeholder đuôi CHƯA giải quyết (send() push bubble
// rỗng, rồi advance()→pushAsk/buildFromSlots push bubble MỚI → placeholder cũ kẹt vĩnh viễn trong hội
// thoại = "Trợ lý đang trả lời…" treo). Prune+push trong 1 setState (key=idx) → React tái dùng DOM node
// → bubble MORPH tại chỗ (không nháy), lifecycle abort-guarded (không tạo orphan mới).
export function pruneTrailingPlaceholder<T extends MsgLike>(msgs: T[]): T[] {
  const last = msgs[msgs.length - 1];
  return last && isPlaceholder(last) ? msgs.slice(0, -1) : msgs;
}
