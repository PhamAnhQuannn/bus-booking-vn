// llm-eval — CỔNG CHẤT LƯỢNG PR-0 (planner-100convday-zero-cost). Đo chất lượng trích enum VN của một
// provider (Groq) SO với baseline Gemini, TRƯỚC khi viết bất kỳ adapter nào. Nếu Groq không đạt → dừng,
// lấy Flash-Lite $15/mo. Chạy THỦ CÔNG (KHÔNG vào CI — đốt quota dev-key). Dán output vào PR body.
//
// Chạy từ repo root:
//   pnpm tsx trip-planner/scripts/llm-eval.ts --dry                      # $0: validate fixtures + self-check, KHÔNG gọi API
//   pnpm tsx trip-planner/scripts/llm-eval.ts --gemini --gemini-key-env GEMINI_API_KEY_EVAL --confirm  # baseline (60 req = ~3 ngày free-tier)
//   pnpm tsx trip-planner/scripts/llm-eval.ts --groq --model openai/gpt-oss-20b --confirm --ttft
//   ...thêm --ttft (đo TTFT stream 10 fixture) · --runs 2 (đo swing) · --throttle 45000 (ms/call) · --only id1,id2 (debug)
//
// KEY: --gemini-key-env trỏ ENV chứa key Gemini của PROJECT eval RIÊNG (≠ key prod, ≠ key prepay) — quota
//      free tính per-PROJECT. GROQ_API_KEY (dev). NODE_ENV=production → THROW.
// Baseline Gemini cache theo fingerprint(SYSTEM+decls+model+temp): đổi prompt/model → cache vô hiệu, chạy lại.
//
// GO/NO-GO (F1): ∀ lớp  Groq passRate ≥ Gemini−2pp  AND  RAW out-of-enum = 0  AND  refusal ≥ Gemini
//                AND (2 run) swing ≤5pp  AND (ttft) p50 ≤1.2s / p95 ≤3s.

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createHash } from "node:crypto";
import { SYSTEM, systemFor, TRICH_DECL, GOI_Y_DECL, countOutOfEnum } from "../lib/planner/parseIntent";
import { filterVibes } from "../lib/planner/vibes";

if (process.env.NODE_ENV === "production") throw new Error("llm-eval: KHÔNG chạy ở production (đốt quota + không có key dev).");

// ── args ──
const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const val = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
const DRY = has("--dry") || !has("--confirm");
const PROVIDER: "gemini" | "groq" = has("--groq") ? "groq" : "gemini";
const GROQ_MODEL = val("--model") ?? "openai/gpt-oss-20b"; // catalog Groq 2026 (llama-3.1-8b ĐÃ BỎ → 404)
const GEMINI_MODEL = val("--gemini-model") ?? "gemini-3.5-flash";
// Tên ENV chứa key Gemini để đọc. Mặc định GEMINI_API_KEY; baseline PHẢI trỏ key của PROJECT eval RIÊNG
// (vd GEMINI_API_KEY_EVAL) để KHÔNG vét chung quota 20/ngày của key prod. TUYỆT ĐỐI không trỏ key prepay.
const GEMINI_KEY_ENV = val("--gemini-key-env") ?? "GEMINI_API_KEY";
const TEMP = Number(val("--temp") ?? "0.3");
const RUNS = Math.max(1, Number(val("--runs") ?? "1"));
const THROTTLE_MS = Number(val("--throttle") ?? (PROVIDER === "groq" ? "45000" : "0")); // Groq 6000 TPM → ~45s/call
const TTFT = has("--ttft");
const ONLY = val("--only")?.split(",").map((s) => s.trim()).filter(Boolean); // chạy tập con fixture (debug fail)
const TTFT_N = 10;
const FIXTURES_PATH = "trip-planner/scripts/llm-eval.fixtures.jsonl";
const SCRATCH = process.env.CLAUDE_SCRATCH || path.join(os.tmpdir(), "planner-llm-eval");
const CATEGORIES = ["trich", "goi_y_vibe", "refusal", "trich-negation"] as const;
type Category = (typeof CATEGORIES)[number];

// ── fixtures ──
interface Expect { fn: "trich" | "goi_y_vibe" | null; dia_diem?: string; vibe?: string; interests?: string[]; pace?: string }
interface Fixture { id: string; category: Category; prompt: string; locale?: "vi" | "en"; expect: Expect }

function loadFixtures(): Fixture[] {
  const raw = fs.readFileSync(FIXTURES_PATH, "utf-8").split("\n");
  const out: Fixture[] = [];
  const ids = new Set<string>();
  for (let n = 0; n < raw.length; n++) {
    const l = raw[n].trim();
    if (!l || l.startsWith("//")) continue;
    let f: Fixture;
    try { f = JSON.parse(l) as Fixture; } catch (e) { console.error(`✗ ${FIXTURES_PATH}:${n + 1} JSON hỏng — ${String(e)}\n  ${l}`); process.exit(2); }
    if (!f.id || !f.category || !f.prompt || !f.expect) { console.error(`✗ ${FIXTURES_PATH}:${n + 1} thiếu field bắt buộc`); process.exit(2); }
    if (!CATEGORIES.includes(f.category)) { console.error(`✗ ${f.id}: category lạ "${f.category}"`); process.exit(2); }
    if (f.expect.fn !== null && f.expect.fn !== "trich" && f.expect.fn !== "goi_y_vibe") { console.error(`✗ ${f.id}: expect.fn lạ`); process.exit(2); }
    if (ids.has(f.id)) { console.error(`✗ id trùng "${f.id}"`); process.exit(2); }
    ids.add(f.id);
    out.push(f);
  }
  return out;
}

// ── provider call: trả function call ĐẦU TIÊN (name+raw args) hoặc null (không gọi = refusal) ──
type Call = { fn: string; args: Record<string, unknown> } | null;
// Groq validate tool-args server-side theo JSON-schema (Gemini KHÔNG). gpt-oss điền `null` cho field
// SỐ chưa rõ (adults/children…) → Groq 400 "expected integer, got null". Nới null CHỈ cho field
// integer/number/boolean (nguyên nhân 400). GIỮ enum string/array (dia_diem/vibe/pace/interests) STRICT:
// nếu nới null vào enum → "mời" model (qwen) bỏ trống dia_diem → tính điểm KHÔNG công bằng. Với enum strict,
// model null city → Groq 400 = fail ĐÚNG (nulling city LÀ fail). prod partialFromArgs/filterVibes coi null=vắng.
// (Finding PR-7: adapter Groq gửi schema nới-null-số HOẶC strip null-số trước khi gửi.)
function groqTolerant(decl: typeof TRICH_DECL | typeof GOI_Y_DECL) {
  const d = JSON.parse(JSON.stringify(decl)) as { parameters?: { properties?: Record<string, { type?: unknown }> } };
  const props = d.parameters?.properties ?? {};
  for (const k of Object.keys(props)) {
    const p = props[k];
    const t = Array.isArray(p.type) ? (p.type as string[]) : [p.type as string];
    if (t.some((x) => x === "integer" || x === "number" || x === "boolean")) p.type = [...new Set([...t, "null"])];
  }
  return d;
}
const openaiTools = () => [TRICH_DECL, GOI_Y_DECL].map((d) => ({ type: "function", function: groqTolerant(d) }));

async function callGemini(f: Fixture): Promise<Call> {
  const key = process.env[GEMINI_KEY_ENV];
  if (!key) throw new Error(`${GEMINI_KEY_ENV} chưa cấu hình (--gemini-key-env)`);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemFor(f.locale ?? "vi") }] },
      contents: [{ role: "user", parts: [{ text: f.prompt }] }],
      tools: [{ functionDeclarations: [TRICH_DECL, GOI_Y_DECL] }],
      generationConfig: { temperature: TEMP, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  logRate("gemini", res);
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const parts = j.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) if (p.functionCall?.name) return { fn: p.functionCall.name, args: p.functionCall.args ?? {} };
  return null;
}

async function callGroq(f: Fixture): Promise<Call> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY chưa cấu hình");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: GROQ_MODEL, temperature: TEMP, tool_choice: "auto", tools: openaiTools(),
      messages: [{ role: "system", content: systemFor(f.locale ?? "vi") }, { role: "user", content: f.prompt }],
    }),
  });
  logRate("groq", res);
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const tc = j.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc?.function?.name) return null;
  let args: Record<string, unknown> = {};
  try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* mã trả JSON hỏng → args rỗng, sẽ trượt enum */ }
  return { fn: tc.function.name, args };
}
const callProvider = (f: Fixture): Promise<Call> => (PROVIDER === "gemini" ? callGemini(f) : callGroq(f));

function logRate(tag: string, res: Response) {
  const parts: string[] = [];
  for (const [k, v] of res.headers) if (/ratelimit|retry-after/i.test(k)) parts.push(`${k}=${v}`);
  if (parts.length) console.log(`   [${tag} rate] ${parts.join(" · ")}`);
}

// ── scoring ──
const setEq = (a: string[], b: string[]) => { const A = new Set(a), B = new Set(b); return A.size === B.size && [...A].every((x) => B.has(x)); };
type Res = { id: string; category: Category; expectFn: string | null; gotFn: string | null; fnOk: boolean; enumOk: boolean; outOfEnum: number; pass: boolean; gotArgs: Record<string, unknown> | null; expect: Expect };

function score(f: Fixture, call: Call): Res {
  const gotFn = call?.fn ?? null;
  const fnOk = gotFn === f.expect.fn;
  const outOfEnum = call ? countOutOfEnum(call.fn, call.args) : 0;
  let enumOk = true;
  if (f.expect.fn !== null && call && fnOk) {
    const a = call.args;
    if (f.expect.dia_diem !== undefined) enumOk &&= a.dia_diem === f.expect.dia_diem;
    if (f.expect.vibe !== undefined) enumOk &&= filterVibes([String(a.vibe ?? "")])[0] === f.expect.vibe;
    if (f.expect.pace !== undefined) enumOk &&= a.pace === f.expect.pace;
    if (f.expect.interests !== undefined) enumOk &&= setEq(filterVibes(Array.isArray(a.interests) ? a.interests.map(String) : []), f.expect.interests);
  } else if (f.expect.fn !== null) {
    enumOk = false; // đáng lẽ gọi function mà không gọi (hoặc gọi sai fn)
  }
  const pass = f.expect.fn === null ? gotFn === null : fnOk && enumOk && outOfEnum === 0;
  return { id: f.id, category: f.category, expectFn: f.expect.fn, gotFn, fnOk, enumOk, outOfEnum, pass, gotArgs: call?.args ?? null, expect: f.expect };
}

// self-check (--dry): fixture "hoàn hảo" phải tự đạt pass=true + outOfEnum=0. Bắt lỗi fixture (slug/vibe sai
// enum, expect không nhất quán) mà KHÔNG tốn 1 request nào. Mô phỏng call lý tưởng từ chính expect.
function idealCall(f: Fixture): Call {
  if (f.expect.fn === null) return null;
  const args: Record<string, unknown> = {};
  if (f.expect.dia_diem !== undefined) args.dia_diem = f.expect.dia_diem;
  if (f.expect.vibe !== undefined) args.vibe = f.expect.vibe;
  if (f.expect.pace !== undefined) args.pace = f.expect.pace;
  if (f.expect.interests !== undefined) args.interests = f.expect.interests;
  return { fn: f.expect.fn, args };
}

// ── baseline cache (Gemini) ──
function fingerprint(): string {
  const h = createHash("sha256");
  h.update(SYSTEM + " " + systemFor("en") + " " + JSON.stringify(TRICH_DECL) + JSON.stringify(GOI_Y_DECL) + " " + GEMINI_MODEL + " " + TEMP);
  return h.digest("hex").slice(0, 16);
}
const baselineFile = () => path.join(SCRATCH, `baseline-gemini-${fingerprint()}.json`);

// ── aggregate + verdict ──
function byCat(results: Res[]) {
  const m: Record<string, { pass: number; total: number; ooe: number }> = {};
  for (const c of CATEGORIES) m[c] = { pass: 0, total: 0, ooe: 0 };
  for (const r of results) { m[r.category].total++; if (r.pass) m[r.category].pass++; m[r.category].ooe += r.outOfEnum; }
  return m;
}
const pct = (p: number, t: number) => (t ? (100 * p) / t : 100);

function report(tag: string, results: Res[]) {
  const m = byCat(results);
  const totalOoe = results.reduce((s, r) => s + r.outOfEnum, 0);
  const totalPass = results.filter((r) => r.pass).length;
  console.log(`\n══ ${tag} (${PROVIDER === "groq" ? GROQ_MODEL : GEMINI_MODEL}, temp ${TEMP}) ══`);
  for (const c of CATEGORIES) console.log(`  ${c.padEnd(16)} ${m[c].pass}/${m[c].total} (${pct(m[c].pass, m[c].total).toFixed(1)}%)  out-of-enum=${m[c].ooe}`);
  console.log(`  ${"TỔNG".padEnd(16)} ${totalPass}/${results.length} (${pct(totalPass, results.length).toFixed(1)}%)  out-of-enum=${totalOoe}`);
  const fails = results.filter((r) => !r.pass);
  if (fails.length) {
    console.log("  ── FAIL ──");
    for (const r of fails) {
      const exp = JSON.stringify({ fn: r.expect.fn, ...(r.expect.dia_diem !== undefined && { dia_diem: r.expect.dia_diem }), ...(r.expect.vibe !== undefined && { vibe: r.expect.vibe }), ...(r.expect.interests !== undefined && { interests: r.expect.interests }), ...(r.expect.pace !== undefined && { pace: r.expect.pace }) });
      console.log(`    ${r.id.padEnd(12)} expect=${r.expectFn ?? "null"} got=${r.gotFn ?? "null"} fnOk=${r.fnOk} enumOk=${r.enumOk} ooe=${r.outOfEnum}`);
      console.log(`        want ${exp}`);
      console.log(`        got  ${JSON.stringify(r.gotArgs)}`);
    }
  }
  return { m, totalOoe };
}

function verdict(groq: Res[], gemini: Res[], ttft?: { p50: number; p95: number }) {
  const g = byCat(groq), b = byCat(gemini);
  const lines: string[] = [];
  let ok = true;
  for (const c of CATEGORIES) {
    const gp = pct(g[c].pass, g[c].total), bp = pct(b[c].pass, b[c].total);
    const pass = gp >= bp - 2;
    ok &&= pass;
    lines.push(`  ${pass ? "✓" : "✗"} ${c}: Groq ${gp.toFixed(1)}% vs Gemini ${bp.toFixed(1)}% (bar ≥ ${(bp - 2).toFixed(1)}%)`);
  }
  const ooe = groq.reduce((s, r) => s + r.outOfEnum, 0);
  const ooeOk = ooe === 0; ok &&= ooeOk;
  lines.push(`  ${ooeOk ? "✓" : "✗"} RAW out-of-enum Groq = ${ooe} (bar 0)`);
  const gRef = pct(g.refusal.pass, g.refusal.total), bRef = pct(b.refusal.pass, b.refusal.total);
  const refOk = gRef >= bRef; ok &&= refOk;
  lines.push(`  ${refOk ? "✓" : "✗"} refusal Groq ${gRef.toFixed(1)}% ≥ Gemini ${bRef.toFixed(1)}%`);
  if (ttft) { const tOk = ttft.p50 <= 1200 && ttft.p95 <= 3000; ok &&= tOk; lines.push(`  ${tOk ? "✓" : "✗"} TTFT p50 ${ttft.p50}ms (≤1200) · p95 ${ttft.p95}ms (≤3000)`); }
  console.log("\n══ GO/NO-GO (F1) ══"); for (const l of lines) console.log(l);
  console.log(`\n  → ${ok ? "GO ✅ (Groq đạt — tiếp PR sequence)" : "NO-GO ❌ (thử model kế; fail cả 3 → Flash-Lite $15/mo)"}`);
}

// ── TTFT (stream) ──
async function ttftOne(f: Fixture): Promise<number> {
  const t0 = performance.now();
  if (PROVIDER === "gemini") {
    const key = process.env[GEMINI_KEY_ENV]!;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system_instruction: { parts: [{ text: systemFor(f.locale ?? "vi") }] }, contents: [{ role: "user", parts: [{ text: f.prompt }] }], tools: [{ functionDeclarations: [TRICH_DECL, GOI_Y_DECL] }], generationConfig: { temperature: TEMP, thinkingConfig: { thinkingBudget: 0 } } }),
    });
    const reader = res.body!.getReader(); await reader.read(); reader.cancel();
  } else {
    const key = process.env.GROQ_API_KEY!;
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: GROQ_MODEL, temperature: TEMP, stream: true, tool_choice: "auto", tools: openaiTools(), messages: [{ role: "system", content: systemFor(f.locale ?? "vi") }, { role: "user", content: f.prompt }] }),
    });
    const reader = res.body!.getReader(); await reader.read(); reader.cancel();
  }
  return Math.round(performance.now() - t0);
}

// ── main ──
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const allFixtures = loadFixtures();
  const fixtures = ONLY ? allFixtures.filter((f) => ONLY.includes(f.id)) : allFixtures;
  if (ONLY) console.log(`[--only] ${fixtures.length}/${allFixtures.length} fixture: ${fixtures.map((f) => f.id).join(", ")}`);
  const cat = byCat(fixtures.map((f) => ({ category: f.category } as Res)));
  console.log(`fixtures: ${fixtures.length}` + CATEGORIES.map((c) => ` · ${c}=${cat[c].total}`).join(""));
  if (fixtures.length < 60) console.warn(`⚠ chỉ ${fixtures.length} fixture (<60) — dưới sàn PR-0.`);

  if (DRY) {
    console.log("\n[--dry] self-check: mô phỏng call lý tưởng từ expect (KHÔNG gọi API, $0)…");
    const results = fixtures.map((f) => score(f, idealCall(f)));
    const { totalOoe } = report("SELF-CHECK (ideal)", results);
    const broken = results.filter((r) => !r.pass);
    if (broken.length || totalOoe) { console.error(`\n✗ ${broken.length} fixture KHÔNG tự đạt (expect không nhất quán / slug-vibe sai enum). Sửa fixture trước khi --confirm.`); process.exit(1); }
    console.log("\n✓ Fixtures nhất quán (mọi expect tự đạt pass, out-of-enum=0). Sẵn sàng --confirm khi có key.");
    console.log("  Chạy thật: --gemini --gemini-key-env GEMINI_API_KEY_EVAL --confirm   ·   --groq --model openai/gpt-oss-20b --confirm --ttft");
    return;
  }

  const runResults: Res[][] = [];
  for (let run = 1; run <= RUNS; run++) {
    console.log(`\n─ run ${run}/${RUNS} · provider=${PROVIDER} · throttle=${THROTTLE_MS}ms ─`);
    let cache: Record<string, Call> = {};
    const useCache = PROVIDER === "gemini";
    if (useCache && fs.existsSync(baselineFile())) { cache = JSON.parse(fs.readFileSync(baselineFile(), "utf-8")).results ?? {}; }
    const results: Res[] = [];
    let errored = 0;
    for (const f of fixtures) {
      let call: Call = null;
      if (useCache && f.id in cache) { call = cache[f.id]; }
      else {
        try {
          call = await callProvider(f);
          // Cache CHỈ khi thành công (KHÔNG cache lỗi → baseline Gemini không nhiễm null-giả).
          if (useCache) { cache[f.id] = call; fs.mkdirSync(SCRATCH, { recursive: true }); fs.writeFileSync(baselineFile(), JSON.stringify({ fingerprint: fingerprint(), model: GEMINI_MODEL, temp: TEMP, results: cache })); }
        } catch (e) {
          // 1 fixture lỗi (400 schema / 429 / mạng) → ghi FAIL + tiếp, KHÔNG abort cả run.
          console.error(`   ✗ ${f.id}: ${String(e).slice(0, 180)}`);
          errored++;
          call = null;
        }
        if (THROTTLE_MS) await sleep(THROTTLE_MS);
      }
      results.push(score(f, call));
    }
    runResults.push(results);
    report(`run ${run}`, results);
    if (errored) console.log(`  ⚠ ${errored} fixture lỗi request (đếm như FAIL; xem dòng ✗ trên).`);
  }

  if (RUNS >= 2) {
    const p0 = pct(runResults[0].filter((r) => r.pass).length, runResults[0].length);
    const p1 = pct(runResults[1].filter((r) => r.pass).length, runResults[1].length);
    const swing = Math.abs(p0 - p1);
    console.log(`\nswing (2 run): ${swing.toFixed(1)}pp ${swing <= 5 ? "✓ (≤5)" : "✗ (>5 — temp variance quá cao)"}`);
  }

  let ttft: { p50: number; p95: number } | undefined;
  if (TTFT) {
    console.log(`\n─ TTFT (${TTFT_N} fixture, stream) ─`);
    const ms: number[] = [];
    for (const f of fixtures.slice(0, TTFT_N)) { const t = await ttftOne(f); ms.push(t); console.log(`   ${f.id}: ${t}ms`); if (THROTTLE_MS) await sleep(THROTTLE_MS); }
    ms.sort((a, b) => a - b);
    ttft = { p50: ms[Math.floor(ms.length / 2)], p95: ms[Math.floor(ms.length * 0.95)] ?? ms[ms.length - 1] };
    console.log(`   p50=${ttft.p50}ms · p95=${ttft.p95}ms`);
  }

  // verdict CHỈ khi có cả 2 phía. Groq run → so với baseline Gemini đã cache (nếu có).
  if (PROVIDER === "groq") {
    const bf = baselineFile();
    if (!fs.existsSync(bf)) { console.log("\n(⚠ chưa có baseline Gemini cùng fingerprint — chạy --gemini --confirm trước để so GO/NO-GO)"); return; }
    const base = JSON.parse(fs.readFileSync(bf, "utf-8")).results as Record<string, Call>;
    const geminiRes = fixtures.map((f) => score(f, base[f.id] ?? null));
    verdict(runResults[runResults.length - 1], geminiRes, ttft);
  } else {
    console.log(`\n(baseline Gemini đã cache: ${path.relative(process.cwd(), baselineFile())} — giờ chạy --groq --model … --confirm để so GO/NO-GO)`);
  }
})().catch((e) => { console.error(e); process.exit(2); });
