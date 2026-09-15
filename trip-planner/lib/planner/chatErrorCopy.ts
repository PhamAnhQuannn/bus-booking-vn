// Map `reason` trong body lỗi HTTP của /api/planner/chat (429/503) → copy + cờ Thử lại. Client-safe,
// pure (không import server). Route phát `reason`; client (page.tsx) đọc khi !res.ok để hiện thông báo
// ĐÚNG tình huống thay vì 1 câu "đang bận" chung. Trả KEY i18n (scope 'planner') để client gọi t(key).
//
// Phân loại theo hành động khách nên làm:
//  - Hết lượt HÔM NAY (global-budget / per-ip-daily / tắt kill-switch) → KHÔNG Thử lại (retry vô ích
//    tới khi quota reset / bật lại); mời dùng nút "Tự chọn lịch trình" (fallback luôn bật).
//  - Tạm thời (breaker cooldown / gửi quá nhanh) → CHO Thử lại.

export type ChatErrorReason =
  | 'disabled' // kill-switch PLANNER_CHAT_ENABLED=false
  | 'breaker' // circuit-breaker mở (upstream 429/5xx storm)
  | 'global-budget' // ngân sách Gemini/ngày toàn cục cạn
  | 'per-ip-daily' // 1 IP vượt trần ngày
  | 'session' // throttle theo session
  | 'anon-ip'; // throttle theo IP (khách ẩn danh)

export interface ChatErrorCopy {
  key: string; // key i18n dưới scope 'planner' (vd 'assistant.quotaExhausted')
  retry: boolean; // có gợi ý nút "Thử lại" không
}

export function chatErrorCopy(reason: string | null | undefined): ChatErrorCopy {
  switch (reason) {
    case 'global-budget':
    case 'per-ip-daily':
      return { key: 'assistant.quotaExhausted', retry: false };
    case 'disabled':
      return { key: 'assistant.paused', retry: false };
    case 'breaker':
      return { key: 'assistant.paused', retry: true };
    case 'session':
    case 'anon-ip':
      return { key: 'assistant.rateLimited', retry: true };
    default:
      // reason lạ/thiếu (proxy edge-limit, 5xx trần, body không JSON) → copy "bận" chung + cho Thử lại.
      return { key: 'assistant.busy', retry: true };
  }
}
