// Router provider (PR-9) — chọn thứ tự provider + fallback trước token đầu. SHIP DARK: default
// PLANNER_LLM_PRIMARY=gemini → order [gemini, groq]; prod KHÔNG có GROQ_API_KEY nên nhánh groq
// (nếu có) ném no_key trước khi yield → fallback gemini. Flip THẬT = user đổi env + REDEPLOY (A+C).
//
// streamChat CÔNG KHAI (barrel index.ts ghi đè export của parseIntent) → route dùng router transparent.
// parseIntent GIỮ streamChat=geminiAdapter cho streamChat.test.ts (test provider Gemini biệt lập).
//
// FALLBACK: CHỈ khi provider hiện tại ném TRƯỚC event NỘI DUNG đầu (token/slots/suggest/sig) — provider
// event 1 mình KHÔNG khoá fallback (khớp route.firstEventAt = event nội dung đầu, PR-8). Đã phát nội
// dung → ném (không fallback: tránh double-stream/lịch nửa vời). Fallback TỐI ĐA 1 lần (order 2 phần tử).

import type { ChatTurn, StreamEvent, ProviderId } from "./types";
import { streamChat as geminiStream } from "./geminiAdapter";
import { streamChat as groqStream } from "./openaiCompatAdapter";

type Adapter = (history: ChatTurn[], locale?: "vi" | "en") => AsyncGenerator<StreamEvent>;
const ADAPTERS: Record<ProviderId, Adapter> = { gemini: geminiStream, groq: groqStream };

// Order theo PLANNER_LLM_PRIMARY (đọc per-call: env Vercel baked per-deploy nhưng process dài + test được).
// Giá trị lạ → mặc định gemini primary (an toàn: gemini là provider đã chạy prod).
export function providerOrder(): ProviderId[] {
  const primary = (process.env.PLANNER_LLM_PRIMARY ?? "gemini").trim().toLowerCase();
  return primary === "groq" ? ["groq", "gemini"] : ["gemini", "groq"];
}

export async function* streamChat(history: ChatTurn[], locale: "vi" | "en" = "vi"): AsyncGenerator<StreamEvent> {
  const order = providerOrder();
  for (let i = 0; i < order.length; i++) {
    const isLast = i === order.length - 1;
    let sawContent = false; // event NỘI DUNG (không tính provider) đã phát chưa
    try {
      for await (const ev of ADAPTERS[order[i]](history, locale)) {
        if (ev.kind !== "provider") sawContent = true;
        yield ev;
      }
      return; // provider hoàn tất OK
    } catch (err) {
      // Đã phát nội dung HOẶC là provider cuối → ném (route hiện degrade copy). Ngược lại rơi xuống provider kế.
      if (sawContent || isLast) throw err;
    }
  }
}
