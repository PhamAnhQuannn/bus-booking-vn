/**
 * [SYS20] lib/core/logger — structured logging primitive.
 *
 * Cross-cutting logger (Pino + PII redaction). Imported BY domains; imports NO domain.
 * Re-exports the current logger living at `@/lib/logger` (the file does NOT move in this
 * scaffold wave — later waves relocate the implementation here). The logger is a core
 * primitive, not a domain, so the core import-boundary rule permits this re-export.
 */

export * from '@/lib/logger';
