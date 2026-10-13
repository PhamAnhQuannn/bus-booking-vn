// conv-sim / simClient — gọi LLM đóng vai khách QUA eval-proxy (ledger chung, key thật chỉ ở proxy).
// Mặc định Claude Haiku 4.5 temp 0.7; SIM_PROVIDER=groq → gpt-oss-20b (cross-family, free tier).
// EVAL_DRY=1 → không gọi mạng, trả câu tất định (chạy thử runner $0 cùng PLANNER_LLM_STUB).

import { parseSimReply, simPrompt, type SimReply, type SimTurnInput } from "./simLib";

const PROXY = process.env.EVAL_PROXY_URL ?? "http://127.0.0.1:8787";
const SIM_PROVIDER = (process.env.SIM_PROVIDER ?? "claude") as "claude" | "groq";
const SIM_MODEL = process.env.SIM_MODEL ?? (SIM_PROVIDER === "groq" ? "openai/gpt-oss-20b" : "claude-haiku-4-5");

function dryReply(x: SimTurnInput): SimReply {
  const { sc } = x;
  const parts = x.fields.map((f) =>
    f === "dia_diem" ? `đi ${sc.place.ten}` : f === "days" ? `${sc.hidden_goal.days} ngày` : f === "party" ? `${sc.hidden_goal.party.adults} người lớn` : "");
  return { text: parts.filter(Boolean).join(", ") || "ok", uttered_fields: x.fields, uttered_hooks: [], give_up: false };
}

export async function simTurn(x: SimTurnInput): Promise<SimReply> {
  if (process.env.EVAL_DRY === "1") return dryReply(x);
  const { system, user } = simPrompt(x);
  const headers = { "content-type": "application/json", "x-eval-role": "sim", "x-eval-tag": x.sc.id };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = SIM_PROVIDER === "groq"
      ? await fetch(`${PROXY}/groq/openai/v1/chat/completions`, {
          method: "POST", headers,
          body: JSON.stringify({ model: SIM_MODEL, temperature: 0.7, max_tokens: 300, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
        })
      : await fetch(`${PROXY}/anthropic/v1/messages`, {
          method: "POST", headers: { ...headers, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: SIM_MODEL, temperature: 0.7, max_tokens: 300, system, messages: [{ role: "user", content: user }] }),
        });
    if (res.status === 529 && (await res.text()).includes("eval_cap_reached")) throw new Error("EVAL_CAP_REACHED");
    if (!res.ok) { await new Promise((r) => setTimeout(r, 1500 * attempt)); continue; }
    const j = await res.json();
    const raw = SIM_PROVIDER === "groq" ? j.choices?.[0]?.message?.content ?? "" : (j.content ?? []).map((b: { text?: string }) => b.text ?? "").join("");
    return parseSimReply(raw);
  }
  throw new Error("SIM_FAILED");
}
