/**
 * VND currency formatter — single source of truth for Vietnamese Dong display.
 *
 * Was copy-pasted as a local `formatPrice` in 3 customer pages (search results,
 * trip detail, routes browser). Extracted here so every price reads identically
 * and the home-page "Từ …" teaser reuses the exact same formatting.
 *
 * Pure + client-safe (no server-only / pg / prisma deps) — the `lib/format`
 * barrel may therefore be imported by `'use client'` components without leaking
 * a server graph into the browser bundle (Issue 092b barrel-leak class).
 */

/** Format an integer VND amount, e.g. 250000 → "250.000 ₫". */
export function formatVnd(v: number): string {
  return v.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
}
