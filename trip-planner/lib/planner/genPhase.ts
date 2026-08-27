/**
 * genPhase — pha SINH KẾ HOẠCH tường minh (từ lúc gửi yêu cầu → hiện kế hoạch).
 * Bổ sung cho layoutPhase (idle|collecting|planning) — layoutPhase lo BỐ CỤC,
 * genPhase lo NỘI DUNG chuỗi chờ (skeleton / progress / slot card / lỗi).
 *
 *   welcome      : chưa có tin (màn chào).
 *   acknowledged : vừa gửi, chưa bóc được slot nào (bong bóng user đã hiện).
 *   understood   : đã biết ≥1 slot (điểm đến/ngày/…) → hiện card tóm tắt slot.
 *   building     : engine ĐANG dựng itinerary (isGenerating) → skeleton + progress + bus.
 *   reveal       : có dto → hiện kế hoạch thật.
 *   error        : lượt cuối lỗi/timeout.
 *
 * Pure: KHÔNG lưu; suy từ trạng thái hội thoại mỗi render. Mọi sticky/latch sống ở component.
 */
export type GenPhase = 'welcome' | 'acknowledged' | 'understood' | 'building' | 'reveal' | 'error';

export function deriveGenPhase(a: {
  messageCount: number;
  building: boolean; // ĐANG hướng tới 1 kế hoạch: engine dựng (isGenerating) HOẶC đang chờ Gemini và đã biết điểm đến
  hasDto: boolean;
  hasError: boolean; // lượt cuối có bong bóng lỗi
  anySlot: boolean; // đã bóc được ít nhất 1 ràng buộc (kể cả điểm đến đang stream)
}): GenPhase {
  if (a.messageCount === 0) return 'welcome';
  if (a.building) return 'building'; // skeleton + progress phủ CẢ pha chờ Gemini (khi đã biết điểm đến), không chỉ lúc build tất định
  if (a.hasError) return 'error';
  if (a.hasDto) return 'reveal';
  if (a.anySlot) return 'understood';
  return 'acknowledged';
}
