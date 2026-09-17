// Gemini adapter — 1 Gemini call/lượt, STREAM (streamGenerateContent?alt=sse). Key server-side, KHÔNG lộ
// client. Tách khỏi parseIntent (PR-3) làm adapter provider ĐẦU TIÊN; openaiCompatAdapter (Groq) là sibling
// tương lai (PR-7). streamChat MOVE nguyên văn — hành vi byte-identical (streamChat.test.ts không đổi).
// Model PIN cứng: alias `gemini-flash-latest` đã roll sang gemini-3.7-flash (thinking) → 503 → pin bản ổn định.

import { isCitySlug } from "../cities";
import { filterVibes } from "../vibes";
import { signModelTurn } from "../chatSig";
import { systemFor, TRICH_DECL, GOI_Y_DECL, partialFromArgs, countOutOfEnum } from "./prompt";
import { ParseIntentError, type ChatTurn, type StreamEvent } from "./types";

const GEMINI_MODEL_DEFAULT = "gemini-3.5-flash";
// GEMINI_MODEL_OVERRIDE = van rollback: đổi sang bản DATED khác (vd gemini-3.5-flash-lite) qua env,
// KHÔNG cần đổi code. LƯU Ý: env trên Vercel baked per-deploy → vẫn CẦN redeploy để giá trị mới có
// hiệu lực (nhanh hơn sửa+merge code, không phải "hot" runtime). Đọc PER-CALL trong resolveGeminiModel
// (không cache ở module-load) để đúng cả process dài + test được. Giá trị xấu (khoảng trắng, `/`, hay
// alias `-latest` — đã cháy: flash-latest→3.7 thinking→503) → fallback pin + log, KHÔNG drift âm thầm.
const MODEL_NAME_RE = /^[a-z0-9.-]+$/i; // model DATED hợp lệ: chữ/số/./- , không khoảng trắng, không `/`
function resolveGeminiModel(): string {
  const raw = process.env.GEMINI_MODEL_OVERRIDE?.trim();
  if (!raw) return GEMINI_MODEL_DEFAULT;
  if (!MODEL_NAME_RE.test(raw) || /latest/i.test(raw)) {
    console.warn(`[planner] GEMINI_MODEL_OVERRIDE bị từ chối (${JSON.stringify(raw)}) → dùng ${GEMINI_MODEL_DEFAULT}`);
    return GEMINI_MODEL_DEFAULT;
  }
  return raw;
}
const GEMINI_URL = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`;

// Bound each free-text turn: cap output tokens (cost) + abort a hung/slow upstream (latency).
// 2048 leaves prose + the trich/goi_y_vibe function-call room so extraction isn't cut off.
const MAX_OUTPUT_TOKENS = 2048;
const STREAM_TIMEOUT_MS = 30_000;

// gemini-flash-latest trả 503 UNAVAILABLE ("high demand") ngắt quãng khi Google quá tải. 1 phát 503
// mà không retry = cả lượt hỏng → UI "Trợ lý đang bận, thử lại sau". Retry BOUNDED các mã 5xx tạm
// thời + lỗi mạng, chỉ TRƯỚC khi stream token đầu (chưa yield gì → không nhân đôi). 4xx (key/config)
// + 429 (quota/rate-limit — retry trong ~1.2s vô nghĩa, để circuit-breaker #552 lo) + idle-timeout:
// fail-fast. Backoff tuyến tính 400ms→800ms, tổng thêm ≤ ~1.2s — nằm trong idle STREAM_TIMEOUT_MS.
const GEMINI_MAX_ATTEMPTS = 3;
const GEMINI_RETRY_BACKOFF_MS = 400;
const GEMINI_RETRYABLE_STATUS = new Set([500, 502, 503, 504]);
// Backoff huỷ sớm khi signal abort (idle-timeout đã hết) → không phí nốt 800ms trên đường lỗi.
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });

interface GeminiPart {
  text?: string;
  functionCall?: { name?: string; args?: Record<string, unknown> };
}

// Stream 1 lượt hội thoại. Yield token prose + tối đa 1 directive (ask/plan).
export async function* streamChat(history: ChatTurn[], locale: 'vi' | 'en' = 'vi'): AsyncGenerator<StreamEvent> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new ParseIntentError("GEMINI_API_KEY chưa cấu hình", "no_key");

  // Idle deadline: abort only when the upstream goes quiet for STREAM_TIMEOUT_MS (reset on
  // every chunk), so a healthy long stream isn't truncated while a hung upstream still can't
  // pin the function open. maxOutputTokens caps a runaway generation.
  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
  const kick = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
  };

  const requestBody = JSON.stringify({
    system_instruction: { parts: [{ text: systemFor(locale) }] },
    contents: history.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    // BẮT BUỘC: không có tools thì Gemini KHÔNG function-call → không có `slots`/`suggest`,
    // bot hỏi lại thành phố dù khách đã nêu. Client parse part.functionCall bên dưới.
    tools: [{ functionDeclarations: [TRICH_DECL, GOI_Y_DECL] }],
    // thinkingBudget:0 tắt "suy nghĩ ẩn" của thinking-model — đo được ~377-409 thought token/lượt
    // chặn token đầu → TTFT 11-19s. Tắt = TTFT ~0.6s, thoughts=0 (verify direct-Google TRƯỚC merge:
    // 200 + thoughtsTokenCount=0 + trich/goi_y_vibe vẫn fire). Nếu API từ chối/floor field này hoặc
    // extraction giảm chất lượng → rollback bằng GEMINI_MODEL_OVERRIDE=gemini-3.5-flash-lite (van env).
    generationConfig: { temperature: 0.3, maxOutputTokens: MAX_OUTPUT_TOKENS, thinkingConfig: { thinkingBudget: 0 } },
  });

  // Backoff giữa các lần thử; abort trong lúc chờ = idle-timeout đã hết → fail-fast timeout.
  const backoff = async (n: number) => {
    try {
      await sleep(GEMINI_RETRY_BACKOFF_MS * n, controller.signal);
    } catch {
      clearTimeout(timer);
      throw new ParseIntentError("Gemini timeout", "upstream");
    }
  };

  let res: Response;
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      res = await fetch(GEMINI_URL(resolveGeminiModel(), key), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: requestBody,
      });
    } catch (err) {
      // Idle-timeout abort: deadline đã hết, retry vô nghĩa → fail-fast.
      if (controller.signal.aborted) {
        clearTimeout(timer);
        throw new ParseIntentError("Gemini timeout", "upstream");
      }
      if (attempt >= GEMINI_MAX_ATTEMPTS) {
        clearTimeout(timer);
        throw new ParseIntentError(`Gemini fetch failed: ${String(err)}`, "upstream");
      }
      await backoff(attempt);
      continue;
    }

    if (res.ok && res.body) break; // thành công → vào phần đọc stream

    // Non-2xx: chỉ retry mã 5xx tạm thời; 4xx + 429 fail-fast. Huỷ body bỏ đi để trả socket sớm.
    if (!GEMINI_RETRYABLE_STATUS.has(res.status) || attempt >= GEMINI_MAX_ATTEMPTS) {
      res.body?.cancel();
      clearTimeout(timer);
      throw new ParseIntentError(`Gemini HTTP ${res.status}`, "upstream");
    }
    res.body?.cancel();
    await backoff(attempt);
  }

  // PR-8: khai provider TRƯỚC token đầu → route log + client badge biết lịch đến từ đâu.
  yield { kind: "provider", id: "gemini", model: resolveGeminiModel() };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accProse = ""; // cộng dồn prose server phát ra → ký ở cuối turn (client echo tag để verify).
  // #553: Gemini trả usageMetadata (token thật) ở frame CUỐI của stream, luỹ kế. Giữ bản mới nhất,
  // phát 1 event "usage" ở cuối turn cho route accounting. Trước đây bị bỏ hẳn → không đo được spend.
  let usage: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number; thoughtsTokenCount?: number } | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      kick(); // got a chunk -> reset the idle deadline
      buffer += decoder.decode(value, { stream: true });

      // SSE frame phân tách bằng dòng "data: {json}".
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;

        let obj: {
          candidates?: { content?: { parts?: GeminiPart[] } }[];
          usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number; thoughtsTokenCount?: number };
        };
        try {
          obj = JSON.parse(payload);
        } catch {
          continue; // frame chưa trọn (hiếm với 1 dòng/frame) -> bỏ qua
        }

        if (obj.usageMetadata) usage = obj.usageMetadata; // luỹ kế; frame cuối mang tổng

        const parts = obj.candidates?.[0]?.content?.parts ?? [];
        for (const part of parts) {
          if (part.text) {
            accProse += part.text;
            yield { kind: "token", text: part.text };
          } else if (part.functionCall) {
            const { name, args = {} } = part.functionCall;
            if (name === "trich") {
              yield { kind: "slots", partial: partialFromArgs(args), dropped: countOutOfEnum("trich", args) };
            } else if (name === "goi_y_vibe") {
              const dia = typeof args.dia_diem === "string" && isCitySlug(args.dia_diem) ? args.dia_diem : null;
              const vibes = filterVibes([String(args.vibe ?? "")]); // allowlist vibe
              if (dia && vibes.length) yield { kind: "suggest", dia_diem: dia, vibe: vibes[0] };
            }
          }
        }
      }
    }
    // Cuối turn thành công: ký prose đã phát → client lưu tag, echo lại lượt sau để server verify.
    if (accProse) yield { kind: "sig", tag: signModelTurn(accProse) };
    // #553: phát token thật/turn (nếu Gemini trả usageMetadata) cho route accounting.
    if (usage)
      yield {
        kind: "usage",
        inputTokens: usage.promptTokenCount ?? 0,
        outputTokens: usage.candidatesTokenCount ?? 0,
        totalTokens: usage.totalTokenCount ?? 0,
        thoughtsTokens: usage.thoughtsTokenCount ?? 0,
      };
  } catch (err) {
    // Idle-timeout abort or a stream read error -> ParseIntentError so the route shows the
    // polite fallback instead of an uncaught crash.
    throw new ParseIntentError(
      controller.signal.aborted ? "Gemini timeout" : `Gemini stream error: ${String(err)}`,
      "upstream",
    );
  } finally {
    clearTimeout(timer);
  }
}
