/**
 * No-op stub for the `server-only` / `client-only` build-time marker packages.
 *
 * Next.js resolves these internally via its compiler; they are NOT installed as
 * resolvable node packages, so raw vitest's node resolver throws
 * "Cannot find package 'server-only'" the moment a test's module graph reaches a
 * file with `import 'server-only'` (e.g. lib/payment/processWebhook.ts, pulled in
 * transitively via domain barrels after the Issue 092b reach-in→barrel sweep).
 *
 * These markers have zero runtime behavior — at runtime the real modules export
 * nothing. Aliasing them to this empty module lets the graph load under vitest
 * without changing any behavior under test.
 */
export {};
