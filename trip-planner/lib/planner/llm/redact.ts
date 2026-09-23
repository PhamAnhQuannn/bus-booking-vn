// redact — scrub yếu tố định danh cá nhân (PII) khỏi free-text khách TRƯỚC khi (a) gửi LLM
// (Groq/Gemini — cross-border) và (b) lưu vào PlannerConversation. Planner chỉ cần enum slots
// (thành phố/ngày/sở thích) — KHÔNG cần tên/SĐT/email; định danh chỉ rò khi khách tự gõ vào chat.
//
// Best-effort by construction (như redactErrorText): giảm rò định danh, KHÔNG thay hồ sơ CDTIA.
// Regex email + SĐT tái dùng từ lib/admin/redactErrorText.ts (đã vá false-positive #394) — chép
// sang đây để planner tự chứa, không import chéo domain (SYS20).
//
// KHÔNG redact tên bằng blanket capitalized-word: "Sa Pa"/"Bến Tre"/"Sơn Trà" là địa danh → nuke
// nhầm → hỏng intent parse. Chỉ redact tên khi có MARKER rõ ("tên tôi là X", "my name is X").

import type { ChatTurn } from "./types";

// Email — deliberately broad (over-scrub harmless).
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

// SĐT VN/quốc tế: +84 / 84 / leading 0, tolerating space/dot/dash. `(?<!\d)` anchor START of a
// digit run (#394) → không nuốt đuôi order-id/txn-ref dài hơn. Bounded 8-10 chữ số theo sau.
const PHONE = /(?<!\d)(?:\+?84|0)[\s.-]?\d(?:[\s.-]?\d){7,9}\b/g;

// CCCD (12) / CMND (9) đứng độc lập, khác 10 chữ số của phone. Chạy SAU phone (phone đã bị thay
// bằng chữ) nên không đụng số điện thoại. `(?<!\d)...(?!\d)` → chỉ khối số đúng độ dài, không cắt
// giữa run dài hơn (order-id, mã vé).
const NATIONAL_ID = /(?<!\d)(?:\d{12}|\d{9})(?!\d)/g;

// Tên TỰ KHAI, marker-anchored. Giữ nguyên marker, thay phần tên. 1-3 từ chữ cái ngay sau marker.
// VN: "(tôi/mình/em/tớ) tên (là|:) X", "tên (của) (tôi/mình/em/tớ) (là|:) X", "họ (và) tên (là) X".
// EN: "my name is X". Đại từ/"họ" BẮT BUỘC: "tên" trần là từ thường ("điểm đến tên Đà Lạt",
// "khách sạn tên Mường Thanh") → nuốt địa danh → hỏng intent parse.
// Over-mask sau marker rõ = hiếm + vô hại cho intent (thành phố lấy từ chỗ khác).
// Từ đầu ≥2 chữ cái (tránh bắt "à"/"ơi" lạc); từ sau ≥1 chữ cái, tối đa 3 từ nữa (họ tên VN có
// tên đệm 1 ký tự viết tắt, vd "Nguyễn Văn A").
const NAME_VI = /((?:họ(?: và)? tên|(?:tôi|mình|em|tớ)\s+tên|tên(?:\s+của)?\s+(?:tôi|mình|em|tớ))\s*(?:là|:)?\s+)([\p{L}]{2,}(?:\s+[\p{L}]+){0,3})/giu;
const NAME_EN = /(\bmy name is\s+)([A-Za-z]{2,}(?:\s+[A-Za-z]+){0,3})/gi;

/** Mask email / SĐT / CCCD-CMND / tên tự khai trong một chuỗi free-text. Thứ tự cố định. */
export function redactPii(text: string): string {
  return text
    .replace(EMAIL, "[email]")
    .replace(PHONE, "[sđt]")
    .replace(NATIONAL_ID, "[cccd]")
    .replace(NAME_VI, "$1[tên]")
    .replace(NAME_EN, "$1[tên]");
}

/**
 * Redact PII trong user-turn của lịch sử chat. Model-turn = prose của server (không PII) + mang
 * chữ ký HMAC (chatSig) → GIỮ NGUYÊN để verify không hỏng. Dùng ở CẢ đường gửi LLM lẫn đường lưu.
 */
export function redactTurns(turns: ChatTurn[]): ChatTurn[] {
  return turns.map((t) => (t.role === "user" ? { ...t, text: redactPii(t.text) } : t));
}
