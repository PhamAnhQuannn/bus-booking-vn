/**
 * [SYS20] lib/core/http — HTTP edge primitive (placeholder).
 *
 * Will hold cross-cutting request-edge helpers: rate-limit, CSRF double-submit, and
 * webhook-HMAC verification (currently scattered across lib/ratelimit, lib/security, lib/api).
 * Imported BY domains; imports NO domain. Real primitives migrate here in a later wave —
 * empty barrel for now.
 */

export { clientIp } from './clientIp';
