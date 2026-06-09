// format domain public API barrel (SYS20 rule 3).
// Pure, client-safe formatters only — no server-only siblings (keeps the barrel
// importable from 'use client' components without a server-graph leak).

// vnd.ts
export { formatVnd } from './vnd';
