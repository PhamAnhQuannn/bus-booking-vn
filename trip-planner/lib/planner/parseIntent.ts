// parseIntent — SHIM re-export (PR-3). Nội dung đã tách vào `llm/`:
//   - llm/types.ts       : ParsedIntent, ChatTurn, ChatRole, StreamEvent, ParseIntentError (contract)
//   - llm/prompt.ts      : SYSTEM, systemFor, TRICH_DECL, GOI_Y_DECL, countOutOfEnum, partialFromArgs, intentToParams (provider-agnostic)
//   - llm/geminiAdapter.ts : streamChat (Gemini provider — sibling tương lai: openaiCompatAdapter cho Groq)
// Giữ đường import cũ (`./parseIntent` + barrel) BẤT BIẾN → route/test/harness không đổi.
// Tách theo hướng multi-provider (planner-100convday A+C: Groq primary + Gemini fallback).

export type { ParsedIntent, ChatRole, ChatTurn, StreamEvent } from "./llm/types";
export { ParseIntentError } from "./llm/types";
export { SYSTEM, systemFor, TRICH_DECL, GOI_Y_DECL, countOutOfEnum, partialFromArgs, intentToParams } from "./llm/prompt";
export { streamChat } from "./llm/geminiAdapter";
