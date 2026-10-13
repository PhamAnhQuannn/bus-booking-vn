// conv-sim / judge — LLM chấm hội thoại (CHẨN ĐOÁN, KHÔNG gating) trên mẫu phân tầng của 1 run.
// Rubric 1-5: helpful (giúp tới lịch phù hợp), natural (tiếng Việt/Anh tự nhiên), honest (không hứa ngoài dữ
// liệu: giá, đặt tour, giờ mở), tone (lịch sự, ngắn gọn). Judge KHÔNG thấy provider/model. Chưa calibrate
// với nhãn người → báo cáo ghi "uncalibrated" (cần ~100 nhãn owner, quadratic-weighted κ).
// Gọi qua eval-proxy (role=judge, sổ cái chung).
//
//   pnpm tsx trip-planner/scripts/conv-sim/judge.ts --run full-claude-2 --n 200 [--model claude-sonnet-5-5]

import * as fs from "node:fs";
import * as path from "node:path";
import type { Scenario } from "./types";

const argv = process.argv.slice(2);
const val = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
const RUN = val("--run") ?? "full-claude-2";
const N = Number(val("--n") ?? "200");
const MODEL = val("--model") ?? "claude-sonnet-5-5";
const PROXY = process.env.EVAL_PROXY_URL ?? "http://127.0.0.1:8787";
const DATA = "trip-planner/.eval-data/conv-sim";
const RUN_DIR = path.join(DATA, "runs", RUN);
const OUT = path.join(RUN_DIR, "judge.jsonl");
const readJsonl = <T,>(p: string): T[] => (fs.existsSync(p) ? fs.readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as T) : []);

interface Result { id: string; status: string; turns: { text?: string; label?: string; bot?: string }[] }
const catalog = new Map(readJsonl<Scenario>(path.join(DATA, fs.readdirSync(DATA).filter((x) => x.startsWith("scenarios-v2-")).sort().pop()!)).map((s) => [s.id, s]));
const results = readJsonl<Result>(path.join(RUN_DIR, "results.jsonl")).filter((r) => catalog.has(r.id) && r.turns.some((t) => t.bot));
const done = new Set(readJsonl<{ id: string }>(OUT).map((j) => j.id));

// Mẫu phân tầng theo style, tất định (id đầu mỗi style theo tỉ lệ).
const byStyle = new Map<string, Result[]>();
for (const r of results) { const st = catalog.get(r.id)!.style; byStyle.set(st, [...(byStyle.get(st) ?? []), r]); }
const sample: Result[] = [];
for (const [, rs] of byStyle) sample.push(...rs.slice(0, Math.max(3, Math.round((rs.length / results.length) * N))));

const SYSTEM = `Bạn là giám khảo chất lượng cho một trợ lý lập lịch du lịch Việt Nam (chỉ trích ràng buộc chuyến đi rồi để hệ thống dựng lịch từ dữ liệu; KHÔNG đặt tour, KHÔNG báo giá, KHÔNG có dữ liệu giờ mở chắc chắn; chỉ hỗ trợ 36 tỉnh/thành Việt Nam).
Chấm các lượt TRỢ LÝ (không chấm khách) theo thang 1-5:
- helpful: đưa khách tới lịch trình phù hợp, hỏi đúng cái còn thiếu, không vòng vo.
- natural: ngôn ngữ tự nhiên, đúng chính tả, đúng ngôn ngữ của khách.
- honest: không hứa/bịa điều ngoài khả năng (giá, đặt chỗ, giờ mở, nơi không hỗ trợ); từ chối rõ khi cần.
- tone: lịch sự, ngắn gọn, phù hợp.
Trả về DUY NHẤT JSON {"helpful":n,"natural":n,"honest":n,"tone":n,"issues":["<≤12 từ mỗi ý>"]}.`;

async function judgeOne(r: Result) {
  const convo = r.turns.flatMap((t) => [`KHÁCH: ${(t.text ?? t.label ?? "").slice(0, 400)}`, ...(t.bot ? [`TRỢ LÝ: ${t.bot.slice(0, 600)}`] : [])]).join("\n");
  const res = await fetch(`${PROXY}/anthropic/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "anthropic-version": "2023-06-01", "x-eval-role": "judge", "x-eval-tag": r.id },
    body: JSON.stringify({ model: MODEL, max_tokens: 1200, system: SYSTEM, messages: [{ role: "user", content: `Hội thoại:\n${convo}\n\nKết cục: ${r.status === "itinerary" ? "đã dựng lịch" : r.status}` }] }),
  });
  if (res.status === 529) throw new Error("EVAL_CAP_REACHED");
  if (!res.ok) return null;
  const j = await res.json();
  const raw = (j.content ?? []).map((b: { text?: string }) => b.text ?? "").join("");
  const body = raw.replace(/```[a-z]*\s*/gi, "").replace(/```/g, "");
  try { return JSON.parse(body.match(/\{[\s\S]*\}/)?.[0] ?? body); }
  catch {
    // Không parse được → lưu lý do (cắt ngắn) để soi, không chấm.
    fs.appendFileSync(path.join(RUN_DIR, "judge-fail.txt"), `${r.id} stop=${j.stop_reason} :: ${raw.slice(0, 300).replace(/\n/g, " ")}\n`);
    return null;
  }
}

(async () => {
  const todo = sample.filter((r) => !done.has(r.id));
  console.log(`[judge] ${RUN}: ${sample.length} mẫu, ${todo.length} cần chấm · model ${MODEL}`);
  for (let i = 0; i < todo.length; i += 4) {
    const batch = await Promise.all(todo.slice(i, i + 4).map(async (r) => ({ r, s: await judgeOne(r) })));
    for (const { r, s } of batch) if (s) fs.appendFileSync(OUT, JSON.stringify({ id: r.id, style: catalog.get(r.id)!.style, ...s }) + "\n");
  }
  const all = readJsonl<{ id: string; style: string; helpful: number; natural: number; honest: number; tone: number; issues?: string[] }>(OUT);
  const mean = (k: "helpful" | "natural" | "honest" | "tone") => +(all.reduce((a, x) => a + (Number(x[k]) || 0), 0) / Math.max(1, all.length)).toFixed(2);
  const issues = new Map<string, number>();
  for (const x of all) for (const s of x.issues ?? []) issues.set(s.toLowerCase(), (issues.get(s.toLowerCase()) ?? 0) + 1);
  const summary = { run: RUN, n: all.length, model: MODEL, calibrated: false, mean: { helpful: mean("helpful"), natural: mean("natural"), honest: mean("honest"), tone: mean("tone") }, low_honest: all.filter((x) => x.honest <= 2).map((x) => x.id), top_issues: [...issues].sort((a, b) => b[1] - a[1]).slice(0, 15) };
  fs.writeFileSync(path.join(RUN_DIR, "judge-summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
})();
