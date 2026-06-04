/**
 * [SYS20] lib/core/config — typed env + feature flags primitive.
 *
 * Cross-cutting configuration access (validated env, *_STUB flags). Imported BY domains;
 * imports NO domain. Re-exports the current env module living at `@/lib/config/env` (the
 * file does NOT move in this scaffold wave). Config is a core primitive, not a domain.
 */

export * from '@/lib/config';
