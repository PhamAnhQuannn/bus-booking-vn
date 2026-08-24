/**
 * layoutPhase — pha bố cục suy ra (KHÔNG lưu) từ trạng thái hội thoại sẵn có.
 *  - idle:       chưa có tin (màn chờ hero).
 *  - collecting: có tin, CHƯA có plan data và chưa generating (chat thu thập).
 *  - planning:   đang generating HOẶC đã có plan data. Sticky trong phiên qua cờ `planned`
 *                (latch bên ngoài, OR vào đây) → không bao giờ tự hạ về collecting.
 *
 * Pure: mọi logic sticky (latch/skipTransition) sống ở component, chỉ đút vào qua `planned`.
 */
export type LayoutPhase = 'idle' | 'collecting' | 'planning';

export function deriveLayoutPhase(a: {
  messageCount: number;
  hasDto: boolean;
  isGenerating: boolean;
  planned: boolean;
}): LayoutPhase {
  if (a.messageCount === 0) return 'idle'; // idle thắng mọi cờ (kể cả latch cũ)
  if (a.planned || a.hasDto || a.isGenerating) return 'planning';
  return 'collecting';
}
