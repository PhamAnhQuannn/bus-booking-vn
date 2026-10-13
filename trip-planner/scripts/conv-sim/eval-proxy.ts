// conv-sim / eval-proxy — reverse proxy GHI + CHẶN CHI PHÍ cho mọi lời gọi LLM của vòng eval.
// Next dev/start (local) trỏ ANTHROPIC_BASE_URL / GEMINI_BASE_URL / GROQ_BASE_URL về đây (các adapter đã
// hỗ trợ *_BASE_URL ngoài prod); runner (user-sim) + judge cũng gọi qua đây → MỘT sổ cái cho cả cycle.
//
//   • Key THẬT chỉ nằm trong process này (đọc từ env-file, không in, không ghi). Next chạy với key giả
//     "via-eval-proxy" → proxy THAY header/query bằng key thật trước khi forward.
//   • Ledger bền `.eval-data/conv-sim/ledger.json` cộng dồn MỌI run; chạm CAP → trả 529 + tạo file STOP.
//   • calls.jsonl: mỗi call 1 dòng {role, provider, model, status, ms, tokens, usd, pii_hits}. pii_hits =
//     SĐT/email còn sót trong request planner SAU redact của route (phải = 0). KHÔNG lưu nội dung request.
//
// Chạy (từ repo root, cửa sổ riêng):
//   pnpm tsx trip-planner/scripts/conv-sim/eval-proxy.ts --cap 95 [--port 8787] [--env-file .env.eval.local]
//   [--key-env ANTHROPIC_API_KEY_EVAL]   tên biến chứa key Anthropic trong env-file
// Route: /anthropic/* → api.anthropic.com · /gemini/* → generativelanguage.googleapis.com · /groq/* → api.groq.com
// Header tuỳ chọn từ runner: x-eval-role: sim|judge (mặc định planner), x-eval-tag: <scenarioId>.

import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { readEnvFile, parseUsage, usdOf, piiHits, conservativeUsage } from "./proxyLib";

const argv = process.argv.slice(2);
const val = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
const PORT = Number(val("--port") ?? "8787");
const CAP = Number(val("--cap") ?? "95");
const ENV_FILE = val("--env-file") ?? ".env.eval.local";
// Key eval phải tách khỏi key dev/prod trong .env.local (giới hạn chi riêng theo workspace).
if (/(^|[\\/])\.env\.local$/.test(ENV_FILE)) throw new Error("--env-file .env.local bị từ chối — dùng .env.eval.local");
const KEY_ENV = val("--key-env") ?? "ANTHROPIC_API_KEY_EVAL";
const DIR = val("--dir") ?? "trip-planner/.eval-data/conv-sim";
const LEDGER = path.join(DIR, "ledger.json");
const CALLS = path.join(DIR, "calls.jsonl");
export const STOP_FILE = path.join(DIR, "STOP");

if (process.env.VERCEL || process.env.NODE_ENV === "production") throw new Error("eval-proxy: chỉ chạy local");
if (!(CAP > 0 && CAP <= 100)) throw new Error("--cap phải trong (0, 100] — trần cycle $100");

// ── key: đọc env-file, KHÔNG in ──
const envFile = readEnvFile(ENV_FILE);
const KEYS = {
  anthropic: envFile[KEY_ENV] ?? "",
  gemini: envFile.GEMINI_API_KEY_EVAL ?? "",
  groq: envFile.GROQ_API_KEY_EVAL ?? envFile.GROQ_API_KEY ?? "",
};
if (!KEYS.anthropic) throw new Error(`thiếu ${KEY_ENV} trong ${ENV_FILE}`);

interface Ledger { usd: number; calls: number; byRole: Record<string, number>; byProvider: Record<string, number>; updatedAt: string }
fs.mkdirSync(DIR, { recursive: true });
const ledger: Ledger = fs.existsSync(LEDGER)
  ? JSON.parse(fs.readFileSync(LEDGER, "utf8"))
  : { usd: 0, calls: 0, byRole: {}, byProvider: {}, updatedAt: "" };
// Ghi tạm rồi rename: crash giữa chừng không để lại ledger rỗng/cụt (parse hỏng → mất sổ cái → vượt trần).
const saveLedger = () => { ledger.updatedAt = new Date().toISOString(); fs.writeFileSync(LEDGER + ".tmp", JSON.stringify(ledger, null, 2)); fs.renameSync(LEDGER + ".tmp", LEDGER); };
// Call đang bay chưa có usage → giữ chỗ RESERVE/call khi so với trần (song song 4+ worker không vượt trần).
const RESERVE_USD = 0.25;
let inflight = 0;

const UPSTREAM: Record<string, string> = {
  anthropic: "https://api.anthropic.com",
  gemini: "https://generativelanguage.googleapis.com",
  groq: "https://api.groq.com",
};

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const t0 = Date.now();
  const m = (req.url ?? "").match(/^\/(anthropic|gemini|groq)(\/.*)$/);
  if (!m) { res.writeHead(404).end(); return; }
  const provider = m[1];
  const role = String(req.headers["x-eval-role"] ?? "planner");
  const tag = String(req.headers["x-eval-tag"] ?? "");

  if (ledger.usd + inflight * RESERVE_USD >= CAP || fs.existsSync(STOP_FILE)) {
    if (ledger.usd >= CAP) fs.writeFileSync(STOP_FILE, `cap ${CAP} reached at ${new Date().toISOString()}\n`);
    res.writeHead(529, { "content-type": "application/json" }).end(JSON.stringify({ type: "error", error: { type: "eval_cap_reached" } }));
    return;
  }

  inflight++;
  try {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const reqBody = Buffer.concat(chunks).toString("utf8");
  let reqModel = "";
  try { reqModel = JSON.parse(reqBody).model ?? ""; } catch { /* gemini: model ở path */ }
  if (provider === "gemini") reqModel = m[2].match(/models\/([^:]+)/)?.[1] ?? reqModel;

  // Thay key giả bằng key thật.
  const url = new URL(UPSTREAM[provider] + m[2]);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (provider === "anthropic") {
    headers["x-api-key"] = KEYS.anthropic;
    headers["anthropic-version"] = String(req.headers["anthropic-version"] ?? "2023-06-01");
  } else if (provider === "gemini") {
    if (!KEYS.gemini) { res.writeHead(401).end(); return; }
    url.searchParams.set("key", KEYS.gemini);
  } else {
    if (!KEYS.groq) { res.writeHead(401).end(); return; }
    headers.authorization = `Bearer ${KEYS.groq}`;
  }

  let status = 0;
  let truncated = false;
  const out: Buffer[] = [];
  try {
    const up = await fetch(url, { method: req.method, headers, body: req.method === "GET" ? undefined : reqBody });
    status = up.status;
    const passHeaders: Record<string, string> = {};
    up.headers.forEach((v, k) => { if (!["content-encoding", "content-length", "transfer-encoding", "connection"].includes(k)) passHeaders[k] = v; });
    res.writeHead(up.status, passHeaders);
    if (up.body) for await (const c of up.body as unknown as AsyncIterable<Uint8Array>) { const b = Buffer.from(c); out.push(b); res.write(b); }
    res.end();
  } catch {
    truncated = true; // upstream có thể đã tính tiền cả phần chưa đọc tới → tính bảo thủ bên dưới
    status = status || 502;
    if (!res.headersSent) res.writeHead(502);
    res.end();
  }

  let usage = parseUsage(provider, Buffer.concat(out).toString("utf8"), reqModel);
  // Stream đứt giữa chừng, hoặc 2xx mà không đọc được usage → không để $0 lọt sổ cái.
  if ((truncated && status < 400) || (status < 300 && usage.input === 0 && usage.output === 0)) usage = conservativeUsage(usage, reqBody);
  const rawUsd = usdOf(usage);
  const usd = Number.isFinite(rawUsd) ? rawUsd : 0.05; // NaN sẽ làm `ledger.usd >= CAP` luôn false
  ledger.usd += usd; ledger.calls++;
  ledger.byRole[role] = (ledger.byRole[role] ?? 0) + usd;
  ledger.byProvider[provider] = (ledger.byProvider[provider] ?? 0) + usd;
  saveLedger();
  fs.appendFileSync(CALLS, JSON.stringify({
    ts: new Date(t0).toISOString(), role, tag, provider, model: usage.model, status, ms: Date.now() - t0,
    in: usage.input, out: usage.output, cacheW: usage.cacheWrite, cacheR: usage.cacheRead, usd,
    pii_hits: role === "planner" ? piiHits(reqBody) : null,
  }) + "\n");
  if (ledger.usd >= CAP * 0.8 && ledger.usd - usd < CAP * 0.8) console.warn(`[eval-proxy] 80% cap: $${ledger.usd.toFixed(2)} / $${CAP}`);
  } finally { inflight--; }
}

// Lỗi bất ngờ (client huỷ giữa lúc upload…) KHÔNG được làm sập proxy — sập = mất sổ cái các call đang bay.
const server = http.createServer((req, res) => {
  handle(req, res).catch(() => { if (!res.headersSent) res.writeHead(502); res.end(); });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[eval-proxy] :${PORT} cap $${CAP} · ledger $${ledger.usd.toFixed(4)} (${ledger.calls} calls) · providers ready: anthropic${KEYS.gemini ? " gemini" : ""}${KEYS.groq ? " groq" : ""}`);
});
