// conv-sim / serve — bật Next dev LOCAL đúng env eval (tránh quên cờ / secret sai định dạng).
//   pnpm tsx trip-planner/scripts/conv-sim/serve.ts            # LLM thật qua eval-proxy :8787 (Claude primary)
//   pnpm tsx trip-planner/scripts/conv-sim/serve.ts --stub     # $0: PLANNER_LLM_STUB (chạy thử runner)
//   ... --primary gemini|groq|claude                           # so sánh provider (fallback luôn tắt)
// Key thật KHÔNG đi vào Next: Next nhận key giả, eval-proxy thay bằng key thật.

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import * as fs from "node:fs";

const argv = process.argv.slice(2);
const val = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
const STUB = argv.includes("--stub");
// --start: `next start` trên bản build sẵn (`pnpm build` trước) — nhanh hơn dev nhiều lần khi chạy hàng nghìn lượt.
// VERCEL_ENV=preview để isRealProduction()=false dù NODE_ENV=production (cờ eval vẫn hiệu lực, getEnv không strict-prod).
const START = argv.includes("--start");
const PRIMARY = val("--primary") ?? "claude";
const PROXY = val("--proxy") ?? "http://127.0.0.1:8787";

if (process.env.VERCEL) throw new Error("serve: biến VERCEL đang set (vd từ `vercel env pull`) → cờ eval sẽ bị bỏ qua. Gỡ ra rồi chạy lại.");
if (!fs.existsSync("tourism-kb/export")) throw new Error("serve: thiếu tourism-kb/export (KB local) — engine không dựng được lịch");

const env: NodeJS.ProcessEnv = {
  ...process.env,
  ...(START ? { VERCEL_ENV: "preview" } : {}),
  PLANNER_EVAL_MODE: "1",
  PLANNER_LLM_FALLBACK: "off",
  PLANNER_LLM_PRIMARY: PRIMARY,
  PLANNER_CHAT_SECRET: randomBytes(32).toString("hex"), // mỗi run 1 secret: chữ ký model-turn như prod
  PLANNER_LLM_STUB: STUB ? "true" : "false",
  // Cả --stub cũng trỏ về proxy + key giả: nếu cờ stub lỡ không có hiệu lực thì key thật trong
  // .env.local / shell KHÔNG bao giờ tới nhà cung cấp mà không qua sổ cái.
  ANTHROPIC_BASE_URL: `${PROXY}/anthropic`, ANTHROPIC_API_KEY: "via-eval-proxy",
  GEMINI_BASE_URL: `${PROXY}/gemini`, GEMINI_API_KEY: "via-eval-proxy",
  GROQ_BASE_URL: `${PROXY}/groq`, GROQ_API_KEY: "via-eval-proxy",
};
// Key eval thật (nếu shell có) không được lọt vào môi trường của Next.
for (const k of ["ANTHROPIC_API_KEY_EVAL", "GEMINI_API_KEY_EVAL", "GROQ_API_KEY_EVAL"]) delete env[k];
console.log(`[serve] eval server :3001 (${START ? "next start" : "next dev"}) · ${STUB ? "STUB" : `primary=${PRIMARY} via ${PROXY}`} · fallback off`);
const child = spawn("pnpm", START ? ["exec", "next", "start", "-p", "3001"] : ["dev", "--webpack"], { env, stdio: "inherit", shell: process.platform === "win32" });
child.on("exit", (code) => process.exit(code ?? 0));
