// LLM adapter — kiểu CHUNG (contract) cho mọi provider (Gemini, và sau này Groq/openai-compat).
// Tách khỏi parseIntent (PR-3) để geminiAdapter + adapter tương lai import mà KHÔNG tạo vòng lặp.
// Thuần kiểu + 1 error class — không import gì (leaf).

export type ChatRole = "user" | "model";
export interface ChatTurn {
  role: ChatRole;
  text: string;
  sig?: string; // model-turn: HMAC tag do server ký (chống history-injection). Xem chatSig.ts.
}

// Ràng buộc chốt — CHỈ ràng buộc, không địa điểm. Field khớp requestFromParams.
export interface ParsedIntent {
  dia_diem: string; // slug thành phố (allowlist CITY_SLUGS) — mặc định "da-lat"
  days: number;
  adults: number;
  children: number;
  elders: number;
  pace: "relaxed" | "moderate" | "packed";
  interests: string[];
  wheelchair: boolean;
  avoidSteep: boolean;
}

// Event stream ra route: prose token | slot ĐÃ TRÍCH (client lo hỏi thêm + dựng).
// (ask/plan giữ cho tương thích kiểu; luồng mới dùng `slots` — chip + build là TẤT ĐỊNH ở client.)
// Provider phát lịch turn này (PR-8): id + model để route log per-provider + client badge khi ≠ primary.
// A+C: primary=groq, fallback=gemini — badge cho biết fallback đã fire (Groq outage/breaker mở).
export type ProviderId = "gemini" | "groq";

export type StreamEvent =
  | { kind: "provider"; id: ProviderId; model: string } // phát 1 lần, TRƯỚC token đầu (adapter tự khai)
  | { kind: "token"; text: string }
  | { kind: "slots"; partial: Partial<ParsedIntent>; dropped?: number } // dropped = countOutOfEnum RAW (enum bịa model phát trước allowlist) — log per-provider, must-have trước flip
  | { kind: "suggest"; dia_diem: string; vibe: string } // mode discovery: route lo lookup KB → tên
  | { kind: "sig"; tag: string } // cuối turn: HMAC ký prose server phát ra (client echo lại — chatSig.ts)
  | { kind: "usage"; inputTokens: number; outputTokens: number; totalTokens: number; thoughtsTokens: number } // #553: token thật/turn cho accounting (thoughtsTokens = token "suy nghĩ" ẩn của thinking model — đo latency)
  | { kind: "ask"; slot: string; options: string[]; allowCustom: boolean }
  | { kind: "plan"; intent: ParsedIntent };

export class ParseIntentError extends Error {
  constructor(
    message: string,
    readonly code: "no_key" | "upstream" | "bad_json",
  ) {
    super(message);
    this.name = "ParseIntentError";
  }
}
