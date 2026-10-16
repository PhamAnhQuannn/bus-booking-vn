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

import { isRealProduction, isLocalEvalHarnessAllowed } from "@/lib/core/config/deployTier";
import { logger } from "@/lib/logger";
import { ParseIntentError, type AdapterOpts, type ChatTurn, type StreamEvent, type ProviderId, type RouterHooks } from "./types";
import { streamChat as geminiStream } from "./geminiAdapter";
import { streamChat as groqStream } from "./openaiCompatAdapter";
import { streamChat as claudeStream } from "./anthropicAdapter";
import { stubStream } from "./llmStub";

type Adapter = (history: ChatTurn[], locale?: "vi" | "en", opts?: AdapterOpts) => AsyncGenerator<StreamEvent>;
const ADAPTERS: Record<ProviderId, Adapter> = { gemini: geminiStream, groq: groqStream, claude: claudeStream };

// #829: env key mỗi adapter đọc (khớp check no_key trong adapter). Route dùng để biết provider nào PHỤC VỤ
// ĐƯỢC: breaker primary mở + fallback không key (prod default: không GROQ_API_KEY) → 503 breaker, KHÔNG
// skip sang provider chắc chắn ném no_key (copy "chưa cấu hình khoá" sai + mất Retry-After).
const KEY_ENV: Record<ProviderId, string> = { gemini: "GEMINI_API_KEY", groq: "GROQ_API_KEY", claude: "ANTHROPIC_API_KEY" };
export function providerHasKey(p: ProviderId): boolean {
  return !!process.env[KEY_ENV[p]];
}

// Order theo PLANNER_LLM_PRIMARY (đọc per-call: env Vercel baked per-deploy nhưng process dài + test được).
// Giá trị lạ → mặc định gemini primary (an toàn: gemini là provider đã chạy prod). "claude" → [claude, gemini].
export function providerOrder(): ProviderId[] {
  const primary = (process.env.PLANNER_LLM_PRIMARY ?? "gemini").trim().toLowerCase();
  const order: ProviderId[] =
    primary === "claude" ? ["claude", "gemini"] // opt-in (trả phí); default giữ nguyên
    : primary === "groq" ? ["groq", "gemini"]
    : ["gemini", "groq"];
  // Eval (planner-conv-eval): PLANNER_LLM_FALLBACK=off → CHỈ primary, để so provider không lẫn lượt
  // fallback âm thầm. Bỏ qua ở prod thật (prod luôn giữ lưới fallback).
  if (process.env.PLANNER_LLM_FALLBACK === "off" && isLocalEvalHarnessAllowed()) return order.slice(0, 1);
  return order;
}

export async function* streamChat(history: ChatTurn[], locale: "vi" | "en" = "vi", hooks: RouterHooks = {}): AsyncGenerator<StreamEvent> {
  // #748 STUB GATE — TRƯỚC vòng provider. Router KHÔNG phân biệt "stub cố tình ném" (vd __error__ ném
  // trước content) với "provider chết" → nếu để stub throw vào vòng, fallback rơi xuống Groq adapter thật
  // (ungated) = phá $0 stub / gọi upstream ngoài ý. Gate ở đây: stub bật → phục vụ stub, KHÔNG bao giờ
  // vào fallback. Vá cả fallthrough LẪN PLANNER_LLM_PRIMARY=groq. Prod: getEnv() đã FAIL boot nếu stub
  // bật (env strict); inline throw = defense-in-depth cho path getEnv chưa chạy (cron/edge/test).
  if (process.env.PLANNER_LLM_STUB === "true") {
    if (isRealProduction()) throw new ParseIntentError("PLANNER_LLM_STUB không được bật ở production", "no_key");
    yield* stubStream(history, locale);
    return;
  }

  // #829: provider có breaker mở → bỏ qua, đi thẳng provider kế (không trả latency attempt chắc hỏng).
  // Route đã 503 nếu KHÔNG còn provider phục vụ được → rỗng ở đây chỉ là race (breaker vừa mở giữa chừng).
  const order = providerOrder().filter((p) => !hooks.skip?.has(p));
  if (hooks.skip?.size) logger.warn({ skipped: [...hooks.skip], order }, "planner.router.breaker_skip");
  if (order.length === 0) throw new ParseIntentError("Mọi provider đang mở breaker", "upstream");
  // #829: lỗi upstream ĐẦU bị nuốt — nếu provider cuối chỉ ném no_key (fallback chưa có key) thì ném lỗi
  // này thay vào: nguyên nhân thật là upstream, không phải cấu hình.
  let firstUpstream: unknown = null;
  for (let i = 0; i < order.length; i++) {
    const p = order[i];
    const isLast = i === order.length - 1;
    let sawContent = false; // event NỘI DUNG (không tính provider) đã phát chưa
    try {
      // #622: mỗi attempt adapter tự retry cũng đếm vào breaker CỦA provider đó.
      const opts: AdapterOpts = hooks.onUpstreamFailure ? { onRetry: () => hooks.onUpstreamFailure?.(p) } : {};
      for await (const ev of ADAPTERS[p](history, locale, opts)) {
        if (ev.kind !== "provider") sawContent = true;
        yield ev;
      }
      await hooks.onSuccess?.(p); // #829: reset breaker của provider ĐÃ phục vụ (không phải primary)
      return; // provider hoàn tất OK
    } catch (err) {
      const code = err instanceof ParseIntentError ? err.code : "unknown";
      // #829/#606: CHỈ upstream đếm (no_key = cấu hình, bad_json = service vẫn sống) — trên breaker
      // provider NÀY, cả khi lỗi bị fallback nuốt lẫn khi ném ra (route không đếm nữa → không double).
      if (code === "upstream") {
        await hooks.onUpstreamFailure?.(p);
        firstUpstream ??= err;
      }
      // Đã phát nội dung HOẶC là provider cuối → ném (route hiện degrade copy). Ngược lại rơi xuống provider kế.
      if (sawContent) throw err;
      if (isLast) throw code === "no_key" && firstUpstream ? firstUpstream : err;
      // #826: log lỗi provider primary BỊ NUỐT trước khi fallback — nếu không, lỗi provider cuối (vd Groq
      // no_key) rethrow sẽ CHE nguyên nhân thật (vd Gemini chat-path fail). Message do adapter sinh
      // ("Gemini HTTP 429", "Gemini timeout"...) — không chứa prompt/PII; KHÔNG log history.
      logger.warn(
        {
          provider: p,
          nextProvider: order[i + 1] ?? null,
          code,
          err: err instanceof Error ? err.message : String(err),
        },
        "planner.router.fallback",
      );
    }
  }
}
