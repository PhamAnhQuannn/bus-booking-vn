/**
 * Hold timer store — drives the countdown UI for the bb_hold expiry.
 *
 * Derived from expiresAt (ISO timestamp).
 *
 * Fields:
 *   remainingMs  — milliseconds until expiry (0 when expired)
 *   isWarning    — true when remainingMs <= 2 minutes (T-2min)
 *   isExpired    — true when remainingMs <= 0
 *
 * Usage:
 *   1. Call startTimer(expiresAt) once when the hold is created.
 *   2. The store ticks every second via setInterval.
 *   3. Call stopTimer() on unmount or clearBooking.
 */

import { create } from 'zustand';

const WARNING_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

export interface HoldTimerState {
  remainingMs: number;
  isWarning: boolean;
  isExpired: boolean;
  expiresAtMs: number | null;

  /** Start (or restart) the countdown from the given ISO expiry timestamp. */
  startTimer: (expiresAtISO: string) => void;

  /** Stop the interval (call on unmount). */
  stopTimer: () => void;

  /** Internal: update remaining time. */
  _tick: () => void;
}

let _intervalId: ReturnType<typeof setInterval> | null = null;

export const useHoldTimerStore = create<HoldTimerState>((set, get) => ({
  remainingMs: 0,
  isWarning: false,
  isExpired: true, // default expired until started
  expiresAtMs: null,

  startTimer: (expiresAtISO: string) => {
    // Clear any existing interval
    if (_intervalId !== null) {
      clearInterval(_intervalId);
      _intervalId = null;
    }

    const expiresAtMs = new Date(expiresAtISO).getTime();
    const initialRemaining = Math.max(0, expiresAtMs - Date.now());

    set({
      expiresAtMs,
      remainingMs: initialRemaining,
      isWarning: initialRemaining > 0 && initialRemaining <= WARNING_THRESHOLD_MS,
      isExpired: initialRemaining <= 0,
    });

    if (initialRemaining > 0) {
      _intervalId = setInterval(() => {
        get()._tick();
      }, 1000);
    }
  },

  stopTimer: () => {
    if (_intervalId !== null) {
      clearInterval(_intervalId);
      _intervalId = null;
    }
  },

  _tick: () => {
    const { expiresAtMs } = get();
    // Compute remaining from wall-clock to avoid drift
    const remainingMs = expiresAtMs !== null ? Math.max(0, expiresAtMs - Date.now()) : 0;

    if (remainingMs <= 0) {
      if (_intervalId !== null) {
        clearInterval(_intervalId);
        _intervalId = null;
      }
      set({ remainingMs: 0, isWarning: false, isExpired: true });
      return;
    }

    set({
      remainingMs,
      isWarning: remainingMs > 0 && remainingMs <= WARNING_THRESHOLD_MS,
      isExpired: false,
    });
  },
}));
