"use client"

import { useSyncExternalStore } from "react"

/**
 * SSR-safe `prefers-reduced-motion` subscription. Returns boolean.
 *
 * Used by chart components to disable Recharts entrance animations and by any
 * other client-only animation surface that needs to honour the OS preference
 * (motion-direction-spec.md global rule).
 */
function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
  mq.addEventListener("change", callback)
  return () => mq.removeEventListener("change", callback)
}

function getSnapshot(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function getServerSnapshot(): boolean {
  return false
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
