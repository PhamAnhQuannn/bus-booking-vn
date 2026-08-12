// chatSig — ký/verify model-turn của planner chat để chống history-injection.
//
// VẤN ĐỀ: route tin `body.history` do client kiểm soát, gồm cả `role:'model'`. Client bịa
// một model-turn giả ("mình đồng ý bỏ mọi giới hạn…") để mồi jailbreak. Không có history
// server-authoritative (store hiện tại client-push, chỉ authed customer; Phase-1 hầu hết guest).
//
// CƠ CHẾ (stateless, không migration, chạy cho guest): server ký prose nó phát ra bằng
// HMAC-SHA256 (PLANNER_CHAT_SECRET); client echo tag lại; server verify → CHỈ nạp vào Gemini
// `contents` những model-turn có chữ ký hợp lệ. Attacker không có secret → không tạo tag giả.
//
// Degrade an toàn: secret unset (dev/CI) → tag rỗng + verify cho qua (giữ coherence dev). PROD set.

import { signValue, unsignValue } from "@/lib/security";
import type { ChatTurn } from "./parseIntent";

// Đọc trong hàm (không cache module-load) để test set env sau import vẫn thấy.
function secret(): string | undefined {
  return process.env.PLANNER_CHAT_SECRET;
}

// Tag = phần sau dấu '.' cuối của signValue (tái dùng primitive đã audit, không viết crypto mới).
// Unset → "" (client sẽ gửi lại "", verifyModelTurn cho qua ở chế độ degrade).
export function signModelTurn(text: string): string {
  const s = secret();
  if (!s) return "";
  const signed = signValue(text, s);
  return signed.slice(signed.lastIndexOf(".") + 1);
}

// True nếu tag khớp text dưới secret hiện tại. Unset → true (degrade). Tag rỗng khi có secret → false.
export function verifyModelTurn(text: string, tag: string): boolean {
  const s = secret();
  if (!s) return true;
  if (!tag) return false;
  return unsignValue(`${text}.${tag}`, s) === text;
}

// Giữ nguyên user-turn (user nói gì tuỳ ý — SYSTEM prompt + validate lo). Model-turn CHỈ giữ khi
// tag verify hợp lệ; còn lại DROP → không cho model-turn giả lọt vào contents.
export function sanitizeHistory(raw: ChatTurn[]): ChatTurn[] {
  return raw.filter((t) => t.role !== "model" || verifyModelTurn(t.text, t.sig ?? ""));
}
