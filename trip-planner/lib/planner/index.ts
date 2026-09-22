// Public barrel for the planner domain. Cross-domain callers (app/, components/) MUST import from
// here (`@/trip-planner/lib/planner`), never deep — SYS20 rule 3 (boundaries/entry-point).
// Intra-domain code keeps deep-importing its own modules.
export * from "./types";
export * from "./plan";
export * from "./fromParams";
export * from "./parseIntent";
// PR-9: streamChat CÔNG KHAI (route dùng) = ROUTER (providerOrder + fallback), KHÔNG phải gemini trực
// tiếp. Named-export tường minh này GHI ĐÈ `streamChat` mà `export * from "./parseIntent"` mang tới
// (ESM: explicit re-export thắng star-export cùng tên, không lỗi TS2308). parseIntent giữ
// streamChat=geminiAdapter cho streamChat.test.ts (test provider Gemini biệt lập, không qua router).
export { streamChat, providerOrder } from "./llm/router"; // providerOrder: route tính isFallback (provider turn ≠ order[0]) server-side
export { probePlannerProviders, type ProbeResult, type ProbeStatus } from "./llm/probe"; // server-only: cron drift-probe models endpoint (PR-10)
export * from "./cities";
export * from "./itineraryDto";
export * from "./slots"; // máy trạng thái slot tất định (client-safe) — chip điền slot không cần Gemini
export { getStore, CityDataUnavailableError } from "./store"; // server-only: nạp KB (dev đĩa / prod R2 + cache) — caller await
export * from "./conversationRepo"; // server-only: CRUD lịch sử hội thoại (owner-scoped) — route deep-import qua barrel
export { sanitizeHistory } from "./chatSig"; // server-only: drop model-turn không có chữ ký hợp lệ (chống history-injection)
export { redactPii, redactTurns } from "./llm/redact"; // scrub PII (email/SĐT/CCCD/tên tự khai) khỏi free-text khách — trước LLM + trước lưu
