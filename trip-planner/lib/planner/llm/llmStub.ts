// LLM stub (PR-5) — trả SSE canned KHÔNG gọi upstream, cho e2e/preview $0 (PLANNER_LLM_STUB=true, chỉ
// ngoài prod — env strict block FAIL boot nếu bật ở prod). Yield StreamEvent thật (giống geminiAdapter)
// để client xử y hệt. Sentinel trong tin user cuối điều khiển kịch bản test:
//   __error__ → ném ParseIntentError (test đường lỗi/degrade)
//   __slow__  → trễ ~1.5s trước khi phát (test skeleton/timeout)
//   __noop__  → chỉ prose, KHÔNG action (test giữ lịch cũ)
//   __vibe__  → suggest (mode discovery)
//   (mặc định) → slots trích sẵn (da-lat 3 ngày 2 người)

import { signModelTurn } from "../chatSig";
import { ParseIntentError, type ChatTurn, type StreamEvent } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function* stubStream(history: ChatTurn[], locale: 'vi' | 'en' = 'vi'): AsyncGenerator<StreamEvent> {
  const last = history[history.length - 1]?.text ?? "";
  if (last.includes("__error__")) throw new ParseIntentError("stub error", "upstream");
  if (last.includes("__slow__")) await sleep(1500);

  const prose = locale === 'en' ? "Here's a suggested plan for you." : "Đây là gợi ý cho chuyến đi của bạn.";
  yield { kind: "token", text: prose };

  if (last.includes("__noop__")) {
    // không action — client giữ lịch hiện tại
  } else if (last.includes("__vibe__")) {
    yield { kind: "suggest", dia_diem: "da-lat", vibe: "lang-man" };
  } else {
    yield { kind: "slots", partial: { dia_diem: "da-lat", days: 3, adults: 2 } };
  }

  yield { kind: "sig", tag: signModelTurn(prose) };
  yield { kind: "usage", inputTokens: 0, outputTokens: 0, totalTokens: 0, thoughtsTokens: 0 };
}
